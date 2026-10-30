import { AVATAR_FRAMES, levelForXP, frameBySlug, resolveAvatarFrame } from '../../shared/achievementFrames.mjs';

const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });
export function avatarFrames(pool) {
  const select = `SELECT u.id AS user_id, COALESCE(x.total_xp, 0) AS total_xp,
    COALESCE(f.frame_slug, 'automatic') AS selected_slug
    FROM users u LEFT JOIN user_xp x ON x.user_id=u.id
    LEFT JOIN user_avatar_frames f ON f.user_id=u.id WHERE u.status='active'`;
  function present(row) {
    const level = levelForXP(row.total_xp);
    return { user_id: row.user_id, level, selected_slug: row.selected_slug,
      frame_slug: resolveAvatarFrame(row.selected_slug, level).slug };
  }
  async function profile(query, userId, lock = false) {
    const row = (await query(`${select} AND u.id=$1 ${lock ? 'FOR UPDATE OF u' : ''}`, [userId])).rows[0];
    if (!row) throw fail(404, 'Perfil indisponível');
    return { ...present(row), total_xp: Number(row.total_xp),
      frames: AVATAR_FRAMES.map(frame => ({ ...frame, unlocked: frame.level <= levelForXP(row.total_xp) })) };
  }
  async function get(userId) { return profile(pool.query.bind(pool), userId); }
  async function list() { return (await pool.query(select)).rows.map(present); }
  async function set(userId, payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      Object.keys(payload).some(key => key !== 'frame_slug') || !frameBySlug(payload.frame_slug)) {
      throw fail(400, 'Selecione uma borda válida');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const current = await profile(client.query.bind(client), userId, true);
      if (frameBySlug(payload.frame_slug).level > current.level) throw fail(403, 'Conquiste o nível necessário para usar esta borda');
      await client.query(`INSERT INTO user_avatar_frames(user_id,frame_slug) VALUES($1,$2)
        ON CONFLICT(user_id) DO UPDATE SET frame_slug=excluded.frame_slug, updated_at=now()`, [userId, payload.frame_slug]);
      const result = await profile(client.query.bind(client), userId);
      await client.query('COMMIT');
      return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  return { get, list, set };
}
