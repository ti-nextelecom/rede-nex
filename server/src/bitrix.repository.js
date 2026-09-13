import { query } from './db.js';
import { hashPassword } from './auth.repository.js';

function clean(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function pick(record, names) {
  for (const name of names) {
    if (record[name] !== undefined && record[name] !== null && String(record[name]).trim() !== '') {
      return record[name];
    }
  }
  return null;
}

function truthyBitrix(value) {
  if (value === true) return true;
  if (value === false) return false;
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!normalized) return true;
  return !['N', 'NO', 'FALSE', '0', 'INACTIVE', 'INATIVO'].includes(normalized);
}

function joinName(record) {
  const fullName = clean(pick(record, ['FULL_NAME', 'full_name', 'nome_completo', 'Nome completo', 'Nome Completo', 'name']));
  if (fullName) return fullName;

  return [pick(record, ['NAME', 'Nome', 'first_name']), pick(record, ['LAST_NAME', 'Sobrenome', 'last_name'])]
    .map(clean)
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function normalizeBitrixUser(record) {
  const email = clean(pick(record, ['EMAIL', 'E-mail', 'Email', 'email', 'WORK_EMAIL']));
  const name = joinName(record);
  const bitrixId = clean(pick(record, ['ID', 'id', 'Bitrix ID', 'bitrix_id']));

  if (!email || !name) {
    return null;
  }

  const department = pick(record, [
    'DEPARTMENT_NAME',
    'Departamento',
    'department',
    'setor',
    'bitrix_department',
    'UF_DEPARTMENT_NAME',
    'UF_DEPARTMENT',
  ]);

  return {
    bitrix_id: bitrixId,
    name,
    email: email.toLowerCase(),
    position: clean(pick(record, ['WORK_POSITION', 'Cargo', 'position', 'work_position'])),
    phone: clean(pick(record, ['PERSONAL_MOBILE', 'Telefone', 'phone', 'WORK_PHONE'])),
    photo_url: clean(pick(record, ['PERSONAL_PHOTO', 'photo_url', 'Foto'])),
    bitrix_department: Array.isArray(department) ? department.join(', ') : clean(department),
    bitrix_active: truthyBitrix(pick(record, ['ACTIVE', 'Ativo', 'active', 'status'])),
    birth_date: clean(pick(record, ['PERSONAL_BIRTHDAY'])) || null,
  };
}

async function ensureDepartment(name) {
  const departmentName = clean(name);
  if (!departmentName) return null;

  const { rows } = await query(
    `
      insert into departments (name, description)
      values ($1, 'Importado do Bitrix24')
      on conflict (name) do update set description = coalesce(departments.description, excluded.description)
      returning id
    `,
    [departmentName]
  );
  return rows[0]?.id ?? null;
}

async function getDefaultRoleId() {
  const { rows } = await query("select id from roles where name = 'Colaborador' limit 1");
  return rows[0]?.id ?? null;
}

export async function importBitrixUsers(records, source = 'manual') {
  const normalized = records.map(normalizeBitrixUser);
  const validUsers = normalized.filter(Boolean);
  const roleId = await getDefaultRoleId();
  const defaultPasswordHash = await hashPassword('Nex@2026');
  const imported = [];

  for (const user of validUsers) {
    const departmentId = await ensureDepartment(user.bitrix_department);
    const { rows } = await query(
      `
        insert into users (
          name,
          email,
          photo_url,
          department_id,
          position,
          phone,
          status,
          role_id,
          bitrix_id,
          bitrix_department,
          bitrix_active,
          bitrix_last_sync_at,
          source
          ,
          password_hash,
          must_change_password,
          birth_date
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), 'bitrix', $12, true, $13)
        on conflict (email) do update set
          name = excluded.name,
          photo_url = coalesce(excluded.photo_url, users.photo_url),
          department_id = coalesce(excluded.department_id, users.department_id),
          position = coalesce(excluded.position, users.position),
          phone = coalesce(excluded.phone, users.phone),
          status = excluded.status,
          role_id = coalesce(users.role_id, excluded.role_id),
          bitrix_id = coalesce(excluded.bitrix_id, users.bitrix_id),
          bitrix_department = excluded.bitrix_department,
          bitrix_active = excluded.bitrix_active,
          bitrix_last_sync_at = now(),
          source = 'bitrix',
          password_hash = coalesce(users.password_hash, excluded.password_hash),
          must_change_password = case when users.password_hash is null then true else users.must_change_password end,
          birth_date = coalesce(excluded.birth_date, users.birth_date)
        returning id, name, email, position, status, bitrix_id, bitrix_department, bitrix_active
      `,
      [
        user.name,
        user.email,
        user.photo_url,
        departmentId,
        user.position,
        user.phone,
        user.bitrix_active ? 'active' : 'inactive',
        roleId,
        user.bitrix_id,
        user.bitrix_department,
        user.bitrix_active,
        defaultPasswordHash,
        user.birth_date || null,
      ]
    );
    imported.push(rows[0]);
  }

  const { rows } = await query(
    `
      insert into bitrix_user_imports (source, total_received, total_imported, total_skipped, payload)
      values ($1, $2, $3, $4, $5::jsonb)
      returning *
    `,
    [source, records.length, imported.length, records.length - imported.length, JSON.stringify({ imported_at: new Date().toISOString() })]
  );

  return {
    import: rows[0],
    imported,
    skipped: records.length - imported.length,
  };
}

export async function listBitrixUsers() {
  const { rows } = await query(
    `
      select
        u.id,
        u.name,
        u.email,
        u.position,
        u.phone,
        u.status,
        u.photo_url,
        u.bitrix_id,
        u.bitrix_department,
        u.bitrix_active,
        u.bitrix_last_sync_at,
        d.name as department_name,
        r.name as role_name
      from users u
      left join departments d on d.id = u.department_id
      left join roles r on r.id = u.role_id
      where u.source = 'bitrix' or u.bitrix_id is not null
      order by u.name
    `
  );
  return rows;
}

export async function listBitrixImports() {
  const { rows } = await query('select * from bitrix_user_imports order by created_at desc limit 20');
  return rows;
}