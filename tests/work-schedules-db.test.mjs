import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import pg from 'pg';
import {
  scheduleRepository,
  createScheduleRouter,
} from '../server/src/work-schedules.mjs';
import { generateFiveTwo } from '../shared/workSchedules.mjs';

test(
  'schedules database and HTTP: hierarchy, 5x2, agreements, atomic notices, conflicts, retries and own access',
  { skip: process.env.RUN_SCHEDULE_DB_TESTS !== '1', timeout: 60000 },
  async () => {
    const admin = new pg.Pool({
      host: '127.0.0.1',
      port: 55482,
      user: 'rh_test',
      database: 'postgres',
      connectionTimeoutMillis: 3000,
    });
    const database = `schedules_test_${process.pid}_${Date.now()}`;
    const ids = Object.fromEntries(
      [
        'admin',
        'root',
        'manager',
        'employee',
        'peer',
        'outsider',
        'inactive',
        'unassigned',
        'cycleManager',
        'cycleEmployee',
        'rootDept',
        'childDept',
        'otherDept',
        'cycleA',
        'cycleB',
        'adminRole',
        'managerRole',
        'employeeRole',
      ].map((name) => [name, randomUUID()]),
    );
    let pool, server;
    const from = '2026-11-09',
      to = '2026-11-15';
    const request = (entries) => ({ operation_id: randomUUID(), entries });
    try {
      await admin.query(`CREATE DATABASE ${database} OWNER rh_app`);
      pool = new pg.Pool({
        host: '127.0.0.1',
        port: 55482,
        user: 'rh_app',
        database,
        connectionTimeoutMillis: 3000,
        options: '-c statement_timeout=10000 -c lock_timeout=5000',
      });
      await pool.query(`CREATE TABLE roles(id uuid PRIMARY KEY,name text);
      CREATE TABLE users(id uuid PRIMARY KEY,name text,status text,role_id uuid REFERENCES roles(id),department_id uuid,photo_url text);
      CREATE TABLE departments(id uuid PRIMARY KEY,name text,parent_id uuid,manager_id uuid REFERENCES users(id));
      CREATE TABLE notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,title text,message text,type text,link text,actor_name text,actor_photo_url text);`);
      await pool.query(
        "INSERT INTO roles VALUES($1,'Administrador'),($2,'Gestor'),($3,'Colaborador')",
        [ids.adminRole, ids.managerRole, ids.employeeRole],
      );
      for (const name of [
        'admin',
        'root',
        'manager',
        'employee',
        'peer',
        'outsider',
        'inactive',
        'unassigned',
        'cycleManager',
        'cycleEmployee',
      ]) {
        await pool.query('INSERT INTO users VALUES($1,$2,$3,$4,NULL,NULL)', [
          ids[name],
          name + ' Ficticio',
          name === 'inactive' ? 'inactive' : 'active',
          name === 'admin'
            ? ids.adminRole
            : ['peer', 'unassigned'].includes(name)
              ? ids.managerRole
              : ids.employeeRole,
        ]);
      }
      await pool.query(
        "INSERT INTO departments VALUES($1,'Operacoes',NULL,$4),($2,'Suporte',$1,$5),($3,'Outra area',NULL,$6)",
        [
          ids.rootDept,
          ids.childDept,
          ids.otherDept,
          ids.root,
          ids.manager,
          ids.peer,
        ],
      );
      await pool.query(
        "INSERT INTO departments VALUES($1,'Ciclo A',$2,$3),($2,'Ciclo B',$1,NULL)",
        [ids.cycleA, ids.cycleB, ids.cycleManager],
      );
      await pool.query(
        'UPDATE users SET department_id=$1 WHERE id=ANY($2::uuid[])',
        [ids.childDept, [ids.employee, ids.manager, ids.inactive]],
      );
      await pool.query('UPDATE users SET department_id=$1 WHERE id=$2', [
        ids.otherDept,
        ids.outsider,
      ]);
      await pool.query('UPDATE users SET department_id=$1 WHERE id=$2', [
        ids.cycleA,
        ids.cycleEmployee,
      ]);
      await pool.query(
        await readFile(
          new URL(
            '../server/migrations/20261113_work_schedules.sql',
            import.meta.url,
          ),
          'utf8',
        ),
      );
      const repo = scheduleRepository(pool);
      const team = await repo.list(ids.root, from, to);
      assert.equal(
        team.departments.find((sector) => sector.id === ids.rootDept)
          .manager_id,
        ids.root,
      );
      assert.equal(
        team.departments.find((sector) => sector.id === ids.childDept)
          .manager_name,
        'manager Ficticio',
      );
      assert.equal(
        team.people.filter((person) => person.id === ids.manager).length,
        1,
      );
      const employeeView = await repo.list(ids.employee, from, to);
      assert.deepEqual(
        employeeView.departments.map((sector) => sector.id),
        [ids.childDept],
      );
      assert.equal(employeeView.departments[0].manager_id, ids.manager);
      assert.equal(employeeView.people.length, 1);
      assert.ok(
        !employeeView.entries.some((entry) => entry.user_id === ids.manager),
      );
      assert.equal(
        team.is_supervisor,
        true,
        'department manager is a supervisor regardless of role title',
      );
      assert.equal(
        team.people.find((person) => person.id === ids.employee).can_edit,
        true,
      );
      assert.equal(
        team.people.find((person) => person.id === ids.outsider).can_edit,
        false,
      );
      assert.equal((await repo.list(ids.outsider, from, to)).people.length, 1);
      assert.equal(
        (await repo.list(ids.admin, from, to)).people.every(
          (person) => person.can_edit,
        ),
        true,
      );
      assert.equal(
        (await repo.list(ids.cycleManager, from, to)).people.find(
          (person) => person.id === ids.cycleEmployee,
        ).can_edit,
        false,
      );

      const generated = generateFiveTwo({
        userIds: [ids.employee],
        from,
        to,
        workdays: [1, 2, 3, 4, 5],
        start_time: '08:00',
        end_time: '17:00',
      });
      const initial = request(generated);
      assert.equal((await repo.save(ids.manager, initial)).changed_count, 7);
      const notifications = (await pool.query('SELECT * FROM notifications'))
        .rows;
      assert.deepEqual(
        new Set(notifications.map((row) => row.user_id)),
        new Set([
          ids.admin,
          ids.root,
          ids.peer,
          ids.unassigned,
          ids.cycleManager,
        ]),
      );
      assert.ok(
        notifications.every((row) => row.link.startsWith('/escalas?date=')),
      );
      assert.equal((await repo.save(ids.manager, initial)).replayed, true);
      await assert.rejects(
        repo.save(ids.manager, {
          ...initial,
          entries: [{ ...generated[0], note: 'Different request' }],
        }),
        (error) => error.statusCode === 409,
      );
      await assert.rejects(
        repo.save(ids.root, initial),
        (error) => error.statusCode === 409,
      );
      assert.equal(
        (await pool.query('SELECT count(*)::int AS n FROM notifications'))
          .rows[0].n,
        5,
      );
      assert.equal(
        (await repo.history(ids.employee, from, to)).history.length,
        7,
      );
      assert.equal(
        (await repo.history(ids.outsider, from, to)).history.length,
        0,
      );
      assert.equal((await repo.list(ids.employee, from, to)).entries.length, 7);

      const old = (await repo.list(ids.manager, from, to)).entries.find(
        (entry) => entry.day === from,
      );
      const edit = {
        user_id: ids.employee,
        day: from,
        status: 'agreed_off',
        start_time: null,
        end_time: null,
        note: 'Folga combinada com compensação',
        expected_revision: old.revision,
      };
      assert.equal(
        (await repo.save(ids.root, request([edit]))).changed_count,
        1,
      );
      await assert.rejects(
        repo.save(ids.manager, request([edit])),
        (error) => error.statusCode === 409,
      );
      await assert.rejects(
        repo.save(ids.outsider, request([{ ...edit, expected_revision: 2 }])),
        (error) => error.statusCode === 403,
      );
      await assert.rejects(
        repo.save(ids.peer, request([{ ...edit, expected_revision: 2 }])),
        (error) => error.statusCode === 403,
      );
      await assert.rejects(
        repo.save(ids.unassigned, request([{ ...edit, expected_revision: 2 }])),
        (error) => error.statusCode === 403,
      );
      await assert.rejects(
        repo.save(ids.manager, request([{ ...edit, user_id: ids.inactive }])),
      );
      const unchanged = request([{ ...edit, expected_revision: 2 }]);
      const beforeNotices = (
        await pool.query('SELECT count(*)::int AS n FROM notifications')
      ).rows[0].n;
      assert.equal((await repo.save(ids.manager, unchanged)).changed_count, 0);
      assert.equal(
        (await pool.query('SELECT count(*)::int AS n FROM notifications'))
          .rows[0].n,
        beforeNotices,
      );

      const concurrent = await Promise.allSettled(
        ['Primeiro acordo', 'Segundo acordo'].map((note) =>
          repo.save(
            ids.manager,
            request([{ ...edit, note, expected_revision: 2 }]),
          ),
        ),
      );
      assert.equal(
        concurrent.filter((result) => result.status === 'fulfilled').length,
        1,
      );
      assert.equal(
        concurrent.filter(
          (result) =>
            result.status === 'rejected' && result.reason.statusCode === 409,
        ).length,
        1,
      );
      const current = (await repo.list(ids.manager, from, to)).entries.find(
        (entry) => entry.day === from,
      );
      assert.equal(current.revision, 3);
      // A batch with one stale day must leave every other day untouched.
      await assert.rejects(
        repo.save(
          ids.manager,
          request([
            { ...edit, expected_revision: 2 },
            { ...generated[1], note: 'Should roll back', expected_revision: 1 },
          ]),
        ),
        (error) => error.statusCode === 409,
      );
      assert.equal(
        (await repo.list(ids.manager, from, to)).entries.find(
          (entry) => entry.day === generated[1].day,
        ).note,
        '',
      );
      // A notification insertion failure rolls back calendar, operation and audit.
      await pool.query(
        "CREATE FUNCTION reject_schedule_notice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$; CREATE TRIGGER reject_schedule_notice BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION reject_schedule_notice();",
      );
      const rollback = request([
        { ...edit, expected_revision: 3, note: 'Failed change' },
      ]);
      await assert.rejects(repo.save(ids.manager, rollback));
      assert.equal(
        (await repo.list(ids.manager, from, to)).entries.find(
          (entry) => entry.day === from,
        ).revision,
        3,
      );
      await pool.query(
        'DROP TRIGGER reject_schedule_notice ON notifications; DROP FUNCTION reject_schedule_notice()',
      );
      assert.equal((await repo.save(ids.manager, rollback)).changed_count, 1);

      const sendJson = (_req, res, status, body) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      const sendError = (req, res, status, code, message) =>
        sendJson(req, res, status, { error: { code, message } });
      const router = createScheduleRouter({
        pool,
        sendJson,
        sendError,
        requireUser: async (req, res) => {
          const name = String(req.headers.cookie || '').replace('sid=', '');
          if (!ids[name] || !['manager', 'employee', 'peer'].includes(name)) {
            sendError(req, res, 401, 'UNAUTHORIZED', 'Login obrigatório');
            return null;
          }
          return { id: ids[name] };
        },
        readJson: async (req) => {
          let body = '';
          for await (const chunk of req) body += chunk;
          return JSON.parse(body || '{}');
        },
      });
      server = createServer(async (req, res) => {
        try {
          if (
            !(await router(req, res, new URL(req.url, 'http://local').pathname))
          )
            sendError(req, res, 404, 'NOT_FOUND', 'Not found');
        } catch (error) {
          sendError(req, res, 500, 'ERROR', error.message);
        }
      });
      await new Promise((done) => server.listen(0, '127.0.0.1', done));
      const base = `http://127.0.0.1:${server.address().port}/api/work-schedules`;
      assert.equal((await fetch(`${base}?from=${from}&to=${to}`)).status, 401);
      assert.equal(
        (
          await fetch(`${base}?from=${from}&to=${to}`, {
            headers: { cookie: 'sid=employee' },
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await fetch(base, {
            method: 'POST',
            headers: { cookie: 'sid=manager', 'X-Nex-User-Id': ids.employee },
            body: JSON.stringify(initial),
          })
        ).status,
        409,
      );
      const httpSave = await fetch(base, {
        method: 'POST',
        headers: { cookie: 'sid=manager', 'X-Nex-User-Id': ids.manager },
        body: JSON.stringify(
          request([{ ...edit, expected_revision: 4, note: 'Acordo por HTTP' }]),
        ),
      });
      assert.equal(httpSave.status, 200, await httpSave.text());
      // RLS also denies a query with no authenticated schedule context.
      assert.equal(
        (await pool.query('SELECT * FROM work_schedule_entries')).rowCount,
        0,
      );
      assert.equal(
        (await pool.query('SELECT * FROM work_schedule_history')).rowCount,
        0,
      );
      const policies = (
        await pool.query(
          "SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname IN ('work_schedule_entries','work_schedule_history','work_schedule_operations')",
        )
      ).rows;
      assert.equal(policies.length, 3);
      assert.ok(
        policies.every((row) => row.relrowsecurity && row.relforcerowsecurity),
      );
      const access = await pool.query(
        "SELECT bool_and(has_table_privilege(current_user,$1,privilege)) AS allowed FROM unnest(string_to_array($2,',')) AS privilege",
        ['public.work_schedule_entries', 'SELECT,INSERT,UPDATE'],
      );
      assert.equal(access.rows[0].allowed, true);
    } finally {
      if (server) {
        server.closeAllConnections();
        await new Promise((done) => server.close(done));
      }
      await pool?.end();
      await admin.query(`DROP DATABASE IF EXISTS ${database}`);
      await admin.end();
    }
  },
);
