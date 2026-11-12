import test from 'node:test';import assert from 'node:assert/strict';
import {startNativePushRegistration,nativePushLink} from '../shared/nativePushRegistration.mjs';
const cid='10000000-0000-4000-8000-000000000001',mid='20000000-0000-4000-8000-000000000002';
const flush=()=>new Promise(done=>setImmediate(done));
function ports(permission='granted'){
 const events={},log=[],removed=[];
 const listener=(name,fn)=>{events[name]=fn;log.push(name);return Promise.resolve({remove:async()=>{removed.push(name);}});};
 return {events,log,removed,push:{addListener:listener,checkPermissions:async()=>{log.push('check');return {receive:permission};},requestPermissions:async()=>({receive:'granted'}),createChannel:async()=>{log.push('channel');},register:async()=>{log.push('register');events.registration({value:'valid-token-value-for-fictional-device'});}},app:{addListener:listener,getLaunchUrl:async()=>undefined}};
}
test('native registration installs callbacks before registering, persists token and opens the exact message',async()=>{
 const p=ports(),saved=[],paths=[];const c=startNativePushRegistration({...p,saveToken:async token=>saved.push(token),navigate:path=>paths.push(path)});await c.ready;await flush();assert.equal(saved.length,1);assert.ok(p.log.indexOf('registration')<p.log.indexOf('register'));
 p.events.pushNotificationActionPerformed({notification:{data:{conversationId:cid,messageId:mid}}});assert.match(paths[0],new RegExp('mensagem='+mid));
 p.events.appUrlOpen({url:`rede-nex://chat/${cid}?mensagem=${mid}&mencao=1`});assert.match(paths[1],/mencao=1/);c.stop();assert.equal(p.removed.length,5);p.events.registration({value:'late-token'});await flush();assert.equal(saved.length,1);
});
test('permission refusal does not register; token delivery retries after a network error',async()=>{
 const denied=ports('denied');let notice=0;const d=startNativePushRegistration({...denied,saveToken:async()=>{throw Error('must not send');},navigate:()=>{},onDenied:()=>notice++});await d.ready;assert.equal(notice,1);assert.ok(!denied.log.includes('register'));d.stop();
 const p=ports();let calls=0,retry;const c=startNativePushRegistration({...p,saveToken:async()=>{if(++calls===1)throw Error('offline');},navigate:()=>{},timers:{setTimeout:fn=>{retry=fn;return 1;},clearTimeout:()=>{}}});await c.ready;await flush();assert.equal(calls,1);retry();await flush();assert.equal(calls,2);c.stop();
});
test('unmount before native listener promises resolve removes late subscriptions and never registers',async()=>{
 const p=ports(),resolvers=[];const listener=()=>new Promise(done=>resolvers.push(()=>done({remove:async()=>{p.removed.push('late');}})));p.push.addListener=listener;p.app.addListener=listener;
 const c=startNativePushRegistration({...p,saveToken:async()=>{throw Error('must not save');},navigate:()=>{}});c.stop();for(const resolve of resolvers)resolve();await c.ready;assert.equal(p.removed.length,5);assert.ok(!p.log.includes('register'));
});
test('native links refuse external URLs, protocols and malformed conversation identifiers',()=>{
 for(const x of ['https://evil.invalid', 'javascript:alert(1)','rede-nex://chat/invalid',{link:'//evil.invalid'},{link:'/\\evil.invalid'}])assert.equal(nativePushLink(x),null);
 assert.equal(nativePushLink('rede-nex://open?link=%2Ftarefas%3Ftarefa%3D'+cid),'/tarefas?tarefa='+cid);
});
