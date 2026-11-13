import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, delimiter, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFile } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { promisify } from 'node:util';
import pg from 'pg';
import { migrationFiles, migrationStatus, applyMigrations } from '../server/scripts/migrate.mjs';
import { pgDumpEnvironment, backupDatabase } from '../server/scripts/backup.mjs';
import { requireSafeRole, identity } from '../server/scripts/deploy-common.mjs';
import { releaseFiles } from '../deploy/verify-release.mjs';
import { preserveBrandAssets, brandAssets } from '../deploy/prepare-static-assets.mjs';

test('hosting: migration inventory is ordered, hashed and strips only the legacy outer transaction', async () => {
  const files = await migrationFiles();
  assert.deepEqual(files.map(file => file.name), ["20261016_hr_module.sql","20261017_runtime_tables.sql","20261026_task_collaboration.sql","20261027_hr_employee_termination.sql","20261028_chat_conversation_archives.sql","20261029_task_blueprints.sql","20261030_attention_browser_push.sql","20261031_chat_message_reactions.sql","20261101_achievement_avatar_frames.sql","20261102_user_appearance.sql","20261103_password_vault.sql","20261104_chat_message_delivery.sql","20261105_architecture.sql","20261106_behavioral_profiles.sql","20261112_android_push.sql","20261113_work_schedules.sql"]);
  assert.match(files[0].checksum, /^[0-9a-f]{64}$/);
  assert.ok(!files[0].sql.trim().startsWith('BEGIN;'));
  assert.ok(!files[0].sql.trim().endsWith('COMMIT;'));
  assert.match(files[0].sql, /BEGIN\s+FOREACH/);
  assert.doesNotMatch(files[1].sql, /INSERT INTO|DROP TABLE/i);
});
test('hosting: status is read-only and refuses rewritten or removed applied migrations', async () => {
  const files = await migrationFiles(); const calls = [];
  const client = { query: async sql => { calls.push(sql); return { rows: sql.includes('to_regclass') ? [{ present: false }] : [] }; } };
  assert.equal((await migrationStatus(client, files))[0].status, 'pending');
  assert.ok(calls.every(sql => sql.startsWith('SELECT')));
  client.query = async sql => ({ rows: sql.includes('to_regclass') ? [{ present: true }] : [{ name: files[0].name, checksum: 'changed' }] });
  await assert.rejects(() => migrationStatus(client, files), /alterada/);
});
test('hosting: privileged runtime or unexpected database is rejected', async () => {
  assert.throws(() => requireSafeRole({ rolsuper: true }), /SUPERUSER/);
  assert.throws(() => requireSafeRole({ rolbypassrls: true }), /BYPASSRLS/);
  requireSafeRole({ rolsuper: false, rolbypassrls: false });
  await assert.rejects(() => identity({ query: async () => ({ rows: [{ name: 'another_db' }] }) }, 'expected_db'), /EXPECTED_DATABASE/);
});
test('hosting: backup does not place credentials in process arguments or log', () => {
  const env = pgDumpEnvironment({ DATABASE_URL: 'postgresql://test_user:a%40b@127.0.0.1:55482/fictional?sslmode=require' });
  assert.equal(env.PGPASSWORD, 'a@b'); assert.equal(env.PGDATABASE, 'fictional'); assert.equal(env.PGSSLMODE, 'require');
  assert.equal(env.DATABASE_URL, undefined); assert.equal(env.REDE_NEX_MIGRATION_DATABASE_URL, undefined);
  assert.throws(() => pgDumpEnvironment({ DATABASE_URL: 'postgresql://user@localhost/test?unsupported=x' }), /não suportado/);
});
test('hosting: release refuses private paths, backup files and environment files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nex-release-test-'));
  try {
    await mkdir(join(root, 'dist')); await writeFile(join(root, 'dist/index.html'), '<html/>');
    assert.deepEqual(await releaseFiles(root), ['dist/index.html']);
    await writeFile(join(root, '.env'), 'FICTIONAL=not-a-secret');
    await assert.rejects(() => releaseFiles(root), /Arquivo/);
    await rm(join(root, '.env'));
    await mkdir(join(root, 'dist/uploads'));
    await assert.rejects(() => releaseFiles(root), /fora da lista/);
  } finally { await rm(root, { recursive: true }); }
});
test('hosting: updater backs up before migration and preserves non-code data', async () => {
  const script = await readFile(new URL('../deploy/update.sh', import.meta.url), 'utf8');
  assert.ok(script.indexOf('scripts/backup.mjs') < script.indexOf('scripts/migrate.mjs'));
  const managed = script.match(/^managed=\((.*)\)$/m)[1];
  assert.doesNotMatch(managed, /uploads|\.env|public|database|downloads/);
  assert.doesNotMatch(script, /rm -rf|pg_restore .*--clean|db:purge|seedTiData/);
  assert.match(script, /trap rollback ERR INT TERM/);
  const root=await mkdtemp(join(tmpdir(),'nex-brand-test-'));
  try {
    const current=join(root,'current');const release=join(root,'release');
    await mkdir(join(current,'dist/assets/images'),{recursive:true});await mkdir(release);
    await writeFile(join(release,'release-manifest.json'),JSON.stringify({application:'rede-nex',files:{}}));
    for(const name of brandAssets)await writeFile(join(current,'dist/assets/images',name),'fictional-brand-test');
    await writeFile(join(current,'dist/assets/images','private-file.png'),'must-not-copy');
    assert.equal((await preserveBrandAssets(release,current)).length,4);
    assert.equal((await releaseFiles(release)).filter(path=>path.startsWith('dist/assets/images/')).length,4);
    assert.ok(!Object.keys(JSON.parse(await readFile(join(release,'release-manifest.json'),'utf8')).files).some(path=>path.includes('private-file')));
  } finally {await rm(root,{recursive:true});}
});
test('hosting isolated PostgreSQL: apply, idempotency, checksums and transactional rollback', { skip: process.env.RUN_HR_DB_TESTS !== '1' }, async () => {
  const { createHrTestDb } = await import('./hr-test-support.mjs');
  const { pool, database } = await createHrTestDb(); const client = await pool.connect();
  try {
    const files = await migrationFiles();
    await client.query(await readFile(new URL('./hosting-legacy-fixture.sql', import.meta.url), 'utf8'));
    assert.equal((await migrationStatus(client, files)).filter(row => row.status === 'pending').length, files.length);
    assert.equal((await applyMigrations(client, files, { expectedDatabase: database, runtimeRole: 'rh_app' })).length, files.length);
    assert.deepEqual(await applyMigrations(client, files, { expectedDatabase: database, runtimeRole: 'rh_app' }), []);
    assert.equal((await client.query('SELECT count(*)::int n FROM ti_projects')).rows[0].n, 0, 'No example projects');
    const bad = { name: '20991231_failed.sql', checksum: 'fictional', sql: 'CREATE TABLE public.rollback_probe(id int); SELECT nonexistent_column FROM public.roles;' };
    await assert.rejects(() => applyMigrations(client, [...files, bad], { expectedDatabase: database, runtimeRole: 'rh_app' }));
    assert.equal((await client.query("SELECT to_regclass('public.rollback_probe') present")).rows[0].present, null);
    assert.equal((await client.query('SELECT count(*)::int n FROM nex_deploy.migrations')).rows[0].n, files.length);
    await assert.rejects(() => migrationStatus(client, [{ ...files[0], checksum: 'changed' }, ...files.slice(1)]), /alterada/);
  } finally { client.release(); await pool.end(); }
});

