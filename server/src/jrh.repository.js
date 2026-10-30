import { query, pool } from './db.js';

function cleanText(value, maxLength) {
  const text = String(value ?? '').replace(/ /g, '').trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

const ALLOWED_REACTIONS = new Set(['like', 'love', 'celebrate', 'insightful']);

async function isHRUser(userId) {
  const { rows } = await query(`
    SELECT u.id FROM users u
    LEFT JOIN departments d ON d.id = u.department_id
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE u.id = $1
    AND (
      r.name = 'Administrador'
      OR lower(d.name) LIKE '%rh%'
      OR lower(d.name) LIKE '%recursos humanos%'
      OR lower(d.name) LIKE '%gente%'
    )
    LIMIT 1
  `, [userId]);
  return rows.length > 0;
}

const jrhPostSelect = `
  SELECT p.id, p.author_id, p.title, p.content, p.type, p.category, p.image_url, p.video_url,
    p.pinned, p.visibility, p.community_id, p.created_at, p.updated_at,
    p.period_start, p.expires_at,
    CASE WHEN u.id IS NULL THEN NULL
    ELSE json_build_object(
      'id', u.id, 'name', u.name, 'email', u.email,
      'photo_url', u.photo_url,
      'department_name', d.name
    ) END AS users,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', pr.id, 'user_id', pr.user_id, 'reaction', pr.reaction,
        'created_at', pr.created_at
      ) ORDER BY pr.created_at)
      FROM post_reactions pr WHERE pr.post_id = p.id
    ), '[]'::json) AS likes,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', c.id, 'post_id', c.post_id, 'user_id', c.author_id,
        'content', c.content, 'created_at', c.created_at,
        'users', json_build_object(
          'id', cu.id, 'name', cu.name, 'photo_url', cu.photo_url,
          'department_name', cd.name
        )
      ) ORDER BY c.created_at)
      FROM comments c
      LEFT JOIN users cu ON cu.id = c.author_id
      LEFT JOIN departments cd ON cd.id = cu.department_id
      WHERE c.post_id = p.id
    ), '[]'::json) AS comments,
    (SELECT COUNT(*)::int FROM post_views pv WHERE pv.post_id = p.id) AS view_count,
    COALESCE((
      SELECT json_agg(json_build_object(
        'user_id', pv.user_id, 'viewed_at', pv.viewed_at,
        'name', vu.name, 'photo_url', vu.photo_url
      ) ORDER BY pv.viewed_at)
      FROM post_views pv
      LEFT JOIN users vu ON vu.id = pv.user_id
      WHERE pv.post_id = p.id
    ), '[]'::json) AS viewers
  FROM posts p
  LEFT JOIN users u ON u.id = p.author_id
  LEFT JOIN departments d ON d.id = u.department_id
  WHERE p.type = 'jrh'
`;

export async function listJRHPosts() {
  const { rows } = await query(`${jrhPostSelect} ORDER BY p.pinned DESC, p.created_at DESC LIMIT 100`);
  return rows;
}

export async function createJRHPost(userId, input) {
  const canPost = await isHRUser(userId);
  if (!canPost) throw Object.assign(new Error('Apenas RH pode publicar no J-RH'), { status: 403 });

  const title = cleanText(input.title ?? '', 255);
  const content = cleanText(input.content ?? '', 10000);
  const category = input.category ? cleanText(input.category, 100) : null;
  const imageUrl = input.image_url ? cleanText(input.image_url, 1000) : null;
  const videoUrl = input.video_url ? cleanText(input.video_url, 1000) : null;

  if (!content && !imageUrl && !videoUrl) {
    throw Object.assign(new Error('Conteúdo obrigatório'), { status: 400 });
  }

  const { rows } = await query(
    `INSERT INTO posts (author_id, title, content, type, category, image_url, video_url, visibility, period_start, expires_at, created_at, updated_at)
     VALUES ($1, $2, $3, 'jrh', $4, $5, $6, 'company', $7, $8, NOW(), NOW())
     RETURNING id`,
    [userId, title || null, content || null, category, imageUrl, videoUrl,
     input.period_start ?? null, input.expires_at ?? null]
  );

  const { rows: full } = await query(
    `${jrhPostSelect} AND p.id = $1`,
    [rows[0].id]
  );
  return full[0];
}

export async function recordJRHPostView(postId, userId) {
  await query(
    `INSERT INTO post_views (post_id, user_id) VALUES ($1, $2)
     ON CONFLICT (post_id, user_id) DO NOTHING`,
    [postId, userId]
  );
}

export async function listJRHPostViews(postId, requesterId) {
  const canView = await isHRUser(requesterId);
  if (!canView) throw Object.assign(new Error('Apenas RH pode ver visualizações'), { status: 403 });

  const { rows } = await query(`
    SELECT pv.user_id, pv.viewed_at, u.name, u.photo_url,
      d.name AS department_name
    FROM post_views pv
    LEFT JOIN users u ON u.id = pv.user_id
    LEFT JOIN departments d ON d.id = u.department_id
    WHERE pv.post_id = $1
    ORDER BY pv.viewed_at DESC
  `, [postId]);
  return rows;
}

export async function toggleJRHReaction(postId, userId, reaction) {
  if (!ALLOWED_REACTIONS.has(reaction)) {
    throw Object.assign(new Error('Reação inválida'), { status: 400 });
  }

  const { rows: existing } = await query(
    `SELECT id FROM post_reactions WHERE post_id = $1 AND user_id = $2 AND reaction = $3`,
    [postId, userId, reaction]
  );

  if (existing.length > 0) {
    await query(`DELETE FROM post_reactions WHERE id = $1`, [existing[0].id]);
    return { action: 'removed' };
  } else {
    await query(
      `INSERT INTO post_reactions (post_id, user_id, reaction, created_at) VALUES ($1, $2, $3, NOW())`,
      [postId, userId, reaction]
    );
    return { action: 'added' };
  }
}

export async function createJRHComment(postId, userId, content) {
  const text = cleanText(content ?? '', 5000);
  if (!text) throw Object.assign(new Error('Comentário vazio'), { status: 400 });

  const { rows } = await query(
    `INSERT INTO comments (post_id, author_id, content, created_at)
     VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id`,
    [postId, userId, text]
  );

  const { rows: full } = await query(`
    SELECT c.id, c.post_id, c.author_id AS user_id, c.content, c.created_at,
      json_build_object('id', u.id, 'name', u.name, 'photo_url', u.photo_url,
        'department_name', d.name) AS users
    FROM comments c
    LEFT JOIN users u ON u.id = c.author_id
    LEFT JOIN departments d ON d.id = u.department_id
    WHERE c.id = $1
  `, [rows[0].id]);
  return full[0];
}

export async function getJRHPost(postId) {
  const { rows } = await query(`${jrhPostSelect} AND p.id = $1`, [postId]);
  return rows[0] ?? null;
}

export async function updateJRHPost(postId, userId, input) {
  const isHR = await isHRUser(userId);
  if (!isHR) {
    const { rows: pr } = await query("SELECT author_id FROM posts WHERE id = $1 AND type = 'jrh'", [postId]);
    if (!pr[0] || pr[0].author_id !== userId) throw Object.assign(new Error('Sem permissão para editar este post'), { statusCode: 403 });
  }

  const updates = [];
  const values = [];
  let idx = 1;

  if ('title' in input) { updates.push('title = $' + idx++); values.push(input.title ? cleanText(input.title, 255) : null); }
  if ('content' in input) { updates.push('content = $' + idx++); values.push(input.content ? cleanText(input.content, 10000) : null); }
  if ('category' in input) { updates.push('category = $' + idx++); values.push(input.category ? cleanText(input.category, 100) : null); }
  if ('image_url' in input) { updates.push('image_url = $' + idx++); values.push(input.image_url ? cleanText(input.image_url, 1000) : null); }
  if ('video_url' in input) { updates.push('video_url = $' + idx++); values.push(input.video_url ? cleanText(input.video_url, 1000) : null); }
  if ('period_start' in input) { updates.push('period_start = $' + idx++); values.push(input.period_start ?? null); }
  if ('expires_at' in input) { updates.push('expires_at = $' + idx++); values.push(input.expires_at ?? null); }
  if ('pinned' in input) { updates.push('pinned = $' + idx++); values.push(Boolean(input.pinned)); }
  if ('visibility' in input) { updates.push('visibility = $' + idx++); values.push(input.visibility); }

  if (updates.length === 0) throw Object.assign(new Error('Nenhum campo para atualizar'), { status: 400 });
  updates.push('updated_at = NOW()');

  values.push(postId);
  const { rows } = await query(
    'UPDATE posts SET ' + updates.join(', ') + " WHERE id = $" + idx + " AND type = 'jrh' RETURNING id",
    values
  );
  if (!rows[0]) throw Object.assign(new Error('Post nao encontrado'), { status: 404 });

  const { rows: full } = await query(jrhPostSelect + ' AND p.id = $1', [postId]);
  return full[0];
}

export async function deleteJRHPost(postId, userId) {
  const isHR = await isHRUser(userId);
  if (!isHR) {
    const { rows: pr } = await query("SELECT author_id FROM posts WHERE id = $1 AND type = 'jrh'", [postId]);
    if (!pr[0] || pr[0].author_id !== userId) throw Object.assign(new Error('Sem permissão para excluir este post'), { statusCode: 403 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM comment_reactions WHERE comment_id IN (SELECT id FROM comments WHERE post_id = $1)', [postId]);
    await client.query('DELETE FROM comments WHERE post_id = $1', [postId]);
    await client.query('DELETE FROM post_reactions WHERE post_id = $1', [postId]);
    await client.query('DELETE FROM post_views WHERE post_id = $1', [postId]);
    const { rows } = await client.query("DELETE FROM posts WHERE id = $1 AND type = 'jrh' RETURNING id", [postId]);
    if (!rows[0]) { await client.query('ROLLBACK'); throw Object.assign(new Error('Post nao encontrado'), { status: 404 }); }
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function checkIsHR(userId) {
  return isHRUser(userId);
}

export async function getMonthBirthdays() {
  const { rows } = await query(`
    SELECT u.id, u.name, u.photo_url, u.birth_date,
           d.name AS department_name,
           EXTRACT(DAY FROM u.birth_date)::int AS birth_day
    FROM users u
    LEFT JOIN departments d ON d.id = u.department_id
    WHERE u.status = 'active'
      AND u.birth_date IS NOT NULL
      AND EXTRACT(MONTH FROM u.birth_date) = EXTRACT(MONTH FROM NOW())
    ORDER BY EXTRACT(DAY FROM u.birth_date)
  `);
  return rows;
}

export async function autoPublishTodayBirthdays() {
  const { rows: birthdays } = await query(`
    SELECT u.id, u.name, u.photo_url, u.department_id,
           d.name AS department_name
    FROM users u
    LEFT JOIN departments d ON d.id = u.department_id
    WHERE u.status = 'active'
      AND u.birth_date IS NOT NULL
      AND EXTRACT(MONTH FROM u.birth_date) = EXTRACT(MONTH FROM NOW())
      AND EXTRACT(DAY FROM u.birth_date) = EXTRACT(DAY FROM NOW())
  `);

  if (birthdays.length === 0) return;

  const { rows: admins } = await query(`
    SELECT u.id FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE r.name = 'Administrador' AND u.status = 'active'
    LIMIT 1
  `);
  const authorId = admins[0]?.id;
  if (!authorId) return;

  for (const user of birthdays) {
    const marker = `[bday:${user.id}]`;
    const { rows: existing } = await query(`
      SELECT id FROM posts
      WHERE type = 'jrh' AND category = 'aniversario'
        AND content LIKE $1 AND created_at::date = NOW()::date
    `, [`%${marker}%`]);

    if (existing.length > 0) continue;

    const dept = user.department_name ? ` (${user.department_name})` : '';
    const content = `🎂 Hoje é aniversário de **${user.name}**${dept}! Parabenize e mande uma mensagem de carinho! 🎉 ${marker}`;

    await query(`
      INSERT INTO posts (author_id, title, content, type, category, visibility, pinned, created_at, updated_at)
      VALUES ($1, $2, $3, 'jrh', 'aniversario', 'company', false, NOW(), NOW())
    `, [authorId, `🎂 Aniversário: ${user.name}`, content]);
  }
}
