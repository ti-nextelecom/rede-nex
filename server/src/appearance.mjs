import { parseAppearance, legacyAppearance } from '../../shared/appearance.mjs';
const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });
export function userAppearance(pool) {
  async function get(userId) {
    const row = (await pool.query(`SELECT p.user_id,p.mode,p.accent_color,p.surface_color,p.chat_background,p.chat_incoming,p.chat_outgoing,p.wallpaper,p.platform_wallpaper,
      to_jsonb(u)->'chat_theme' AS legacy_theme FROM users u LEFT JOIN user_appearance_preferences p ON p.user_id=u.id
      WHERE u.id=$1 AND u.status='active'`, [userId])).rows[0];
    if (!row) throw fail(404, 'Perfil indisponível');
    if (!row.user_id) return legacyAppearance(row.legacy_theme);
    return parseAppearance({ version: 1, mode: row.mode, accent: row.accent_color, surface: row.surface_color,
      chatBackground: row.chat_background, chatIncoming: row.chat_incoming, chatOutgoing: row.chat_outgoing, wallpaper: row.wallpaper, platformWallpaper: row.platform_wallpaper });
  }
  async function set(userId, input) {
    let settings;
    try { settings = parseAppearance(input); } catch (error) { throw fail(400, error.message); }
    const { rows } = await pool.query(`INSERT INTO user_appearance_preferences(user_id,mode,accent_color,surface_color,chat_background,chat_incoming,chat_outgoing,wallpaper,platform_wallpaper)
      SELECT u.id,$2,$3,$4,$5,$6,$7,$8,$9 FROM users u WHERE u.id=$1 AND u.status='active'
      ON CONFLICT(user_id) DO UPDATE SET mode=excluded.mode,accent_color=excluded.accent_color,surface_color=excluded.surface_color,
        chat_background=excluded.chat_background,chat_incoming=excluded.chat_incoming,chat_outgoing=excluded.chat_outgoing,wallpaper=excluded.wallpaper,platform_wallpaper=excluded.platform_wallpaper,updated_at=now()
      RETURNING user_id`, [userId, settings.mode, settings.accent, settings.surface, settings.chatBackground, settings.chatIncoming, settings.chatOutgoing, settings.wallpaper, settings.platformWallpaper]);
    if (!rows.length) throw fail(404, 'Perfil indisponível');
    return settings;
  }
  return { get, set };
}
