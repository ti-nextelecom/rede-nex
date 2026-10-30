const calendarDay = /^\d{4}-\d{2}-\d{2}$/;
const pad = value => String(value).padStart(2, '0');

/** Date-only deadlines expire at the end of that LOCAL calendar day, not UTC midnight. */
export function parseTaskDeadline(value) {
  if (!value) return new Date(NaN);
  return new Date(calendarDay.test(value) ? `${value}T23:59:00` : value);
}

/** datetime-local is a wall clock, so never populate it from toISOString() (UTC). */
export function taskDeadlineInput(value) {
  const date = parseTaskDeadline(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Serialize the user's wall-clock choice with an explicit timezone for PostgreSQL. */
export function taskDeadlineValue(value) {
  const date = parseTaskDeadline(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
