// Observers follow the conversation; they are not execution assignees.
export function canManageTask(task, actor, adminRoles = ['Administrador', 'Gestor']) {
  return Boolean(task && actor && (adminRoles.includes(actor.role_name) || task.created_by === actor.id || task.owner_id === actor.id));
}
export function canRemoveTaskFile(task, actor, file, adminRoles = ['Administrador', 'Gestor']) {
  return canManageTask(task, actor, adminRoles) || Boolean(actor && !file.checklist_item_id && file.uploaded_by === actor.id);
}
export function taskPeopleInputError(input) {
  for (const key of ['assignee_ids', 'observer_ids']) {
    const ids = input[key];
    if (ids !== undefined && (!Array.isArray(ids) || ids.length > 100 || ids.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))) return 'Selecione até 100 usuários válidos por papel.';
  }
  return null;
}
export function distinctObserverIds(ids, task) {
  const executing = new Set([task.created_by, task.owner_id, ...(task.assignees || []).map(person => person.id)]);
  return [...new Set(ids)].filter(id => !executing.has(id));
}
export function checklistItemBelongsToTask(task, itemId, checklistId) {
  return Boolean(task?.checklists?.some(list => (!checklistId || list.id === checklistId) && list.items?.some(item => item.id === itemId)));
}
export function taskLink(id) { return `/tarefas?tarefa=${encodeURIComponent(id)}`; }
