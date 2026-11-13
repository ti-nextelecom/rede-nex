import test from 'node:test';
import assert from 'node:assert/strict';
import { chatMessageEditParts, applyChatMessageEdit } from '../shared/chatMessageEdit.mjs';

test('editing preserves paragraphs, mentions, accents and forwarding metadata', () => {
  const text = 'Olá, @Maria Silva.\n\nPrimeiro parágrafo.\nSegunda linha — ação e atenção. 😀';
  assert.equal(applyChatMessageEdit(text, chatMessageEditParts(text).text), text);
  const forwarded = '[FWD:João Silva]\n' + text;
  assert.equal(applyChatMessageEdit(forwarded, text + '\nFim.'), forwarded + '\nFim.');
  assert.equal(applyChatMessageEdit('[STICKER]😀', '👍'), '[STICKER]👍');
  assert.throws(() => applyChatMessageEdit(text, '   '));
  assert.throws(() => applyChatMessageEdit(text, 'x'.repeat(8001)));
});

test('editing captions preserves attachment URLs and allows removing the caption', () => {
  for (const type of ['[IMAGE]', '[VIDEO]', '[AUDIO_MSG]', '[DOC|Projeto.pdf]', '[FILE]', '[DOC]']) {
    const metadata = type + '/uploads/chat/' + 'a'.repeat(4500) + '.pdf';
    const original = metadata + '\nLegenda\n\nCom parágrafos e @Maria Silva';
    assert.equal(chatMessageEditParts(original).text, 'Legenda\n\nCom parágrafos e @Maria Silva');
    assert.equal(applyChatMessageEdit(original, 'Nova\n\nlegenda'), metadata + '\nNova\n\nlegenda');
    assert.equal(applyChatMessageEdit(original, ''), metadata);
    assert.equal(applyChatMessageEdit('[FWD:João]\n' + metadata, 'Olá'), '[FWD:João]\n' + metadata + '\nOlá');
  }
});

test('repository saves long edits and intact media metadata in PostgreSQL', { skip: process.env.RUN_CHAT_DELIVERY_DB_TESTS !== '1' }, async () => {
  const { default: pg } = await import('pg');
  const { randomUUID } = await import('node:crypto');
  const admin = new pg.Pool({host:'127.0.0.1',port:55482,user:'rh_test',database:'postgres',connectionTimeoutMillis:3000});
  const database = `chat_edit_test_${process.pid}_${Date.now()}`;
  const previousUrl = process.env.DATABASE_URL;
  let applicationPool;
  try {
    await admin.query(`CREATE DATABASE ${database} OWNER rh_app`);
    process.env.DATABASE_URL = `postgresql://rh_app@127.0.0.1:55482/${database}`;
    const { pool } = await import('../server/src/db.js');
    applicationPool = pool;
    const { editMessage } = await import('../server/src/chat.repository.js');
    await pool.query(`CREATE TABLE chat_messages(id uuid PRIMARY KEY, sender_id uuid, conversation_id uuid, content text, created_at timestamptz DEFAULT now(), edited_at timestamptz);
      CREATE TABLE chat_message_edits(message_id uuid REFERENCES chat_messages(id), content text, edited_at timestamptz)`);
    const sender = randomUUID(), id = randomUUID(), conversation = randomUUID();
    const original = 'Mensagem inicial\n\nPreservar parágrafos';
    await pool.query('INSERT INTO chat_messages(id,sender_id,conversation_id,content) VALUES($1,$2,$3,$4)', [id,sender,conversation,original]);
    const long = 'Linha longa com acentuação.\n'.repeat(220);
    assert.ok(long.length > 4000 && long.length < 8000);
    assert.equal((await editMessage(sender,id,long)).content,long.trim());
    const media = '[IMAGE]/uploads/' + 'a'.repeat(4500) + '.png\nLegenda\n\nSegunda linha';
    assert.equal((await editMessage(sender,id,media)).content,media);
    assert.equal((await pool.query('SELECT content FROM chat_message_edits ORDER BY edited_at')).rows[0].content,original);
    await assert.rejects(editMessage(sender,id,'x'.repeat(8001)), error => error.statusCode === 400);
    assert.equal((await pool.query('SELECT content FROM chat_messages WHERE id=$1',[id])).rows[0].content,media);
    assert.equal(await editMessage(randomUUID(),id,'Outro usuário'),null);
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    await applicationPool?.end();
    await admin.query(`DROP DATABASE IF EXISTS ${database}`);
    await admin.end();
  }
});
