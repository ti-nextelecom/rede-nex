export interface AgendaEvent { id: string; title: string; start_at: string; end_at: string; all_day: boolean; location?: string; color?: string }
export function calendarMonth(year: number, month: number): Array<string | null>;
export function eventsOnDay<T extends AgendaEvent>(events: T[], date: string): T[];
