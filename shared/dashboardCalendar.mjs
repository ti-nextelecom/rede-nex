import { dayKey } from './personalWork.mjs';
export function calendarMonth(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const leading = (first.getUTCDay() + 6) % 7;
  const total = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = Math.ceil((leading + total) / 7) * 7;
  return Array.from({ length: cells }, (_, index) => {
    const day = index - leading + 1;
    return day < 1 || day > total ? null : `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  });
}
export function eventsOnDay(events, date) {
  return events.filter(event => {
    const start = dayKey(event.start_at);
    const endTime = new Date(event.end_at).getTime();
    // Calendar end timestamps are exclusive. Midnight belongs to the prior day.
    const end = Number.isFinite(endTime) && endTime > new Date(event.start_at).getTime() ? dayKey(new Date(endTime - 1)) : start;
    return start && end && start <= date && date <= end;
  }).sort((a, b) => String(a.start_at).localeCompare(String(b.start_at)));
}
