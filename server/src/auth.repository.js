import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { query } from './db.js';

const scrypt = promisify(scryptCallback);
const SESSION_DAYS = 7;

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password, passwordHash) {
  if (!passwordHash?.startsWith('scrypt:')) return false;
  const [, salt, stored] = passwordHash.split(':');
  const derived = await scrypt(password, salt, 64);
  const storedBuffer = Buffer.from(stored, 'hex');
  return storedBuffer.length === derived.length && timingSafeEqual(storedBuffer, derived);
}

function publicUser(row) {
  if (!row) return null;
  const { password_hash: _passwordHash, token_hash: _tokenHash, chat_theme: _chatTheme, ...user } = row;
  return user;
}

export async function login({ email, password, userAgent, ipAddress }) {
  const { rows } = await query(
    `
      select
        u.*,
        r.name as role_name,
        d.name as department_name
      from users u
      left join roles r on r.id = u.role_id
      left join departments d on d.id = u.department_id
      where lower(u.email) = lower($1)
        and u.status = 'active'
      limit 1
    `,
    [email]
  );
  const user = rows[0];
  const valid = user && await verifyPassword(password, user.password_hash);
  if (!valid) {
    await logAudit({
      actorId: user?.id ?? null,
      action: 'LOGIN_FAILED',
      entityType: 'users',
      entityId: user?.id ?? null,
      metadata: { email },
      ipAddress,
      userAgent,
    }).catch(() => {});
    return null;
  }

  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await query(
    `
      insert into user_sessions (user_id, token_hash, user_agent, ip_address, expires_at)
      values ($1, $2, $3, $4, $5)
    `,
    [user.id, tokenHash, userAgent ?? null, ipAddress ?? null, expiresAt]
  );
  await query('update users set last_login_at = now(), last_seen_at = now() where id = $1', [user.id]);
  await logAudit({
    actorId: user.id,
    action: 'LOGIN',
    entityType: 'users',
    entityId: user.id,
    metadata: { email: user.email },
    ipAddress,
    userAgent,
  });

  return { token, user: publicUser(user) };
}

export async function getUserByToken(token) {
  if (!token) return null;
  const { rows } = await query(
    `
      update user_sessions s
      set last_seen_at = now()
      from users u
      left join roles r on r.id = u.role_id
      left join departments d on d.id = u.department_id
      where s.user_id = u.id
        and s.token_hash = $1
        and s.revoked_at is null
        and s.expires_at > now()
        and u.status = 'active'
      returning
        u.*,
        r.name as role_name,
        d.name as department_name,
        s.id as session_id,
        s.expires_at
    `,
    [hashToken(token)]
  );
  const user = rows[0];
  if (!user) return null;
  return publicUser(user);
}

export async function logout(token, actorId) {
  if (!token) return false;
  const { rows, rowCount } = await query(
    'update user_sessions set revoked_at = now() where token_hash = $1 and revoked_at is null returning user_id',
    [hashToken(token)]
  );
  if (rows[0]?.user_id) {
    await query(
      "update users set last_seen_at = now() - interval '10 minutes' where id = $1",
      [rows[0].user_id]
    );
  }
  if (actorId) {
    await logAudit({ actorId, action: 'LOGOUT', entityType: 'users', entityId: actorId });
  }
  return rowCount > 0;
}

export async function heartbeat(token) {
  if (!token) return null;
  const { rows } = await query(
    `
      update user_sessions s
      set last_seen_at = now()
      from users u
      where s.user_id = u.id
        and s.token_hash = $1
        and s.revoked_at is null
        and s.expires_at > now()
        and u.status = 'active'
      returning u.id
    `,
    [hashToken(token)]
  );
  const session = rows[0];
  if (!session) return null;
  await query('update users set last_seen_at = now() where id = $1', [session.id]);
  return { online: true, last_seen_at: new Date().toISOString(), user_id: session.id };
}

export async function changePassword(userId, currentPassword, nextPassword) {
  const { rows } = await query('select password_hash from users where id = $1 limit 1', [userId]);
  const user = rows[0];
  if (!user || !await verifyPassword(currentPassword, user.password_hash)) return false;
  const passwordHash = await hashPassword(nextPassword);
  await query(
    `
      update users
      set password_hash = $2,
          must_change_password = false,
          password_changed_at = now()
      where id = $1
    `,
    [userId, passwordHash]
  );
  await logAudit({ actorId: userId, action: 'CHANGE_PASSWORD', entityType: 'users', entityId: userId });
  return true;
}

