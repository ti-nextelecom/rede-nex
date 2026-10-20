import { readFile } from 'node:fs/promises';
import { buildWorkBriefing, personalizeProjects } from '../../shared/personalWork.mjs';

// HOSTING: include server/agents/copiloto.md. Only edit that Markdown to tune
// the existing Copiloto's instructions; it is re-read on every request.
// Personal work is NEVER appended to the external provider's prompt here.
// Sending it to a third-party AI requires the organization's explicit approval.
export async function buildCopilotoSystem(user) {
  const file = process.env.COPILOTO_AGENT_MD_PATH || new URL('../agents/copiloto.md', import.meta.url);
  const instructions = await readFile(file, 'utf8');
  if (!instructions.trim() || instructions.length > 64000) throw new Error('Invalid Copiloto instructions');
  const name = String(user.name || 'Colaborador').slice(0, 150);
  return instructions.replaceAll('{{firstName}}', name.trim().split(' ')[0]).replaceAll('{{userName}}', name);
}

export async function loadCopilotoContext(user, repositories) {
  // Internal-only summary. Identity comes from requireUser, never request.user_id.
  const [tasks, projects] = await Promise.all([repositories.listTasks(user.id), repositories.listProjects()]);
  const steps = {};
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, projects.length) }, async () => {
    while (next < projects.length) {
      const project = projects[next++];
      try { steps[project.id] = await repositories.listSteps(project.id); }
      catch { /* Missing data is unknown, never zero. */ }
    }
  }));
  return { ...buildWorkBriefing(tasks, personalizeProjects(projects, steps, user), user.id), partial: Object.keys(steps).length !== projects.length };
}

export function operationalBriefing(briefing, firstName) {
  const lines = [`${firstName}, você tem ${briefing.pending} tarefa(s) pendente(s), ${briefing.overdue} vencida(s) e ${briefing.today} para hoje.`];
  for (const task of briefing.focus.slice(0, 4)) lines.push(`• ${task.title}${task.deadline ? ` — prazo ${String(task.deadline).slice(0, 10)}` : ' — definir prazo'}.`);
  for (const project of briefing.projects.slice(0, 3)) lines.push(`• Projeto ${project.name}: ${project.pending_count === null ? 'etapas indisponíveis' : `${project.pending_count} etapa(s) pendente(s)`}${project.overdue_count ? `, ${project.overdue_count} vencida(s)` : ''}.`);
  if (briefing.partial) lines.push('Algumas etapas não puderam ser consultadas; o resumo pode estar incompleto.');
  return lines.join('\n');
}

export function safeCopilotoHistory(history) {
  return (Array.isArray(history) ? history : []).filter(item => item && !item.internalOnly && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
    .slice(-10).map(item => ({ role: item.role, content: item.content.slice(0, 4000) }));
}
