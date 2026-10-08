import { pool } from './db.js';

export async function initTiTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ti_projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      responsible TEXT DEFAULT 'TI',
      status TEXT NOT NULL DEFAULT 'Em andamento',
      start_date DATE,
      due_date DATE,
      progress_pct INT NOT NULL DEFAULT 0,
      color TEXT DEFAULT 'blue',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ti_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID REFERENCES ti_projects(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'Média',
      responsible TEXT DEFAULT 'Wendel',
      requester TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Backlog',
      progress_pct INT NOT NULL DEFAULT 0,
      scheduled_date DATE,
      scheduled_time TIME,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      due_date DATE,
      blocked_reason TEXT DEFAULT '',
      observations TEXT DEFAULT '',
      result TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ti_task_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID REFERENCES ti_tasks(id) ON DELETE CASCADE,
      field_changed TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by TEXT DEFAULT 'Sistema',
      ts TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function listTiProjects() {
  const res = await pool.query(`
    SELECT p.*,
      COUNT(t.id) FILTER (WHERE t.status NOT IN ('Concluído')) AS pending_tasks,
      COUNT(t.id) FILTER (WHERE t.status = 'Concluído') AS done_tasks,
      COUNT(t.id) FILTER (WHERE t.status = 'Bloqueado') AS blocked_tasks,
      COUNT(t.id) FILTER (WHERE t.status = 'Aguardando') AS waiting_tasks,
      COUNT(t.id) AS total_tasks
    FROM ti_projects p
    LEFT JOIN ti_tasks t ON t.project_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at ASC
  `);
  return res.rows;
}

export async function createTiProject(data) {
  const res = await pool.query(
    `INSERT INTO ti_projects (name, description, responsible, status, start_date, due_date, progress_pct, color)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [data.name, data.description||'', data.responsible||'TI', data.status||'Em andamento',
     data.start_date||null, data.due_date||null, data.progress_pct||0, data.color||'blue']
  );
  return res.rows[0];
}

export async function updateTiProject(id, data) {
  const allowed = ['name','description','responsible','status','start_date','due_date','progress_pct','color'];
  const fields = [], vals = [];
  let i = 1;
  for (const [k,v] of Object.entries(data)) {
    if (allowed.includes(k)) { fields.push(`${k} = $${i++}`); vals.push(v); }
  }
  if (!fields.length) return null;
  fields.push(`updated_at = NOW()`);
  vals.push(id);
  const res = await pool.query(`UPDATE ti_projects SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, vals);
  return res.rows[0];
}

export async function deleteTiProject(id) {
  await pool.query('DELETE FROM ti_projects WHERE id = $1', [id]);
}

export async function listTiTasks(filters = {}) {
  const conditions = ['1=1'];
  const vals = [];
  let i = 1;
  if (filters.project_id) { conditions.push(`t.project_id = $${i++}`); vals.push(filters.project_id); }
  if (filters.status) { conditions.push(`t.status = $${i++}`); vals.push(filters.status); }
  if (filters.date) { conditions.push(`t.scheduled_date = $${i++}`); vals.push(filters.date); }
  if (filters.priority) { conditions.push(`t.priority = $${i++}`); vals.push(filters.priority); }
  const where = conditions.join(' AND ');
  const res = await pool.query(`
    SELECT t.*, p.name AS project_name, p.color AS project_color
    FROM ti_tasks t
    LEFT JOIN ti_projects p ON p.id = t.project_id
    WHERE ${where}
    ORDER BY
      CASE t.priority WHEN 'Crítica' THEN 1 WHEN 'Alta' THEN 2 WHEN 'Média' THEN 3 ELSE 4 END,
      t.scheduled_date ASC NULLS LAST,
      t.created_at ASC
  `, vals);
  return res.rows;
}

export async function createTiTask(data) {
  const res = await pool.query(
    `INSERT INTO ti_tasks (project_id, title, description, category, priority, responsible, requester, status, progress_pct, scheduled_date, scheduled_time, due_date, blocked_reason, observations)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [data.project_id||null, data.title, data.description||'', data.category||'',
     data.priority||'Média', data.responsible||'Wendel', data.requester||'',
     data.status||'Backlog', data.progress_pct||0,
     data.scheduled_date||null, data.scheduled_time||null, data.due_date||null,
     data.blocked_reason||'', data.observations||'']
  );
  return res.rows[0];
}

export async function updateTiTask(id, data, changedBy = 'Sistema') {
  const allowed = ['project_id','title','description','category','priority','responsible','requester',
    'status','progress_pct','scheduled_date','scheduled_time','started_at','completed_at',
    'due_date','blocked_reason','observations','result'];
  const cur = await pool.query('SELECT * FROM ti_tasks WHERE id = $1', [id]);
  if (!cur.rows.length) return null;
  const current = cur.rows[0];

  const fields = [], vals = [];
  let i = 1;
  const historyEntries = [];

  for (const [k,v] of Object.entries(data)) {
    if (!allowed.includes(k)) continue;
    fields.push(`${k} = $${i++}`);
    vals.push(v);
    const oldVal = current[k] != null ? String(current[k]) : '';
    const newVal = v != null ? String(v) : '';
    if (oldVal !== newVal) historyEntries.push({ field: k, old: oldVal, new: newVal });
  }

  if (data.status === 'Em Andamento' && !current.started_at && !data.started_at) {
    fields.push(`started_at = NOW()`);
  }
  if (data.status === 'Concluído' && !current.completed_at && !data.completed_at) {
    fields.push(`completed_at = NOW()`);
    historyEntries.push({ field: 'status', old: current.status, new: 'Concluído' });
  }

  if (!fields.length) return current;
  fields.push(`updated_at = NOW()`);
  vals.push(id);

  const res = await pool.query(
    `UPDATE ti_tasks SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, vals
  );

  for (const h of historyEntries) {
    await pool.query(
      `INSERT INTO ti_task_history (task_id, field_changed, old_value, new_value, changed_by) VALUES ($1,$2,$3,$4,$5)`,
      [id, h.field, h.old, h.new, changedBy]
    ).catch(() => {});
  }

  return res.rows[0];
}

export async function deleteTiTask(id) {
  await pool.query('DELETE FROM ti_tasks WHERE id = $1', [id]);
}

export async function getTiTaskHistory(taskId) {
  const res = await pool.query(
    `SELECT * FROM ti_task_history WHERE task_id = $1 ORDER BY ts DESC LIMIT 100`, [taskId]
  );
  return res.rows;
}

export async function getTiSummary() {
  const today = new Date().toISOString().split('T')[0];
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const res = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE scheduled_date = $1) AS today_total,
      COUNT(*) FILTER (WHERE status = 'Em Andamento') AS in_progress,
      COUNT(*) FILTER (WHERE status = 'Concluído' AND completed_at::date = $1) AS done_today,
      COUNT(*) FILTER (WHERE status = 'Concluído' AND completed_at::date >= $2) AS done_week,
      COUNT(*) FILTER (WHERE status IN ('Backlog','A Fazer')) AS pending,
      COUNT(*) FILTER (WHERE status = 'Aguardando') AS waiting,
      COUNT(*) FILTER (WHERE status = 'Bloqueado') AS blocked,
      COUNT(*) FILTER (WHERE due_date < $1 AND status NOT IN ('Concluído')) AS overdue
    FROM ti_tasks
  `, [today, weekStartStr]);
  return res.rows[0];
}

export async function seedTiData() {
  const existing = await pool.query('SELECT COUNT(*) FROM ti_projects');
  if (parseInt(existing.rows[0].count) > 0) return;

  const today = new Date().toISOString().split('T')[0];

  const p1 = await createTiProject({ name: 'Rede Nex', description: 'Plataforma interna da NexTelecom — chat, tarefas, projetos, wiki, feed', responsible: 'Wendel', status: 'Em andamento', progress_pct: 80, color: 'blue', start_date: '2026-06-01' });
  const p2 = await createTiProject({ name: 'Consulta de Protocolos', description: 'Funcionalidade centralizada de consulta de protocolos de atendimento', responsible: 'Wendel', status: 'A fazer', progress_pct: 0, color: 'orange' });
  const p3 = await createTiProject({ name: 'Newave One', description: 'Integrações, APIs de telefonia, PABX, protocolos e relatórios', responsible: 'Wendel', status: 'Em andamento', progress_pct: 30, color: 'teal' });
  const p4 = await createTiProject({ name: 'Power BI Nex Telecom', description: 'Dashboard executivo com dados comercial, atendimento e financeiro', responsible: 'Wendel', status: 'Em andamento', progress_pct: 15, color: 'violet', due_date: '2026-10-15' });

  await createTiTask({ project_id: p1.id, title: 'Front-End', status: 'Concluído', priority: 'Alta', responsible: 'Wendel', progress_pct: 100 });
  await createTiTask({ project_id: p1.id, title: 'Banco de Dados', status: 'Concluído', priority: 'Alta', responsible: 'Wendel', progress_pct: 100 });
  await createTiTask({ project_id: p1.id, title: 'Módulo de Tarefas', status: 'Concluído', priority: 'Alta', responsible: 'Wendel', progress_pct: 100 });
  await createTiTask({ project_id: p1.id, title: 'Consulta via API Hubsoft', status: 'Em Andamento', priority: 'Alta', responsible: 'Wendel', progress_pct: 60, scheduled_date: today, due_date: '2026-09-18' });
  await createTiTask({ project_id: p1.id, title: 'Painel de Gestão T.I.', status: 'Em Andamento', priority: 'Alta', responsible: 'Wendel', progress_pct: 70, scheduled_date: today });

  await createTiTask({ project_id: p2.id, title: 'Levantamento de requisitos', status: 'A Fazer', priority: 'Média', responsible: 'Wendel' });
  await createTiTask({ project_id: p2.id, title: 'Desenvolvimento da interface', status: 'Backlog', priority: 'Média', responsible: 'Wendel', due_date: '2026-10-01' });

  await createTiTask({ project_id: p3.id, title: 'Integração API Newave', status: 'Em Andamento', priority: 'Alta', responsible: 'Wendel', progress_pct: 40, scheduled_date: today });
  await createTiTask({ project_id: p3.id, title: 'Ajuste PABX e ramais', status: 'Aguardando', priority: 'Alta', responsible: 'Wendel', blocked_reason: 'Aguardando credenciais do fornecedor Newave', due_date: '2026-09-20' });
  await createTiTask({ project_id: p3.id, title: 'Relatórios e Indicadores', status: 'Backlog', priority: 'Média', responsible: 'Wendel' });

  await createTiTask({ project_id: p4.id, title: 'Levantamento das fontes de dados', status: 'Concluído', priority: 'Alta', responsible: 'Wendel', progress_pct: 100 });
  await createTiTask({ project_id: p4.id, title: 'Identificação das APIs', status: 'Em Andamento', priority: 'Alta', responsible: 'Wendel', progress_pct: 30 });
  await createTiTask({ project_id: p4.id, title: 'Modelagem de dados', status: 'A Fazer', priority: 'Média', responsible: 'Wendel' });
  await createTiTask({ project_id: p4.id, title: 'Dashboard executivo', status: 'Backlog', priority: 'Alta', responsible: 'Wendel', due_date: '2026-09-25' });
  await createTiTask({ project_id: p4.id, title: 'Publicação e atualização automática', status: 'Backlog', priority: 'Média', responsible: 'Wendel', due_date: '2026-10-15' });
}
