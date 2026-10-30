type TaskRoles = { created_by?: string; owner_id?: string; assignees?: { id: string }[] };
export function canManageTask(task: TaskRoles | null, actor: { id: string; role_name?: string } | null, adminRoles?: string[]): boolean;
export function canRemoveTaskFile(task: TaskRoles | null, actor: { id: string; role_name?: string } | null, file: { checklist_item_id?: string | null; uploaded_by?: string }, adminRoles?: string[]): boolean;
export function taskPeopleInputError(input: { assignee_ids?: unknown; observer_ids?: unknown }): string | null;
export function distinctObserverIds(ids: string[], task: TaskRoles): string[];
export function checklistItemBelongsToTask(task: { checklists?: { id: string; items?: { id: string }[] }[] } | null, itemId: string, checklistId?: string): boolean;
export function taskLink(id: string): string;
