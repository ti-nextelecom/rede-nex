// Keep the last server snapshot, including every newly persisted item.
export async function appendTaskChecklists(task, groups, api) {
  let updated = task;
  for (const group of groups) {
    const title = group.title.trim();
    const items = group.items.map(item => typeof item === 'string' ? { content: item.trim() } : { ...item, content: item.content.trim() }).filter(item => item.content);
    if (!title && !items.length) continue;
    const existing = new Set(updated.checklists.map(list => list.id));
    updated = await api.addChecklist(task.id, title || 'Checklist');
    const created = updated.checklists.find(list => !existing.has(list.id));
    if (!created) throw new Error('Não foi possível confirmar a checklist criada. Atualize a tarefa antes de tentar novamente.');
    for (const item of items) updated = await api.addItem(task.id, created.id, item.content, item);
  }
  return updated;
}
