import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { runtimePool, identity, requireSafeRole, quoteIdentifier } from './deploy-common.mjs';

export async function migrationFiles(directory = new URL('../migrations/', import.meta.url)) {
  const names = (await readdir(directory)).filter(name => /^\d{8}_[a-z0-9_]+\.sql$/.test(name)).sort();
  return Promise.all(names.map(async name => {
    const sql = (await readFile(new URL(name, directory), 'utf8')).replace(/\r\n/g, '\n');
    // The original RH file is also usable via psql. Strip ONLY its outer wrapper.
    const body = name === '20261016_hr_module.sql' ? sql.replace(/^(\s*--[^\n]*\n)*\s*BEGIN;\s*/i, '').replace(/\s*COMMIT;\s*$/i, '') : sql;
    return { name, sql: body, checksum: createHash('sha256').update(sql).digest('hex') };
  }));
}
export async function migrationStatus(client, files) {
  const exists = (await client.query("SELECT to_regclass('nex_deploy.migrations') IS NOT NULL present")).rows[0].present;
  const applied = exists ? (await client.query('SELECT name,checksum FROM nex_deploy.migrations')).rows : [];
  for (const row of applied) {
    const file = files.find(file => file.name === row.name);
    if (!file || file.checksum !== row.checksum) throw new Error(`Migração já aplicada foi removida/alterada: ${row.name}`);
  }
  return files.map(file => ({ name: file.name, status: applied.some(row => row.name === file.name) ? 'applied' : 'pending' }));
}
export async function applyMigrations(client, files, { expectedDatabase, runtimeRole }) {
  await identity(client, expectedDatabase);
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='120s'");
    const locked = (await client.query("SELECT pg_try_advisory_xact_lock(hashtext('rede-nex-migrations')) locked")).rows[0].locked;
    if (!locked) throw new Error('Outra atualização está migrando este banco');
    await client.query(`CREATE SCHEMA IF NOT EXISTS nex_deploy;
      REVOKE ALL ON SCHEMA nex_deploy FROM PUBLIC;
      CREATE TABLE IF NOT EXISTS nex_deploy.migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
      REVOKE ALL ON nex_deploy.migrations FROM PUBLIC`);
    const status = await migrationStatus(client, files);
    for (const file of files) {
      if (status.find(row => row.name === file.name).status === 'applied') continue;
      await client.query(file.sql);
      await client.query('INSERT INTO nex_deploy.migrations(name,checksum) VALUES($1,$2)', [file.name, file.checksum]);
    }
    if (runtimeRole) {
      const role = (await client.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1', [runtimeRole])).rows[0];
      if (!role) throw new Error('Role runtime não encontrada'); if (!role.rolsuper && !role.rolbypassrls) {
      const target = quoteIdentifier(runtimeRole);
      await client.query(`GRANT USAGE ON SCHEMA nex_hr TO ${target};
        GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA nex_hr TO ${target};
        GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA nex_hr TO ${target};
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA nex_hr TO ${target};
        GRANT SELECT,INSERT,UPDATE,DELETE ON public.ti_projects,public.ti_tasks,public.ti_task_history,public.training_progress,public.nav_settings,public.task_observers,
          public.chat_conversation_archives,public.task_template_recipients,public.task_checklist_item_people,
          public.chat_attention_requests,public.browser_push_subscriptions,public.browser_push_deliveries,public.chat_message_reactions,public.password_vaults,public.device_fcm_tokens,public.android_push_deliveries,public.user_avatar_frames,public.user_appearance_preferences TO ${target};
        GRANT SELECT,INSERT,UPDATE ON public.architecture_projects TO ${target};
        GRANT SELECT,INSERT ON public.behavioral_assessments TO ${target};
        GRANT SELECT,INSERT,UPDATE,DELETE ON public.behavioral_drafts TO ${target};
        GRANT SELECT,INSERT,UPDATE ON public.behavioral_badges TO ${target};
        GRANT USAGE,SELECT ON SEQUENCE public.browser_push_deliveries_id_seq,public.android_push_deliveries_id_seq TO ${target}`);
      }
    }
    await client.query('COMMIT');
    return status.filter(row => row.status === 'pending').map(row => row.name);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--apply', '--status'].includes(arg)) || (args.includes('--apply') && args.includes('--status'))) throw new Error('Uso: migrate.mjs [--status|--apply]');
  const runtime = runtimePool();
  let migrationPool;
  try {
    const app = await identity(runtime); requireSafeRole(app);
    migrationPool = process.env.REDE_NEX_MIGRATION_DATABASE_URL ? new pg.Pool({ connectionString: process.env.REDE_NEX_MIGRATION_DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 }) : runtime;
    const client = await migrationPool.connect();
    try {
      const migration = await identity(client);
      if (app.host !== migration.host || app.port !== migration.port || app.name !== migration.name) throw new Error('Conexões de runtime e migração não apontam para o mesmo banco/servidor');
      const files = await migrationFiles();
      if (args.includes('--apply')) console.log(JSON.stringify({ applied: await applyMigrations(client, files, { expectedDatabase: app.name, runtimeRole: app.role }) }));
      else console.log(JSON.stringify({ database: app.name, migrations: await migrationStatus(client, files) }, null, 2));
    } finally { client.release(); }
  } finally { if (migrationPool && migrationPool !== runtime) await migrationPool.end(); await runtime.end(); }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(error => { console.error('Migração recusada:', error.message); process.exitCode = 1; });
}
