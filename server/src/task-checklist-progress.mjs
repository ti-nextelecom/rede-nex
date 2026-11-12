import { canManageTask, canToggleTaskChecklist, checklistItemBelongsToTask } from '../../shared/taskCollaboration.mjs';

// Participants can report progress, while task management remains a separate permission.
export function createTaskChecklistProgressRouter({ requireUser, readJson, sendJson, sendError, getTask, updateChecklistItem, adminRoles = ['Administrador', 'Gestor'] }) {
  return async (req, res, path) => {
    const match = /^\/api\/tasks\/([0-9a-f-]+)\/checklists\/([0-9a-f-]+)\/items\/([0-9a-f-]+)$/i.exec(path);
    if (!match || req.method !== 'PATCH') return false;
    const actor = await requireUser(req, res);
    if (!actor) return true;
    res.setHeader('Cache-Control', 'no-store');
    const fail = (status, message) => { sendError(req, res, status, status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', message); return true; };
    const [taskId, checklistId, itemId] = match.slice(1);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (![taskId, checklistId, itemId].every(id => uuid.test(id))) return fail(404, 'Etapa não encontrada');
    const task = await getTask(taskId);
    if (!task) return fail(404, 'Tarefa não encontrada');
    if (!canToggleTaskChecklist(task, actor, adminRoles)) return fail(403, 'Somente participantes e responsáveis podem atualizar o checklist');
    if (!checklistItemBelongsToTask(task, itemId, checklistId)) return fail(404, 'Etapa não pertence a este checklist');
    const payload = await readJson(req);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fail(400, 'Dados inválidos');
    const manager = canManageTask(task, actor, adminRoles);
    if (!manager && (Object.keys(payload).length !== 1 || !Object.hasOwn(payload, 'completed'))) return fail(403, 'Participantes podem apenas marcar ou desmarcar etapas');
    if (Object.hasOwn(payload, 'completed') && typeof payload.completed !== 'boolean') return fail(400, 'Informe se a etapa foi concluída');
    // Never forward hidden structural fields on a participant's progress request.
    const saved = await updateChecklistItem(itemId, manager ? payload : { completed: payload.completed });
    if (saved === false) return fail(404, 'Etapa não encontrada');
    sendJson(req, res, 200, { data: await getTask(taskId) });
    return true;
  };
}
