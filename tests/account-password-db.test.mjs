import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID, randomBytes, scryptSync } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';

// All users, passwords and sessions are fictional and exist only in localhost.
test('password API: own password, administrative temporary password, forced login and access isolation',
  { skip: process.env.RUN_ACCOUNT_PASSWORD_DB_TESTS !== '1', timeout: 120000 }, async () => {
  const database = 'account_password_test_' + process.pid + '_' + Date.now();
  const directory = resolve('.cache', database);
  assert.ok(directory.startsWith(resolve('.cache') + sep));
  const adminDb = new pg.Pool({ host: '127.0.0.1', port: 55482, user: 'rh_test', database: 'postgres', connectionTimeoutMillis: 3000 });
  let pool, child, exited;
  const ids = { admin: randomUUID(), bob: randomUUID(), carol: randomUUID(), roleAdmin: randomUUID(), roleEmployee: randomUUID() };
  const original = 'Ficticia-inicial!827', temporary = 'Ficticia-temporaria!392', personal = 'Ficticia-pessoal!593';
  const hash = password => { const salt = randomBytes(16).toString('hex'); return `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`; };
  try {
    await mkdir(directory, { recursive: true });
    await adminDb.query('CREATE DATABASE ' + database + ' OWNER rh_app');
    pool = new pg.Pool({ host: '127.0.0.1', port: 55482, user: 'rh_app', database, connectionTimeoutMillis: 3000 });
    await pool.query(`
      CREATE TABLE roles(id uuid PRIMARY KEY, name text, description text, created_at timestamptz DEFAULT now());
      CREATE TABLE departments(id uuid PRIMARY KEY, name text, description text, created_at timestamptz DEFAULT now());
      CREATE TABLE users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, email text UNIQUE, password_hash text,
        status text DEFAULT 'active', role_id uuid, department_id uuid, photo_url text, cover_url text, bio text,
        position text, phone text, admission_date date, birth_date date, last_seen_at timestamptz, last_login_at timestamptz,
        must_change_password boolean DEFAULT false, password_changed_at timestamptz, bitrix_id text,
        bitrix_department text, bitrix_active boolean, bitrix_last_sync_at timestamptz, source text,
        created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
      CREATE TABLE user_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id),
        token_hash text, user_agent text, ip_address text, last_seen_at timestamptz, expires_at timestamptz, revoked_at timestamptz);
      CREATE TABLE audit_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, action text, entity_type text,
        entity_id uuid, old_data jsonb, new_data jsonb, metadata jsonb, ip_address text, user_agent text);
    `);
    await pool.query("INSERT INTO roles(id,name) VALUES($1,'Administrador'),($2,'Colaborador')", [ids.roleAdmin, ids.roleEmployee]);
    for (const person of ['admin', 'bob', 'carol']) {
      await pool.query('INSERT INTO users(id,name,email,password_hash,role_id) VALUES($1,$2,$3,$4,$5)',
        [ids[person], 'Pessoa ficticia ' + person, person + '@example.invalid', hash(original), person === 'admin' ? ids.roleAdmin : ids.roleEmployee]);
    }
    const socket = createServer(); await new Promise(done => socket.listen(0, '127.0.0.1', done));
    const port = socket.address().port; await new Promise(done => socket.close(done));
    const envFile = join(directory, 'fixture.env');
    await writeFile(envFile, `DATABASE_URL=postgresql://rh_app@127.0.0.1:55482/${database}\nPORT=${port}\nHOST=127.0.0.1\nUPLOADS_DIR=${directory.replaceAll('\\','/')}\n`);
    child = spawn(process.execPath, ['server/src/server.js'], { cwd: process.cwd(),
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: 'production', REDE_NEX_ENV_FILE: envFile },
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    exited = once(child, 'exit'); let output = '';
    child.stdout.on('data', bytes => { output += bytes; }); child.stderr.on('data', bytes => { output += bytes; });
    const origin = 'http://127.0.0.1:' + port;
    let ready = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      if (child.exitCode !== null) throw Error('API fixture exited: ' + output);
      try { await fetch(origin + '/api/auth/me'); ready = true; break; } catch { await new Promise(done => setTimeout(done, 100)); }
    }
    assert.ok(ready, 'API fixture must start: ' + output);
    const call = (path, { token, method = 'GET', body } = {}) => fetch(origin + '/api' + path, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const login = async (email, password, expected = 200) => {
      const response = await call('/auth/login', { method: 'POST', body: { email: email + '@example.invalid', password } });
      assert.equal(response.status, expected, await response.clone().text());
      const result = await response.json();
      if (expected === 200) {
        const cookie = response.headers.get('set-cookie')?.match(/(?:^|[,;]\s*)session=([^;]+)/)?.[1];
        assert.ok(cookie, 'Login returns an HttpOnly session cookie');
        result.data.token = decodeURIComponent(cookie);
      }
      return result;
    };
    const account = async id => (await pool.query('SELECT password_hash,must_change_password,password_changed_at FROM users WHERE id=$1', [id])).rows[0];
    const actor = (await login('admin', original)).data.token;
    const bob = (await login('bob', original)).data.token;
    const carolBefore = await account(ids.carol);
    assert.equal((await call('/auth/change-password', { method: 'POST', body: { current_password: original, new_password: personal } })).status, 401);
    assert.equal((await call('/users/' + ids.carol, { method: 'PUT', token: bob, body: { password: temporary, must_change_password: true } })).status, 403);

    const reset = await call('/users/' + ids.bob, { method: 'PUT', token: actor, body: { password: temporary, must_change_password: true } });
    assert.equal(reset.status, 200, await reset.clone().text());
    assert.equal((await reset.json()).data.must_change_password, true);
    const forcedHash = (await account(ids.bob)).password_hash;
    assert.notEqual(forcedHash, temporary); assert.match(forcedHash, /^scrypt:/);
    await login('bob', original, 401);
    const forcedLogin = await login('bob', temporary); assert.equal(forcedLogin.data.user.must_change_password, true);
    assert.equal(forcedLogin.data.user.password_hash, undefined);
    const forcedToken = forcedLogin.data.token;
    const denied = await call('/users', { token: forcedToken });
    assert.equal(denied.status, 403); assert.equal((await denied.json()).error.code, 'PASSWORD_CHANGE_REQUIRED');
    assert.equal((await call('/auth/me', { token: forcedToken })).status, 200);
    assert.equal((await call('/users/' + ids.bob, { method: 'PUT', token: actor, body: { name: 'Pessoa ficticia atualizada' } })).status, 200);
    assert.equal((await account(ids.bob)).must_change_password, true, 'editing other profile data cannot clear the gate');

    for (const [current_password, new_password, status] of [
      ['Senha-incorreta!839', personal, 403], [temporary, 'fraca', 400],
      [temporary, temporary, 400], [{ invalid: true }, personal, 400], [temporary, { invalid: true }, 400],
    ]) {
      assert.equal((await call('/auth/change-password', { method: 'POST', token: forcedToken, body: { current_password, new_password } })).status, status);
      assert.equal((await account(ids.bob)).password_hash, forcedHash);
      assert.equal((await account(ids.bob)).must_change_password, true);
    }
    const changed = await call('/auth/change-password', { method: 'POST', token: forcedToken,
      body: { current_password: temporary, new_password: personal, user_id: ids.carol } });
    assert.equal(changed.status, 200, await changed.clone().text());
    assert.equal((await account(ids.bob)).must_change_password, false);
    assert.ok((await account(ids.bob)).password_changed_at);
    assert.equal((await call('/users', { token: forcedToken })).status, 200);
    await login('bob', temporary, 401); await login('bob', personal);
    assert.deepEqual(await account(ids.carol), carolBefore, 'self service cannot modify another account');

    for (const option of ['false', 1, null]) {
      assert.equal((await call('/users/' + ids.bob, { method: 'PUT', token: actor, body: { password: temporary, must_change_password: option } })).status, 400);
    }
    assert.equal((await call('/users/' + ids.bob, { method: 'PUT', token: actor, body: { must_change_password: true } })).status, 400);
    assert.equal((await call('/users/' + ids.bob, { method: 'PUT', token: actor, body: { password: temporary, must_change_password: false } })).status, 200);
    assert.equal((await account(ids.bob)).must_change_password, false);
    const finalLogin = await login('bob', temporary); assert.equal(finalLogin.data.user.must_change_password, false);
    assert.equal((await call('/users', { token: finalLogin.data.token })).status, 200);
    assert.equal((await call('/users/' + ids.bob, { method: 'PUT', token: actor, body: { password: personal } })).status, 200);
    assert.equal((await account(ids.bob)).must_change_password, false, 'existing API clients retain the established default');

    for (const [name, flag] of [['new_default', undefined], ['new_optional', false]]) {
      const created = await call('/users', { method: 'POST', token: actor, body: {
        name: 'Pessoa ficticia nova', email: name + '@example.invalid', password: temporary, role_id: ids.roleEmployee,
        ...(flag === undefined ? {} : { must_change_password: flag }),
      } });
      assert.equal(created.status, 201, await created.clone().text());
      assert.equal((await created.json()).data.must_change_password, flag ?? true);
    }
    const audits = JSON.stringify((await pool.query('SELECT * FROM audit_logs')).rows);
    for (const password of [original, temporary, personal]) assert.ok(!audits.includes(password), 'audit records must never contain passwords');
  } finally {
    if (child) { if (child.exitCode === null) child.kill('SIGTERM'); await exited; }
    await pool?.end(); await adminDb.query('DROP DATABASE IF EXISTS ' + database); await adminDb.end();
    if (directory.startsWith(resolve('.cache') + sep)) await rm(directory, { recursive: true, force: true });
  }
});