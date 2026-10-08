import { query } from './db.js';

export async function listCommunities() {
  const { rows } = await query(`
    SELECT c.*,
           COUNT(cm.id)::int AS member_count,
           u.name AS creator_name
    FROM communities c
    LEFT JOIN community_members cm ON cm.community_id = c.id
    LEFT JOIN users u ON u.id = c.created_by
    GROUP BY c.id, u.name
    ORDER BY c.name
  `);
  return rows;
}

export async function getCommunity(id) {
  const { rows } = await query('SELECT * FROM communities WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function createCommunity(data, userId) {
  const { name, description, icon, color } = data;
  const { rows } = await query(
    `INSERT INTO communities (id, name, description, icon, color, created_by, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING *`,
    [name, description || null, icon || 'Users', color || '#ff7a00', userId || null]
  );
  return rows[0];
}

export async function updateCommunity(id, data) {
  const { name, description, icon, color } = data;
  const { rows } = await query(
    `UPDATE communities
     SET name        = COALESCE($1, name),
         description = COALESCE($2, description),
         icon        = COALESCE($3, icon),
         color       = COALESCE($4, color),
         updated_at  = NOW()
     WHERE id = $5
     RETURNING *`,
    [name || null, description || null, icon || null, color || null, id]
  );
  return rows[0] || null;
}

export async function deleteCommunity(id) {
  await query('DELETE FROM community_members WHERE community_id = $1', [id]);
  await query('DELETE FROM communities WHERE id = $1', [id]);
}

export async function listCommunityMembers(communityId) {
  const { rows } = await query(
    `SELECT cm.id, cm.role, cm.created_at,
            u.id AS user_id, u.name, u.email, u.photo_url, u.position,
            d.name AS department
     FROM community_members cm
     JOIN users u ON u.id = cm.user_id
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE cm.community_id = $1
     ORDER BY u.name`,
    [communityId]
  );
  return rows;
}

export async function addCommunityMember(communityId, userId, role) {
  const existing = await query(
    'SELECT id FROM community_members WHERE community_id = $1 AND user_id = $2',
    [communityId, userId]
  );
  if (existing.rows.length > 0) {
    const { rows } = await query(
      'UPDATE community_members SET role = $1 WHERE community_id = $2 AND user_id = $3 RETURNING *',
      [role || 'member', communityId, userId]
    );
    return rows[0];
  }
  const { rows } = await query(
    `INSERT INTO community_members (id, community_id, user_id, role, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, NOW())
     RETURNING *`,
    [communityId, userId, role || 'member']
  );
  return rows[0];
}

export async function removeCommunityMember(communityId, userId) {
  await query(
    'DELETE FROM community_members WHERE community_id = $1 AND user_id = $2',
    [communityId, userId]
  );
}
