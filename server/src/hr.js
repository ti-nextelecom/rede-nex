import { randomUUID } from 'node:crypto';
import { HR_PERMISSIONS, effectivePermissions, validDate, csvCell, addMonths, addDays } from '../../shared/hr.mjs';

const keys = new Set(HR_PERMISSIONS.map(p => p.key));
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const tables = { employees: 'rh', asos: 'aso', vacations: 'vacations' };
const nullableDates = ['admission_on','last_exam_on','scheduled_on','completed_on','start_on','source_start_limit'];
export function validateHrRecord(table, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(400, 'Dados inválidos.');
  const out = {};
  const text = (key, max = 200, required = false) => {
    const value = input[key] ?? ''; if (typeof value !== 'string' || value.length > max || (required && value.trim().length < 2)) fail(400, `Campo inválido: ${key}.`);
    out[key] = value.trim();
  };
  const date = (key, required = false) => {
    const value = input[key] || null;
    if ((required && !value) || (value && !validDate(value))) fail(400, `Data inválida: ${key}.`);
    out[key] = value;
  };
  const integer = (key, min, max, fallback) => {
    const value = input[key] ?? fallback; if (!Number.isInteger(value) || value < min || value > max) fail(400, `Valor inválido: ${key}.`); out[key] = value;
  };
  if (table === 'employees') {
    if (!uuid(input.user_id)) fail(400,'Selecione um usuário existente da REDE NEX.'); out.user_id = input.user_id;
    text('full_name',200); for (const key of ['short_name','team','area','company','position']) text(key);
    text('employee_code',50); out.employee_code ||= null; date('admission_on'); date('termination_on');
    for (const key of ['needs_review','archived']) { if (input[key] !== undefined && typeof input[key] !== 'boolean') fail(400,'Indicador inválido.'); out[key] = input[key] ?? false; }
  } else {
    if (!uuid(input.employee_id)) fail(400,'Selecione um colaborador.'); out.employee_id = input.employee_id;
    text('notes',2000);
    for (const key of nullableDates.filter(k => table === 'asos' ? ['last_exam_on','scheduled_on','completed_on'].includes(k) : ['start_on','source_start_limit'].includes(k))) date(key);
    const month = input.planned_month || null;
    if (month && (!validDate(month) || !month.endsWith('-01'))) fail(400,'Mês inválido.'); out.planned_month = month;
    if (month && (out.scheduled_on || out.start_on)) fail(400,'Escolha uma data exata ou um mês, não ambos.');
    const allowedFlags = table === 'asos' ? ['appointment','documents'] : ['notice','payment','return'];
    if (input.checklist !== undefined && (!input.checklist || typeof input.checklist !== 'object' || Array.isArray(input.checklist))) fail(400,'Checklist inválido.');
    out.checklist = {};
    for (const [key, value] of Object.entries(input.checklist || {})) {
      if (!allowedFlags.includes(key) || typeof value !== 'boolean') fail(400,'Checklist inválido.'); out.checklist[key] = value;
    }
    if (input.archived !== undefined && typeof input.archived !== 'boolean') fail(400,'Indicador inválido.'); out.archived = input.archived ?? false;
    if (table === 'asos') {
      integer('periodicity_months',1,60,12);
      const today = new Date().toLocaleDateString('en-CA',{timeZone:'America/Bahia'});
      if ((out.completed_on && out.completed_on > today) || (out.last_exam_on && out.last_exam_on > today)) fail(400,'Exame realizado não pode ter data futura.');
    } else {
      for (const key of ['acquisition_start','acquisition_end','concession_end']) date(key,true);
      if (out.acquisition_start > out.acquisition_end || out.concession_end <= out.acquisition_end) fail(400,'Revise os períodos aquisitivo e concessivo.');
      const balance = String(input.balance_days ?? '');
      if (!/^\d{1,3}(\.\d{1,2})?$/.test(balance) || Number(balance) > 366) fail(400,'Saldo inválido: informe até duas casas decimais.'); out.balance_days = balance;
      integer('leave_days',1,60,30); integer('bonus_days',0,30,0);
      if (!['draft','planned','completed','cancelled'].includes(input.status)) fail(400,'Situação inválida.'); out.status = input.status;
      if (['planned','completed'].includes(out.status) && out.leave_days + out.bonus_days > Number(balance)) fail(400,'Gozo e abono excedem o saldo disponível.');
      if (['planned','completed'].includes(out.status) && !out.start_on && !out.planned_month) fail(400,'Informe o mês ou a data da programação.');
      if (out.status === 'completed' && !out.start_on) fail(400,'Informe a data exata das férias concluídas.');
      if (input.awaiting_employee !== undefined && typeof input.awaiting_employee !== 'boolean') fail(400,'Indicador inválido.'); out.awaiting_employee = input.awaiting_employee ?? false;
    }
  }
  return out;
}
export async function hrTransaction(pool, actorId, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('nex_hr.actor',$1,true)",[actorId]);
    const result = await fn(client); await client.query('COMMIT'); return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function hrAccess(client) {
  const actor = (await client.query('SELECT u.id,u.role_id,r.name AS role_name FROM public.users u JOIN public.roles r ON r.id=u.role_id WHERE u.id=nex_hr.actor_id() AND u.status=\'active\'')).rows[0];
  if (!actor) fail(403,'Usuário sem acesso.');
  const grants = (await client.query('SELECT * FROM nex_hr.grants')).rows;
  const role = {}, overrides = {};
  for (const g of grants) {
    if (g.target_kind === 'role' && g.target_id === actor.role_id) role[g.permission] = g.allowed;
    if (g.target_kind === 'user' && g.target_id === actor.id) overrides[g.permission] = g.allowed;
  }
  return { admin: actor.role_name === 'Administrador', permissions: effectivePermissions(actor.role_name === 'Administrador',role,overrides) };
}
async function audit(client, resource, id, operation, before, after) {
  await client.query('INSERT INTO nex_hr.audit(actor_id,resource,entity_id,operation,before_data,after_data) VALUES(nex_hr.actor_id(),$1,$2,$3,$4,$5)',[resource,id,operation,before == null ? null : JSON.stringify(before),after == null ? null : JSON.stringify(after)]);
}
export async function saveHrRecord(client, table, input, id = null) {
  if (!tables[table]) fail(404,'Recurso inexistente.');
  const values = validateHrRecord(table,input);
  let before = null;
  if (id) {
    if (!uuid(id)) fail(400,'Identificador inválido.');
    before = (await client.query(`SELECT to_jsonb(t) AS data FROM nex_hr.${table} t WHERE id=$1 FOR UPDATE`,[id])).rows[0]?.data;
    if (!before) fail(404,'Registro não encontrado.');
    if (!Number.isInteger(input.version) || input.version !== before.version) fail(409,'O registro foi alterado por outra pessoa. Recarregue antes de salvar.');
  }
  if (table === 'employees') {
    if (before && before.user_id !== values.user_id) fail(400,'O vínculo com o usuário não pode ser trocado.');
    const user = (await client.query('SELECT name FROM public.users WHERE id=$1',[values.user_id])).rows[0];
    if (!user) fail(400,'Usuário da REDE NEX não encontrado.');
    values.full_name = user.name; // Canonical identity is always the existing account.
  }
  if (table !== 'employees') {
    const employee = (await client.query('SELECT id,archived FROM nex_hr.employees WHERE id=$1',[values.employee_id])).rows[0];
    if (!employee || (employee.archived && !values.archived)) fail(400,'Colaborador inexistente ou arquivado.');
  }
  const columns = Object.keys(values), params = Object.values(values).map((v,i) => columns[i] === 'checklist' ? JSON.stringify(v) : v);
  let result;
  if (id) {
    result = await client.query(`UPDATE nex_hr.${table} t SET ${columns.map((c,i) => `${c}=$${i+1}`).join(',')},version=version+1,updated_at=now() WHERE id=$${params.length+1} RETURNING to_jsonb(t) AS data`,[...params,id]);
  } else {
    id = randomUUID(); result = await client.query(`INSERT INTO nex_hr.${table} AS t (id,${columns.join(',')}) VALUES($1,${columns.map((_,i) => `$${i+2}`).join(',')}) RETURNING to_jsonb(t) AS data`,[id,...params]);
  }
  const after = result.rows[0].data; await audit(client,tables[table],id,before ? 'update' : 'create',before,after); return after;
}

export async function bulkGenerateVacations(client, targetYear) {
  const { rows: emps } = await client.query(
    "SELECT id, full_name, to_char(admission_on,'YYYY-MM-DD') AS admission_on FROM nex_hr.employees WHERE NOT archived AND admission_on IS NOT NULL"
  );
  const today = new Date().toLocaleDateString('en-CA',{timeZone:'America/Bahia'});
  let created = 0, skipped = 0;
  for (const emp of emps) {
    const [, mm, dd] = emp.admission_on.split('-');
    let acqStart = `${targetYear}-${mm}-${dd}`;
    if (!validDate(acqStart)) acqStart = `${targetYear}-${mm}-28`;
    if (!validDate(acqStart)) { skipped++; continue; }
    const acqEndFull = addMonths(acqStart, 12);
    const acqEnd = addDays(acqEndFull, -1);
    const conEnd = addMonths(acqEnd, 12);
    if (!acqEnd || !conEnd) { skipped++; continue; }
    if (conEnd < today) { skipped++; continue; }
    try {
      const r = await client.query(
        `INSERT INTO nex_hr.vacations (id,employee_id,acquisition_start,acquisition_end,concession_end,balance_days,leave_days,bonus_days,status,notes)
         VALUES ($1,$2,$3,$4,$5,30,30,0,'draft','')
         ON CONFLICT (employee_id,acquisition_start,acquisition_end) DO NOTHING`,
        [randomUUID(), emp.id, acqStart, acqEnd, conEnd]
      );
      if (r.rowCount > 0) created++; else skipped++;
    } catch { skipped++; }
  }
  return { created, skipped, total: emps.length };
}

export function createHrRouter({ pool, requireUser, sendJson, sendError, readJson }) {
  return async (req,res,path) => {
    if (path !== '/api/access/me' && path !== '/api/permissions/rh' && path !== '/api/rh' && !path.startsWith('/api/rh/')) return false;
    res.setHeader('Cache-Control','no-store'); res.setHeader('Vary','Cookie');
    const user = await requireUser(req,res); if (!user) return true;
    try {
      const payload = await hrTransaction(pool,user.id,async client => {
        const access = await hrAccess(client);
        if (path === '/api/access/me' && req.method === 'GET') return access;
        if (path === '/api/permissions/rh') {
          if (!access.admin) fail(403,'Somente o Administrador pode gerenciar o acesso ao RH.');
          if (req.method === 'GET') return {
            roles: (await client.query('SELECT id,name FROM public.roles ORDER BY name')).rows,
            users: (await client.query('SELECT u.id,u.name,u.photo_url,u.role_id,r.name AS role_name FROM public.users u JOIN public.roles r ON r.id=u.role_id WHERE u.status=\'active\' ORDER BY u.name')).rows,
            grants: (await client.query('SELECT * FROM nex_hr.grants')).rows,
            revision: (await client.query('SELECT revision FROM nex_hr.settings WHERE id=1')).rows[0].revision,
          };
          if (req.method !== 'PUT') fail(405,'Método não permitido.');
          const body = await readJson(req);
          if (!['role','user'].includes(body.target_kind) || !uuid(body.target_id) || !body.grants || typeof body.grants !== 'object' || Array.isArray(body.grants)) fail(400,'Permissões inválidas.');
          const target = body.target_kind === 'role'
            ? (await client.query('SELECT name FROM public.roles WHERE id=$1',[body.target_id])).rows[0]
            : (await client.query('SELECT r.name FROM public.users u JOIN public.roles r ON r.id=u.role_id WHERE u.id=$1',[body.target_id])).rows[0];
          if (!target) fail(404,'Perfil ou usuário não encontrado.');
          if (target.name === 'Administrador') fail(400,'O acesso do Administrador é permanente.');
          for (const [key,value] of Object.entries(body.grants)) if (!keys.has(key) || (value !== null && typeof value !== 'boolean')) fail(400,'Permissão desconhecida ou valor inválido.');
          const revision = (await client.query('SELECT revision FROM nex_hr.settings WHERE id=1 FOR UPDATE')).rows[0].revision;
          if (body.revision !== revision) fail(409,'As permissões mudaram. Recarregue antes de salvar.');
          const before = (await client.query('SELECT permission,allowed FROM nex_hr.grants WHERE target_kind=$1 AND target_id=$2',[body.target_kind,body.target_id])).rows;
          await client.query('DELETE FROM nex_hr.grants WHERE target_kind=$1 AND target_id=$2',[body.target_kind,body.target_id]);
          for (const [key,value] of Object.entries(body.grants)) if (value !== null) await client.query('INSERT INTO nex_hr.grants VALUES($1,$2,$3,$4)',[body.target_kind,body.target_id,key,value]);
          await client.query('UPDATE nex_hr.settings SET revision=revision+1 WHERE id=1');
          await audit(client,'permissions',body.target_id,'access_change',before,{ target_kind:body.target_kind, grants:body.grants });
          return { revision:revision+1 };
        }
        if (!access.permissions['rh.view']) fail(403,'Você não tem permissão para acessar o Módulo RH.');
        const [, , , table, id] = path.split('/');
        if (table === 'users' && !id && req.method === 'GET') {
          if (!access.permissions['rh.manage']) fail(403,'Sem permissão para gerenciar vínculos de colaboradores.');
          return { users:(await client.query("SELECT u.id,u.name,u.photo_url,u.position,to_char(u.admission_date,'YYYY-MM-DD') AS admission_date,u.status,d.name AS department_name FROM public.users u LEFT JOIN public.departments d ON d.id=u.department_id ORDER BY u.name LIMIT 2501")).rows };
        }
        if (table === 'history' && req.method === 'GET') {
          const records = (await client.query(
            "SELECT a.id::text,a.resource,a.entity_id,a.operation,a.created_at,a.before_data,a.after_data," +
            "u.name AS actor_name," +
            "CASE a.resource WHEN 'rh' THEN COALESCE(pu1.name,e1.full_name) WHEN 'aso' THEN COALESCE(pu2.name,e2.full_name) WHEN 'vacations' THEN COALESCE(pu3.name,e3.full_name) WHEN 'permissions' THEN pu4.name END AS entity_name " +
            "FROM nex_hr.audit a " +
            "LEFT JOIN public.users u ON u.id=a.actor_id " +
            "LEFT JOIN nex_hr.employees e1 ON a.resource='rh' AND e1.id=a.entity_id " +
            "LEFT JOIN public.users pu1 ON pu1.id=e1.user_id " +
            "LEFT JOIN nex_hr.asos asos ON a.resource='aso' AND asos.id=a.entity_id " +
            "LEFT JOIN nex_hr.employees e2 ON e2.id=asos.employee_id " +
            "LEFT JOIN public.users pu2 ON pu2.id=e2.user_id " +
            "LEFT JOIN nex_hr.vacations vacs ON a.resource='vacations' AND vacs.id=a.entity_id " +
            "LEFT JOIN nex_hr.employees e3 ON e3.id=vacs.employee_id " +
            "LEFT JOIN public.users pu3 ON pu3.id=e3.user_id " +
            "LEFT JOIN public.users pu4 ON a.resource='permissions' AND pu4.id=a.entity_id " +
            "ORDER BY a.id DESC LIMIT 200"
          )).rows;
          return { records };
        }
        if (!tables[table]) fail(404,'Recurso do RH não encontrado.');
        const resource = tables[table];
        if (table === 'employees' ? !(access.permissions['rh.manage'] || access.permissions['aso.view'] || access.permissions['vacations.view']) : !access.permissions[resource+'.view']) fail(403,'Sem permissão de visualização.');
        if (req.method === 'GET') {
          if (id && id !== 'export') fail(404,'Recurso não encontrado.');
          if (id === 'export' && (table === 'employees' || !access.permissions[resource+'.export'])) fail(403,'Sem permissão de exportação.');
          const result = table === 'employees'
            ? await client.query("SELECT to_jsonb(t) || jsonb_build_object('full_name',COALESCE(u.name,t.full_name),'photo_url',u.photo_url,'user_status',COALESCE(u.status,'active')) AS data FROM nex_hr.employees t LEFT JOIN public.users u ON u.id=t.user_id ORDER BY COALESCE(u.name,t.full_name) LIMIT 2501")
            : await client.query(`SELECT to_jsonb(t) || jsonb_build_object('user_id',e.user_id,'full_name',COALESCE(u.name,e.full_name),'photo_url',u.photo_url,'user_status',COALESCE(u.status,'active'),'team',e.team,'employee_code',e.employee_code,'employee_archived',e.archived) AS data FROM nex_hr.${table} t JOIN nex_hr.employees e ON e.id=t.employee_id LEFT JOIN public.users u ON u.id=e.user_id ORDER BY COALESCE(u.name,e.full_name) LIMIT 2501`);
          const records = result.rows.slice(0,2500).map(r => r.data);
          if (id === 'export') {
            if (result.rows.length > 2500) fail(422,'Exportação excede 2500 registros. Solicite extração administrativa.');
            const columns = table === 'asos' ? ['full_name','employee_code','team','last_exam_on','periodicity_months','scheduled_on','planned_month','completed_on','notes','archived'] : ['full_name','employee_code','team','acquisition_start','acquisition_end','concession_end','balance_days','start_on','planned_month','leave_days','bonus_days','status','awaiting_employee','notes','archived'];
            return { csv:'\uFEFF'+[columns,...records.map(r => columns.map(c => r[c]))].map(row => row.map(csvCell).join(';')).join('\r\n') };
          }
          return { records, truncated:result.rows.length > 2500 };
        }
        if (table === 'vacations' && id === 'bulk-generate') {
          if (req.method !== 'POST') fail(405,'Método não permitido.');
          if (!access.permissions['vacations.manage']) fail(403,'Sem permissão de edição.');
          const body = await readJson(req);
          const yr = Number(body.acquisition_year);
          if (!Number.isInteger(yr) || yr < 2020 || yr > 2035) fail(400,'Ano inválido.');
          return await bulkGenerateVacations(client, yr);
        }
        if (!access.permissions[resource+'.manage']) fail(403,'Sem permissão de edição.');
        if (!['POST','PUT'].includes(req.method) || (req.method === 'PUT' && !id) || (req.method === 'POST' && id)) fail(405,'Método não permitido.');
        const body = await readJson(req);
        return { record:await saveHrRecord(client,table,body,id || null) };
      });
      sendJson(req,res,200,payload,{'Cache-Control':'no-store','Vary':'Cookie'});
    } catch (error) {
      const setup = ['42P01','3F000','42883'].includes(error.code);
      const status = setup ? 503 : error.status || error.statusCode || (error.code === '23505' ? 409 : ['23514','23503','22P02','22007'].includes(error.code) ? 400 : error.code === '42501' ? 403 : 500);
      const message = setup ? 'Módulo RH aguardando a migração 20261016_hr_module.sql no servidor.' : error.status ? error.message : status === 409 ? 'Já existe um registro para este usuário, matrícula ou período.' : status === 400 ? 'Dados inconsistentes. Revise os campos.' : status === 403 ? 'Acesso ao RH não autorizado pelo banco de dados.' : 'Não foi possível concluir a operação do RH.';
      sendError(req,res,status,setup ? 'HR_SETUP_REQUIRED' : 'HR_ERROR',message);
    }
    return true;
  };
}
