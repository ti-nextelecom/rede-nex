import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createTaskChecklistProgressRouter } from '../server/src/task-checklist-progress.mjs';
import { canManageTask, canToggleTaskChecklist } from '../shared/taskCollaboration.mjs';

async function fixture(run) {
  const ids = Object.fromEntries(['owner', 'creator', 'participant', 'observer', 'outsider', 'admin', 'task', 'list', 'item', 'otherList', 'otherItem'].map(key => [key, randomUUID()]));
  const task = { id: ids.task, created_by: ids.creator, owner_id: ids.owner, assignees: [{ id: ids.participant }], observers: [{ id: ids.observer }], checklists: [{ id: ids.list, items: [{ id: ids.item, content: 'Etapa sem responsável individual', completed: false, assignee_id: null }] }, { id: ids.otherList, items: [{ id: ids.otherItem, content: 'Outra etapa', completed: false }] }] };
  const calls = [];
  const sendJson = (_req, res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  const router = createTaskChecklistProgressRouter({
    sendJson, sendError: (req, res, status, code, message) => sendJson(req, res, status, { error: { code, message } }),
    requireUser: async (req, res) => { const name = req.headers['x-test-user']; if (!ids[name]) { sendJson(req, res, 401, {}); return null; } return { id: ids[name], role_name: name === 'admin' ? 'Administrador' : 'Colaborador' }; },
    readJson: async req => { let body = ''; for await (const chunk of req) body += chunk; return JSON.parse(body); },
    getTask: async id => id === task.id ? structuredClone(task) : null,
    updateChecklistItem: async (id, payload) => { calls.push({ id, payload }); Object.assign(task.checklists.flatMap(group => group.items).find(item => item.id === id), payload); return true; },
  });
  const server = createServer(async (req, res) => { try { if (!await router(req, res, new URL(req.url, 'http://local').pathname)) { res.writeHead(404); res.end(); } } catch { res.writeHead(500); res.end(); } });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const path = `/api/tasks/${ids.task}/checklists/${ids.list}/items/${ids.item}`;
  async function patch(payload, actor = 'participant', target = path) { const response = await fetch(`http://127.0.0.1:${server.address().port}${target}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(actor ? { 'x-test-user': actor } : {}) }, body: JSON.stringify(payload) }); return { status: response.status, body: await response.json() }; }
  try { await run({ ids, task, calls, patch, path }); } finally { server.closeAllConnections(); await new Promise(done => server.close(done)); }
}

test('task participants can mark and unmark unassigned checklist steps without acquiring management permission', () => fixture(async ({ ids, task, patch, calls }) => {
  const actor = { id: ids.participant, role_name: 'Colaborador' };
  assert.equal(canManageTask(task, actor), false); assert.equal(canToggleTaskChecklist(task, actor), true);
  for (const completed of [true, false]) { const result = await patch({ completed }); assert.equal(result.status, 200); assert.equal(result.body.data.checklists[0].items[0].completed, completed); }
  assert.deepEqual(calls.map(call => call.payload), [{ completed: true }, { completed: false }]);
  assert.equal(task.checklists[0].items[0].content, 'Etapa sem responsável individual'); assert.equal(task.checklists[0].items[0].assignee_id, null);
}));

test('observers, outsiders and unauthenticated callers cannot update checklist progress', () => fixture(async ({ patch, calls }) => {
  for (const actor of ['observer', 'outsider']) assert.equal((await patch({ completed: true }, actor)).status, 403);
  assert.equal((await patch({ completed: true }, null)).status, 401); assert.equal(calls.length, 0);
}));

test('participant progress requests cannot carry content, roles or malformed completion values', () => fixture(async ({ patch, calls }) => {
  for (const field of ['content', 'assignee_id', 'participant_ids', 'observer_ids', 'task_id']) assert.equal((await patch({ completed: true, [field]: 'injected' })).status, 403);
  for (const completed of ['false', 1, null, []]) assert.equal((await patch({ completed })).status, 400);
  for (const payload of [null, [], 'wrong']) assert.equal((await patch(payload)).status, 400);
  assert.equal((await patch({})).status, 403); assert.equal(calls.length, 0);
}));

test('checklist progress validates the complete task/list/item relationship', () => fixture(async ({ ids, path, patch, calls }) => {
  assert.equal((await patch({ completed: true }, 'participant', path.replace(ids.item, ids.otherItem))).status, 404);
  assert.equal((await patch({ completed: true }, 'participant', path.replace(ids.task, randomUUID()))).status, 404);
  assert.equal((await patch({ completed: true }, 'participant', path.replace(ids.list, randomUUID()))).status, 404);
  assert.equal(calls.length, 0);
}));

test('owners, creators and administrators retain structural checklist editing', () => fixture(async ({ patch, calls }) => {
  for (const actor of ['owner', 'creator', 'admin']) assert.equal((await patch({ content: `Atualizada por ${actor}` }, actor)).status, 200);
  assert.equal((await patch({ completed: 'false' }, 'owner')).status, 400); assert.equal(calls.length, 3);
}));
