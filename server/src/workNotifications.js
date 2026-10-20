// Pure recipient selection: no broadcast fallback. Callers pass trusted records
// from authenticated mutation handlers, never arbitrary recipient IDs from UI.
export function taskRecipients(task, actorId) {
  return [...new Set([task.created_by, task.owner_id, ...(task.assignees || []).map(person => person.id)])]
    .filter(id => typeof id === 'string' && id && id !== actorId);
}

export function projectRecipients(project, steps, users, actorId) {
  const ids = steps.flatMap(step => [step.responsible_user_id, ...(step.assignees || []).map(person => person.user_id)]);
  if (project.responsible_user_id) ids.push(project.responsible_user_id);
  else {
    // Legacy name-only ownership: do not notify ambiguous names.
    const normalize = value => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
    const matches = users.filter(user => normalize(user.name) === normalize(project.responsible_name));
    if (matches.length === 1) ids.push(matches[0].id);
  }
  return [...new Set(ids)].filter(id => typeof id === 'string' && id && id !== actorId);
}

export async function notifyTaskActivity(task, actor, title, send) {
  const userIds = taskRecipients(task, actor.id);
  if (!userIds.length) return;
  await send({ actorId: actor.id, actorName: actor.name, actorPhotoUrl: actor.photo_url,
    title, message: task.title, type: 'task', link: `/tarefas?tarefa=${encodeURIComponent(task.id)}`, userIds });
}

export async function notifyProjectActivity(project, actor, title, repositories) {
  const [steps, users] = await Promise.all([repositories.listSteps(project.id), repositories.listUsers()]);
  const userIds = projectRecipients(project, steps, users, actor.id);
  if (!userIds.length) return;
  await repositories.notifyUsers({ actorId: actor.id, actorName: actor.name, actorPhotoUrl: actor.photo_url,
    title, message: `${project.name} • ${project.status}`, type: 'project', link: `/projetos?projeto=${encodeURIComponent(project.id)}`, userIds });
}
