import { query } from './db.js';

const LIST_SELECT = `
  SELECT
    s.id, s.user_id, s.content, s.image_url, s.video_url,
    s.expires_at, s.created_at,
    json_build_object(
      'id', u.id,
      'name', u.name,
      'photo_url', u.photo_url,
      'department_name', d.name
    ) AS users,
    COUNT(DISTINCT sv.user_id)::int AS view_count,
    BOOL_OR(sv2.user_id IS NOT NULL) AS viewed_by_me
  FROM stories s
  JOIN users u ON u.id = s.user_id
  LEFT JOIN departments d ON d.id = u.department_id
  LEFT JOIN story_views sv ON sv.story_id = s.id
  LEFT JOIN story_views sv2 ON sv2.story_id = s.id AND sv2.user_id = $1
  WHERE s.expires_at > NOW()
  GROUP BY s.id, u.id, d.name
  ORDER BY s.created_at DESC
  LIMIT 200`;

const SINGLE_SELECT = `
  SELECT
    s.id, s.user_id, s.content, s.image_url, s.video_url,
    s.expires_at, s.created_at,
    json_build_object(
      'id', u.id,
      'name', u.name,
      'photo_url', u.photo_url,
      'department_name', d.name
    ) AS users,
    COUNT(DISTINCT sv.user_id)::int AS view_count,
    BOOL_OR(sv2.user_id IS NOT NULL) AS viewed_by_me
  FROM stories s
  JOIN users u ON u.id = s.user_id
  LEFT JOIN departments d ON d.id = u.department_id
  LEFT JOIN story_views sv ON sv.story_id = s.id
  LEFT JOIN story_views sv2 ON sv2.story_id = s.id AND sv2.user_id = $1
  WHERE s.id = $2
  GROUP BY s.id, u.id, d.name`;

export async function listStories(requesterId) {
  const { rows } = await query(LIST_SELECT, [requesterId]);
  return rows;
}

export async function createStory(userId, { content, image_url, video_url }) {
  const ins = await query(
    `INSERT INTO stories (user_id, content, image_url, video_url)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [userId, content ?? null, image_url ?? null, video_url ?? null]
  );
  const { rows } = await query(SINGLE_SELECT, [userId, ins.rows[0].id]);
  return rows[0];
}

export async function recordStoryView(storyId, userId) {
  await query(
    `INSERT INTO story_views (story_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (story_id, user_id) DO NOTHING`,
    [storyId, userId]
  );
}

export async function listStoryViewers(storyId) {
  const { rows } = await query(
    `SELECT sv.user_id, sv.viewed_at, u.name, u.photo_url
     FROM story_views sv
     JOIN users u ON u.id = sv.user_id
     WHERE sv.story_id = $1
     ORDER BY sv.viewed_at DESC`,
    [storyId]
  );
  return rows;
}
