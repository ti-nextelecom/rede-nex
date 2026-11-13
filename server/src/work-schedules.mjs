import { createHash } from 'node:crypto';
import {
  scheduleDates,
  scheduleEntryInput,
  scheduleError,
} from '../../shared/workSchedules.mjs';

const uuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const entryKey = (entry) => entry.user_id + ':' + entry.day;
const cleanEntry = (row) => ({
  ...row,
  day:
    typeof row.day === 'string' ? row.day : row.day.toISOString().slice(0, 10),
});

export function scheduleRepository(pool) {
  async function transaction(actorId, work) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.schedule_user_id',$1,true)", [
        actorId,
      ]);
      const actor = (
        await client.query(
          "SELECT id,name,photo_url FROM public.users WHERE id=$1 AND status='active' FOR SHARE",
          [actorId],
        )
      ).rows[0];
      if (!actor) throw scheduleError('Usuário inativo ou sem acesso.', 403);
      const result = await work(client, actor);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    list(actorId, from, to) {
      scheduleDates(from, to);
      return transaction(actorId, async (client) => {
        const supervisor = (
          await client.query('SELECT public.schedule_is_supervisor() AS value')
        ).rows[0].value;
        const people = (
          await client.query(
            `SELECT u.id,u.name,u.photo_url,u.department_id,d.name AS department_name,
          public.schedule_can_manage(u.id) AS can_edit
          FROM public.users u LEFT JOIN public.departments d ON d.id=u.department_id
          WHERE u.status='active' AND ($1::boolean OR u.id=$2) ORDER BY u.name,u.id`,
            [supervisor, actorId],
          )
        ).rows;
        const departments = (
          await client.query(
            `SELECT d.id,d.name,d.parent_id,m.id AS manager_id,m.name AS manager_name,m.photo_url AS manager_photo_url
              FROM public.departments d
              LEFT JOIN public.users m ON m.id=d.manager_id AND m.status='active'
              WHERE $1::boolean OR d.id=(SELECT department_id FROM public.users WHERE id=$2)
              ORDER BY d.name,d.id`,
            [supervisor, actorId],
          )
        ).rows;
        const entries = (
          await client.query(
            `SELECT e.user_id,to_char(e.day,'YYYY-MM-DD') AS day,e.status,e.start_time,e.end_time,e.note,e.revision,e.updated_by,e.updated_at
          FROM public.work_schedule_entries e JOIN public.users u ON u.id=e.user_id
          WHERE e.day BETWEEN $1::date AND $2::date AND u.status='active' AND public.schedule_can_read(e.user_id)
          ORDER BY e.day,e.user_id`,
            [from, to],
          )
        ).rows;
        return {
          people,
          departments,
          entries,
          is_supervisor: supervisor,
          from,
          to,
        };
      });
    },

    save(actorId, payload) {
      if (
        !payload ||
        Object.keys(payload).some(
          (key) => !['operation_id', 'entries'].includes(key),
        ) ||
        !uuid(payload.operation_id) ||
        !Array.isArray(payload.entries) ||
        !payload.entries.length ||
        payload.entries.length > 5000
      )
        throw scheduleError('Alteração de escala inválida.');
      const input = payload.entries
        .map(scheduleEntryInput)
        .sort((a, b) => entryKey(a).localeCompare(entryKey(b)));
      if (new Set(input.map(entryKey)).size !== input.length)
        throw scheduleError('Há dias repetidos na alteração.');
      const days = input.map((entry) => entry.day).sort();
      scheduleDates(days[0], days.at(-1));
      const requestHash = createHash('sha256')
        .update(JSON.stringify(input))
        .digest('hex');
      return transaction(actorId, async (client, actor) => {
        // Serializes both retries of the same request and edits of currently empty days.
        await client.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
          ['schedule-operation:' + payload.operation_id],
        );
        const previous = (
          await client.query(
            'SELECT actor_id,request_hash,changed_count FROM public.work_schedule_operations WHERE id=$1',
            [payload.operation_id],
          )
        ).rows[0];
        if (previous) {
          if (
            previous.actor_id !== actorId ||
            previous.request_hash !== requestHash
          )
            throw scheduleError(
              'Identificação da alteração já utilizada.',
              409,
            );
          return { changed_count: previous.changed_count, replayed: true };
        }
        const userIds = [
          ...new Set(input.map((entry) => entry.user_id)),
        ].sort();
        for (const id of userIds)
          await client.query(
            'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
            ['schedule-user:' + id],
          );
        const allowed = (
          await client.query(
            "SELECT id FROM public.users WHERE id=ANY($1::uuid[]) AND status='active' AND public.schedule_can_manage(id) FOR SHARE",
            [userIds],
          )
        ).rows;
        if (allowed.length !== userIds.length)
          throw scheduleError(
            'Você pode organizar somente colaboradores ativos da sua hierarquia.',
            403,
          );
        const stored = (
          await client.query(
            `SELECT user_id,to_char(day,'YYYY-MM-DD') AS day,status,start_time,end_time,note,revision,updated_by,updated_at
          FROM public.work_schedule_entries WHERE user_id=ANY($1::uuid[]) AND day BETWEEN $2::date AND $3::date FOR UPDATE`,
            [userIds, days[0], days.at(-1)],
          )
        ).rows;
        const byKey = new Map(
          stored.map((row) => [entryKey(row), cleanEntry(row)]),
        );
        const changed = input.filter((entry) => {
          const old = byKey.get(entryKey(entry));
          if ((old?.revision || 0) !== entry.expected_revision)
            throw scheduleError(
              'A escala foi alterada por outro supervisor. Atualize os dados e revise antes de salvar.',
              409,
            );
          return (
            !old ||
            ['status', 'start_time', 'end_time', 'note'].some(
              (field) => entry[field] !== old[field],
            )
          );
        });
        const operation = await client.query(
          'INSERT INTO public.work_schedule_operations(id,actor_id,request_hash,changed_count) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING RETURNING id',
          [payload.operation_id, actorId, requestHash, changed.length],
        );
        if (!operation.rowCount)
          throw scheduleError('Identificação da alteração já utilizada.', 409);
        if (!changed.length) return { changed_count: 0, replayed: false };
        const saved = (
          await client.query(
            `INSERT INTO public.work_schedule_entries(user_id,day,status,start_time,end_time,note,revision,updated_by)
          SELECT user_id,day,status,start_time,end_time,note,expected_revision+1,$2 FROM jsonb_to_recordset($1::jsonb)
            AS value(user_id uuid,day date,status text,start_time text,end_time text,note text,expected_revision integer)
          ON CONFLICT(user_id,day) DO UPDATE SET status=EXCLUDED.status,start_time=EXCLUDED.start_time,end_time=EXCLUDED.end_time,
            note=EXCLUDED.note,revision=EXCLUDED.revision,updated_by=EXCLUDED.updated_by,updated_at=now()
            WHERE work_schedule_entries.revision=EXCLUDED.revision-1
          RETURNING user_id,to_char(day,'YYYY-MM-DD') AS day,status,start_time,end_time,note,revision,updated_by,updated_at`,
            [JSON.stringify(changed), actorId],
          )
        ).rows;
        if (saved.length !== changed.length)
          throw scheduleError(
            'A escala mudou durante o salvamento. Atualize e revise.',
            409,
          );
        const history = saved.map((after) => ({
          user_id: after.user_id,
          day: after.day,
          before_data: byKey.get(entryKey(after)) || null,
          after_data: after,
        }));
        await client.query(
          `INSERT INTO public.work_schedule_history(operation_id,user_id,day,actor_id,actor_name,before_data,after_data)
          SELECT $2,user_id,day,$3,$4,before_data,after_data FROM jsonb_to_recordset($1::jsonb)
            AS value(user_id uuid,day date,before_data jsonb,after_data jsonb)`,
          [JSON.stringify(history), payload.operation_id, actorId, actor.name],
        );
        const changedPeople = new Set(changed.map((entry) => entry.user_id))
          .size;
        const link =
          '/escalas?date=' +
          changed[0].day +
          (changedPeople === 1 ? '&user=' + changed[0].user_id : '');
        // Notifications commit together with the schedule and audit. One notice per save.
        await client.query(
          `INSERT INTO public.notifications(user_id,title,message,type,link,actor_name,actor_photo_url)
          SELECT u.id,$2,$3,'info',$4,$5,$6 FROM public.users u LEFT JOIN public.roles r ON r.id=u.role_id
          WHERE u.status='active' AND u.id<>$1 AND (r.name IN ('Administrador','Gestor','Supervisor')
            OR EXISTS(SELECT 1 FROM public.departments d WHERE d.manager_id=u.id))`,
          [
            actorId,
            'Escala atualizada',
            `${actor.name} atualizou ${changed.length} dia(s) de ${changedPeople} colaborador(es), entre ${days[0].split('-').reverse().join('/')} e ${days.at(-1).split('-').reverse().join('/')}.`,
            link,
            actor.name,
            actor.photo_url,
          ],
        );
        return { changed_count: saved.length, replayed: false };
      });
    },

    history(actorId, from, to, userId = null, offset = 0) {
      scheduleDates(from, to);
      if (userId !== null && !uuid(userId))
        throw scheduleError('Colaborador inválido.');
      if (!Number.isInteger(offset) || offset < 0 || offset > 100000)
        throw scheduleError('Página inválida.');
      return transaction(actorId, async (client) => {
        const rows = (
          await client.query(
            `SELECT h.id,h.user_id,u.name AS user_name,to_char(h.day,'YYYY-MM-DD') AS day,
          h.actor_name,h.before_data,h.after_data,h.created_at FROM public.work_schedule_history h JOIN public.users u ON u.id=h.user_id
          WHERE h.day BETWEEN $1::date AND $2::date AND ($3::uuid IS NULL OR h.user_id=$3) AND public.schedule_can_read(h.user_id)
          ORDER BY h.created_at DESC,h.id DESC LIMIT 51 OFFSET $4`,
            [from, to, userId, offset],
          )
        ).rows;
        return { history: rows.slice(0, 50), has_more: rows.length > 50 };
      });
    },
  };
}

