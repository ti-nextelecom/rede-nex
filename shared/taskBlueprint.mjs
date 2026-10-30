import { safeTaskFileUrl } from './taskMedia.mjs';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function invalid(message) { throw Object.assign(new Error(message), { statusCode: 400, code: 'VALIDATION_ERROR' }); }
const text = (value, max) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
export function blueprintIds(value = []) {
  if (!Array.isArray(value) || value.length > 100 || value.some(id => typeof id !== 'string' || !uuid.test(id))) invalid('Selecione até 100 usuários válidos por papel.');
  return [...new Set(value)];
}
export function normalizeTaskBlueprint(input = {}) {
  const owner = input.owner_id || input.assigned_to || null;
  if (owner && !uuid.test(owner)) invalid('Responsável inválido.');
  if (input.deadline && !Number.isFinite(new Date(input.deadline).getTime())) invalid('Prazo inválido.');
  const groups = input.checklists ?? input.checklist_items ?? [];
  if (!Array.isArray(groups) || groups.length > 30) invalid('Use até 30 checklists por tarefa.');
  let count = 0;
  const keys = new Set();
  const checklists = groups.map(group => {
    if (!group || !Array.isArray(group.items)) invalid('Checklist inválida.');
    if (group.items.length > 500) invalid('Use até 500 etapas por tarefa.');
    const items = group.items.map(raw => {
      const item = typeof raw === 'string' ? { content: raw } : raw;
      if (!item || typeof item !== 'object') invalid('Etapa inválida.');
      const content = text(item.content, 500);
      const assignee_id = item.assignee_id || null;
      if (assignee_id && !uuid.test(assignee_id)) invalid('Responsável da etapa inválido.');
      const key = text(item.key || item.id, 80);
      if (key && (keys.has(key) || !/^[\w-]+$/.test(key))) invalid('Identificador de etapa inválido ou duplicado.');
      if (key) keys.add(key);
      return { key, content, assignee_id, participant_ids: blueprintIds(item.participant_ids), observer_ids: blueprintIds(item.observer_ids) };
    }).filter(item => item.content);
    count += items.length;
    return { title: text(group.title, 200) || 'Checklist', items };
  }).filter((group, index) => group.items.length || text(groups[index].title, 200));
  if (count > 500) invalid('Use até 500 etapas por tarefa.');
  const files = input.files ?? [];
  if (!Array.isArray(files) || files.length > 100) invalid('Use até 100 arquivos por modelo.');
  return {
    version: 1, title: text(input.title, 500), description: text(input.description, 10000),
    priority: ['low', 'normal', 'high', 'urgent'].includes(input.priority) ? input.priority : 'normal',
    deadline: input.deadline || null, owner_id: owner,
    assignee_ids: blueprintIds(input.assignee_ids), observer_ids: blueprintIds(input.observer_ids), checklists,
    files: files.map(file => {
      if (!file || !safeTaskFileUrl(file.file_url)) invalid('Arquivo do modelo inválido.');
      return { name: text(file.name, 500) || 'Arquivo', file_url: safeTaskFileUrl(file.file_url), file_type: text(file.file_type, 100),
        file_size: Number.isFinite(Number(file.file_size)) && Number(file.file_size) >= 0 ? Number(file.file_size) : 0,
        checklist_item_key: text(file.checklist_item_key || file.checklist_item_id, 80) || null };
    }),
  };
}
export function blueprintFromTask(task, files = []) {
  return normalizeTaskBlueprint({ ...task, assignee_ids: (task.assignees || []).map(p => p.id), observer_ids: (task.observers || []).map(p => p.id), files });
}
export function blueprintFromTemplate(template) {
  return normalizeTaskBlueprint(template.task_snapshot?.version ? template.task_snapshot : template);
}
export function blueprintPeople(blueprint, creatorId) {
  const items = blueprint.checklists.flatMap(group => group.items);
  const participants = [...new Set([creatorId, ...blueprint.assignee_ids, ...items.flatMap(item => [item.assignee_id, ...item.participant_ids])].filter(Boolean))];
  const executing = new Set([creatorId, blueprint.owner_id, ...participants]);
  const observers = [...new Set([...blueprint.observer_ids, ...items.flatMap(item => item.observer_ids)])].filter(id => !executing.has(id));
  return { participants, observers };
}
