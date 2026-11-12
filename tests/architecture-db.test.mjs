import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import pg from 'pg';
import { architectureRepository, createArchitectureRouter } from '../server/src/architecture.mjs';
import { newPlan } from '../shared/architecture.mjs';

test('architecture API persists drawings, enforces sharing and concurrent revisions with restricted Postgres RLS', {skip:process.env.RUN_ARCHITECTURE_DB_TESTS!=='1'},async()=>{
  const admin=new pg.Pool({host:'127.0.0.1',port:55482,user:'rh_test',database:'postgres',connectionTimeoutMillis:3000});
  const database=`architecture_test_${process.pid}_${Date.now()}`,alice=randomUUID(),bob=randomUUID(),carol=randomUUID(),inactive=randomUUID();let pool,server;
  const payload={title:'Casa de homologação',description:'Dados fictícios',site_type:'house',client_name:'Cliente de teste',address:'',visibility:'private',is_template:false,editor_ids:[],viewer_ids:[],document:newPlan('house')};
  try {
    await admin.query(`CREATE DATABASE ${database} OWNER rh_app`);pool=new pg.Pool({host:'127.0.0.1',port:55482,user:'rh_app',database,connectionTimeoutMillis:3000});
    await pool.query('CREATE TABLE public.users(id uuid PRIMARY KEY,name text,status text)');
    await pool.query("INSERT INTO users VALUES($1,'Alice Teste','active'),($2,'Bob Teste','active'),($3,'Carol Teste','active'),($4,'Inativo Teste','inactive')",[alice,bob,carol,inactive]);
    const migration=await readFile(new URL('../server/migrations/20261105_architecture.sql',import.meta.url),'utf8');await pool.query(migration);await pool.query(migration);
    const repo=architectureRepository(pool),created=await repo.create(alice,payload);assert.equal(created.owner_id,alice);assert.equal(created.revision,1);assert.equal(created.document.floors[0].elements.length,payload.document.floors[0].elements.length);
    assert.equal((await repo.list(bob)).projects.length,0);await assert.rejects(repo.get(bob,created.id),error=>error.statusCode===404);await assert.rejects(repo.create(inactive,payload),error=>error.statusCode===403);
    assert.equal((await pool.query('SELECT * FROM architecture_projects')).rowCount,0);
    const shared=await repo.save(alice,created.id,{...created,editor_ids:[bob],viewer_ids:[carol],expected_revision:1});assert.equal(shared.revision,2);
    assert.equal((await repo.get(bob,created.id)).can_edit,true);assert.equal((await repo.get(carol,created.id)).can_edit,false);
    await assert.rejects(repo.save(carol,created.id,{...shared,expected_revision:2}),error=>error.statusCode===403);
    await assert.rejects(repo.save(bob,created.id,{...shared,visibility:'team',expected_revision:2}),error=>error.statusCode===403);
    const edited=await repo.save(bob,created.id,{...shared,title:'Projeto editado',expected_revision:2});assert.equal(edited.revision,3);
    await assert.rejects(repo.save(alice,created.id,{...shared,expected_revision:2}),error=>error.statusCode===409);
    const client=await pool.connect();try{await client.query('BEGIN');await client.query("SELECT set_config('app.architecture_user_id',$1,true)",[bob]);await assert.rejects(client.query('UPDATE architecture_projects SET owner_id=$2 WHERE id=$1',[created.id,bob]),/imutáveis/);await client.query('ROLLBACK');}finally{client.release();}
    const archived=await repo.archive(alice,created.id,{archived:true,expected_revision:3});assert.ok(archived.archived_at);assert.equal((await repo.list(alice)).projects.length,0);assert.equal((await repo.list(alice,{archived:true})).projects.length,1);
    await assert.rejects(repo.save(bob,created.id,{...edited,expected_revision:4}),error=>error.statusCode===409);const restored=await repo.archive(alice,created.id,{archived:false,expected_revision:4});
    const race=await Promise.allSettled([repo.save(alice,created.id,{...restored,title:'Versão A',expected_revision:5}),repo.save(bob,created.id,{...restored,title:'Versão B',expected_revision:5})]);assert.equal(race.filter(result=>result.status==='fulfilled').length,1);assert.equal(race.find(result=>result.status==='rejected').reason.statusCode,409);
    const team=await repo.create(alice,{...payload,visibility:'team'});assert.equal((await repo.get(carol,team.id)).can_edit,false);assert.ok((await repo.list(carol)).projects.some(item=>item.id===team.id));
    const sendJson=(_req,res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
    const sendError=(req,res,status,code,message)=>sendJson(req,res,status,{error:{code,message}});
    const router=createArchitectureRouter({pool,sendJson,sendError,requireUser:async(req,res)=>{const userId=req.headers.cookie==='sid=alice'?alice:req.headers.cookie==='sid=bob'?bob:null;if(!userId){sendError(req,res,401,'UNAUTHORIZED','Entre para continuar');return null;}return {id:userId};},readJson:async req=>{let body='';for await(const chunk of req)body+=chunk;return JSON.parse(body||'{}');}});
    server=createServer(async(req,res)=>{try{if(!await router(req,res,new URL(req.url,'http://local').pathname))sendError(req,res,404,'NOT_FOUND','Not found');}catch(error){sendError(req,res,500,'ERROR',error.message);}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(origin+'/api/architecture/projects')).status,401);
    const viaHttp=await fetch(origin+'/api/architecture/projects',{method:'POST',headers:{cookie:'sid=alice','Content-Type':'application/json','X-Nex-User-Id':alice},body:JSON.stringify({...payload,is_template:true})});assert.equal(viaHttp.status,201);const model=(await viaHttp.json()).data;
    const response=await fetch(`${origin}/api/architecture/projects/${model.id}`,{headers:{cookie:'sid=alice'}});assert.equal(response.status,200);assert.equal((await response.json()).data.is_template,true);
    assert.equal((await fetch(`${origin}/api/architecture/projects/${model.id}`,{headers:{cookie:'sid=bob'}})).status,404);
    assert.equal((await fetch(`${origin}/api/architecture/projects/${model.id}`,{method:'PUT',headers:{cookie:'sid=alice','Content-Type':'application/json','X-Nex-User-Id':bob},body:'{}'})).status,409);
    const elevated=new pg.Pool({host:'127.0.0.1',port:55482,user:'rh_test',database,connectionTimeoutMillis:3000});try{const bypass=architectureRepository(elevated);await assert.rejects(bypass.get(bob,model.id),error=>error.statusCode===404);assert.ok(!(await bypass.list(bob)).projects.some(item=>item.id===model.id));}finally{await elevated.end();}
    const config=(await pool.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='public.architecture_projects'::regclass")).rows[0];assert.ok(config.relrowsecurity&&config.relforcerowsecurity);
  } finally {if(server)await new Promise(resolve=>server.close(resolve));await pool?.end();await admin.query(`DROP DATABASE IF EXISTS ${database}`);await admin.end();}
});
