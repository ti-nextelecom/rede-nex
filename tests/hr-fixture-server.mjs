// Development-only fixture. Bind loopback; NEVER deploy this file.
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { pathToFileURL } from 'node:url';
import { createHrRouter } from '../server/src/hr.js';
import { createHrTestDb, ids } from './hr-test-support.mjs';
export function fixtureServer(pool) {
  const sendJson = (_req,res,status,payload,headers={}) => {res.writeHead(status,{'Content-Type':'application/json',...headers});res.end(JSON.stringify(payload));};
  const sendError = (req,res,status,code,message) => sendJson(req,res,status,{error:{code,message}});
  const readJson = async req => {let body='';for await (const chunk of req){body+=chunk;if(body.length>30000)throw Object.assign(new Error('Limite excedido'),{status:413});}return JSON.parse(body || '{}');};
  const actor = req => {
    const key = req.headers['x-test-actor'] || /rh_fixture=(\w+)/.exec(req.headers.cookie || '')?.[1] || 'admin';
    return ids[key] && ['admin','employee','manager','blocked'].includes(key) ? ids[key] : null;
  };
  const requireUser = async (req,res) => {
    const id = actor(req);
    if (!id) {sendError(req,res,401,'UNAUTHENTICATED','Não autenticado.');return null;}
    return (await pool.query('SELECT u.*,r.name AS role_name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1',[id])).rows[0];
  };
  const route = createHrRouter({pool,requireUser,sendJson,sendError,readJson});
  const server = createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://127.0.0.1');
      if(url.pathname==='/api/__fixture/actor') {
        const who=url.searchParams.get('as');if(!['admin','employee','manager','blocked'].includes(who))return sendError(req,res,400,'INVALID','Usuário fictício inválido');
        res.writeHead(302,{'Set-Cookie':`rh_fixture=${who}; HttpOnly; SameSite=Strict; Path=/`,'Location':'/tests/fixtures/rh.html'});res.end();return;
      }
      if(url.pathname==='/api/auth/me')return sendJson(req,res,200,{data:await requireUser(req,res)});
      if(url.pathname==='/api/auth/heartbeat')return sendJson(req,res,200,{ok:true});
      // Minimal shell data for testing the REAL App/Layout at /rh; never proxy.
      if(req.method==='GET' && ['/api/notifications','/api/chat/conversations','/api/users/online'].includes(url.pathname))return sendJson(req,res,200,{data:[]});
      if(!await route(req,res,url.pathname.replace(/\/+$/,'') || '/'))sendError(req,res,404,'FIXTURE_ONLY','A fixture não acessa a API real.');
    } catch {sendError(req,res,500,'FIXTURE_ERROR','Falha da fixture de teste.');}
  });
  const sockets = new WebSocketServer({server,path:'/ws'});
  sockets.on('connection',socket=>socket.on('message',()=>{}));
  return server;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const {pool,database}=await createHrTestDb();const server=fixtureServer(pool);
  server.listen(55484,'127.0.0.1',()=>console.log(`RH fixture local em 127.0.0.1:55484; banco isolado ${database}; dados fictícios.`));
  const close=()=>server.close(async()=>{await pool.end();process.exit(0);});process.on('SIGINT',close);process.on('SIGTERM',close);
}
