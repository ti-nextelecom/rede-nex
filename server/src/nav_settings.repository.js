import { query } from './db.js';

export async function getAllNavSettings() {
  const { rows } = await query('SELECT role_name, visible_routes FROM nav_settings ORDER BY role_name');
  const result = {};
  for (const row of rows) {
    result[row.role_name] = row.visible_routes ?? null;
  }
  return result;
}

export async function upsertNavSettings(roleName, visibleRoutes) {
  const { rows } = await query(
    `INSERT INTO nav_settings (role_name, visible_routes, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (role_name)
     DO UPDATE SET visible_routes = $2::jsonb, updated_at = now()
     RETURNING role_name, visible_routes`,
    [roleName, visibleRoutes !== null ? JSON.stringify(visibleRoutes) : null]
  );
  return rows[0];
}

export async function deleteNavSettings(roleName) {
  await query('DELETE FROM nav_settings WHERE role_name = $1', [roleName]);
}
