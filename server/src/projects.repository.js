import { query } from './db.js';
import { notifyUsers } from './notifications.repository.js';

// ── Projects ──────────────────────────────────────────────────

export async function listProjects() {
  const { rows } = await query('SELECT * FROM projects ORDER BY updated_at DESC');
  return rows;
}

export async function createProject(body, actor) {
  const { rows } = await query(
    `INSERT INTO projects
       (name, code, responsible_name, responsible_photo_url, category, deadline, start_date,
        summary, accent, status, progress, phase, next_action, tag, tag_color)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      body.name, body.code, body.responsible_name, body.responsible_photo_url ?? null,
      body.category ?? 'Estratégico', body.deadline ?? null, body.start_date ?? null,
      body.summary ?? null, body.accent ?? 'blue', body.status ?? 'Não iniciado',
      body.progress ?? 0, body.phase ?? 'Descoberta',
      body.next_action ?? 'Definir primeiro passo', body.tag ?? null, body.tag_color ?? null,
    ]
  );
  return rows[0];
}

export async function updateProject(id, body) {
  const ALLOWED = ['name','code','responsible_name','responsible_photo_url','status','progress',
                   'deadline','start_date','category','phase','next_action','summary','accent','tag','tag_color'];
  const sets = [];
  const vals = [];
  let i = 1;
  for (const k of ALLOWED) {
    if (k in body) { sets.push(`${k}=$${i++}`); vals.push(body[k]); }
  }
  if (!sets.length) return null;
  vals.push(id);
  const { rows } = await query(
    `UPDATE projects SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals
  );
  return rows[0] ?? null;
}

export async function deleteProject(id) {
  await query('DELETE FROM projects WHERE id=$1', [id]);
}

// ── Steps ─────────────────────────────────────────────────────

export async function listSteps(projectId) {
  const { rows: steps } = await query(
    'SELECT * FROM project_steps WHERE project_id=$1 ORDER BY order_index ASC', [projectId]
  );
  if (!steps.length) return [];

  const stepIds = steps.map(s => s.id);

  const { rows: assignees } = await query(
    `SELECT sa.id, sa.step_id, sa.user_id, sa.deadline, sa.created_at,
            u.id as u_id, u.name as u_name, u.email as u_email,
            u.photo_url as u_photo, u.position as u_position,
            d.id as d_id, d.name as d_name
     FROM step_assignees sa
     JOIN users u ON u.id = sa.user_id
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE sa.step_id = ANY($1)`,
    [stepIds]
  );

  const aMap = {};
  for (const a of assignees) {
    if (!aMap[a.step_id]) aMap[a.step_id] = [];
    aMap[a.step_id].push({
      id: a.id, step_id: a.step_id, user_id: a.user_id, deadline: a.deadline, created_at: a.created_at,
      user: {
        id: a.u_id, name: a.u_name, email: a.u_email, photo_url: a.u_photo,
        position: a.u_position, department_id: a.d_id,
        department_name: a.d_name ?? null,
        department: a.d_id ? { id: a.d_id, name: a.d_name } : null,
      },
    });
  }

  const responsibleIds = [...new Set(steps.filter(s => s.responsible_user_id).map(s => s.responsible_user_id))];
  let ruMap = {};
  if (responsibleIds.length) {
    const { rows: rus } = await query('SELECT * FROM users WHERE id = ANY($1)', [responsibleIds]);
    for (const u of rus) ruMap[u.id] = u;
  }

  return steps.map(s => ({
    ...s,
    assignees: aMap[s.id] ?? [],
    responsible_user: s.responsible_user_id ? (ruMap[s.responsible_user_id] ?? null) : null,
  }));
}

