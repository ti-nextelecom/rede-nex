import { blueprintIds } from '../../shared/taskBlueprint.mjs';

export async function replaceChecklistPeople(query, itemId, input) {
  for (const [key, role] of [['participant_ids', 'participant'], ['observer_ids', 'observer']]) {
    if (input[key] === undefined) continue;
    const ids = blueprintIds(input[key]);
    await query('DELETE FROM task_checklist_item_people WHERE item_id=$1 AND role=$2', [itemId, role]);
    if (ids.length) await query('INSERT INTO task_checklist_item_people(item_id,user_id,role) SELECT $1,uid,$3 FROM unnest($2::uuid[]) uid ON CONFLICT DO NOTHING', [itemId, ids, role]);
  }
}

export async function syncChecklistMembership(query, taskId) {
  await query(`INSERT INTO task_assignees(task_id,user_id)
    SELECT $1::uuid, user_id FROM (
      SELECT ci.assignee_id user_id FROM task_checklist_items ci JOIN task_checklists cl ON cl.id=ci.checklist_id WHERE cl.task_id=$1 AND ci.assignee_id IS NOT NULL
      UNION SELECT p.user_id FROM task_checklist_item_people p JOIN task_checklist_items ci ON ci.id=p.item_id JOIN task_checklists cl ON cl.id=ci.checklist_id WHERE cl.task_id=$1 AND p.role='participant'
    ) people ON CONFLICT DO NOTHING`, [taskId]);
  await query(`INSERT INTO task_observers(task_id,user_id)
    SELECT DISTINCT $1::uuid,p.user_id FROM task_checklist_item_people p JOIN task_checklist_items ci ON ci.id=p.item_id
    JOIN task_checklists cl ON cl.id=ci.checklist_id JOIN tasks t ON t.id=cl.task_id
    WHERE t.id=$1 AND p.role='observer' AND p.user_id IS DISTINCT FROM t.created_by AND p.user_id IS DISTINCT FROM t.owner_id
    AND NOT EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id=$1 AND ta.user_id=p.user_id) ON CONFLICT DO NOTHING`, [taskId]);
  await query(`DELETE FROM task_observers o USING tasks t WHERE o.task_id=t.id AND t.id=$1 AND
    (o.user_id=t.created_by OR o.user_id=t.owner_id OR EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id=t.id AND ta.user_id=o.user_id))`, [taskId]);
}

export async function insertBlueprintChecklists(query, taskId, blueprint, actorId) {
  const itemMap = new Map();
  for (const [index, group] of blueprint.checklists.entries()) {
    const list = (await query('INSERT INTO task_checklists(task_id,title,sort_order) VALUES($1,$2,$3) RETURNING id', [taskId, group.title, index])).rows[0];
    for (const [order, item] of group.items.entries()) {
      const saved = (await query('INSERT INTO task_checklist_items(checklist_id,content,completed,assignee_id,sort_order) VALUES($1,$2,false,$3,$4) RETURNING id', [list.id, item.content, item.assignee_id, order])).rows[0];
      if (item.key) itemMap.set(item.key, saved.id);
      await replaceChecklistPeople(query, saved.id, item);
    }
  }
  for (const file of blueprint.files) {
    if (file.checklist_item_key && !itemMap.has(file.checklist_item_key)) continue;
    await query('INSERT INTO task_files(task_id,name,file_url,file_type,file_size,uploaded_by,checklist_item_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [taskId, file.name, file.file_url, file.file_type || null, file.file_size || null, actorId, file.checklist_item_key ? itemMap.get(file.checklist_item_key) : null]);
  }
  await syncChecklistMembership(query, taskId);
}
