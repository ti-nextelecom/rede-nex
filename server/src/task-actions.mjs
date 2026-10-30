import { canManageTask, taskPeopleInputError } from '../../shared/taskCollaboration.mjs';
import { canAccessTaskFiles } from '../../shared/taskMedia.mjs';

// A model's tool call is untrusted input, never permission to bypass the HTTP rules.
export async function runAuthorizedTaskAction(action, user, id, input, repository, adminRoles = ['Administrador', 'Gestor']) {
  const fail = (statusCode, message) => { throw Object.assign(new Error(message), { statusCode }); };
  if (!['update', 'comment'].includes(action) || !user?.id || !id || !input || typeof input !== 'object' || Array.isArray(input)) fail(400, 'Ação de tarefa inválida');
  const existing = await repository.getTask(id);
  if (!existing) fail(404, 'Tarefa não encontrada');
  if (action === 'update') {
    if (!canManageTask(existing, user, adminRoles)) fail(403, 'Sem permissão para editar esta tarefa');
    const peopleError = taskPeopleInputError(input);
    if (peopleError) fail(400, peopleError);
    return repository.updateTask(id, input);
  }
  if (!canAccessTaskFiles(existing, user, adminRoles)) fail(403, 'Sem permissão para comentar nesta tarefa');
  if (typeof input.content !== 'string' || !input.content.trim()) fail(400, 'Comentário obrigatório');
  return repository.addTaskComment(id, user.id, input.content);
}
