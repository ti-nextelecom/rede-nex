import test from 'node:test';
import assert from 'node:assert/strict';
import { chatDelivery } from '../shared/chatDelivery.mjs';
import { CHAT_NOTIFICATION_SOUND, scheduleChatNotificationSound } from '../shared/chatNotificationSound.mjs';
test('sidebar distinguishes unread, partially read group messages and read by all', () => {
  const conversation = { last_message: { sender: { id: 'me' }, created_at: '2026-10-30T10:00:00Z', recipient_count: 3, read_count: 0 } };
  assert.equal(chatDelivery(conversation, 'me').label, 'Não lida');
  conversation.last_message.read_count = 1;
  assert.deepEqual(chatDelivery(conversation, 'me'), { read: true, complete: false, label: 'Lida por 1 de 3' });
  conversation.last_message.read_count = 3;
  assert.equal(chatDelivery(conversation, 'me').label, 'Lida por todos');
  assert.equal(chatDelivery(conversation, 'other'), null);
  assert.equal(chatDelivery({ last_message: { sender: { id: 'me' }, created_at: '2026-10-30T10:00:00Z' }, other_participant: { last_read_at: '2026-10-30T10:01:00Z' } }, 'me').label, 'Lida');
});
test('notification schedules one distinct sustained chime and releases every audio node', () => {
  let started = 0, ended = 0, disconnected = 0, closed = 0, finished = 0;
  let oscillator;
  const parameter = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  const context = { currentTime: 0, destination: {}, createGain: () => ({ gain: parameter, connect() {}, disconnect() { disconnected++; } }), createOscillator: () => oscillator = ({ frequency: parameter, connect() {}, disconnect() { disconnected++; }, start() { started++; }, stop(time) { if (time) { assert.ok(time >= .85); ended++; } } }), close: async () => { closed++; } };
  const stop = scheduleChatNotificationSound(context, () => finished++);
  assert.equal(CHAT_NOTIFICATION_SOUND.repeats, 1);
  assert.equal(started, 1); assert.equal(ended, 1);
  assert.ok(CHAT_NOTIFICATION_SOUND.duration >= .8);
  oscillator.onended(); stop();
  assert.equal(disconnected, 2); assert.equal(closed, 1); assert.equal(finished, 1);
});