export async function createStep(body, actor) {
  const { rows } = await query(
    `INSERT INTO project_steps
       (project_id, name, description, start_date, deadline, responsible_name,
        responsible_user_id, status, order_index, color, custom_status_label,
        custom_status_color, tag, tag_color)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [
      body.project_id, body.name, body.description ?? null, body.start_date ?? null,
      body.deadline ?? null, body.responsible_name ?? null, body.responsible_user_id ?? null,
      body.status ?? 'Não iniciado', body.order_index ?? 0, body.color ?? 'blue',
      body.custom_status_label ?? null, body.custom_status_color ?? null,
      body.tag ?? null, body.tag_color ?? null,
    ]
  );
  let responsible_user = null;
  if (rows[0].responsible_user_id) {
    const { rows: ru } = await query('SELECT * FROM users WHERE id=$1', [rows[0].responsible_user_id]);
    responsible_user = ru[0] ?? null;
  }
  return { ...rows[0], assignees: [], responsible_user };
}

export async function updateStep(id, body, actor) {
  const ALLOWED = ['name','description','start_date','deadline','responsible_name','responsible_user_id',
                   'status','order_index','color','custom_status_label','custom_status_color','tag','tag_color','delivery_date'];
  const sets = [];
  const vals = [];
  let i = 1;
  for (const k of ALLOWED) {
    if (k in body) { sets.push(`${k}=$${i++}`); vals.push(body[k]); }
  }
  if (!sets.length) return null;
  vals.push(id);
  const { rows } = await query(`UPDATE project_steps SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals);
  if (!rows[0]) return null;
  let responsible_user = null;
  if (rows[0].responsible_user_id) {
    const { rows: ru } = await query('SELECT * FROM users WHERE id=$1', [rows[0].responsible_user_id]);
    responsible_user = ru[0] ?? null;
  }
  return { ...rows[0], assignees: [], responsible_user };
}

export async function deleteStep(id) {
  await query('DELETE FROM project_steps WHERE id=$1', [id]);
}

// ── Step Assignees ─────────────────────────────────────────────

export async function addStepAssignee(body, actor) {
  const { rows } = await query(
    'INSERT INTO step_assignees (step_id, user_id, deadline) VALUES ($1,$2,$3) RETURNING *',
    [body.step_id, body.user_id, body.deadline ?? null]
  );
  const assignee = rows[0];

  // Phase 4: notify assigned user
  if (assignee?.user_id) {
    const { rows: stepRows } = await query(
      'SELECT ps.name as step_name, p.name as proj_name FROM project_steps ps JOIN projects p ON p.id=ps.project_id WHERE ps.id=$1',
      [body.step_id]
    );
    const step = stepRows[0];
    if (step) {
      await notifyUsers({
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? null,
        actorPhotoUrl: actor?.photo_url ?? null,
        title: 'Você foi adicionado a uma etapa',
        message: `Etapa: ${step.step_name} | Projeto: ${step.proj_name}`,
        type: 'project',
        link: `/projetos`,
        userIds: [assignee.user_id],
      }).catch(() => {});
    }
  }

  return assignee;
}

export async function removeStepAssignee(id) {
  await query('DELETE FROM step_assignees WHERE id=$1', [id]);
}

// ── Step History ───────────────────────────────────────────────

export async function listStepHistory(stepId) {
  const { rows } = await query(
    'SELECT * FROM step_history WHERE step_id=$1 ORDER BY created_at DESC LIMIT 50', [stepId]
  );
  return rows;
}

export async function addStepHistory(stepId, body, ipAddress) {
  const { rows } = await query(
    'INSERT INTO step_history (step_id, action, details, actor_name, actor_ip) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [stepId, body.action ?? 'Ação', body.details ?? null, body.actor_name ?? 'Sistema', ipAddress]
  );
  return rows[0];
}

// ── Comments ───────────────────────────────────────────────────

export async function listComments(projectId) {
  const { rows } = await query(
    `SELECT pc.*, ps.name AS step_name
     FROM project_comments pc
     LEFT JOIN project_steps ps ON ps.id = pc.step_id
     WHERE pc.project_id=$1 ORDER BY pc.created_at ASC`,
    [projectId]
  );
  return rows.map(r => ({ ...r, mentions: r.mentions ?? [], images: r.images ?? [] }));
}

