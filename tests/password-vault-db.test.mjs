// Explicit opt-in, loopback-only disposable DB. Does not read application environment files.
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createVault, encryptVault } from '../shared/passwordVault.mjs';
import { createVaultRouter, passwordVault } from '../server/src/password-vault.mjs';

test('vault HTTP/DB enforces account ownership, encryption, RLS and optimistic concurrent writes', { skip: process.env.RUN_VAULT_DB_TESTS !== '1' }, async () => {
  const admin = new pg.Pool({ host: '127.0.0.1', port: 55482, user: 'rh_test', database: 'postgres', connectionTimeoutMillis: 3000 });
  const database = `vault_test_${process.pid}_${Date.now()}`;
  let pool, server;
  const alice = '10000000-0000-4000-8000-000000000001', bob = '10000000-0000-4000-8000-000000000002';
  try {
    await admin.query(`CREATE DATABASE ${database} OWNER rh_app`);
    pool = new pg.Pool({ host: '127.0.0.1', port: 55482, user: 'rh_app', database, connectionTimeoutMillis: 3000 });
    const role = (await pool.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.equal(role.rolsuper, false); assert.equal(role.rolbypassrls, false);
    await pool.query('CREATE TABLE users(id uuid PRIMARY KEY)');
    await pool.query('INSERT INTO users VALUES($1),($2)', [alice, bob]);
    const migration = await readFile(new URL('../server/migrations/20261103_password_vault.sql', import.meta.url), 'utf8');
    await pool.query(migration); await pool.query(migration);
    const sendJson = (_req, res, status, payload) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(payload)); };
    const sendError = (req, res, status, code, message) => sendJson(req, res, status, { error: { code, message } });
    const handler = createVaultRouter({ pool, sendJson, sendError, requireUser: async (req, res) => {
      const id = req.headers['x-test-user']; if ([alice, bob].includes(id)) return { id };
      sendError(req, res, 401, 'AUTH', 'Entre na conta'); return null;
    }, readJson: async req => { let data = ''; for await (const chunk of req) data += chunk; return JSON.parse(data); } });
    server = createServer((req, res) => void handler(req, res, '/api/users/me/password-vault').catch(error => sendError(req, res, error.statusCode || 500, 'ERROR', error.message)));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}/api/users/me/password-vault`;
    const request = (actor, method = 'GET', body, owner = actor) => fetch(url, { method, headers: { 'x-test-user': actor || '', 'x-nex-user-id': owner || '', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    assert.equal((await request()).status, 401);
    const created = await createVault('Senha mestra fictícia! 234', alice);
    const envelope = await encryptVault(created.key, created.salt, alice, [{ id: 'dummy', title: 'Serviço', username: 'example', password: 'SENHA-FICTICIA', url: 'https://example.invalid/', notes: '' }]);
    const body = { expected_revision: 0, envelope };
    assert.equal((await request(alice, 'PUT', body, bob)).status, 409);
    assert.equal((await request(alice, 'PUT', { ...body, user_id: bob })).status, 400);
    assert.equal((await request(alice, 'PUT', body)).status, 200);
    assert.equal((await request(bob)).headers.get('cache-control'), 'no-store');
    assert.equal((await (await request(bob)).json()).data.envelope, null);
    const saved = (await (await request(alice)).json()).data;
    assert.deepEqual(saved.envelope, envelope); assert.equal(saved.revision, 1);
    assert.ok(!JSON.stringify(saved).includes('SENHA-FICTICIA'));
    assert.equal((await pool.query('SELECT * FROM password_vaults')).rowCount, 0);
    const client = await pool.connect();
    try {
      await client.query('BEGIN'); await client.query("SELECT set_config('app.vault_user_id',$1,true)", [bob]);
      assert.equal((await client.query('SELECT * FROM password_vaults WHERE user_id=$1', [alice])).rowCount, 0);
      await assert.rejects(client.query('INSERT INTO password_vaults(user_id,envelope) VALUES($1,$2)', [alice, envelope]), /row-level security/);
      await client.query('ROLLBACK');
    } finally { client.release(); }
    const repository = passwordVault(pool);
    const results = await Promise.allSettled([repository.save(alice, { expected_revision: 1, envelope }), repository.save(alice, { expected_revision: 1, envelope })]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.find(result => result.status === 'rejected').reason.statusCode, 409);
    assert.equal((await repository.get(alice)).revision, 2);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await pool?.end(); await admin.query(`DROP DATABASE IF EXISTS ${database}`); await admin.end();
  }
});
