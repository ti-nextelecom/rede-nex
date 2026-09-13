import { pool, query } from './db.js';
import { cleanText, syncManyToMany } from './db_utils.js';

const eventSelect = `
  select
    e.id, e.title, e.description, e.location, e.start_at, e.end_at,
    e.all_day, e.color, e.created_by, e.created_at, e.updated_at,
    (select json_build_object('id', u.id, 'name', u.name, 'photo_url', u.photo_url)
     from users u where u.id = e.created_by) as creator,
    coalesce((
      select json_agg(json_build_object('id', u.id, 'name', u.name, 'photo_url', u.photo_url))
      from calendar_event_participants p join users u on u.id = p.user_id
      where p.event_id = e.id
    ), '[]') as participants
  from calendar_events e
`;

export async function listEvents(userId, { from, to } = {}) {
  let where = 'where (e.created_by = $1 or exists (select 1 from calendar_event_participants p where p.event_id = e.id and p.user_id = $1))';
  const params = [userId];
  if (from) { params.push(from); where += ` and e.end_at >= $${params.length}`; }
  if (to)   { params.push(to);   where += ` and e.start_at <= $${params.length}`; }
  const { rows } = await query(`${eventSelect} ${where} order by e.start_at asc`, params);
  return rows;
}

export async function getEvent(id) {
  const { rows } = await query(`${eventSelect} where e.id = $1`, [id]);
  return rows[0] || null;
}

export async function createEvent(userId, input) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `insert into calendar_events (title, description, location, start_at, end_at, all_day, color, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [
        cleanText(input.title, 500),
        cleanText(input.description || '', 5000) || null,
        cleanText(input.location || '', 500) || null,
        input.start_at,
        input.end_at,
        !!input.all_day,
        input.color || '#f97316',
        userId,
      ]
    );
    const id = rows[0].id;
    const participants = [...new Set([userId, ...(input.participant_ids || [])])];
    await client.query(
      `insert into calendar_event_participants (event_id, user_id)
       select $1, uid from unnest($2::uuid[]) as uid on conflict do nothing`,
      [id, participants]
    );
    await client.query('COMMIT');
    return getEvent(id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateEvent(id, input) {
  const fields = [], values = [];
  let i = 1;
  if (input.title !== undefined)       { fields.push(`title=$${i++}`);       values.push(cleanText(input.title, 500)); }
  if (input.description !== undefined) { fields.push(`description=$${i++}`); values.push(cleanText(input.description, 5000) || null); }
  if (input.location !== undefined)    { fields.push(`location=$${i++}`);    values.push(cleanText(input.location, 500) || null); }
  if (input.start_at !== undefined)    { fields.push(`start_at=$${i++}`);    values.push(input.start_at); }
  if (input.end_at !== undefined)      { fields.push(`end_at=$${i++}`);      values.push(input.end_at); }
  if (input.all_day !== undefined)     { fields.push(`all_day=$${i++}`);     values.push(!!input.all_day); }
  if (input.color !== undefined)       { fields.push(`color=$${i++}`);       values.push(input.color); }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (fields.length) {
      fields.push('updated_at=now()');
      values.push(id);
      await client.query(`update calendar_events set ${fields.join(',')} where id=$${i}`, values);
    }
    if (input.participant_ids !== undefined) {
      await client.query('delete from calendar_event_participants where event_id=$1', [id]);
      if (input.participant_ids.length) {
        await client.query(
          `insert into calendar_event_participants (event_id, user_id)
           select $1, uid from unnest($2::uuid[]) as uid on conflict do nothing`,
          [id, input.participant_ids]
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return getEvent(id);
}

export async function deleteEvent(id) {
  await query('delete from calendar_events where id=$1', [id]);
  return true;
}

function icalUnfold(text) {
  return text.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseIcalProp(line) {
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return null;
  const keyPart = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1);
  const baseKey = keyPart.split(';')[0].toUpperCase();
  return { baseKey, params: keyPart.toUpperCase(), value };
}

function parseIcalDate(prop) {
  if (!prop) return null;
  const { params, value: raw } = prop;
  if (params.includes('VALUE=DATE') || /^\d{8}$/.test(raw)) {
    const y = raw.slice(0,4), m = raw.slice(4,6), d = raw.slice(6,8);
    return { iso: y + '-' + m + '-' + d + 'T00:00:00.000Z', allDay: true };
  }
  const y = raw.slice(0,4), mo = raw.slice(4,6), d = raw.slice(6,8);
  const h = raw.slice(9,11) || '00', mi = raw.slice(11,13) || '00', s = raw.slice(13,15) || '00';
  if (raw.endsWith('Z')) return { iso: y + '-' + mo + '-' + d + 'T' + h + ':' + mi + ':' + s + '.000Z', allDay: false };
  return { iso: y + '-' + mo + '-' + d + 'T' + h + ':' + mi + ':' + s + '.000-03:00', allDay: false };
}

function decodeIcalText(str) {
  return str.replace(/\\n/g, '\n').replace(/\\N/g, '\n').replace(/\\,/g, ',').replace(/\;/g, ';').replace(/\\\\/g, '\\');
}

function parseVEvents(text) {
  const lines = icalUnfold(text).split('\n');
  const events = [];
  let current = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === 'BEGIN:VEVENT') { current = {}; continue; }
    if (line === 'END:VEVENT') { if (current) events.push(current); current = null; continue; }
    if (!current) continue;
    const prop = parseIcalProp(line);
    if (prop) current[prop.baseKey] = prop;
  }
  return events;
}

export async function fetchGoogleCalendarEvents(icalUrl, { from, to } = {}) {
  const url = icalUrl.replace(/^webcal:/, 'https:');
  const icsText = await new Promise((resolve, reject) => {
    function doGet(target, depth) {
      if (depth > 2) return reject(new Error('Too many redirects'));
      const mod = target.startsWith('https') ? require('https') : require('http');
      const req = mod.get(target, { timeout: 10000 }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return doGet(res.headers.location, depth + 1);
        }
        let d = '';
        res.on('data', chunk => { d += chunk; });
        res.on('end', () => resolve(d));
      });
      req.on('error', reject);
    }
    doGet(url, 0);
  });

  const fromDate = from ? new Date(from) : null;
  const toDate   = to   ? new Date(to)   : null;

  return parseVEvents(icsText).flatMap(ev => {
    try {
      const start = parseIcalDate(ev.DTSTART);
      if (!start) return [];
      const end = parseIcalDate(ev.DTEND) || { iso: start.iso, allDay: start.allDay };
      const startDate = new Date(start.iso);
      const endDate   = new Date(end.iso);
      if (fromDate && endDate < fromDate) return [];
      if (toDate   && startDate > toDate)  return [];
      const uid = ev.UID ? ev.UID.value : Math.random().toString(36);
      return [{
        id: 'google_' + uid.replace(/[^a-z0-9]/gi, '_'),
        title: decodeIcalText(ev.SUMMARY ? ev.SUMMARY.value : 'Sem título'),
        description: ev.DESCRIPTION ? decodeIcalText(ev.DESCRIPTION.value) : undefined,
        location: ev.LOCATION ? decodeIcalText(ev.LOCATION.value) : undefined,
        start_at: start.iso,
        end_at: end.iso,
        all_day: start.allDay,
        color: '#4285F4',
        created_by: null,
        source: 'google',
      }];
    } catch { return []; }
  });
}

