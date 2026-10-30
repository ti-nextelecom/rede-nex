import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeChatMessages, reuseChatSnapshot } from '../shared/chatTimeline.mjs';
import { createChatDraftStore } from '../shared/chatDrafts.mjs';
import { buildChatNotices, chatMessageLink, chatNotificationTarget } from '../shared/chatMessageLinks.mjs';
import { applyChatRead, chatDelivery, preserveConversationReads } from '../shared/chatDelivery.mjs';
import { markChatRead } from '../server/src/chat-read.mjs';

test('unchanged polling preserves the history and every row; one edit replaces only its row', () => {
  const previous = Array.from({ length: 1000 }, (_, index) => ({ id: String(index), created_at: new Date(1000 * index).toISOString(), content: `Mensagem ${index}`, reactions: [] }));
  const latest = structuredClone(previous.slice(-50));
  assert.equal(mergeChatMessages(previous, latest), previous);
  latest[25].content = 'Editada';
  const result = mergeChatMessages(previous, latest);
  assert.equal(result.length, 1000);
  assert.equal(result[0], previous[0]);
  assert.equal(result[974], previous[974]);
  assert.notEqual(result[975], previous[975]);
  assert.equal(result[975].content, 'Editada');
  assert.equal(reuseChatSnapshot(previous, structuredClone(previous)), previous);
});

test('typing updates immediately without synchronous storage writes, and flush preserves each chat', () => {
  const data = new Map(); let writes = 0;
  const storage = { getItem: key => data.get(key) || null, setItem(key, value) { writes++; data.set(key, value); }, removeItem(key) { writes++; data.delete(key); } };
  const drafts = createChatDraftStore({ ownerId: 'alice', storage });
  for (let index = 0; index < 500; index++) drafts.set('a', 'Texto ' + index);
  drafts.set('b', 'Outro chat');
  assert.equal(writes, 0);
  assert.equal(drafts.capture('a').text, 'Texto 499');
  drafts.flush(); assert.equal(writes, 1);
  const restored = createChatDraftStore({ ownerId: 'alice', storage });
  assert.equal(restored.capture('a').text, 'Texto 499'); assert.equal(restored.capture('b').text, 'Outro chat');
  const sent = drafts.capture('a');
  drafts.set('a', 'Novo rascunho durante envio');
  assert.equal(drafts.clearIfUnchanged('a', sent), false);
  drafts.flush();
  assert.equal(createChatDraftStore({ ownerId: 'alice', storage }).capture('a').text, 'Novo rascunho durante envio');
  assert.equal(createChatDraftStore({ ownerId: 'bob', storage }).capture('a'), undefined);
});

const participants = [{ user_id: 'alice', name: 'Alice Teste' }, { user_id: 'bob', name: 'Bruno Silva' }, { user_id: 'carla', name: 'Carla Teste' }];
const notices = content => buildChatNotices({ participants, actorId: 'alice', conversationId: 'conversation-1', message: { id: 'message-99', content } });
test('mentions notify only conversation participants, and target the exact private or group message', () => {
  const rows = notices('Olá @Bruno Silva, pode conferir? @Pessoa Externa');
  const mentioned = rows.find(row => row.mentioned);
  assert.deepEqual(mentioned.userIds, ['bob']);
  assert.deepEqual(rows.find(row => !row.mentioned).userIds, ['carla']);
  assert.deepEqual(chatNotificationTarget(mentioned.link), { conversationId: 'conversation-1', messageId: 'message-99', mention: true });
  const direct = buildChatNotices({ participants: participants.slice(0, 2), actorId: 'alice', conversationId: 'private', message: { id: 'm2', content: '@Bruno Silva' } });
  assert.deepEqual(direct[0].userIds, ['bob']);
  assert.equal(chatNotificationTarget(direct[0].link).messageId, 'm2');
  assert.deepEqual(notices('@todos')[0].userIds, ['bob', 'carla']);
});

test('media captions support mentions without interpreting attachment URLs, bytes or filenames as names', () => {
  for (const prefix of ['[IMAGE]', '[VIDEO]', '[AUDIO_MSG]', '[DOC|relatorio.pdf]']) {
    const rows = notices(`${prefix}https://example.invalid/media\n@Bruno Silva, veja este arquivo.`);
    assert.deepEqual(rows.find(row => row.mentioned).userIds, ['bob']);
    assert.equal(chatNotificationTarget(rows.find(row => row.mentioned).link).messageId, 'message-99');
  }
  assert.equal(notices('[DOC|@Bruno Silva.pdf]https://example.invalid/file').some(row => row.mentioned), false);
  assert.equal(notices('Acesse https://example.invalid/@Bruno Silva').some(row => row.mentioned), false);
  assert.equal(notices('[FWD:@Bruno Silva]\nTexto sem marcação').some(row => row.mentioned), false);
});

test('chat links encode IDs and reject external or malformed redirects', () => {
  const link = chatMessageLink('private&other=1', 'message?x=1', true);
  assert.equal(chatNotificationTarget(link).conversationId, 'private&other=1');
  assert.equal(chatNotificationTarget(link).messageId, 'message?x=1');
  for (const link of ['https://example.invalid/bate-papo?conversa=x', '//example.invalid', '/\\evil', '/tarefas?conversa=x']) assert.equal(chatNotificationTarget(link), null);
});

test('private read events update the double-check state, and stale polling cannot undo a receipt', () => {
  const conversation = { id: 'private', other_participant: { id: 'bob' }, last_message: { id: 'm1', sender: { id: 'alice' }, created_at: '2026-10-30T10:00:00Z', recipient_count: 1, read_count: 0 } };
  assert.equal(chatDelivery(conversation, 'alice').read, false);
  const event = { conversationId: 'private', readBy: 'bob', lastReadAt: '2026-10-30T10:01:00Z' };
  const updated = applyChatRead([conversation], event);
  assert.deepEqual(chatDelivery(updated[0], 'alice'), { read: true, complete: true, label: 'Lida' });
  const merged = preserveConversationReads(updated, [structuredClone(conversation)]);
  assert.equal(chatDelivery(merged[0], 'alice').read, true);
  assert.equal(applyChatRead(updated, { ...event, readBy: 'outsider' }), updated);
  assert.equal(applyChatRead(updated, { ...event, lastReadAt: 'invalid' }), updated);
  const newer = { ...conversation, last_message: { ...conversation.last_message, created_at: '2026-10-30T10:02:00Z' } };
  assert.equal(chatDelivery(preserveConversationReads(updated, [newer])[0], 'alice').read, false);
});

test('read acknowledgements require membership and publish only to participants of that conversation', async () => {
  const events = [], calls = [];
  const query = async (sql, params) => { calls.push({ sql, params }); return { rows: sql.startsWith('UPDATE') ? [{ last_read_at: '2026-10-30T10:01:00Z' }] : [{ user_id: 'alice' }, { user_id: 'carla' }] }; };
  assert.equal(await markChatRead(query, 'bob', 'private', (id, event) => events.push({ id, event })), true);
  assert.deepEqual(calls[0].params, ['private', 'bob']);
  assert.deepEqual(events.map(item => item.id), ['alice', 'carla']);
  assert.equal(events[0].event.readBy, 'bob');
  assert.equal(events[0].event.type, 'message:read');
  assert.equal(await markChatRead(async () => ({ rows: [] }), 'outsider', 'private', () => assert.fail('Must not publish')), false);
});
