import type { NocIncident } from './nocStore';

export type NocPeriod = 'day' | 'week' | 'month' | 'custom' | 'all';
export type NocDateRange = { start: Date; end: Date; label: string };
export type NocBucket = { start: Date; end: Date; label: string; opened: number; closed: number };

const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const hour = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit' });

function dayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function fromInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : null;
}

export function getNocDateRange(period: NocPeriod, customStart: string, customEnd: string, now = new Date()): NocDateRange | null {
  if (period === 'all') return null;
  const today = dayStart(now);
  if (period === 'day') return { start: today, end: addDays(today, 1), label: `Hoje, ${shortDate.format(today)}` };
  if (period === 'week') {
    const start = addDays(today, -(today.getDay() + 6) % 7);
    return { start, end: addDays(today, 1), label: `Semana de ${shortDate.format(start)} a ${shortDate.format(today)}` };
  }
  if (period === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start, end: addDays(today, 1), label: new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(today) };
  }
  const start = fromInput(customStart);
  const finish = fromInput(customEnd);
  if (!start || !finish || start > finish) return { start: new Date(0), end: new Date(0), label: 'Selecione um intervalo válido' };
  return { start, end: addDays(finish, 1), label: `${shortDate.format(start)} a ${shortDate.format(finish)}` };
}

export function inNocRange(isoDate: string, range: NocDateRange | null): boolean {
  if (!range) return true;
  const time = new Date(isoDate).getTime();
  return time >= range.start.getTime() && time < range.end.getTime();
}

export function resolutionHours(incident: NocIncident): number | null {
  if (!incident.closedAt) return null;
  return Math.max(0, (new Date(incident.closedAt).getTime() - new Date(incident.openedAt).getTime()) / 3600000);
}

export function makeNocBuckets(incidents: NocIncident[], range: NocDateRange | null, period: NocPeriod, now = new Date()): NocBucket[] {
  const end = range?.end ?? addDays(dayStart(now), 1);
  const start = range?.start ?? addDays(dayStart(now), -29);
  if (start >= end) return [];

  if (period === 'day') {
    return Array.from({ length: 6 }, (_, index) => {
      const bucketStart = new Date(start.getTime() + index * 4 * 3600000);
      const bucketEnd = new Date(start.getTime() + (index + 1) * 4 * 3600000);
      const rows = incidents.filter(item => inNocRange(item.openedAt, { start: bucketStart, end: bucketEnd, label: '' }));
      return { start: bucketStart, end: bucketEnd, label: hour.format(bucketStart), opened: rows.filter(item => !item.closedAt).length, closed: rows.filter(item => !!item.closedAt).length };
    });
  }

  const calendarDays = Math.ceil((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000);
  const span = Math.max(1, Math.ceil(calendarDays / 7));
  const count = Math.ceil(calendarDays / span);
  return Array.from({ length: count }, (_, index) => {
    const bucketStart = addDays(start, index * span);
    const bucketEnd = addDays(start, Math.min(calendarDays, (index + 1) * span));
    const rows = incidents.filter(item => inNocRange(item.openedAt, { start: bucketStart, end: bucketEnd, label: '' }));
    return { start: bucketStart, end: bucketEnd, label: shortDate.format(bucketStart), opened: rows.filter(item => !item.closedAt).length, closed: rows.filter(item => !!item.closedAt).length };
  });
}
