import { query } from './db.js';
import { notifyUsers } from './notifications.repository.js';
import { attachChatReactions } from './chat-reactions.mjs';
import { insertChatMessage } from './chat-message-insert.mjs';
import { buildChatNotices } from '../../shared/chatMessageLinks.mjs';
import { chatMessageEditParts } from '../../shared/chatMessageEdit.mjs';

function cleanText(value, maxLength) {
  const text = String(value ?? '').replace(/\u0000/g, '').trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

const conversationSelect = `
  select
    c.id,
    case
      when c.type = 'direct' then coalesce((
        select u.name
        from chat_participants cp
        join users u on u.id = cp.user_id
        where cp.conversation_id = c.id
          and cp.user_id <> $1
        order by u.name
        limit 1
      ), 'Conversa direta')
      else c.name
    end as name,
    c.type,
    c.description,
    c.avatar_url,
    c.created_by,
    c.created_at,
    c.updated_at,
    coalesce(c.broadcast_mode, false) as broadcast_mode,
    current_member.role as my_role,
    coalesce(current_member.is_muted, false) as is_muted,
    coalesce(current_member.is_pinned, false) as is_pinned,
    exists(select 1 from chat_conversation_archives ca where ca.user_id=$1 and ca.conversation_id=c.id) as is_archived,
    coalesce((
      select count(*)::int
      from chat_participants cp
      where cp.conversation_id = c.id
    ), 0) as participant_count,
    (
      select json_build_object(
        'id', m.id,
        'content', m.content,
        'created_at', m.created_at,
        'recipient_count', (select count(*)::int from chat_participants p where p.conversation_id=m.conversation_id and p.user_id<>m.sender_id),
        'read_count', (select count(*)::int from chat_participants p where p.conversation_id=m.conversation_id and p.user_id<>m.sender_id and p.last_read_at>=m.created_at),
        'sender', json_build_object('id', u.id, 'name', u.name, 'photo_url', u.photo_url)
      )
      from chat_messages m
      left join users u on u.id = m.sender_id
      where m.conversation_id = c.id and m.is_deleted = false
      order by m.created_at desc
      limit 1
    ) as last_message,
    coalesce((
      select count(*)::int
      from chat_messages m
      join chat_participants cp on cp.conversation_id = m.conversation_id
      where m.conversation_id = c.id
        and cp.user_id = $1
        and m.sender_id <> $1
        and (cp.last_read_at is null or m.created_at > cp.last_read_at)
    ), 0) as unread_count,
    case
      when c.type = 'direct' then (
        select json_build_object(
          'id', u.id,
          'name', u.name,
          'photo_url', u.photo_url,
          'last_seen_at', u.last_seen_at,
          'online', (u.last_seen_at >= now() - interval '2 minutes'),
          'last_read_at', cp_other.last_read_at
        )
        from chat_participants cp_other
        join users u on u.id = cp_other.user_id
        where cp_other.conversation_id = c.id and cp_other.user_id <> $1
        limit 1
      )
      else null
    end as other_participant,
    case
      when c.pinned_message_id is null then null
      else (
        select json_build_object(
          'id', pm.id,
          'content', pm.content,
          'sender', json_build_object('id', pu.id, 'name', pu.name)
        )
        from chat_messages pm
        left join users pu on pu.id = pm.sender_id
        where pm.id = c.pinned_message_id limit 1
      )
    end as pinned_message
  from chat_conversations c
  join chat_participants current_member on current_member.conversation_id = c.id and current_member.user_id = $1
`;

export async function listConversations(userId) {
  const { rows } = await query(`${conversationSelect} order by coalesce(current_member.is_pinned,false) desc, c.updated_at desc`, [userId]);
  return rows;
}

export async function toggleMuteConversation(conversationId, userId) {
  const { rows } = await query(
    `UPDATE chat_participants
       SET is_muted = NOT is_muted
     WHERE conversation_id = $1 AND user_id = $2
     RETURNING is_muted`,
    [conversationId, userId]
  );
  return rows[0]?.is_muted ?? false;
}

export async function createConversation(userId, input) {
  const participantIds = Array.from(new Set([userId, ...(input.participant_ids || [])]));
  const type = input.type === 'direct' ? 'direct' : 'group';
  const name = cleanText(input.name, 120);
  if ((input.type || 'group') === 'direct' && participantIds.length === 2) {
    const existing = await query(
      `
        select c.id
        from chat_conversations c
        join chat_participants cp1 on cp1.conversation_id = c.id and cp1.user_id = $1
        join chat_participants cp2 on cp2.conversation_id = c.id and cp2.user_id = $2
        where c.type = 'direct'
          and (
            select count(*)::int
            from chat_participants cp
            where cp.conversation_id = c.id
          ) = 2
        limit 1
      `,
      [participantIds[0], participantIds[1]]
    );
    if (existing.rows[0]) {
      return (await listConversations(userId)).find(item => item.id === existing.rows[0].id);
    }
  }

  const { rows } = await query(
    `
      insert into chat_conversations (name, type, description, created_by)
      values ($1, $2, $3, $4)
      returning *
    `,
    [
      type === 'direct' ? null : name,
      type,
      cleanText(input.description, 500) || null,
      userId,
    ]
  );
  const conversation = rows[0];

  await query(
    `
      insert into chat_participants (conversation_id, user_id, role)
      select $1, participant_id, case when participant_id = $2 then 'owner' else 'member' end
      from unnest($3::uuid[]) as participant_id
      on conflict (conversation_id, user_id) do nothing
    `,
    [conversation.id, userId, participantIds]
  );

  return (await listConversations(userId)).find(item => item.id === conversation.id);
}

const MSG_PAGE_SIZE = 50;

export async function listMessages(userId, conversationId, { beforeId = null } = {}) {
  const access = await query(
    'select 1 from chat_participants where conversation_id = $1 and user_id = $2 limit 1',
    [conversationId, userId]
  );
  if (!access.rows[0]) return null;

  if (!beforeId) {
    await query(
      'update chat_participants set last_read_at = now() where conversation_id = $1 and user_id = $2',
      [conversationId, userId]
    );
  }

  const params = [conversationId];
  let cursorClause = '';
  if (beforeId) {
    params.push(beforeId);
    cursorClause = `and m.created_at < (select created_at from chat_messages where id = $${params.length} limit 1)`;
  }
  params.push(MSG_PAGE_SIZE);

  const { rows } = await query(
    `
      select
        m.id,
        m.conversation_id,
        m.sender_id,
        m.content,
        m.attachment_url,
        m.created_at,
        m.updated_at,
        m.edited_at,
        m.is_deleted,
        m.reply_to_id,
        case
          when m.reply_to_id is null then null
          else (
            select json_build_object(
              'id', r.id, 'content', r.content,
              'sender', json_build_object('id', ru.id, 'name', ru.name)
            )
            from chat_messages r
            left join users ru on ru.id = r.sender_id
            where r.id = m.reply_to_id limit 1
          )
        end as reply_to,
        case
          when u.id is null then null
          else json_build_object('id', u.id, 'name', u.name, 'photo_url', u.photo_url, 'position', u.position)
        end as sender
      from chat_messages m
      left join users u on u.id = m.sender_id
      where m.conversation_id = $1 ${cursorClause}
      order by m.created_at desc
      limit $${params.length}
    `,
    params
  );

  const messages = rows.reverse();
  return { messages: await attachChatReactions(query,messages,userId), has_more: rows.length >= MSG_PAGE_SIZE };
}

export async function sendMessage(userId, conversationId, content, attachmentUrl = null, replyToId = null, clientMessageId = null) {
  const isMedia = typeof content === 'string' && /^\[(?:IMAGE|VIDEO|AUDIO_MSG|AUDIO|DOC(?:\|[^\]]*)?|FILE)\]/.test(content);
  const cleanContent = isMedia
    ? String(content ?? '').replace(/\u0000/g, '').trim()
    : cleanText(content, 8000);
  if (!cleanContent && !attachmentUrl) return null;

  const participants = await query(
    `
      select cp.user_id, cp.role, c.broadcast_mode, u.name, u.photo_url
      from chat_participants cp
      join chat_conversations c on c.id = cp.conversation_id
      join users u on u.id = cp.user_id
      where cp.conversation_id = $1
    `,
    [conversationId]
  );

  const mine = participants.rows.find(row => row.user_id === userId);
  if (!mine) return null;

  if (mine.broadcast_mode && !['owner', 'admin'].includes(mine.role)) {
    const err = new Error('Grupo informativo: apenas administradores podem enviar mensagens');
    err.statusCode = 403;
    err.code = 'BROADCAST_RESTRICTED';
    throw err;
  }

  const inserted = await insertChatMessage(query, { userId, conversationId, content: cleanContent || '', attachmentUrl, replyToId, clientMessageId });
  const rows = [inserted.message];
  const { rows: msgRows } = await query(
    `select m.*, json_build_object('id', u.id, 'name', u.name, 'photo_url', u.photo_url, 'position', u.position) as sender
     from chat_messages m left join users u on u.id = m.sender_id where m.id = $1`,
    [rows[0].id]
  );
  const result = msgRows[0] ?? null;
  if (result) Object.defineProperty(result,'replayed',{value:!inserted.inserted,enumerable:false});
  if (inserted.inserted) {
    const notices = buildChatNotices({ participants: participants.rows, actorId: userId, conversationId, message: result ?? rows[0] });
    (async () => {
      for (const notice of notices) {
        await notifyUsers(notice);
      }
    })().catch(() => {});
  }
  return result;
}

