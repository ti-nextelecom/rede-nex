import test from 'node:test';
import assert from 'node:assert/strict';
import { taskCommentNotices } from '../server/src/workNotifications.js';
import { taskMentionAt, applyTaskMention } from '../shared/taskMentions.mjs';
import { androidAvatarUrl } from '../shared/androidNotificationAvatar.mjs';

const actor = { id: 'author', name: 'Autor Ficticio' };
const users = [{ id: 'author', name: actor.name }, { id: 'ana', name: 'Ana' }, { id: 'ana-luiza', name: 'Ana Luiza' }, { id: 'bob', name: 'Bruno Silva' }, { id: 'outsider', name: 'Pessoa Externa' }];
const task = { id: 'task-id', title: 'Tarefa privada ficticia', created_by: actor.id, owner_id: 'bob', assignees: [{ id: 'ana' }], observers: [{ id: 'ana-luiza' }] };
const notice = content => taskCommentNotices(task, actor, content, users);
const mentioned = content => notice(content).filter(item => item.title.includes('mencionado')).flatMap(item => item.userIds);

test('task mentions stay within the task audience and replace generic activity notices without duplication', () => {
  assert.deepEqual(mentioned('@Ana Luiza, revise com @Bruno Silva. @Pessoa Externa nao tem acesso.'), ['ana-luiza', 'bob']);
  const notices = notice('@Ana Luiza @Ana Luiza @Bruno Silva');
  const ids = notices.flatMap(item => item.userIds);
  assert.equal(ids.length, new Set(ids).size);
  assert.deepEqual([...ids].sort(), ['ana', 'ana-luiza', 'bob']);
  assert.ok(notices.every(item => !item.userIds.includes(actor.id) && !item.userIds.includes('outsider')));
  assert.ok(notices.every(item => item.link === '/tarefas?tarefa=task-id'));
  assert.deepEqual(mentioned('Revise com @Ana.'), ['ana']);
  assert.deepEqual(mentioned('@AnaLuiza'), []);
  assert.deepEqual(mentioned('email@Ana ou https://example.invalid/@Ana'), []);
  assert.deepEqual([...mentioned('@todos')].sort(), ['ana', 'ana-luiza', 'bob']);
});

test('ambiguous names, attachment names and URLs do not invent task mentions', () => {
  const duplicate = [...users, { id: 'duplicate', name: 'Ana' }];
  const expanded = { ...task, assignees: [...task.assignees, { id: 'duplicate' }] };
  assert.equal(taskCommentNotices(expanded, actor, '@Ana', duplicate).filter(item => item.title.includes('mencionado')).length, 0);
  const file = { id: 'file', name: '@Ana.pdf', file_url: '/uploads/chat/report.pdf' };
  const withFile = taskCommentNotices({ ...task, files: [file] }, actor, 'Segue anexo\n\n[Anexo: @Ana.pdf](/uploads/chat/report.pdf)', users);
  assert.ok(withFile.every(item => !item.title.includes('mencionado')));
  assert.deepEqual(mentioned('[Anexo: @Ana.pdf](/uploads/chat/report.pdf)'), []);
  assert.deepEqual(mentioned('@Autor Ficticio'), []);
});

test('task mention selection preserves text after the caret and rejects email addresses', () => {
  const text = 'Revisar @An depois deste trecho @Bruno Silva';
  const caret = text.indexOf(' depois');
  const range = taskMentionAt(text, caret);
  assert.equal(range.query, 'An');
  const inserted = applyTaskMention(text, range, 'Ana Luiza');
  assert.equal(inserted.text, 'Revisar @Ana Luiza  depois deste trecho @Bruno Silva');
  assert.equal(inserted.caret, 'Revisar @Ana Luiza '.length);
  assert.equal(taskMentionAt('pessoa@example.invalid', 10), null);
  assert.equal(taskMentionAt('Mensagem normal', 15), null);
  assert.equal(taskMentionAt('@Ana\ntexto', 10), null);
  assert.equal(applyTaskMention(text, null, 'Ana'), null);
});

test('Android sender photos accept bounded HTTPS or platform-relative URLs without credentials', () => {
  assert.equal(androidAvatarUrl('/uploads/avatars/ficticio.png'), 'https://rede.nextelecom.net.br/uploads/avatars/ficticio.png');
  assert.equal(androidAvatarUrl('https://images.example.invalid/avatar.png'), 'https://images.example.invalid/avatar.png');
  for (const value of [undefined, '', 'data:image/png;base64,AAAA', 'javascript:alert(1)', 'http://example.invalid/a.png', 'https://user:secret@example.invalid/a.png', 'https://example.invalid/' + 'a'.repeat(1100), '/uploads/avatars/a\n.png', '\\example.invalid\\a']) assert.equal(androidAvatarUrl(value), '');
});