import { mkdir, stat, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, join, isAbsolute, relative, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { runtimePool, identity } from './deploy-common.mjs';
import { mediaUploadsDir, jrhUploadsDir, pcUploadsDir, downloadsDir } from '../src/runtimePaths.js';

export function pgDumpEnvironment(env = process.env) {
  const output = Object.fromEntries(Object.entries(env).filter(([key]) => /^(PATH|Path|SystemRoot|WINDIR|TEMP|TMP|HOME|USERPROFILE|LANG|LC_.*|PG[A-Z_]+)$/.test(key)));
  const connection = env.REDE_NEX_BACKUP_DATABASE_URL || env.REDE_NEX_MIGRATION_DATABASE_URL || env.DATABASE_URL;
  if (connection) {
    const url = new URL(connection);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('URL PostgreSQL inválida');
    for (const [key, value] of Object.entries({ PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password) })) output[key] = value;
    const supported = { sslmode: 'PGSSLMODE', sslrootcert: 'PGSSLROOTCERT', sslcert: 'PGSSLCERT', sslkey: 'PGSSLKEY', application_name: 'PGAPPNAME' };
    for (const [key, value] of url.searchParams) {
      if (!supported[key]) throw new Error('Parâmetro da conexão não suportado por backup: ' + key);
      output[supported[key]] = value;
    }
  }
  delete output.DATABASE_URL;
  delete output.REDE_NEX_MIGRATION_DATABASE_URL;
  return output;
}
async function run(command, args, env) {
  await new Promise((done, fail) => {
    const child = spawn(command, args, { env, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let failed = false;
    child.stderr.on('data', () => { failed = true; }); // Don't print diagnostics that might contain credentials.
    child.on('error', () => fail(new Error(command + ' indisponível no PATH')));
    child.on('exit', code => code === 0 ? done() : fail(new Error(command + ' falhou (código ' + code + (failed ? ', consulte permissões/versão do cliente PostgreSQL' : '') + ')')));
  });
}
export async function backupDatabase(directory) {
  if (!directory || !isAbsolute(directory)) throw new Error('Informe uma pasta absoluta de backup fora da aplicação');
  const root = resolve(process.cwd()); const target = resolve(directory);
  const relation = relative(root, target);
  if (relation !== '..' && !relation.startsWith('..' + sep) && !isAbsolute(relation)) throw new Error('Backup deve ficar fora da pasta da aplicação');
  for (const publicPath of [mediaUploadsDir, jrhUploadsDir, pcUploadsDir, downloadsDir]) {
    const rel = relative(publicPath, target);
    if (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel)) throw new Error('Backup não pode ficar dentro de mídia/downloads');
  }
  const pool = runtimePool();
  const backupConnection = process.env.REDE_NEX_BACKUP_DATABASE_URL || process.env.REDE_NEX_MIGRATION_DATABASE_URL;
  const backupPool = backupConnection ? new pg.Pool({ connectionString: backupConnection, connectionTimeoutMillis: 5000, max: 1 }) : pool;
  try {
    const app = await identity(pool); const backup = await identity(backupPool);
    if (app.name !== backup.name || app.host !== backup.host || app.port !== backup.port) throw new Error('Conexão de backup diverge do banco/servidor da aplicação');
    if (!backup.rolsuper && !backup.rolbypassrls) throw new Error('Backup integral de FORCE RLS exige role de backup com BYPASSRLS e leitura dos objetos. Defina REDE_NEX_BACKUP_DATABASE_URL somente no processo de atualização');
  } finally { if (backupPool !== pool) await backupPool.end(); await pool.end(); }
  const env = pgDumpEnvironment();
  if (env.PGDATABASE !== process.env.REDE_NEX_EXPECTED_DATABASE) throw new Error('Destino do pg_dump não coincide com REDE_NEX_EXPECTED_DATABASE');
  await mkdir(target, { recursive: true, mode: 0o700 });
  const path = join(target, 'database-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8) + '.dump');
  const partial = path + '.partial';
  await writeFile(partial, '', { flag: 'wx', mode: 0o600 });
  await run('pg_dump', ['--format=custom', '--no-password', '--file', partial], env);
  if ((await stat(partial)).size < 100) throw new Error('Backup vazio');
  await run('pg_restore', ['--list', partial], env);
  await rename(partial, path); // Never label a failed/incomplete dump as a usable backup.
  console.log(path);
  return path;
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (process.argv.length !== 3) { console.error('Uso: backup.mjs /caminho/absoluto/fora-da-aplicacao'); process.exitCode = 1; }
  else backupDatabase(process.argv[2]).catch(error => { console.error('Backup recusado:', error.message); process.exitCode = 1; });
}
