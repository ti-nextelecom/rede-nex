// Shared by the dashboard and authenticated Copiloto. This is personalization,
// not authorization: repositories must still enforce their own access policies.
export function isFinished(status = '') {
  const value = String(status || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return ['done', 'cancelled'].includes(value) || value.startsWith('concluid');
}

export function isTaskMine(task, userId) {
  if (!userId) return false;
  return task.owner_id === userId || task.owner?.id === userId
    || (task.assignees || []).some(person => person.id === userId || person.user_id === userId)
    || (!task.owner_id && !task.owner && !task.assignees?.length && task.created_by === userId);
}

export function dayKey(value = new Date()) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return null;
  // Date-only deadlines are calendar days, never UTC midnight shifted to yesterday.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

const normalizedName = value => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
export function personalizeProjects(projects, stepsByProject, user, now = new Date()) {
  if (!user?.id) return [];
  const today = dayKey(now);
  return projects.flatMap(project => {
    const steps = stepsByProject[project.id];
    // Legacy projects store responsible_name only. Exact full-name fallback,
    // never partial/fuzzy matching. Prefer responsible_user_id when available.
    const responsible = project.responsible_user_id
      ? project.responsible_user_id === user.id
      : !!user.name && normalizedName(project.responsible_name) === normalizedName(user.name);
    const ownSteps = (steps || []).filter(step => step.responsible_user_id === user.id
      || (step.assignees || []).some(person => person.user_id === user.id || person.user?.id === user.id));
    if (!responsible && !ownSteps.length) return [];
    const pending = (steps || []).filter(step => !isFinished(step.status));
    const myPending = ownSteps.filter(step => !isFinished(step.status));
    const actionable = responsible ? pending : myPending;
    return [{ ...project, involvement: responsible ? 'responsible' : 'participant',
      pending_count: steps ? actionable.length : null,
      // Project/step deadlines are DATE fields, sometimes serialized as ISO
      // midnight. Preserve their calendar date instead of shifting it to Bahia.
      overdue_count: steps ? actionable.filter(step => step.deadline && String(step.deadline).slice(0, 10) < today).length : null,
      pending_steps: actionable.map(step => ({ id: step.id, name: step.name, deadline: step.deadline, status: step.status })),
      steps_available: !!steps,
    }];
  }).sort((a, b) => Number(isFinished(a.status)) - Number(isFinished(b.status))
    || (b.overdue_count || 0) - (a.overdue_count || 0)
    || String(a.deadline || '9999').localeCompare(String(b.deadline || '9999')));
}

export function buildWorkBriefing(tasks, projects, userId, now = new Date()) {
  const today = dayKey(now);
  const pending = tasks.filter(task => isTaskMine(task, userId) && !isFinished(task.status));
  const overdue = pending.filter(task => dayKey(task.deadline) && dayKey(task.deadline) < today);
  const dueToday = pending.filter(task => dayKey(task.deadline) === today);
  const priority = { urgent: 0, high: 1, normal: 2, low: 3 };
  const focus = [...pending].sort((a, b) => {
    const rank = task => !dayKey(task.deadline) ? 2 : dayKey(task.deadline) < today ? 0 : dayKey(task.deadline) === today ? 1 : 2;
    return rank(a) - rank(b) || (priority[a.priority] ?? 2) - (priority[b.priority] ?? 2)
      || String(a.deadline || '9999').localeCompare(String(b.deadline || '9999'));
  }).slice(0, 5);
  return { date: today, pending: pending.length, overdue: overdue.length, today: dueToday.length,
    focus: focus.map(task => ({ id: task.id, title: task.title, deadline: task.deadline, priority: task.priority })),
    projects: projects.filter(project => !isFinished(project.status)).map(project => ({ id: project.id, name: project.name,
      involvement: project.involvement, deadline: project.deadline, status: project.status, pending_count: project.pending_count,
      overdue_count: project.overdue_count, pending_steps: project.pending_steps.slice(0, 5) })),
  };
}
