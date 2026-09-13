import { query } from './db.js';
import { cleanText } from './db_utils.js';

const wbSelect = `
  select
    w.id, w.title, w.thumbnail_url, w.created_at, w.updated_at,
    json_build_object('id', u.id, 'name', u.name, 'photo_url', u.photo_url) as creator,
    coalesce((
      select json_agg(json_build_object('id', u2.id, 'name', u2.name, 'photo_url', u2.photo_url))
      from whiteboard_participants p join users u2 on u2.id = p.user_id
      where p.whiteboard_id = w.id
    ), '[]') as participants
  from whiteboards w left join users u on u.id = w.created_by
`;

export async function listWhiteboards(userId) {
  const { rows } = await query(
    `${wbSelect}
     where w.created_by=$1 or exists (select 1 from whiteboard_participants p where p.whiteboard_id=w.id and p.user_id=$1)
     order by w.updated_at desc`,
    [userId]
  );
  return rows;
}

export async function getWhiteboard(id, includeData = false) {
  const sel = includeData
    ? `select w.*,
         json_build_object('id', u.id, 'name', u.name, 'photo_url', u.photo_url) as creator,
         coalesce((
           select json_agg(json_build_object('id', u2.id, 'name', u2.name, 'photo_url', u2.photo_url))
           from whiteboard_participants p join users u2 on u2.id = p.user_id
           where p.whiteboard_id = w.id
         ), '[]') as participants
       from whiteboards w left join users u on u.id = w.created_by where w.id=$1`
    : `${wbSelect} where w.id=$1`;
  const { rows } = await query(sel, [id]);
  return rows[0] || null;
}

export async function createWhiteboard(userId, input) {
  const { rows } = await query(
    'insert into whiteboards (title, created_by) values ($1,$2) returning id',
    [cleanText(input.title, 500), userId]
  );
  const id = rows[0].id;
  const participants = [...new Set([userId, ...(input.participant_ids || [])])];
  await query(
    `insert into whiteboard_participants (whiteboard_id, user_id)
     select $1, uid from unnest($2::uuid[]) as uid on conflict do nothing`,
    [id, participants]
  );
  return getWhiteboard(id);
}

export async function updateWhiteboard(id, input) {
  const fields = [], values = [];
  let i = 1;
  if (input.title !== undefined)         { fields.push(`title=$${i++}`);         values.push(cleanText(input.title, 500)); }
  if (input.data !== undefined)          { fields.push(`data=$${i++}`);           values.push(JSON.stringify(input.data)); }
  if (input.thumbnail_url !== undefined) { fields.push(`thumbnail_url=$${i++}`); values.push(input.thumbnail_url || null); }
  if (!fields.length) return true;
  fields.push('updated_at=now()');
  values.push(id);
  await query(`update whiteboards set ${fields.join(',')} where id=$${i}`, values);
  return true;
}

export async function deleteWhiteboard(id) {
  await query('delete from whiteboards where id=$1', [id]);
  return true;
}
