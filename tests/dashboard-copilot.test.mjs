import test from 'node:test';
import assert from 'node:assert/strict';
import { replyToDashboardQuestion } from '../shared/dashboardCopilot.mjs';

const briefing = { date: '2026-10-16', pending: 8, overdue: 4, today: 1,
  focus: [{ id: 'late', title: 'Revisar conexão', deadline: '2026-10-15', priority: 'high' }, { id: 'today', title: 'Conferir entrega', deadline: '2026-10-16', priority: 'normal' }],
  projects: [
    { id: 'zabbix', name: 'Migração Zabbix', involvement: 'responsible', status: 'Em andamento', deadline: '2026-11-05T00:00:00.000Z', pending_count: 1, overdue_count: 0, pending_steps: [{ id: 'step', name: 'Validar servidor', deadline: '2026-10-20', status: 'Não iniciado' }] },
    { id: 'site', name: 'Novo portal', involvement: 'participant', status: 'Em andamento', deadline: null, pending_count: null, overdue_count: null, pending_steps: [] },
  ] };
test('overview uses the current personal snapshot and never links to the general Copiloto', () => {
  const answer = replyToDashboardQuestion('Por onde começar?', briefing);
  assert.ok(answer.content.includes('8 tarefa(s) pendente(s)'));
  assert.ok(answer.actions.some(action => action.to === '/tarefas?tarefa=late'));
  assert.ok(answer.actions.every(action => !action.to.startsWith('/copiloto')));
});
test('overdue and today are distinct, and limited coverage is explicit', () => {
  const overdue = replyToDashboardQuestion('Minhas tarefas vencidas', briefing);
  assert.ok(overdue.content.includes('4 tarefa(s) vencida(s)'));
  assert.ok(overdue.content.includes('até cinco prioridades'));
  assert.ok(!overdue.actions.some(action => action.to.endsWith('=today')));
  const today = replyToDashboardQuestion('O que vence hoje?', briefing);
  assert.ok(today.actions.some(action => action.to.endsWith('=today')));
  assert.ok(!today.actions.some(action => action.to.endsWith('=late')));
});
test('project ownership and participation filters preserve their meaning', () => {
  assert.deepEqual(replyToDashboardQuestion('Projetos em que sou responsável', briefing).actions.map(action => action.to), ['/projetos?projeto=zabbix']);
  assert.deepEqual(replyToDashboardQuestion('Projetos em que sou participante', briefing).actions.map(action => action.to), ['/projetos?projeto=site']);
  assert.ok(replyToDashboardQuestion('Meus projetos', briefing).content.includes('pendências indisponíveis'));
});
test('named project and follow-up keep context without using general chat history', () => {
  const project = replyToDashboardQuestion('Como está o Zabbix?', briefing);
  assert.equal(project.context.projectId, 'zabbix');
  assert.ok(project.content.includes('05/11/2026'));
  const steps = replyToDashboardQuestion('E as etapas?', briefing, project.context);
  assert.ok(steps.content.includes('Validar servidor'));
  assert.ok(!steps.content.includes('Novo portal'));
});
test('no claims or writes outside the available snapshot', () => {
  assert.ok(replyToDashboardQuestion('Conclua todas as tarefas', briefing).content.includes('Não crio, altero, concluo'));
  assert.ok(replyToDashboardQuestion('Tarefas de outros usuários', briefing).content.includes('Não consulto o trabalho de outras pessoas'));
  assert.ok(replyToDashboardQuestion('Explique teoria musical', briefing).content.includes('não sou o Copiloto geral'));
  const answer = replyToDashboardQuestion('O que vence hoje?', { ...briefing, today: 0, focus: [] });
  assert.ok(answer.content.includes('0 tarefa(s)'));
});
