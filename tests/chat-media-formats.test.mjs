import test from 'node:test';import assert from 'node:assert/strict';import {chatUploadType,CHAT_UPLOAD_ACCEPT} from '../shared/chatMediaUpload.mjs';
test('HTML and Android audio aliases normalize consistently with extension fallback',()=>{
 const cases=[['pagina.html','text/html','text/html'],['pagina.HTM','','text/html'],['gravacao.wav','audio/x-wav','audio/wav'],['gravacao.m4a','audio/x-m4a','audio/mp4'],['gravacao.aac','audio/aac','audio/aac'],['gravacao.flac','audio/x-flac','audio/flac'],['gravacao.opus','application/ogg','audio/ogg'],['gravacao.amr','application/octet-stream','audio/amr'],['voz.webm','audio/webm;codecs=opus','audio/webm']];
 for(const[name,type,expected]of cases)assert.equal(chatUploadType({name,type,size:128}),expected);
 assert.ok(CHAT_UPLOAD_ACCEPT.includes('.html')&&CHAT_UPLOAD_ACCEPT.includes('audio/*'));assert.throws(()=>chatUploadType({name:'pagina.html',type:'application/x-msdownload',size:50}));
});
