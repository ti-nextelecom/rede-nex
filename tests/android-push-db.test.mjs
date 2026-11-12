import test from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID} from 'node:crypto';import {readFile} from 'node:fs/promises';
import {saveAndroidToken,dispatchAndroidPushBatch,validateDeviceToken} from '../server/src/fcm.mjs';
test('device tokens reject malformed input before SQL',()=>{for(const token of [null,'short','x'.repeat(4097),'x'.repeat(30)+'\n'])assert.throws(()=>validateDeviceToken(token),e=>e.statusCode===400);assert.equal(validateDeviceToken('fictional-device-token-0123456789'),'fictional-device-token-0123456789');});
test('Android durable queue binds sessions, respects mute and logout, retries without duplicating sent devices and prevents account-switch leaks',{skip:process.env.RUN_ANDROID_PUSH_DB_TESTS!=='1',timeout:60000},async()=>{
 const admin=new pg.Pool({host:'127.0.0.1',port:55482,user:'rh_test',database:'postgres',connectionTimeoutMillis:3000}),database='android_push_test_'+process.pid+'_'+Date.now();let pool;
 const alice=randomUUID(),bob=randomUUID(),sa=randomUUID(),sa2=randomUUID(),sb=randomUUID(),cid=randomUUID();
 const ta='fictional-alice-token-0123456789',ta2='fictional-alice-second-0123456789',tb='fictional-bob-token-0123456789';
 try{
  await admin.query('CREATE DATABASE '+database+' OWNER rh_app');pool=new pg.Pool({host:'127.0.0.1',port:55482,user:'rh_app',database,connectionTimeoutMillis:3000});
  await pool.query(`CREATE TABLE users(id uuid PRIMARY KEY,status text);CREATE TABLE user_sessions(id uuid PRIMARY KEY,user_id uuid REFERENCES users(id),revoked_at timestamptz,expires_at timestamptz);
    CREATE TABLE notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES users(id),title text,message text,type text,link text,actor_photo_url text,read boolean DEFAULT false);
    CREATE TABLE chat_participants(conversation_id uuid,user_id uuid,is_muted boolean,PRIMARY KEY(conversation_id,user_id));
    CREATE TABLE device_fcm_tokens(token text UNIQUE,user_id uuid REFERENCES users(id),updated_at timestamptz DEFAULT now());`);
  await pool.query("INSERT INTO users VALUES($1,'active'),($2,'active')",[alice,bob]);await pool.query("INSERT INTO user_sessions VALUES($1,$2,NULL,now()+interval '1 day'),($3,$2,NULL,now()+interval '1 day'),($4,$5,NULL,now()+interval '1 day')",[sa,alice,sa2,sb,bob]);
  await pool.query('INSERT INTO device_fcm_tokens(token,user_id) VALUES($1,$2)',['legacy-preserved-token-0123456789',alice]);
  const sql=await readFile(new URL('../server/migrations/20261112_android_push.sql',import.meta.url),'utf8');await pool.query(sql);await pool.query(sql);
  assert.equal((await pool.query('SELECT count(*)::int n FROM device_fcm_tokens')).rows[0].n,1);
  const a={id:alice,session_id:sa},a2={id:alice,session_id:sa2},b={id:bob,session_id:sb};
  await assert.rejects(saveAndroidToken(pool,{id:alice,session_id:sb},{token:ta}),e=>e.statusCode===401);
  await saveAndroidToken(pool,a,{token:ta});await saveAndroidToken(pool,a2,{token:ta2});await saveAndroidToken(pool,b,{token:tb});
  const notice=async(userId,extra={})=>(await pool.query('INSERT INTO notifications(user_id,title,message,type,link,read) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[userId,'Teste','Mensagem ficticia',extra.type||'info',extra.link||'/',extra.read||false])).rows[0].id;
  const avatarNotice=await notice(alice);await pool.query('UPDATE notifications SET actor_photo_url=$1 WHERE id=$2',['/uploads/avatars/ficticio.png',avatarNotice]);const sent=[];let fail=true;await dispatchAndroidPushBatch(pool,async msg=>{if(msg.token===ta&&fail){fail=false;throw Error('offline');}sent.push(msg);});assert.equal(sent.length,1);assert.equal((await pool.query('SELECT count(*)::int n FROM android_push_deliveries')).rows[0].n,1);
  await pool.query('UPDATE android_push_deliveries SET next_attempt_at=now()');await dispatchAndroidPushBatch(pool,async msg=>sent.push(msg));assert.equal(sent.length,2);assert.equal(new Set(sent.map(m=>m.token)).size,2);assert.ok(sent.every(m=>m.data.senderAvatar==='https://rede.nextelecom.net.br/uploads/avatars/ficticio.png'));assert.ok(sent.every(m=>m.data.title==='Teste'&&m.android.priority==='high'&&!m.notification));assert.equal(await dispatchAndroidPushBatch(pool,async()=>{throw Error('must not resend');}),0);
  await pool.query('INSERT INTO chat_participants VALUES($1,$2,true)',[cid,alice]);await notice(alice,{type:'chat',link:'/bate-papo?conversa='+cid});await dispatchAndroidPushBatch(pool,async()=>{throw Error('muted must not send');});assert.equal((await pool.query('SELECT count(*)::int n FROM android_push_deliveries')).rows[0].n,0);
  await notice(alice,{type:'warning',link:'/bate-papo?conversa='+cid+'&atencao='+randomUUID()});let attention=0;await dispatchAndroidPushBatch(pool,async()=>attention++);assert.equal(attention,2);
  await notice(alice,{read:true});await dispatchAndroidPushBatch(pool,async()=>{throw Error('read must not send');});
  await notice(alice);await pool.query('UPDATE user_sessions SET revoked_at=now() WHERE id=$1',[sa]);const afterLogout=[];await dispatchAndroidPushBatch(pool,async m=>afterLogout.push(m));assert.deepEqual(afterLogout.map(m=>m.token),[ta2]);
  await notice(alice);await saveAndroidToken(pool,b,{token:ta2});await dispatchAndroidPushBatch(pool,async()=>{throw Error('old account message must not leak');});
  await notice(bob);const bobSent=[];await dispatchAndroidPushBatch(pool,async m=>{if(m.token===tb)throw Object.assign(Error('unregistered'),{code:'messaging/registration-token-not-registered'});bobSent.push(m);});assert.equal(bobSent.length,1);assert.equal(bobSent[0].token,ta2);assert.equal((await pool.query('SELECT count(*)::int n FROM device_fcm_tokens WHERE token=$1',[tb])).rows[0].n,0);
  assert.equal((await pool.query('SELECT count(*)::int n FROM android_push_deliveries')).rows[0].n,0);
 }finally{await pool?.end();await admin.query('DROP DATABASE IF EXISTS '+database);await admin.end();}
});