export async function editMessage(userId, messageId, newContent) {
  const cleanContent = String(newContent ?? '').replace(/\u0000/g, '').trim();
  if (chatMessageEditParts(cleanContent).text.length > 8000) {
    const error = new Error('A mensagem pode ter até 8.000 caracteres.');
    error.statusCode = 400;
    throw error;
  }
  if (!cleanContent) return null;

  const existing = await query(
    'select id, sender_id, content, conversation_id, created_at from chat_messages where id = $1',
    [messageId]
  );
  if (!existing.rows[0] || existing.rows[0].sender_id !== userId) return null;

  const ageMs = Date.now() - new Date(existing.rows[0].created_at).getTime();
  if (ageMs > 30 * 60 * 1000) {
    const err = new Error('Prazo de edição encerrado (máximo 30 minutos)');
    err.statusCode = 403;
    err.code = 'EDIT_EXPIRED';
    throw err;
  }

  await query(
    'insert into chat_message_edits (message_id, content, edited_at) values ($1, $2, now())',
    [messageId, existing.rows[0].content]
  );

  const { rows } = await query(
    `update chat_messages set content = $1, edited_at = now() where id = $2 returning *`,
    [cleanContent, messageId]
  );

  return rows[0] || null;
}

export async function getMessageEditHistory(userId, messageId) {
  const access = await query(
    `select m.id from chat_messages m
     join chat_participants cp on cp.conversation_id = m.conversation_id and cp.user_id = $1
     where m.id = $2 limit 1`,
    [userId, messageId]
  );
  if (!access.rows[0]) return null;

  const { rows } = await query(
    'select content, edited_at from chat_message_edits where message_id = $1 order by edited_at asc',
    [messageId]
  );
  return rows;
}

