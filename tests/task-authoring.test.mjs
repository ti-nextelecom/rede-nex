import test from 'node:test';
import assert from 'node:assert/strict';
import {blueprintFromTemplate,cloneTaskBlueprint,normalizeTaskBlueprint,taskTemplateBlueprint} from '../shared/taskBlueprint.mjs';
import {taskDescriptionWithoutMedia,taskUploadType} from '../shared/taskMedia.mjs';
const owner='10000000-0000-4000-8000-000000000001',member='10000000-0000-4000-8000-000000000002';
const image={name:'referencia.png',file_url:'/uploads/chat/referencia.png',file_type:'image/png',file_size:120,checklist_item_key:'step-1'},document={name:'manual.pdf',file_url:'https://files.example.invalid/manual.pdf',file_type:'application/pdf',file_size:450};
const source={id:'old-task',title:'Instalar camera',description:'Instrucoes\n\n![Print](/uploads/chat/referencia.png)\n[Manual](https://files.example.invalid/manual.pdf)\n[Procedimento](https://wiki.example.invalid/procedimento)',owner_id:owner,status:'done',assignees:[{id:member}],observers:[],comments:[{content:'Only on source'}],checklists:[{id:'old-list',title:'Instalacao',items:[{id:'step-1',content:'Conectar',completed:true,assignee_id:member,participant_ids:[owner],observer_ids:[]}]}]};
test('templates retain structure and instructions without files or embedded media',()=>{
  const original=structuredClone(source),template=taskTemplateBlueprint({...source,assignee_ids:[member],files:[image,document]});
  assert.deepEqual(template.files,[]);assert.match(template.description,/Instrucoes/);assert.match(template.description,/wiki.example.invalid/);assert.doesNotMatch(template.description,/uploads|files.example|!\[/);assert.equal(template.checklists[0].items[0].content,'Conectar');assert.equal('completed'in template.checklists[0].items[0],false);assert.deepEqual(source,original);
});
test('legacy snapshots exclude inherited media while new task uploads remain valid',()=>{
  const legacy={task_snapshot:{...normalizeTaskBlueprint({...source,files:[image,document]}),version:1}},result=blueprintFromTemplate(legacy);assert.deepEqual(result.files,[]);assert.doesNotMatch(result.description,/referencia.png|manual.pdf/);
  const task=normalizeTaskBlueprint({...result,files:[document]});assert.equal(task.files[0].file_url,document.file_url);assert.equal(legacy.task_snapshot.files.length,2);
});
test('cloning keeps editable attachments and roles without completion, comments or source identity',()=>{
  const draft=cloneTaskBlueprint(source,[image,document]);assert.match(draft.title,/Instalar camera/);assert.equal(draft.files.length,2);assert.equal(draft.files[0].checklist_item_key,'step-1');assert.equal(draft.checklists[0].items[0].key,'step-1');assert.equal(draft.checklists[0].items[0].assignee_id,member);assert.equal('id'in draft,false);assert.equal('status'in draft,false);assert.equal('comments'in draft,false);assert.equal('completed'in draft.checklists[0].items[0],false);assert.equal(source.checklists[0].items[0].completed,true);
});
test('media removal preserves ordinary links and instructions',()=>{
  const text='Inicio\n![Externo](https://images.example.invalid/example.png)\n[Documento](/api/media/abc)\n/uploads/chat/private.pdf\n[Wiki](https://wiki.example.invalid/article)\nFim';const clean=taskDescriptionWithoutMedia(text);assert.doesNotMatch(clean,/images.example|private.pdf|api\/media|!\[/);assert.match(clean,/Inicio/);assert.match(clean,/Fim/);assert.match(clean,/\[Wiki\]\(https:\/\/wiki.example.invalid\/article\)/);
});
test('draft attachments reject invalid addresses, unsupported formats and oversized files',()=>{
  assert.throws(()=>normalizeTaskBlueprint({files:[{name:'bad',file_url:'javascript:alert(1)'}]}));assert.throws(()=>taskUploadType({name:'large.pdf',type:'application/pdf',size:21*1024*1024}));assert.throws(()=>taskUploadType({name:'run.exe',type:'application/x-msdownload',size:8}));assert.equal(taskUploadType({name:'relatorio.pdf',type:'',size:9}),'application/pdf');
});
