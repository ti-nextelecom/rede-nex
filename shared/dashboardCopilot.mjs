import { dayKey } from './personalWork.mjs';
import { resolveDashboardCommand } from './dashboardActions.mjs';

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const stopwords = new Set(['como', 'esta', 'estao', 'meus', 'minhas', 'qual', 'quais', 'para', 'sobre', 'projeto', 'projetos', 'tarefa', 'tarefas', 'etapa', 'etapas', 'prazo', 'prazos', 'andamento', 'status', 'pendencias', 'mostre', 'mostrar', 'ver', 'voce', 'preciso', 'fazer', 'hoje', 'que', 'por', 'das', 'dos', 'com', 'tem', 'sao']);
const taskLink = task => ({ label: task.title, to: `/tarefas?tarefa=${encodeURIComponent(task.id)}` });
const projectLink = project => ({ label: project.name, to: `/projetos?projeto=${encodeURIComponent(project.id)}` });
function dateLabel(value, dateOnly = false) {
  if (!value) return 'sem prazo definido';
  const date = dateOnly ? String(value).slice(0, 10) : dayKey(value);
  return date ? date.split('-').reverse().join('/') : 'prazo indisponível';
}

// Separate operational conversation for the dashboard. Uses ONLY the personal
// snapshot already displayed there. No provider calls, writes or general-chat
// history. Future LLM integration requires explicit data-sharing approval.
export function replyToDashboardQuestion(message, briefing, previous = {}) {
  const question = normalize(message).trim();
  const tasks = briefing.focus || [];
  const projects = briefing.projects || [];
  const allTasks = { label: 'Abrir minhas tarefas', to: '/tarefas' };
  const result = (content, actions = [], topic = 'summary', projectId) => ({ content, actions, context: { topic, ...(projectId ? { projectId } : {}) } });
  const summary = `Você tem ${briefing.pending} tarefa(s) pendente(s), ${briefing.overdue} vencida(s) e ${briefing.today} para hoje. Acompanha ${projects.length} projeto(s) ativo(s) como responsável ou participante.`;

  if (/outros usuarios|outras pessoas|outra pessoa|outro usuario|toda a empresa/.test(question)) {
    return result('Esta conversa é pessoal: só uso as tarefas atribuídas a você e os projetos em que você é responsável ou participante. Não consulto o trabalho de outras pessoas.');
  }
  if(/^(?:(?:por favor|pode|voce pode)\s+)?(?:conclu|apag|exclu|delet|envie|enviar|alter|marque|cancel)/.test(question))return result('Não crio, altero, concluo ou envio registros automaticamente. Posso abrir o item para você revisar a ação.',[allTasks]);
  const command=resolveDashboardCommand(message,briefing,previous);
  if(command)return command;
  if (/\b(conclu\w*|apag\w*|exclu\w*|delet\w*|envie|enviar|alter\w*|marque|cancel\w*)\b/.test(question)) {
    return result('Não crio, altero, concluo ou envio registros automaticamente. Posso abrir os módulos e preparar formulários; você revisa e confirma qualquer salvamento na tela correspondente.', [allTasks]);
  }
  if(/\bajuda\b|o que (?:voce )?(?:pode|consegue)|comandos|possibilidades/.test(question))return result('Você pode pedir:\n• Abra meus projetos\n• Abra o projeto seguido do nome\n• Abra minhas tarefas vencidas\n• Crie uma tarefa “Revisar contrato”\n• Novo projeto “Expansão”\n• Me lembre de revisar o contrato amanhã às 9h\n\nAberturas diretas levam à tela solicitada. Cadastros abrem uma revisão antes do formulário; só são salvos quando você confirma na tela. Os comandos são locais e não usam IA externa.',[{label:'Projetos',to:'/projetos'},{label:'Tarefas',to:'/tarefas'},{label:'Agenda',to:'/calendario'}]);

  const words = question.split(/[^a-z0-9]+/).filter(word => word.length > 2 && !stopwords.has(word));
  const matchingProjects = words.length ? projects.filter(project => words.some(word => normalize(project.name).includes(word))) : [];
  const projectQuestion = /projet|etapa|particip|responsavel/.test(question) || matchingProjects.length > 0;
  if (projectQuestion) {
    let selected = matchingProjects.length ? matchingProjects : projects;
    if (/etapas?|esse|dele/.test(question) && !matchingProjects.length && previous.projectId) selected = projects.filter(project => project.id === previous.projectId);
    if (/responsavel/.test(question)) selected = selected.filter(project => project.involvement === 'responsible');
    if (/participante|participo/.test(question)) selected = selected.filter(project => project.involvement === 'participant');
    if (!selected.length) return result('Não há projetos ativos com esse vínculo no seu resumo atual. Só considero os projetos em que você está envolvido.', [], 'projects');
    const lines = selected.map(project => {
      const pending = project.pending_count === null ? 'pendências indisponíveis' : `${project.pending_count} etapa(s) pendente(s)`;
      const steps = /etapas?/.test(question) ? project.pending_steps.map(step => `  • ${step.name} — ${dateLabel(step.deadline, true)}`).join('\n') : '';
      return `• ${project.name} — ${project.involvement === 'responsible' ? 'responsável' : 'participante'}; ${project.status}; ${pending}${project.overdue_count ? `, ${project.overdue_count} vencida(s)` : ''}; prazo ${dateLabel(project.deadline, true)}.${steps ? `\n${steps}` : ''}`;
    });
    return result(`Seus projetos ativos neste contexto:\n\n${lines.join('\n\n')}`, selected.map(projectLink), 'projects', selected.length === 1 ? selected[0].id : undefined);
  }

  let selectedTasks = tasks;
  let lead = 'Estas são as prioridades do seu resumo, ordenadas por atraso, prazo e urgência:';
  let topic = 'tasks';
  if (/vencid|atrasad|atraso/.test(question)) {
    topic = 'overdue'; selectedTasks = tasks.filter(task => dayKey(task.deadline) && dayKey(task.deadline) < briefing.date);
    lead = `Você tem ${briefing.overdue} tarefa(s) vencida(s).`;
    if (!briefing.overdue) return result(lead + ' Confira as próximas prioridades para planejar seu dia.', [allTasks], topic);
  } else if (/hoje|neste dia/.test(question) && !/resumo|briefing|meu dia|organizar/.test(question)) {
    topic = 'today'; selectedTasks = tasks.filter(task => dayKey(task.deadline) === briefing.date);
    lead = `Você tem ${briefing.today} tarefa(s) com prazo para hoje.`;
    if (!briefing.today) return result(`${lead} ${briefing.overdue ? `Priorize as ${briefing.overdue} vencidas e confira as etapas dos projetos.` : 'Revise os próximos prazos e as etapas dos seus projetos.'}`, [allTasks], topic);
  } else if (/sem prazo/.test(question)) {
    topic = 'tasks'; selectedTasks = tasks.filter(task => !task.deadline);
    lead = 'Tarefas sem prazo entre as prioridades disponíveis:';
  } else if (words.length && !/priorid|comec|resumo|briefing|meu dia|organizar/.test(question)) {
    const matches = tasks.filter(task => words.some(word => normalize(task.title).includes(word)));
    if (matches.length) { selectedTasks = matches; lead = 'Encontrei estas tarefas entre suas prioridades:'; }
    else if (!/tarefas?|pendencias?|entregas?/.test(question)) return result('Sou o assistente do seu dia nesta dashboard. Posso consultar prioridades, tarefas vencidas, entregas de hoje, seus projetos e etapas. Trabalho com um resumo limitado às suas prioridades; não sou o Copiloto geral.', [allTasks]);
  }
  if (!question || /^(oi|ola|bom dia|boa tarde|boa noite)$/.test(question)) return result(`${summary}\n\nQuer começar pelas tarefas vencidas, pelos prazos de hoje ou pelos seus projetos?`);
  if (!selectedTasks.length) return result(`${lead}\n\nNão há itens desse tipo no recorte de prioridades exibido na dashboard. Consulte Tarefas para verificar a lista completa.`, [allTasks], topic);
  const lines = selectedTasks.map((task, index) => `${index + 1}. ${task.title} — ${dateLabel(task.deadline)}${task.priority === 'urgent' ? ' • urgente' : task.priority === 'high' ? ' • alta prioridade' : ''}.`);
  return result(`${topic === 'tasks' ? `${summary}\n\n` : ''}${lead}\n\n${lines.join('\n\n')}\n\nExibo até cinco prioridades, não a lista completa de tarefas.`, [...selectedTasks.map(taskLink), allTasks], topic);
}
