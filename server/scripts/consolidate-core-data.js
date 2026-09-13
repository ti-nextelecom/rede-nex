import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import '../src/env.js';
import { pool, query } from '../src/db.js';
import { hashPassword } from '../src/auth.repository.js';

const DEFAULT_PASSWORD = 'Nex@2026';
const WENDEL_EMAIL = 'wendel@nexcorporativo.net.br';
const WENDEL_PHOTO_PATH = 'public/uploads/avatars/wendel-lima.jpg';

async function roleId(name) {
  const { rows } = await query('select id from roles where name = $1 limit 1', [name]);
  return rows[0]?.id ?? null;
}

async function main() {
  const defaultPasswordHash = await hashPassword(DEFAULT_PASSWORD);
  const adminRoleId = await roleId('Administrador');
  const collaboratorRoleId = await roleId('Colaborador');

  await query(
    `
      delete from users
      where source = 'local'
        and bitrix_id is null
        and email in (
          'ana.beatriz@nextelecom.com.br',
          'lucas.alves@nextelecom.com.br',
          'mariana.costa@nextelecom.com.br',
          'pedro.henrique@nextelecom.com.br',
          'fernanda.lima@nextelecom.com.br',
          'rafael.souza@nextelecom.com.br'
        )
    `
  );

  await query(
    `
      update users
      set
        password_hash = coalesce(password_hash, $1),
        must_change_password = case when password_hash is null then true else must_change_password end,
        role_id = coalesce(role_id, $2)
      where status = 'active'
    `,
    [defaultPasswordHash, collaboratorRoleId]
  );

  const photoBuffer = await readFile(WENDEL_PHOTO_PATH);
  const { rows: userRows } = await query(
    `
      insert into users (name, email, photo_url, status, role_id, source, password_hash, must_change_password)
      values ('Wendel Lima', $1, '/uploads/avatars/wendel-lima.jpg', 'active', $2, 'manual', $3, true)
      on conflict (email) do update set
        name = 'Wendel Lima',
        photo_url = '/uploads/avatars/wendel-lima.jpg',
        status = 'active',
        role_id = $2,
        password_hash = coalesce(users.password_hash, excluded.password_hash),
        must_change_password = true
      returning id
    `,
    [WENDEL_EMAIL, adminRoleId, defaultPasswordHash]
  );
  const wendelId = userRows[0].id;

  await query(
    `
      insert into media_assets (
        bucket,
        path,
        public_url,
        file_name,
        file_type,
        file_size,
        file_data,
        owner_id,
        context
      )
      values ('avatars', 'avatars/wendel-lima.jpg', '/uploads/avatars/wendel-lima.jpg', $1, 'image/jpeg', $2, $3, $4, 'avatar')
      on conflict (bucket, path) do update set
        public_url = excluded.public_url,
        file_name = excluded.file_name,
        file_type = excluded.file_type,
        file_size = excluded.file_size,
        file_data = excluded.file_data,
        owner_id = excluded.owner_id
    `,
    [basename(WENDEL_PHOTO_PATH), photoBuffer.length, photoBuffer, wendelId]
  );

  const [{ rows: counts }, { rows: wendel }] = await Promise.all([
    query('select count(*)::int as total, count(*) filter (where password_hash is not null)::int as with_password from users'),
    query('select u.name, u.email, r.name as role, u.photo_url, u.must_change_password from users u left join roles r on r.id = u.role_id where u.id = $1', [wendelId]),
  ]);

  console.log(JSON.stringify({ users: counts[0], admin: wendel[0] }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