export async function createComment(projectId, body, actor) {
  const { rows } = await query(
    `INSERT INTO project_comments
       (project_id, author_name, content, step_id, comment_type, mentions, images)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      projectId,
      body.author_name ?? (actor?.name ?? 'Anônimo'),
      body.content,
      body.step_id ?? null,
      body.comment_type ?? null,
      JSON.stringify(body.mentions ?? []),
      JSON.stringify(body.images ?? []),
    ]
  );
  const comment = { ...rows[0], mentions: rows[0].mentions ?? [], images: rows[0].images ?? [] };

  // Phase 4: notify step assignees + responsible if comment on a step
  if (comment.step_id) {
    const { rows: saRows } = await query(
      `SELECT DISTINCT sa.user_id FROM step_assignees sa WHERE sa.step_id=$1
       UNION
       SELECT ps.responsible_user_id FROM project_steps ps WHERE ps.id=$1 AND ps.responsible_user_id IS NOT NULL`,
      [comment.step_id]
    );
    const userIds = saRows.map(r => r.user_id).filter(uid => uid !== actor?.id);
    if (userIds.length) {
      const { rows: projRows } = await query(
        'SELECT p.name FROM project_steps ps JOIN projects p ON p.id=ps.project_id WHERE ps.id=$1', [comment.step_id]
      );
      const projName = projRows[0]?.name ?? 'Projeto';
      await notifyUsers({
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? null,
        actorPhotoUrl: actor?.photo_url ?? null,
        title: 'Novo comentário na sua etapa',
        message: `${actor?.name ?? 'Alguém'} comentou em ${projName}`,
        type: 'project',
        link: `/projetos`,
        userIds,
      }).catch(() => {});
    }
  }

  return comment;
}

export async function updateComment(projectId, commentId, body) {
  const { rows } = await query(
    `UPDATE project_comments SET content=$1, comment_type=$2 WHERE id=$3 AND project_id=$4 RETURNING *`,
    [body.content, body.comment_type ?? null, commentId, projectId]
  );
  if (!rows[0]) return null;
  return { ...rows[0], mentions: rows[0].mentions ?? [] };
}

export async function deleteComment(projectId, commentId) {
  await query('DELETE FROM project_comments WHERE id=$1 AND project_id=$2', [commentId, projectId]);
}

// ── Attachments ────────────────────────────────────────────────

export async function listAttachments(projectId) {
  const { rows } = await query(
    `SELECT pa.id, pa.project_id, pa.step_id, pa.filename, pa.file_size, pa.mime_type, pa.uploaded_by, pa.created_at,
            ps.name AS step_name
     FROM project_attachments pa
     LEFT JOIN project_steps ps ON ps.id = pa.step_id
     WHERE pa.project_id=$1 ORDER BY pa.created_at DESC`,
    [projectId]
  );
  return rows;
}

export async function createAttachment(projectId, body, actor) {
  if (!body.filename || !body.data_base64) throw Object.assign(new Error('filename e data_base64 obrigatórios'), { statusCode: 400 });
  const sizeBytes = Math.round((body.data_base64.length * 3) / 4);
  if (sizeBytes > 55 * 1024 * 1024) throw Object.assign(new Error('Arquivo excede 50MB'), { statusCode: 413 });
  const { rows } = await query(
    `INSERT INTO project_attachments (project_id, step_id, filename, file_size, mime_type, data_base64, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, project_id, step_id, filename, file_size, mime_type, uploaded_by, created_at`,
    [projectId, body.step_id ?? null, body.filename, sizeBytes,
     body.mime_type ?? 'application/octet-stream', body.data_base64,
     body.uploaded_by ?? (actor?.name ?? 'Anônimo')]
  );
  return rows[0];
}

export async function deleteAttachment(projectId, attachmentId) {
  await query('DELETE FROM project_attachments WHERE id=$1 AND project_id=$2', [attachmentId, projectId]);
}

export async function getAttachmentForDownload(id) {
  const { rows } = await query('SELECT filename, mime_type, data_base64 FROM project_attachments WHERE id=$1', [id]);
  return rows[0] ?? null;
}

// ── Requests ───────────────────────────────────────────────────

export async function listRequests(status) {
  let q = 'SELECT * FROM project_requests';
  const params = [];
  if (status) { q += ' WHERE status=$1'; params.push(status); }
  q += ' ORDER BY created_at DESC';
  const { rows } = await query(q, params);
  return rows;
}

export async function createRequest(body) {
  const { rows } = await query(
    'INSERT INTO project_requests (project_id, title, requester_name, request_type, status) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [body.project_id ?? null, body.title, body.requester_name, body.request_type ?? 'Decisão', 'Aberta']
  );
  return rows[0];
}
