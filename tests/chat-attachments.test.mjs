import test from 'node:test';import assert from 'node:assert/strict';
import {isHtmlAttachment,attachmentResponseHeaders} from '../shared/chatAttachmentSafety.mjs';
test('HTML is download-only by both MIME and extension, including local blob previews',()=>{
 for(const file of [{type:'text/html; charset=utf-8',name:'relatorio.html'},{type:'text/plain',name:'pagina.HTM'},{type:'application/xhtml+xml',name:'pagina'},{url:'blob:https://example.invalid/id',name:'arquivo.html'}]){
  assert.equal(isHtmlAttachment(file),true);const h=attachmentResponseHeaders(file.type||'',file.name);assert.equal(h['Content-Type'],'application/octet-stream');assert.match(h['Content-Disposition'],/^attachment;/);assert.match(h['Content-Security-Policy'],/^sandbox;/);assert.equal(h['X-Content-Type-Options'],'nosniff');
 }
 assert.deepEqual(attachmentResponseHeaders('image/png'),{});assert.equal(isHtmlAttachment({type:'audio/mpeg',name:'musica.mp3'}),false);assert.deepEqual(attachmentResponseHeaders('audio/mpeg','musica.mp3'),{});
});
test('HTML filenames cannot inject response headers',()=>{const h=attachmentResponseHeaders('text/html','../x\r\nSet-Cookie:evil.html');assert.ok(!/[\r\n]/.test(h['Content-Disposition']));assert.match(h['Content-Disposition'],/filename\*=UTF-8/);});