export async function updateMyProfile(userId, input) {
  const { rows } = await query(
    `
      update users
      set
        name = coalesce(nullif($2, ''), name),
        email = coalesce(nullif(lower($3), ''), email),
        phone = nullif($4, ''),
        position = nullif($5, ''),
        bio = nullif($6, ''),
        google_ical_url = nullif($7, ''),
        photo_url = coalesce(nullif($8, ''), photo_url)
      where id = $1
      returning *
    `,
    [
      userId,
      input.name ?? null,
      input.email ?? null,
      input.phone ?? null,
      input.position ?? null,
      input.bio ?? null,
      input.google_ical_url ?? null,
      input.photo_url ?? null,
    ]
  );

  await logAudit({
    actorId: userId,
    action: 'UPDATE_PROFILE',
    entityType: 'users',
    entityId: userId,
    newData: {
      name: rows[0]?.name,
      email: rows[0]?.email,
      phone: rows[0]?.phone,
      position: rows[0]?.position,
      bio: rows[0]?.bio,
      google_ical_url: rows[0]?.google_ical_url ? '[set]' : null,
    },
  });

  const refreshed = await query(
    `
      select
        u.*,
        r.name as role_name,
        d.name as department_name
      from users u
      left join roles r on r.id = u.role_id
      left join departments d on d.id = u.department_id
      where u.id = $1
      limit 1
    `,
    [userId]
  );
  return publicUser(refreshed.rows[0]);
}

export async function logAudit({ actorId = null, action, entityType, entityId = null, oldData = null, newData = null, metadata = null, ipAddress = null, userAgent = null }) {
  await query(
    `
      insert into audit_logs (actor_id, action, entity_type, entity_id, old_data, new_data, metadata, ip_address, user_agent)
      values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9)
    `,
    [
      actorId,
      action,
      entityType,
      entityId,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
      metadata ? JSON.stringify(metadata) : null,
      ipAddress,
      userAgent,
    ]
  );
}

export async function listOnlineUsers() {
  const { rows } = await query(
    `
      select
        u.id,
        u.name,
        u.email,
        u.photo_url,
        u.position,
        u.last_seen_at,
        case
          when u.last_seen_at >= now() - interval '2 minutes' then true
          else false
        end as online,
        case
          when u.last_seen_at is null then null
          else extract(epoch from (now() - u.last_seen_at))::int
        end as seconds_since_seen
      from users u
      where u.status = 'active'
      order by online desc, u.last_seen_at desc nulls last, u.name
    `
  );
  return rows;
}

export async function createPasswordResetToken(email) {
  const { rows } = await query(
    "SELECT id, name, email FROM users WHERE lower(email) = lower($1) AND status = 'active' LIMIT 1",
    [email]
  );
  const user = rows[0];
  if (!user) return null;

  await query('UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [user.id]);

  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await query(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [user.id, tokenHash, expiresAt]
  );
  await logAudit({ actorId: user.id, action: 'FORGOT_PASSWORD', entityType: 'users', entityId: user.id, metadata: { email } });
  return { token, user };
}

export async function resetPasswordByToken(token, newPassword) {
  const tokenHash = hashToken(token);
  const { rows } = await query(
    `SELECT prt.id, prt.user_id
     FROM password_reset_tokens prt
     JOIN users u ON u.id = prt.user_id
     WHERE prt.token_hash = $1
       AND prt.expires_at > now()
       AND prt.used_at IS NULL
       AND u.status = 'active'
     LIMIT 1`,
    [tokenHash]
  );
  const record = rows[0];
  if (!record) return false;

  const passwordHash = await hashPassword(newPassword);
  await query('UPDATE users SET password_hash = $2, must_change_password = false, password_changed_at = now() WHERE id = $1', [record.user_id, passwordHash]);
  await query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [record.id]);
  await query('UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [record.user_id]);
  await logAudit({ actorId: record.user_id, action: 'RESET_PASSWORD', entityType: 'users', entityId: record.user_id });
  return true;
}
