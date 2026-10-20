import type { Project, ProjectStep } from '../src/lib/projectsApi';
export interface WorkTask { id: string; title: string; status: string; priority: string; deadline?: string | null; owner_id?: string; owner?: { id: string }; created_by?: string; assignees?: Array<{ id: string; user_id?: string }> }
export type PersonalProject = Project & { involvement: 'responsible' | 'participant'; pending_count: number | null; overdue_count: number | null; steps_available: boolean; pending_steps: Array<{ id: string; name: string; deadline: string | null; status: string }> };
export function isFinished(status?: string): boolean;
export function isTaskMine(task: WorkTask, userId?: string): boolean;
export function dayKey(value?: Date | string | null): string | null;
export function personalizeProjects(projects: Project[], steps: Record<string, ProjectStep[]>, user: { id: string; name?: string } | null, now?: Date): PersonalProject[];
export function buildWorkBriefing(tasks: WorkTask[], projects: PersonalProject[], userId?: string, now?: Date): { date: string; pending: number; overdue: number; today: number; focus: Array<{ id: string; title: string; deadline?: string | null; priority: string }>; projects: Array<{ id: string; name: string; involvement: string; deadline: string | null; status: string; pending_count: number | null; overdue_count: number | null; pending_steps: PersonalProject['pending_steps'] }> };
