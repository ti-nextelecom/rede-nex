import test from 'node:test';
import assert from 'node:assert/strict';
import { commandDraft,isDashboardDestination } from '../shared/dashboardActions.mjs';
import { replyToDashboardQuestion } from '../shared/dashboardCopilot.mjs';
const briefing={date:'2026-10-16',pending:2,overdue:1,today:1,focus:[{id:'task-1',title:'Revisar contrato',deadline:'2026-10-16',priority:'normal'}],projects:[{id:'project-1',name:'Migração Zabbix',involvement:'responsible',status:'Em andamento',pending_count:1,overdue_count:0,pending_steps:[],deadline:null}]};
test('explicit navigation opens only internal modules and personal snapshot items',()=>{
  for(const [question,to] of [['Abra projetos','/projetos'],['Abra minhas tarefas','/tarefas'],['Abra a agenda','/calendario?visao=agenda'],['Abra o chat','/bate-papo'],['Abra o projeto Zabbix','/projetos?projeto=project-1'],['Abra a tarefa Revisar contrato','/tarefas?tarefa=task-1'],['Abra minhas tarefas vencidas','/tarefas?escopo=overdue']]){
    const reply=replyToDashboardQuestion(question,briefing);assert.equal(reply.command?.to,to,question);assert.equal(reply.command.kind,'navigate');assert.equal(isDashboardDestination(to),true);
  }
});
test('ambiguous matches ask for selection instead of opening the wrong item',()=>{
  const reply=replyToDashboardQuestion('Abra o projeto Zabbix',{...briefing,projects:[...briefing.projects,{...briefing.projects[0],id:'project-2',name:'Zabbix regional'}]});
  assert.equal(reply.command,undefined);assert.equal(reply.actions.length,2);
  const missing=replyToDashboardQuestion('Abra a tarefa inventada',briefing);assert.equal(missing.command.to,'/tarefas?busca=inventada');
  const own=replyToDashboardQuestion('Abra meus projetos',briefing);assert.equal(own.command,undefined);assert.equal(own.actions[0].to,'/projetos?projeto=project-1');
});
test('creation prepares reviewable drafts, never writes or claims saved records',()=>{
  for(const [question,path,title] of [['Crie uma tarefa "Revisar contrato" amanhã às 9h','/tarefas','Revisar contrato'],['Novo projeto "Expansão"','/projetos','Expansão'],['Me lembre de revisar contrato amanhã às 9h','/calendario','revisar contrato']]){
    const reply=replyToDashboardQuestion(question,briefing);assert.equal(reply.command.kind,'prepare');const url=new URL(reply.command.to,'https://nex.invalid');assert.equal(url.pathname,path);assert.equal(url.searchParams.get('titulo'),title);assert.equal(url.searchParams.get('acao'),'novo');assert.match(reply.content,/Nada foi criado ainda/);assert.equal(isDashboardDestination(reply.command.to),true);
    if(path!=='/projetos'){assert.equal(url.searchParams.get('dia'),'2026-10-17');assert.equal(url.searchParams.get('hora'),'09:00');}
  }
  assert.match(replyToDashboardQuestion('Novo lembrete',briefing).content,/sem promessa de alarme/);
});
test('calendar parsing uses the briefing day and rejects impossible dates and hours',()=>{
  assert.equal(commandDraft('Me lembre amanhã às 9h','2026-12-31').day,'2027-01-01');
  assert.equal(commandDraft('Crie tarefa "Revisar" 29/02/2028 às 14:30','2026-10-16').day,'2028-02-29');
  assert.equal(commandDraft('Crie tarefa "Planejar amanhã"','2026-10-16').day,'');
  for(const question of ['Novo lembrete 31/02/2026','Novo lembrete amanhã às 25h','Novo lembrete amanhã às 09:99'])assert.equal(replyToDashboardQuestion(question,briefing).command,undefined,question);
});
test('negation, multiple requests, unauthorized scope and arbitrary destinations fail safely',()=>{
  for(const question of ['Não abra projetos','Não quero abrir projetos','Abra https://evil.invalid','Abra projetos e tarefas','Crie uma tarefa para outros usuários','Exclua todas as tarefas','Exclua tarefas e abra projetos'])assert.equal(replyToDashboardQuestion(question,briefing).command,undefined,question);
  for(const to of ['https://evil.invalid','//evil.invalid','/tarefas\\evil','/rh','/tarefas?redirect=https://evil.invalid','/tarefas#javascript:alert(1)','/tarefas\n','javascript:alert(1)'])assert.equal(isDashboardDestination(to),false,to);
  assert.match(replyToDashboardQuestion('Ajuda',briefing).content,/comandos s[aã]o locais/i);
});
