export type TaskMentionRange = { start: number; end: number; query: string };
export function taskMentionAt(text: string, caret: number): TaskMentionRange | null;
export function applyTaskMention(text: string, range: TaskMentionRange | null, name: string): { text: string; caret: number } | null;
