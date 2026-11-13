import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateFiveTwo,
  scheduleDate,
  scheduleDates,
  scheduleEntryInput,
  scheduleWindow,
} from '../shared/workSchedules.mjs';

const user = '10000000-0000-0000-0000-000000000001';
const options = {
  userIds: [user],
  from: '2026-11-09',
  to: '2026-11-15',
  workdays: [1, 2, 3, 4, 5],
  start_time: '08:00',
  end_time: '17:00',
};
test('schedule dates use calendar dates, Monday weeks and complete months', () => {
  assert.deepEqual(scheduleWindow('2026-11-13', 'week'), {
    from: '2026-11-09',
    to: '2026-11-15',
  });
  assert.deepEqual(scheduleWindow('2028-02-29', 'month'), {
    from: '2028-02-01',
    to: '2028-02-29',
  });
  assert.deepEqual(scheduleWindow('2000-01-01', 'week'), {
    from: '2000-01-01',
    to: '2000-01-02',
  });
  assert.deepEqual(scheduleWindow('2100-12-31', 'week'), {
    from: '2100-12-27',
    to: '2100-12-31',
  });
  assert.equal(scheduleDates('2026-11-01', '2026-11-30').length, 30);
  for (const invalid of [
    '2026-02-29',
    '2026-02-31',
    '',
    null,
    '2026-11-13T00:00:00Z',
  ])
    assert.throws(() => scheduleDate(invalid));
  assert.throws(() => scheduleDates('2026-11-10', '2026-11-09'));
  assert.throws(() => scheduleDates('2026-01-01', '2026-12-31'));
});
test('5x2 generation preserves agreements by default and requires five distinct workdays', () => {
  const generated = generateFiveTwo(options);
  assert.equal(generated.length, 7);
  assert.equal(generated.filter((entry) => entry.status === 'work').length, 5);
  assert.equal(generated.filter((entry) => entry.status === 'off').length, 2);
  const existing = [
    {
      ...generated[0],
      status: 'agreed_off',
      note: 'Acordado com a supervisão',
      revision: 3,
    },
  ];
  assert.equal(generateFiveTwo({ ...options, existing }).length, 6);
  const replacement = generateFiveTwo({ ...options, existing, replace: true });
  assert.equal(replacement[0].expected_revision, 3);
  assert.equal(replacement[0].status, 'work');
  assert.throws(() => generateFiveTwo({ ...options, workdays: [1, 2, 3, 4] }));
  assert.throws(() =>
    generateFiveTwo({ ...options, workdays: [1, 1, 2, 3, 4] }),
  );
  assert.throws(() => generateFiveTwo({ ...options, userIds: [] }));
  assert.throws(() =>
    generateFiveTwo({
      ...options,
      userIds: Array.from({ length: 1000 }, (_, index) => String(index)),
    }),
  );
});
test('daily input enforces explicit hours, agreement details, bounded fields and revisions', () => {
  const entry = generateFiveTwo(options)[0];
  assert.equal(
    scheduleEntryInput({ ...entry, start_time: '22:00', end_time: '06:00' })
      .end_time,
    '06:00',
  );
  assert.throws(() =>
    scheduleEntryInput({ ...entry, start_time: '08:00', end_time: '08:00' }),
  );
  assert.throws(() => scheduleEntryInput({ ...entry, status: 'off' }));
  assert.equal(
    scheduleEntryInput({
      ...entry,
      status: 'agreed_off',
      start_time: null,
      end_time: null,
    }).status,
    'agreed_off',
  );
  assert.throws(() => scheduleEntryInput({ ...entry, expected_revision: -1 }));
  assert.throws(() => scheduleEntryInput({ ...entry, note: 'x'.repeat(501) }));
  assert.throws(() => scheduleEntryInput({ ...entry, arbitrary: 'value' }));
  assert.throws(() => scheduleEntryInput({ ...entry, user_id: [user] }));
});
