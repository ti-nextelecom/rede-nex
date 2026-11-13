export const SCHEDULE_STATUSES = ['work', 'off', 'agreed_off', 'unplanned'];
export const SCHEDULE_LABELS = {
  work: 'Trabalho',
  off: 'Folga',
  agreed_off: 'Folga combinada',
  unplanned: 'Sem escala',
};
export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function scheduleError(message, statusCode = 400) {
  return Object.assign(new Error(message), {
    statusCode,
    code: 'SCHEDULE_ERROR',
  });
}

export function scheduleDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw scheduleError('Data inválida.');
  const date = new Date(value + 'T12:00:00Z');
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    value < '2000-01-01' ||
    value > '2100-12-31'
  )
    throw scheduleError('Data inválida.');
  return value;
}

export function addScheduleDays(value, amount) {
  const date = new Date(scheduleDate(value) + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function scheduleDates(from, to, maximum = 93) {
  scheduleDate(from);
  scheduleDate(to);
  const length = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  if (length < 1 || length > maximum)
    throw scheduleError(`Escolha um período de até ${maximum} dias.`);
  return Array.from({ length }, (_, index) => addScheduleDays(from, index));
}

export function scheduleWindow(anchor, view) {
  scheduleDate(anchor);
  if (view === 'week') {
    const weekday = new Date(anchor + 'T12:00:00Z').getUTCDay();
    const offset = (weekday + 6) % 7;
    const from = addScheduleDays(anchor, -offset);
    const to = addScheduleDays(anchor, 6 - offset);
    return {
      from: from < '2000-01-01' ? '2000-01-01' : from,
      to: to > '2100-12-31' ? '2100-12-31' : to,
    };
  }
  const from = anchor.slice(0, 7) + '-01';
  const date = new Date(from + 'T12:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return { from, to: date.toISOString().slice(0, 10) };
}

export function scheduleEntryInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw scheduleError('Dia de escala inválido.');
  const fields = [
    'user_id',
    'day',
    'status',
    'start_time',
    'end_time',
    'note',
    'expected_revision',
  ];
  if (Object.keys(value).some((key) => !fields.includes(key)))
    throw scheduleError('Campo de escala inválido.');
  if (
    typeof value.user_id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value.user_id,
    )
  )
    throw scheduleError('Colaborador inválido.');
  if (!SCHEDULE_STATUSES.includes(value.status))
    throw scheduleError('Situação inválida.');
  if (
    !Number.isInteger(value.expected_revision) ||
    value.expected_revision < 0 ||
    value.expected_revision >= 2147483647
  )
    throw scheduleError('Revisão inválida.');
  if (
    typeof value.note !== 'string' ||
    value.note.length > 500 ||
    /\0/.test(value.note)
  )
    throw scheduleError('A observação deve ter até 500 caracteres.');
  const start = value.start_time || null,
    end = value.end_time || null;
  const time = (item) =>
    typeof item === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(item);
  if (value.status === 'work') {
    if (!time(start) || !time(end) || start === end)
      throw scheduleError('Informe horários de entrada e saída diferentes.');
  } else if (start !== null || end !== null)
    throw scheduleError('Horários são permitidos apenas nos dias de trabalho.');
  return {
    user_id: value.user_id.toLowerCase(),
    day: scheduleDate(value.day),
    status: value.status,
    start_time: start,
    end_time: end,
    note: value.note.trim(),
    expected_revision: value.expected_revision,
  };
}

export function generateFiveTwo({
  userIds,
  from,
  to,
  workdays,
  start_time,
  end_time,
  existing = [],
  replace = false,
}) {
  if (!Array.isArray(userIds) || userIds.some((id) => typeof id !== 'string'))
    throw scheduleError('Selecione os colaboradores.');
  if (
    !Array.isArray(workdays) ||
    workdays.length !== 5 ||
    new Set(workdays).size !== 5 ||
    workdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  )
    throw scheduleError('Selecione cinco dias de trabalho e dois de folga.');
  const dates = scheduleDates(from, to);
  const ids = [...new Set(userIds)];
  if (!ids.length || ids.length * dates.length > 5000)
    throw scheduleError(
      'Selecione colaboradores e um período de até 5.000 dias de escala no total.',
    );
  const previous = new Map(
    existing.map((entry) => [entry.user_id + ':' + entry.day, entry]),
  );
  const entries = [];
  for (const user_id of ids) {
    for (const day of dates) {
      const old = previous.get(user_id + ':' + day);
      if (old && old.status !== 'unplanned' && !replace) continue;
      const status = workdays.includes(new Date(day + 'T12:00:00Z').getUTCDay())
        ? 'work'
        : 'off';
      entries.push(
        scheduleEntryInput({
          user_id,
          day,
          status,
          start_time: status === 'work' ? start_time : null,
          end_time: status === 'work' ? end_time : null,
          note: '',
          expected_revision: old?.revision || 0,
        }),
      );
    }
  }
  return entries;
}