export async function listGroupParticipants(conversationId) {
  const { rows } = await query(
    `select cp.user_id as id, cp.role, u.name, u.photo_url, u.position,
            (u.last_seen_at >= now() - interval '5 minutes') as online
     from chat_participants cp
     join users u on u.id = cp.user_id
     where cp.conversation_id = $1
       and u.status = 'active'
     order by
       case cp.role when 'owner' then 0 when 'admin' then 1 else 2 end,
       u.name`,
    [conversationId]
  );
  return rows;
}

export async function updateConversation(userId, conversationId, input) {
  const access = await query(
    `select role from chat_participants where conversation_id = $1 and user_id = $2`,
    [conversationId, userId]
  );
  if (!access.rows[0] || !['owner', 'admin'].includes(access.rows[0].role)) return null;

  const fields = [];
  const values = [];
  let idx = 1;
  if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(cleanText(input.name, 120) || null); }
  if (input.description !== undefined) { fields.push(`description = $${idx++}`); values.push(cleanText(input.description, 500) || null); }
  if (input.broadcast_mode !== undefined) { fields.push(`broadcast_mode = $${idx++}`); values.push(!!input.broadcast_mode); }

  if (fields.length) {
    values.push(conversationId);
    await query(
      `update chat_conversations set ${fields.join(', ')}, updated_at = now() where id = $${idx}`,
      values
    );
  }

  const convs = await listConversations(userId);
  return convs.find(c => c.id === conversationId) || null;
}

