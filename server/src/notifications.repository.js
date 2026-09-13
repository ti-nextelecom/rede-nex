import { query } from './db.js';

export async function notifyUsers({ actorId = null, actorName = null, actorPhotoUrl = null, title, message, type = 'info', link = null, userIds = null }) {
  let recipients = userIds;
  if (!recipients) {
    const { rows } = await query(
      `
        select id
        from users
        where status = 'active'
          and ($1::uuid is null or id <> $1)
      `,
      [actorId]
    );
    recipients = rows.map(row => row.id);
  }
  if (!recipients.length) return [];

  const { rows } = await query(
    `
      insert into notifications (user_id, title, message, type, link, actor_name, actor_photo_url)
      select user_id, $2, $3, $4, $5, $6, $7
      from unnest($1::uuid[]) as user_id
      returning *
    `,
    [recipients, title, message ?? null, type, link, actorName ?? null, actorPhotoUrl ?? null]
  );
  return rows;
}

export async function notifyAdmins({ actorId = null, actorName = null, actorPhotoUrl = null, title, message, type = 'info', link = null }) {
  const { rows } = await query(
    `
      select u.id
      from users u
      join roles r on r.id = u.role_id
      where u.status = 'active'
        and r.name = 'Administrador'
        and ($1::uuid is null or u.id <> $1)
    `,
    [actorId]
  );
  return notifyUsers({ actorId, actorName, actorPhotoUrl, title, message, type, link, userIds: rows.map(row => row.id) });
}

export async function listNotifications(userId) {
  const { rows } = await query(
    `
      select id, title, message, type, read, read_at, link, actor_name, actor_photo_url, created_at
      from notifications
      where user_id = $1
      order by created_at desc
      limit 50
    `,
    [userId]
  );
  return rows;
}

export async function markNotificationRead(userId, id) {
  const { rows } = await query(
    `
      update notifications
      set read = true,
          read_at = coalesce(read_at, now())
      where id = $1 and user_id = $2
      returning *
    `,
    [id, userId]
  );
  return rows[0] ?? null;
}

export async function markAllNotificationsRead(userId) {
  await query('update notifications set read = true, read_at = coalesce(read_at, now()) where user_id = $1 and read = false', [userId]);
  return listNotifications(userId);
}
