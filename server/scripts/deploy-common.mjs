import '../src/env.js';
import pg from 'pg';

export function databaseConfig(env = process.env) {
  if (!env.DATABASE_URL && !env.PGDATABASE) throw new Error('Configure DATABASE_URL ou PGDATABASE no ambiente da VM');
  return { connectionString: env.DATABASE_URL || undefined, host: env.PGHOST, port: env.PGPORT ? Number(env.PGPORT) : undefined,
    database: env.PGDATABASE, user: env.PGUSER, password: env.PGPASSWORD, connectionTimeoutMillis: 5000, max: 1 };
}
export function runtimePool() { return new pg.Pool(databaseConfig()); }
export async function identity(client, expected = process.env.REDE_NEX_EXPECTED_DATABASE) {
  const { rows: [row] } = await client.query(`SELECT current_database() name, current_user role,
    inet_server_addr()::text host, inet_server_port() port, r.rolsuper, r.rolbypassrls
    FROM pg_roles r WHERE r.rolname=current_user`);
  if (!expected || row.name !== expected) throw new Error('REDE_NEX_EXPECTED_DATABASE deve coincidir com o banco conectado');
  return row;
}
export function requireSafeRole(row) {
  if (row.rolsuper) throw new Error('A API exige uma role NOSUPERUSER; SUPERUSER ignora as politicas RLS');
  if (row.rolbypassrls) throw new Error('A API exige uma role NOBYPASSRLS; BYPASSRLS ignora as politicas RLS');
}
export const quoteIdentifier = value => '"' + String(value).replaceAll('"', '""') + '"';
