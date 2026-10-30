import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { insertChatMessage } from '../server/src/chat-message-insert.mjs';
test('concurrent retries insert once, preserve payload identity and allow intentional identical messages with new IDs', {skip:process.env.RUN_CHAT_DELIVERY_DB_TESTS!=='1'}, async () => {
  const admin=new pg.Pool({host:'127.0.0.1',port:55482,user:'rh_test',database:'postgres',connectionTimeoutMillis:3000});
  const database=`chat_delivery_test_${process.pid}_${Date.now()}`; let pool;
  try {
    await admin.query(`CREATE DATABASE ${database} OWNER rh_app`);
    pool=new pg.Pool({host:'127.0.0.1',port:55482,user:'rh_app',database,connectionTimeoutMillis:3000});
    await pool.query('CREATE TABLE chat_conversations(id uuid PRIMARY KEY,updated_at timestamptz DEFAULT now()); CREATE TABLE chat_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid REFERENCES chat_conversations(id),sender_id uuid,content text,attachment_url text,reply_to_id uuid,created_at timestamptz DEFAULT now())');
    const migration=await readFile(new URL('../server/migrations/20261104_chat_message_delivery.sql',import.meta.url),'utf8'); await pool.query(migration);await pool.query(migration);
    const userId=randomUUID(),conversationId=randomUUID(),other=randomUUID(),clientMessageId=randomUUID();
    await pool.query('INSERT INTO chat_conversations(id) VALUES($1),($2)',[conversationId,other]);
    const input={userId,conversationId,content:'Texto fictício',clientMessageId}; const query=pool.query.bind(pool);
    const results=await Promise.all([insertChatMessage(query,input),insertChatMessage(query,input)]);
    assert.equal(results.filter(result=>result.inserted).length,1); assert.equal(results[0].message.id,results[1].message.id);
    assert.equal((await pool.query('SELECT * FROM chat_messages')).rowCount,1);
    await assert.rejects(insertChatMessage(query,{...input,content:'Outro texto'}),error=>error.statusCode===409);
    await assert.rejects(insertChatMessage(query,{...input,conversationId:other}),error=>error.statusCode===409);
    await insertChatMessage(query,{...input,clientMessageId:randomUUID()});
    assert.equal((await pool.query('SELECT * FROM chat_messages')).rowCount,2);
    await assert.rejects(insertChatMessage(query,{...input,clientMessageId:'bad'}),error=>error.statusCode===400);
  } finally { await pool?.end(); await admin.query(`DROP DATABASE IF EXISTS ${database}`); await admin.end(); }
});
