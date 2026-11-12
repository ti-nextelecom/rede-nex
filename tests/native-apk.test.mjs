import test from 'node:test';
import assert from 'node:assert/strict';
import { chatUploadType } from '../shared/chatMediaUpload.mjs';
import { nativeBackAction } from '../shared/nativeNavigation.mjs';

test('Android documents with omitted or generic MIME preserve a supported upload type', () => {
  for (const type of ['', 'application/octet-stream', 'binary/octet-stream']) {
    assert.equal(chatUploadType({name:'Comprovante.PDF',type,size:100}), 'application/pdf');
    assert.equal(chatUploadType({name:'Foto.jpg',type,size:100}), 'image/jpeg');
  }
  assert.equal(chatUploadType({name:'gravacao.webm',type:'audio/webm;codecs=opus',size:100}), 'audio/webm');
  assert.equal(chatUploadType({name:'arquivo',type:'application/pdf',size:100}), 'application/pdf');
});
test('upload normalization rejects empty, excessive and explicitly incompatible files', () => {
  for (const file of [
    {name:'arquivo.pdf',type:'application/pdf',size:0},
    {name:'arquivo.pdf',type:'application/pdf',size:20*1024*1024+1},
    {name:'arquivo.pdf',type:'application/x-msdownload',size:10},
    {name:'arquivo.exe',type:'',size:10},
    {name:'arquivo.constructor',type:'',size:10},
    {name:'arquivo.__proto__',type:'',size:10},
    {name:'arquivo.heic',type:'image/heic',size:10},
  ]) assert.throws(() => chatUploadType(file));
  assert.equal(chatUploadType({name:'comprovante.pdf',type:'application/pdf',size:20*1024*1024}), 'application/pdf');
});
test('Android back returns through app navigation and minimizes at its root', () => {
  for(const pathname of ['/','/login']) assert.equal(nativeBackAction({pathname,historyIndex:3,canGoBack:true}), 'minimize');
  assert.equal(nativeBackAction({pathname:'/tarefas',historyIndex:2,canGoBack:true}), 'history');
  assert.equal(nativeBackAction({pathname:'/bate-papo',historyIndex:0,canGoBack:false}), 'home');
  assert.equal(nativeBackAction({pathname:'/tarefas',historyIndex:undefined,canGoBack:false}), 'home');
  assert.equal(nativeBackAction({pathname:'/tarefas',historyIndex:2,canGoBack:false}), 'home');
});
