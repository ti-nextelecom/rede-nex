export type ScheduleStatus = 'work' | 'off' | 'agreed_off' | 'unplanned';
export interface ScheduleInput {
  user_id: string;
  day: string;
  status: ScheduleStatus;
  start_time: string | null;
  end_time: string | null;
  note: string;
  expected_revision: number;
}
export interface ScheduleEntry
  extends Omit<ScheduleInput, 'expected_revision'> {
  revision: number;
  updated_by: string;
  updated_at: string;
}
export const SCHEDULE_STATUSES: ScheduleStatus[];
export const SCHEDULE_LABELS: Record<ScheduleStatus, string>;
export const WEEKDAYS: string[];
export function scheduleError(message: string, statusCode?: number): Error;
export function scheduleDate(value: string): string;
export function addScheduleDays(value: string, amount: number): string;
export function scheduleDates(
  from: string,
  to: string,
  maximum?: number,
): string[];
export function scheduleWindow(
  anchor: string,
  view: string,
): { from: string; to: string };
export function scheduleEntryInput(value: unknown): ScheduleInput;
export function generateFiveTwo(options: {
  userIds: string[];
  from: string;
  to: string;
  workdays: number[];
  start_time: string;
  end_time: string;
  existing?: ScheduleEntry[];
  replace?: boolean;
}): ScheduleInput[];
