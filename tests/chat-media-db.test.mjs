import test from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID,createHash} from 'node:crypto';import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';import {resolve,join} from 'node:path';import {spawn} from 'node:child_process';import {once} from 'node:events';import {createServer} from 'node:net';
test('real API accepts HTML/audio, downloads HTML safely, preserves audio playback headers and authenticates Android registration',{skip:process.env.RUN_CHAT_MEDIA_DB_TESTS!=='1',timeout:60000},async()=>{
 const admin=new pg.Pool({host:'127.0.0.1',port:55482,user:'rh_test',database:'postgres',connectionTimeoutMillis:3000}),database='chat_media_test_'+process.pid+'_'+Date.now();const directory=resolve('.cache',database);if(!directory.startsWith(resolve('.cache')+'\\')&&process.platform==='win32')throw Error('Unsafe fixture directory');
 let pool,child,exited;const uid=randomUUID(),sid=randomUUID(),session='fictional-http-session-'+randomUUID();
 try{
  await mkdir(directory,{recursive:true});await admin.query('CREATE DATABASE '+database+' OWNER rh_app');pool=new pg.Pool({host:'127.0.0.1',port:55482,user:'rh_app',database,connectionTimeoutMillis:3000});
  await pool.query(`CREATE TABLE roles(id uuid PRIMARY KEY,name text);CREATE TABLE departments(id uuid PRIMARY KEY,name text);
    CREATE TABLE users(id uuid PRIMARY KEY,name text,status text,role_id uuid,department_id uuid);
    CREATE TABLE user_sessions(id uuid PRIMARY KEY,user_id uuid REFERENCES users(id),token_hash text,last_seen_at timestamptz,expires_at timestamptz,revoked_at timestamptz);
    CREATE TABLE notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES users(id));
    CREATE TABLE media_assets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket text,path text,public_url text,file_name text,file_type text,file_size bigint,owner_id uuid,context text);`);
  await pool.query("INSERT INTO users(id,name,status) VALUES($1,'Pessoa Ficticia','active')",[uid]);await pool.query("INSERT INTO user_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 day')",[sid,uid,createHash('sha256').update(session).digest('hex')]);
  await pool.query(await readFile(new URL('../server/migrations/20261112_android_push.sql',import.meta.url),'utf8'));
  const socket=createServer();await new Promise(done=>socket.listen(0,'127.0.0.1',done));const port=socket.address().port;await new Promise(done=>socket.close(done));
  const envFile=join(directory,'fixture.env');await writeFile(envFile,`DATABASE_URL=postgresql://rh_app@127.0.0.1:55482/${database}\nPORT=${port}\nHOST=127.0.0.1\nUPLOADS_DIR=${directory.replaceAll('\\','/')}\n`);
  child=spawn(process.execPath,['server/src/server.js'],{cwd:process.cwd(),env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,NODE_ENV:'production',REDE_NEX_ENV_FILE:envFile},stdio:['ignore','pipe','pipe'],windowsHide:true});exited=once(child,'exit');let output='';child.stdout.on('data',s=>output+=s);child.stderr.on('data',s=>output+=s);
  const origin='http://127.0.0.1:'+port;let healthy=false;for(let i=0;i<60;i++){if(child.exitCode!==null)throw Error(output);try{healthy=(await fetch(origin+'/api/health')).ok;}catch{}if(healthy)break;await new Promise(done=>setTimeout(done,100));}assert.equal(healthy,true,output);
  const auth={Authorization:'Bearer '+session,'Content-Type':'application/json'};
  const upload=async(name,type,buffer)=>fetch(origin+'/api/chat/media',{method:'POST',headers:auth,body:JSON.stringify({file_name:name,file_type:type,data:buffer.toString('base64')})});
  assert.equal((await fetch(origin+'/api/chat/media',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
  const html=Buffer.from('<!doctype html><script>window.HTML_MUST_NOT_EXECUTE=true;</script><h1>Relatorio</h1>');const response=await upload('relatorio.html','text/html',html);assert.equal(response.status,201,await response.clone().text());const url=(await response.json()).data.public_url;assert.match(url,/\.html$/);
  const download=await fetch(origin+url,{headers:auth});assert.equal(download.status,200);assert.equal(download.headers.get('content-type'),'application/octet-stream');assert.match(download.headers.get('content-disposition'),/^attachment;/);assert.match(download.headers.get('content-security-policy'),/^sandbox;/);assert.equal(download.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await download.arrayBuffer()),html);assert.equal((await fetch(origin+url)).status,401);
  for(const[name,type,prefix,expected]of [['voz.m4a','audio/x-m4a',Buffer.from([0,0,0,20,102,116,121,112]),'audio/mp4'],['voz.mp3','audio/mpeg',Buffer.from('ID3'),'audio/mpeg'],['voz.flac','audio/x-flac',Buffer.from('fLaC'),'audio/flac'],['voz.opus','audio/opus',Buffer.from('OggS'),'audio/ogg'],['voz.aac','audio/aac',Buffer.from([255,241]),'audio/aac'],['voz.amr','audio/amr',Buffer.from('#!AMR\n'),'audio/amr'],['voz.wav','audio/x-wav',Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(4),Buffer.from('WAVE')]),'audio/wav']]){
    const bytes=Buffer.concat([prefix,Buffer.alloc(32)]),sent=await upload(name,type,bytes);assert.equal(sent.status,201,await sent.clone().text());const audioUrl=(await sent.json()).data.public_url,audio=await fetch(origin+audioUrl,{headers:auth});assert.equal(audio.headers.get('content-type'),expected);assert.equal(audio.headers.get('content-disposition'),null);assert.deepEqual(Buffer.from(await audio.arrayBuffer()),bytes);
  }
  assert.equal((await upload('fake.mp3','audio/mpeg',html)).status,400);
  const endpoint=origin+'/api/devices/fcm-token',token='fictional-api-device-token-0123456789';
  assert.equal((await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})})).status,401);
  assert.equal((await fetch(endpoint,{method:'POST',headers:{...auth,'X-Nex-User-Id':randomUUID()},body:JSON.stringify({token})})).status,409);
  assert.equal((await fetch(endpoint,{method:'POST',headers:auth,body:JSON.stringify({token:'bad'})})).status,400);
  assert.equal((await fetch(endpoint,{method:'POST',headers:auth,body:JSON.stringify({token,user_id:randomUUID()})})).status,200);
  const row=(await pool.query('SELECT user_id,session_id FROM device_fcm_tokens WHERE token=$1',[token])).rows[0];assert.deepEqual(row,{user_id:uid,session_id:sid});
 }finally{if(child){if(child.exitCode===null)child.kill('SIGTERM');await exited;}await pool?.end();await admin.query('DROP DATABASE IF EXISTS '+database);await admin.end();if(directory.startsWith(resolve('.cache')))await rm(directory,{recursive:true,force:true});}
});
