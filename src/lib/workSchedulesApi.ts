import { apiGet, apiPost } from './apiClient';
import type {
  ScheduleEntry,
  ScheduleInput,
} from '../../shared/workSchedules.mjs';

export interface SchedulePerson {
  id: string;
  name: string;
  photo_url: string | null;
  department_id: string | null;
  department_name: string | null;
  can_edit: boolean;
}
export interface ScheduleData {
  people: SchedulePerson[];
  departments: ScheduleDepartment[];
  entries: ScheduleEntry[];
  is_supervisor: boolean;
  from: string;
  to: string;
}
export interface ScheduleDepartment {
  id: string;
  name: string;
  parent_id: string | null;
  manager_id: string | null;
  manager_name: string | null;
  manager_photo_url: string | null;
}

export function scheduleLoadError(cause: unknown) {
  const message =
    cause instanceof Error
      ? cause.message
      : 'Não foi possível carregar as escalas.';
  return /API (404|503)\b/.test(message)
    ? 'As escalas ainda não estão disponíveis no servidor. A atualização da API e do banco precisa ser aplicada para carregar os setores e os dias planejados.'
    : message;
}
export interface ScheduleHistory {
  id: string;
  user_id: string;
  user_name: string;
  day: string;
  actor_name: string;
  before_data: ScheduleEntry | null;
  after_data: ScheduleEntry;
  created_at: string;
}
export async function getSchedules(from: string, to: string) {
  return (
    await apiGet<{ data: ScheduleData }>(
      `/work-schedules?${new URLSearchParams({ from, to })}`,
    )
  ).data;
}
export async function saveSchedules(
  actorId: string,
  operationId: string,
  entries: ScheduleInput[],
) {
  return (
    await apiPost<{ data: { changed_count: number; replayed: boolean } }>(
      '/work-schedules',
      { operation_id: operationId, entries },
      undefined,
      { 'X-Nex-User-Id': actorId },
    )
  ).data;
}
export async function getScheduleHistory(
  from: string,
  to: string,
  offset = 0,
  user = '',
) {
  return (
    await apiGet<{ data: { history: ScheduleHistory[]; has_more: boolean } }>(
      `/work-schedules/history?${new URLSearchParams({ from, to, offset: String(offset), user })}`,
    )
  ).data;
}