export function createScheduleRouter({
  pool,
  requireUser,
  readJson,
  sendJson,
  sendError,
}) {
  const repository = scheduleRepository(pool);
  return async (req, res, path) => {
    if (
      path !== '/api/work-schedules' &&
      !path.startsWith('/api/work-schedules/')
    )
      return false;
    const user = await requireUser(req, res);
    if (!user) return true;
    res.setHeader('Cache-Control', 'no-store');
    if (
      !['GET', 'HEAD'].includes(req.method) &&
      req.headers['x-nex-user-id'] !== user.id
    ) {
      sendError(
        req,
        res,
        409,
        'ACCOUNT_CHANGED',
        'A conta mudou. Reabra a escala antes de salvar.',
      );
      return true;
    }
    try {
      const params = new URL(req.url, 'http://local').searchParams;
      let data;
      if (path === '/api/work-schedules' && req.method === 'GET')
        data = await repository.list(
          user.id,
          params.get('from'),
          params.get('to'),
        );
      else if (path === '/api/work-schedules' && req.method === 'POST')
        data = await repository.save(user.id, await readJson(req));
      else if (path === '/api/work-schedules/history' && req.method === 'GET')
        data = await repository.history(
          user.id,
          params.get('from'),
          params.get('to'),
          params.get('user') || null,
          Number(params.get('offset') || 0),
        );
      else {
        sendError(req, res, 404, 'NOT_FOUND', 'Rota não encontrada.');
        return true;
      }
      sendJson(req, res, 200, { data });
    } catch (error) {
      if (error.statusCode)
        sendError(req, res, error.statusCode, error.code, error.message);
      else if (['42P01', '42883'].includes(error.code))
        sendError(
          req,
          res,
          503,
          'MIGRATION_REQUIRED',
          'O módulo Escalas precisa da atualização da API e da migração do banco.',
        );
      else throw error;
    }
    return true;
  };
}
