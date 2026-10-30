import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatOutbox, mergeChatOutbox } from '../shared/chatOutbox.mjs';
import { fitMedia, clampZoom, selectionRect, safeMediaSource, mediaKind } from '../shared/mediaTools.mjs';
const pause = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes,no) => { resolve=yes; reject=no; }); return {promise,resolve,reject}; };
const message = entry => ({ id: 'server-' + entry.clientId, client_message_id:entry.clientId, conversation_id:entry.conversationId, content:entry.content, sender_id:'alice', created_at:entry.createdAt, updated_at:entry.createdAt });
test('sending appears immediately, serializes each conversation and never duplicates the acknowledged row', async () => {
  const first = deferred(); const calls=[];
  const box=createChatOutbox({ownerId:'alice',send:entry=>{calls.push(entry); return calls.length===1?first.promise:Promise.resolve(message(entry));}});
  const id=box.enqueue({conversationId:'chat-a',content:'Primeira mensagem'});
  box.enqueue({conversationId:'chat-a',content:'Outra mensagem'});
  assert.equal(calls.length,1);
  assert.equal(box.getSnapshot()[0].state,'sending');
  assert.equal(mergeChatOutbox([],box.getSnapshot(),'chat-a',{id:'alice',name:'Alice'}).length,2);
  first.resolve(message(calls[0])); await pause();
  assert.equal(calls.length,2); assert.ok(box.getSnapshot().every(entry=>entry.state==='sent'));
  const server=box.getSnapshot().map(entry=>entry.message);
  assert.equal(mergeChatOutbox(server,box.getSnapshot(),'chat-a',{id:'alice',name:'Alice'}).length,2);
  assert.equal(box.getSnapshot()[0].clientId,id);
});
test('a lost response retries with the same identity; another conversation can send independently', async () => {
  const pending=deferred(), calls=[]; let fail=true;
  const box=createChatOutbox({ownerId:'alice',send:async entry=>{calls.push(entry); if(entry.conversationId==='slow')return pending.promise; if(fail)throw Error('Network'); return message(entry);}});
  box.enqueue({conversationId:'slow',content:'Pendente'});
  const id=box.enqueue({conversationId:'fast',content:'Importante'}); await pause();
  assert.equal(box.getSnapshot().find(entry=>entry.clientId===id).state,'failed');
  fail=false; box.retry(id); box.retry(id); await pause();
  assert.equal(calls.filter(entry=>entry.clientId===id).length,2);
  assert.equal(box.getSnapshot().find(entry=>entry.clientId===id).state,'sent');
  pending.resolve(message(calls[0])); await pause();
});
test('pending text survives reload by account without resending automatically or accepting another sender acknowledgement', async () => {
  const store=new Map(); const storage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
  const box=createChatOutbox({ownerId:'alice',storage,send:async entry=>({...message(entry),sender_id:'bob'})});
  box.enqueue({conversationId:'chat',content:'Não perder'}); await pause();
  assert.equal(box.getSnapshot()[0].state,'failed');
  let requests=0;
  const restored=createChatOutbox({ownerId:'alice',storage,send:async entry=>{requests++;return message(entry);}});
  assert.equal(requests,0); assert.equal(restored.getSnapshot()[0].content,'Não perder');
  assert.equal(createChatOutbox({ownerId:'bob',storage,send:async entry=>message(entry)}).getSnapshot().length,0);
  const spoofed={...message(box.getSnapshot()[0]),sender_id:'bob'};
  assert.equal(mergeChatOutbox([spoofed],box.getSnapshot(),'chat',{id:'alice',name:'Alice'}).length,2);
});
test('zoom keeps image proportions and crop selection stays within original coordinates', () => {
  assert.equal(clampZoom(20),4); assert.equal(clampZoom(-1),.25); assert.equal(clampZoom(NaN),1);
  const normal=fitMedia(4000,2000,1000,700,1),large=fitMedia(4000,2000,1000,700,2);
  assert.equal(normal.width/normal.height,2); assert.ok(normal.width<=1000); assert.equal(large.width,normal.width*2);
  assert.deepEqual(selectionRect({x:-1,y:-1},{x:2,y:2}),{x:0,y:0,width:1,height:1});
  assert.deepEqual(selectionRect({x:.8,y:.8},{x:.3,y:.4},{x:.2,y:.2,width:.6,height:.6}),{x:.3,y:.4,width:.5,height:.4});
});

test('server polling retires confirmed local rows, including a response lost on the network', async () => {
  const delayed = deferred();
  const box = createChatOutbox({ownerId:'alice',send:() => delayed.promise});
  box.enqueue({conversationId:'chat',content:'Confirmada pelo histórico'});
  const row = message(box.getSnapshot()[0]);
  box.reconcile([{...row,sender_id:'bob'}]);
  assert.equal(box.getSnapshot().length,1);
  box.reconcile([row]);
  assert.equal(box.getSnapshot().length,0);
  delayed.reject(new Error('Resposta perdida')); await pause();
  assert.equal(box.getSnapshot().length,0);
  assert.deepEqual(mergeChatOutbox([],box.getSnapshot(),'chat',{id:'alice',name:'Alice'}),[]);
});
test('viewer rejects executable sources and recognizes PDF/image attachments', () => {
  for(const value of ['javascript:alert(1)','data:text/html,hi','//evil.invalid/file','https://name:secret@example.invalid/file','/\\evil'])assert.equal(safeMediaSource(value),null);
  assert.equal(safeMediaSource('/api/media/test'),'/api/media/test'); assert.equal(mediaKind({url:'/api/media/id',name:'comprovante.pdf'}),'pdf'); assert.equal(mediaKind({url:'blob:http://localhost/test',type:'image/png'}),'image');
});