test('hosting isolated PostgreSQL: full backup restores FORCE RLS rows without using app bypass', { skip: process.env.RUN_HR_DB_TESTS !== '1' }, async () => {
  const { createHrTestDb } = await import('./hr-test-support.mjs');
  const { pool, database } = await createHrTestDb();
  const directory = await mkdtemp(join(tmpdir(), 'nex-backup-test-'));
  const keys = ['DATABASE_URL', 'REDE_NEX_EXPECTED_DATABASE', 'REDE_NEX_BACKUP_DATABASE_URL', 'REDE_NEX_MIGRATION_DATABASE_URL', 'PATH'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const admin = new pg.Pool({ host: '127.0.0.1', port: 55482, user: 'rh_test', database: 'postgres' });
  const restoredName = database + '_restore';
  try {
    process.env.DATABASE_URL = 'postgresql://rh_app@127.0.0.1:55482/' + database;
    process.env.REDE_NEX_EXPECTED_DATABASE = database;
    process.env.REDE_NEX_BACKUP_DATABASE_URL = 'postgresql://rh_test@127.0.0.1:55482/' + database;
    delete process.env.REDE_NEX_MIGRATION_DATABASE_URL;
    if (process.platform === 'win32') process.env.PATH = 'C:/Program Files/PostgreSQL/18/bin' + delimiter + process.env.PATH;
    const backup = await backupDatabase(directory);
    await admin.query('CREATE DATABASE ' + restoredName);
    await promisify(execFile)('pg_restore', ['--no-password', '--no-owner', '--no-privileges', '--exit-on-error', '--dbname', restoredName, backup], { env: { ...pgDumpEnvironment(), PGDATABASE: restoredName } });
    const restored = new pg.Pool({ host: '127.0.0.1', port: 55482, user: 'rh_test', database: restoredName });
    try {
      assert.equal((await restored.query('SELECT count(*)::int n FROM nex_hr.employees')).rows[0].n, 1);
      assert.equal((await restored.query('SELECT count(*)::int n FROM nex_hr.asos')).rows[0].n, 1);
      assert.equal((await restored.query('SELECT count(*)::int n FROM nex_hr.vacations')).rows[0].n, 1);
    } finally { await restored.end(); }
    delete process.env.REDE_NEX_BACKUP_DATABASE_URL;
    await assert.rejects(() => backupDatabase(directory), /Backup integral/);
  } finally {
    for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
    await admin.end(); await pool.end(); await rm(directory, { recursive: true });
  }
});
test('hosting isolated PostgreSQL: packaged API boots without optional secrets or startup DDL', { skip: process.env.RUN_HR_DB_TESTS !== '1' }, async () => {
  const { createHrTestDb } = await import('./hr-test-support.mjs');
  const { pool, database } = await createHrTestDb();
  const directory = await mkdtemp(join(tmpdir(), 'nex-api-start-test-'));
  const socket = createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  const envFile = join(directory, 'runtime.env');
  await writeFile(envFile, `DATABASE_URL=postgresql://rh_app@127.0.0.1:55482/${database}\nPORT=${port}\nHOST=127.0.0.1\nJRH_UPLOADS_DIR=${directory.replaceAll('\\', '/')}\n`);
  const runtimeRoot = process.env.NEX_TEST_RELEASE_DIR ? resolve(process.env.NEX_TEST_RELEASE_DIR) : fileURLToPath(new URL('..', import.meta.url));
  let expectedRelease = 'development';
  try { expectedRelease = JSON.parse(await readFile(join(runtimeRoot, 'release-manifest.json'), 'utf8')).release; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const child = spawn(process.execPath, ['server/src/server.js'], { cwd: runtimeRoot, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: 'production', REDE_NEX_ENV_FILE: envFile }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let output = ''; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
  const exited = once(child, 'exit');
  try {
    let response;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (child.exitCode !== null) throw new Error('API encerrou: ' + output);
      try { response = await fetch(`http://127.0.0.1:${port}/api/health`); if (response.ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(response?.status, 200, output);
    const health=await response.json();assert.equal(health.status, 'ok');assert.equal(health.release, expectedRelease);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/rh/asos`)).status, 401);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/ti/summary`)).status, 401);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/ti/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Never created' }) })).status, 401);
    assert.equal((await fetch(`http://127.0.0.1:${port}/uploads/avatars/fictional.png`)).status, 401);
    assert.equal((await pool.query("SELECT to_regclass('public.ti_projects') present")).rows[0].present, null);
  } finally { child.kill('SIGTERM'); await exited; await pool.end(); await rm(directory, { recursive: true }); }
});