export async function updateParticipantRole(userId, conversationId, targetUserId, role) {
  const VALID_ROLES = ['admin', 'member'];
  if (!VALID_ROLES.includes(role)) return null;

  const access = await query(
    `select role from chat_participants where conversation_id = $1 and user_id = $2`,
    [conversationId, userId]
  );
  if (!access.rows[0] || access.rows[0].role !== 'owner') return null;

  await query(
    `update chat_participants set role = $1 where conversation_id = $2 and user_id = $3`,
    [role, conversationId, targetUserId]
  );
  return listGroupParticipants(conversationId);
}

export async function removeParticipant(userId, conversationId, targetUserId) {
  if (userId !== targetUserId) {
    const access = await query(
      `select role from chat_participants where conversation_id = $1 and user_id = $2`,
      [conversationId, userId]
    );
    if (!access.rows[0] || !['owner', 'admin'].includes(access.rows[0].role)) return false;
  }
  await query(
    `delete from chat_participants where conversation_id = $1 and user_id = $2`,
    [conversationId, targetUserId]
  );
  return true;
}

export async function addParticipants(userId, conversationId, participantIds) {
  const owner = await query(
    `
      select 1
      from chat_participants
      where conversation_id = $1 and user_id = $2 and role in ('owner', 'admin')
      limit 1
    `,
    [conversationId, userId]
  );
  if (!owner.rows[0]) return null;

  await query(
    `
      insert into chat_participants (conversation_id, user_id)
      select $1, participant_id
      from unnest($2::uuid[]) as participant_id
      on conflict (conversation_id, user_id) do nothing
    `,
    [conversationId, participantIds]
  );
  return listConversations(userId);
}

export async function deleteMessage(userId, messageId) {
  const existing = await query(
    'select id, sender_id, created_at from chat_messages where id = $1',
    [messageId]
  );
  if (!existing.rows[0] || existing.rows[0].sender_id !== userId) return false;
  const ageMs = Date.now() - new Date(existing.rows[0].created_at).getTime();
  if (ageMs > 30 * 60 * 1000) return false;
  await query("UPDATE chat_messages SET is_deleted = true, content = 'Mensagem apagada', updated_at = now() WHERE id = $1", [messageId]);
  return true;
}

export async function pinConversation(userId, conversationId) {
  const { rows } = await query(
    `update chat_participants set is_pinned = not coalesce(is_pinned, false)
     where conversation_id = $1 and user_id = $2
     returning is_pinned`,
    [conversationId, userId]
  );
  return rows[0]?.is_pinned ?? false;
}

export async function pinMessage(userId, conversationId, messageId) {
  const member = await query(
    'select role from chat_participants where conversation_id = $1 and user_id = $2',
    [conversationId, userId]
  );
  if (!member.rows[0]) return null;
  await query(
    'update chat_conversations set pinned_message_id = $1 where id = $2',
    [messageId || null, conversationId]
  );
  const convs = await listConversations(userId);
  return convs.find(c => c.id === conversationId) || null;
}

export async function getNotes(userId, conversationId) {
  const { rows } = await query(
    'select content, updated_at from chat_notes where user_id = $1 and conversation_id = $2',
    [userId, conversationId]
  );
  return rows[0] ?? { content: '' };
}

export async function saveNotes(userId, conversationId, content) {
  const clean = String(content ?? '').slice(0, 10000);
  const { rows } = await query(
    `insert into chat_notes (user_id, conversation_id, content, updated_at)
     values ($1, $2, $3, now())
     on conflict (user_id, conversation_id)
     do update set content = excluded.content, updated_at = now()
     returning content, updated_at`,
    [userId, conversationId, clean]
  );
  return rows[0];
}

export async function getOrCreateSelfConversation(userId) {
  const existing = await query(
    `select c.id
     from chat_conversations c
     join chat_participants cp on cp.conversation_id = c.id and cp.user_id = $1
     where c.type = 'direct'
       and (select count(*) from chat_participants cp2 where cp2.conversation_id = c.id) = 1
     limit 1`,
    [userId]
  );
  if (existing.rows[0]) {
    const convs = await listConversations(userId);
    return convs.find(c => c.id === existing.rows[0].id) || null;
  }
  const { rows } = await query(
    `insert into chat_conversations (type, created_by) values ('direct', $1) returning *`,
    [userId]
  );
  const conversation = rows[0];
  await query(
    `insert into chat_participants (conversation_id, user_id, role) values ($1, $2, 'owner')`,
    [conversation.id, userId]
  );
  const convs = await listConversations(userId);
  return convs.find(c => c.id === conversation.id) || null;
}

