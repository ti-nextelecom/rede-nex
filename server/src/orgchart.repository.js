import { pool } from './db.js';

export async function getOrgChart() {
  const { rows } = await pool.query(`
    WITH org_ids AS (
      SELECT id FROM departments WHERE parent_id IS NOT NULL
      UNION
      SELECT parent_id FROM departments WHERE parent_id IS NOT NULL
    )
    SELECT
      d.id,
      d.name,
      d.parent_id,
      u.name        AS manager_name,
      u.photo_url   AS manager_photo,
      u.position    AS manager_position,
      (SELECT COUNT(*)::int FROM users WHERE department_id = d.id AND status = 'active') AS user_count
    FROM departments d
    JOIN org_ids ON d.id = org_ids.id
    LEFT JOIN users u ON u.id = d.manager_id
    ORDER BY d.name
  `);

  const map = Object.fromEntries(rows.map(r => [r.id, { ...r, children: [] }]));
  const roots = [];
  for (const r of rows) {
    if (r.parent_id && map[r.parent_id]) map[r.parent_id].children.push(map[r.id]);
    else if (!r.parent_id) roots.push(map[r.id]);
  }

  const sort = nodes => {
    nodes.sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    nodes.forEach(n => sort(n.children));
    return nodes;
  };

  return sort(roots);
}
