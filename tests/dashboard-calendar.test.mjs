import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarMonth, eventsOnDay } from '../shared/dashboardCalendar.mjs';
test('dashboard calendar: Monday-first grid keeps leap day and year boundary', () => {
  const feb = calendarMonth(2024, 1);
  assert.equal(feb.length % 7, 0); assert.equal(feb[0], null); assert.equal(feb[3], '2024-02-01');
  assert.ok(feb.includes('2024-02-29')); assert.ok(!calendarMonth(2025, 1).includes('2025-02-29'));
  assert.ok(calendarMonth(2027, 0).includes('2027-01-01'));
});
test('dashboard calendar: Bahia dates, exclusive midnight end, ordering and multi-day events', () => {
  const events = [
    { id: 'late', start_at: '2026-10-20T18:00:00-03:00', end_at: '2026-10-21T00:00:00-03:00' },
    { id: 'early', start_at: '2026-10-20T08:00:00-03:00', end_at: '2026-10-20T09:00:00-03:00' },
    { id: 'multi', start_at: '2026-10-19T10:00:00-03:00', end_at: '2026-10-22T12:00:00-03:00' },
  ];
  assert.deepEqual(eventsOnDay(events, '2026-10-20').map(e => e.id), ['multi', 'early', 'late']);
  assert.deepEqual(eventsOnDay(events, '2026-10-21').map(e => e.id), ['multi']);
  assert.deepEqual(eventsOnDay(events, '2026-10-23'), []);
});
