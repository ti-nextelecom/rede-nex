export interface BlueprintItem { key: string; content: string; assignee_id: string | null; participant_ids: string[]; observer_ids: string[]; }
export interface BlueprintChecklist { title: string; items: BlueprintItem[]; }
export interface BlueprintFile { name: string; file_url: string; file_type?: string; file_size?: number; checklist_item_key?: string | null; }
export interface TaskBlueprint { version: number; title: string; description: string; priority: string; deadline: string | null; owner_id: string | null; assignee_ids: string[]; observer_ids: string[]; checklists: BlueprintChecklist[]; files: BlueprintFile[]; }
export function blueprintIds(value?: unknown): string[];
export function normalizeTaskBlueprint(input?: unknown): TaskBlueprint;
export function blueprintFromTask(task: unknown, files?: unknown[]): TaskBlueprint;
export function blueprintFromTemplate(template: unknown): TaskBlueprint;
export function blueprintPeople(blueprint: TaskBlueprint, creatorId?: string): {participants: string[]; observers: string[]};
