import type { buildWorkBriefing } from './personalWork.mjs';
export interface DashboardCommand { kind: 'navigate' | 'prepare'; to: string; label: string }
export function isDashboardDestination(value: unknown): boolean;
export function commandDraft(message: string,today: string): { title: string; day: string; time: string; issues: string[] };
export function resolveDashboardCommand(message: string,briefing: ReturnType<typeof buildWorkBriefing>,previous?: {topic?: string;projectId?: string}): {content: string;actions: Array<{label:string;to:string}>;command?:DashboardCommand;context:{topic:string;projectId?:string}} | null;
