import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  History,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { EmployeeAvatar } from '../components/EmployeeAvatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../components/ui/dialog';
import { ScheduleEditor } from '../components/schedules/ScheduleEditor';
import { ScheduleGenerator } from '../components/schedules/ScheduleGenerator';
import {
  getScheduleHistory,
  getSchedules,
  saveSchedules,
  scheduleLoadError,
  type ScheduleData,
  type ScheduleDepartment,
  type ScheduleHistory,
  type SchedulePerson,
} from '../lib/workSchedulesApi';
import {
  addScheduleDays,
  scheduleDate,
  scheduleDates,
  scheduleWindow,
  SCHEDULE_LABELS,
  WEEKDAYS,
  type ScheduleEntry,
  type ScheduleInput,
} from '../../shared/workSchedules.mjs';
import './work-schedules.css';

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bahia',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const today = () => {
  const parts = Object.fromEntries(
    dateFormatter
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const displayDate = (date: string) => date.split('-').reverse().join('/');
const compactStatus = { work: 'T', off: 'F', agreed_off: 'FC', unplanned: '—' };
function validDate(value: string | null) {
  try {
    return value ? scheduleDate(value) : today();
  } catch {
    return today();
  }
}

function describeEntry(entry: ScheduleEntry | null) {
  if (!entry) return SCHEDULE_LABELS.unplanned;
  const label = SCHEDULE_LABELS[entry.status];
  return entry.status === 'work'
    ? `${label} ${entry.start_time}–${entry.end_time}`
    : label;
}

function ScheduleHistoryDialog({
  from,
  to,
  userId,
  onClose,
}: {
  from: string;
  to: string;
  userId: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ScheduleHistory[]>([]);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const lock = useRef(false);
  const mounted = useRef(true);
  const load = useCallback(
    async (offset: number) => {
      if (lock.current) return;
      lock.current = true;
      setLoading(true);
      setError('');
      try {
        const data = await getScheduleHistory(from, to, offset, userId);
        if (mounted.current) {
          setItems((current) =>
            offset ? [...current, ...data.history] : data.history,
          );
          setMore(data.has_more);
        }
      } catch (cause) {
        if (mounted.current)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Não foi possível carregar o histórico.',
          );
      } finally {
        lock.current = false;
        if (mounted.current) setLoading(false);
      }
    },
    [from, to, userId],
  );
  useEffect(() => {
    mounted.current = true;
    void load(0);
    return () => {
      mounted.current = false;
    };
  }, [load]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="schedule-dialog schedule-history">
        <DialogTitle>Histórico de alterações</DialogTitle>
        <DialogDescription>
          {displayDate(from)} a {displayDate(to)}
          {userId ? ' · Colaborador selecionado' : ' · Todas as áreas visíveis'}
        </DialogDescription>
        {error && (
          <p role="alert" className="schedule-error">
            {error}
            <button onClick={() => void load(items.length)}>
              Tentar novamente
            </button>
          </p>
        )}
        <ol>
          {items.map((item) => (
            <li key={item.id}>
              <strong>
                {item.user_name} · {displayDate(item.day)}
              </strong>
              <p>
                {describeEntry(item.before_data)} →{' '}
                {describeEntry(item.after_data)}
              </p>
              {item.after_data.note && (
                <p className="schedule-history-note">{item.after_data.note}</p>
              )}
              {item.before_data?.note &&
                item.before_data.note !== item.after_data.note && (
                  <p className="schedule-history-note schedule-hint">
                    Observação anterior · {item.before_data.note}
                  </p>
                )}
              <small>
                {item.actor_name} ·{' '}
                {new Date(item.created_at).toLocaleString('pt-BR')}
              </small>
            </li>
          ))}
        </ol>
        {loading && <p role="status">Carregando histórico…</p>}
        {!loading && !items.length && !error && (
          <p>Nenhuma alteração registrada neste período.</p>
        )}
        {more && (
          <button disabled={loading} onClick={() => void load(items.length)}>
            Carregar mais
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function WorkSchedules() {
  const { user } = useAuth();
  return user ? <ScheduleWorkspace key={user.id} actorId={user.id} /> : null;
}

function ScheduleWorkspace({ actorId }: { actorId: string }) {
  const [params] = useSearchParams();
  const [anchor, setAnchor] = useState(() => validDate(params.get('date')));
  const [view, setView] = useState<'week' | 'month'>('week');
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('all');
  const [personFilter, setPersonFilter] = useState(params.get('user') || '');
  const [mine, setMine] = useState(false);
  const [editor, setEditor] = useState<{
    person: SchedulePerson;
    day: string;
    entry?: ScheduleEntry;
  } | null>(null);
  const [generator, setGenerator] = useState(false);
  const [history, setHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const mutationLock = useRef(false);
  const loadVersion = useRef(0);
  const currentActor = useRef(actorId);
  const currentDay = today();
  const { from, to } = scheduleWindow(anchor, view);
  const days = useMemo(() => scheduleDates(from, to), [from, to]);

  useEffect(() => {
    setAnchor(validDate(params.get('date')));
    setPersonFilter(params.get('user') || '');
    setDepartment('all');
    setSearch('');
    setMine(false);
  }, [params]);
  useEffect(() => {
    currentActor.current = actorId;
    const requests = loadVersion;
    return () => {
      currentActor.current = '';
      requests.current++;
    };
  }, [actorId]);
  const load = useCallback(
    async (quiet = false) => {
      const version = ++loadVersion.current;
      if (!quiet) setLoading(true);
      setError('');
      try {
        const result = await getSchedules(from, to);
        if (loadVersion.current === version) setData(result);
      } catch (cause) {
        if (loadVersion.current === version) setError(scheduleLoadError(cause));
      } finally {
        if (loadVersion.current === version) setLoading(false);
      }
    },
    [from, to],
  );
  useEffect(() => {
    const requests = loadVersion;
    void load();
    return () => {
      requests.current++;
    };
  }, [load]);
  useEffect(() => {
    if (editor || generator || history || saving) return;
    const refresh = () => {
      if (!document.hidden) void load(true);
    };
    window.addEventListener('focus', refresh);
    const interval = window.setInterval(refresh, 30000);
    return () => {
      window.removeEventListener('focus', refresh);
      window.clearInterval(interval);
    };
  }, [editor, generator, history, saving, load]);

  const byDay = useMemo(
    () =>
      new Map(
        (data?.entries || []).map((entry) => [
          entry.user_id + ':' + entry.day,
          entry,
        ]),
      ),
    [data],
  );
  const departments = useMemo(() => {
    const directory = new Map<string, ScheduleDepartment>(
      (data?.departments || []).map((sector) => [sector.id, sector]),
    );
    for (const person of data?.people || []) {
      const id = person.department_id || 'none';
      if (!directory.has(id))
        directory.set(id, {
          id,
          name: person.department_name || 'Sem setor',
          parent_id: null,
          manager_id: null,
          manager_name: null,
          manager_photo_url: null,
        });
    }
    return [...directory.values()].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    );
  }, [data]);
  const sectors = useMemo(() => {
    const people = data?.people || [];
    const directory = new Map(people.map((person) => [person.id, person]));
    const matches = (person: SchedulePerson) =>
      (!mine || person.can_edit) &&
      (!personFilter || person.id === personFilter) &&
      person.name
        .toLocaleLowerCase('pt-BR')
        .includes(search.toLocaleLowerCase('pt-BR'));
    return departments
      .filter((sector) => department === 'all' || sector.id === department)
      .flatMap((sector) => {
        const supervisor = sector.manager_id
          ? directory.get(sector.manager_id)
          : undefined;
        const members = people.filter(
          (person) =>
            (person.department_id || 'none') === sector.id && matches(person),
        );
        if (
          (search || personFilter || mine) &&
          !members.length &&
          !(supervisor && matches(supervisor))
        )
          return [];
        return [
          {
            department: sector,
            people: supervisor
              ? [
                  supervisor,
                  ...members.filter((person) => person.id !== supervisor.id),
                ]
              : members,
          },
        ];
      });
  }, [data, departments, department, mine, personFilter, search]);
  const visible = useMemo(
    () => [
      ...new Map(
        sectors
          .flatMap((sector) => sector.people)
          .map((person) => [person.id, person]),
      ).values(),
    ],
    [sectors],
  );
  const editable = useMemo(
    () => (data?.people || []).filter((person) => person.can_edit),
    [data],
  );
  const totals = useMemo(() => {
    const ids = new Set(visible.map((person) => person.id));
    const counts = {
      work: 0,
      off: 0,
      agreed_off: 0,
      unplanned: visible.length * days.length,
    };
    for (const entry of data?.entries || []) {
      if (
        !ids.has(entry.user_id) ||
        entry.day < from ||
        entry.day > to ||
        entry.status === 'unplanned'
      )
        continue;
      counts[entry.status]++;
      counts.unplanned--;
    }
    return counts;
  }, [data, visible, days.length, from, to]);

  async function save(entries: ScheduleInput[], operationId: string) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setSaving(true);
    try {
      const result = await saveSchedules(actorId, operationId, entries);
      if (currentActor.current !== actorId) return;
      setEditor(null);
      setGenerator(false);
      setNotice(
        result.changed_count
          ? `${result.changed_count} dia(s) atualizado(s). Os demais supervisores foram notificados.`
          : 'A escala já está atualizada.',
      );
      await load();
    } finally {
      mutationLock.current = false;
      if (currentActor.current === actorId) setSaving(false);
    }
  }
  function move(direction: number) {
    let next = addScheduleDays(from, direction * 7);
    if (view === 'month') {
      const date = new Date(from + 'T12:00:00Z');
      date.setUTCMonth(date.getUTCMonth() + direction);
      next = date.toISOString().slice(0, 10);
    }
    if (next >= '2000-01-01' && next <= '2100-12-31') setAnchor(next);
    setNotice('');
  }
  const ready = data?.from === from && data?.to === to && !loading && !error;
  return (
    <section className="schedule-page">
      <header className="schedule-header">
        <div>
          <h1>
            <CalendarDays size={24} /> Escalas e folgas
          </h1>
          <p>
            {data && !data.is_supervisor
              ? 'Consulte seus dias de trabalho e suas folgas.'
              : 'Organize a jornada por setor e acompanhe supervisores e colaboradores.'}
          </p>
        </div>
        <div className="schedule-actions">
          <button disabled={!ready} onClick={() => setHistory(true)}>
            <History size={17} /> Histórico
          </button>
          {editable.length > 0 && (
            <button
              className="schedule-primary"
              disabled={!ready}
              onClick={() => setGenerator(true)}
            >
              <Plus size={17} /> Planejar 5×2
            </button>
          )}
        </div>
      </header>
      <div className="schedule-toolbar">
        <div className="schedule-period">
          <button onClick={() => move(-1)} aria-label="Período anterior">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setAnchor(today())}>Hoje</button>
          <button onClick={() => move(1)} aria-label="Próximo período">
            <ChevronRight size={18} />
          </button>
          <label className="schedule-date-label">
            <span className="sr-only">Escolher data</span>
            <input
              type="date"
              value={anchor}
              min="2000-01-01"
              max="2100-12-31"
              onChange={(event) => {
                if (event.target.value)
                  setAnchor(validDate(event.target.value));
              }}
            />
          </label>
        </div>
        <div className="schedule-view" aria-label="Visualização">
          <button
            aria-pressed={view === 'week'}
            onClick={() => setView('week')}
          >
            Semana
          </button>
          <button
            aria-pressed={view === 'month'}
            onClick={() => setView('month')}
          >
            Mês
          </button>
        </div>
        <button
          disabled={loading}
          onClick={() => void load()}
          aria-label="Atualizar escalas"
        >
          <RefreshCw size={17} />
        </button>
      </div>
      <div className="schedule-filters">
        <label className="schedule-search">
          <Search size={16} />
          <input
            type="search"
            placeholder="Buscar colaborador"
            aria-label="Buscar colaborador"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <select
          aria-label="Filtrar setor"
          value={department}
          disabled={!ready}
          onChange={(event) => setDepartment(event.target.value)}
        >
          <option value="all">Todos os setores</option>
          {departments.map((sector) => (
            <option key={sector.id} value={sector.id}>
              {sector.name}
            </option>
          ))}
        </select>
        {editable.length > 0 && (
          <label className="schedule-checkbox">
            <input
              type="checkbox"
              checked={mine}
              onChange={(event) => setMine(event.target.checked)}
            />
            Minha hierarquia
          </label>
        )}
        {personFilter && (
          <button onClick={() => setPersonFilter('')}>
            Exibir todos os colaboradores
          </button>
        )}
      </div>
      {notice && (
        <p role="status" className="schedule-notice">
          {notice}
        </p>
      )}
      {error && (
        <div role="alert" className="schedule-error">
          {error}
          <button onClick={() => void load()}>Tentar novamente</button>
        </div>
      )}
      <div className="schedule-caption">
        <h2>
          {view === 'week'
            ? `${displayDate(from)} a ${displayDate(to)}`
            : new Date(from + 'T12:00:00Z').toLocaleDateString('pt-BR', {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              })}
        </h2>
        <span>
          {ready
            ? `${sectors.length} setor(es) · ${visible.length} pessoa(s)`
            : loading
              ? 'Carregando setores…'
              : 'Dados indisponíveis'}
        </span>
      </div>
      <div className="schedule-legend">
        {(['work', 'off', 'agreed_off', 'unplanned'] as const).map((status) => (
          <span key={status}>
            <i data-status={status}>{compactStatus[status]}</i>
            {SCHEDULE_LABELS[status]} <b>{ready ? totals[status] : '—'}</b>
          </span>
        ))}
      </div>
      {loading && (
        <p className="schedule-empty" role="status">
          Carregando escalas…
        </p>
      )}
      {ready && (
        <div
          className={`schedule-grid-scroll is-${view}`}
          tabIndex={0}
          role="region"
          aria-label="Grade de escalas. Use a rolagem horizontal para consultar os dias."
        >
          <table className="schedule-grid">
            <caption className="sr-only">
              Escala de {displayDate(from)} a {displayDate(to)}
            </caption>
            <thead>
              <tr>
                <th scope="col">Colaborador</th>
                {days.map((day) => (
                  <th scope="col" key={day} data-today={day === currentDay}>
                    <span>
                      {WEEKDAYS[new Date(day + 'T12:00:00Z').getUTCDay()]}
                    </span>
                    <strong>{day.slice(8)}</strong>
                  </th>
                ))}
              </tr>
            </thead>
            {sectors.map((sector) => (
              <tbody key={sector.department.id}>
                <tr className="schedule-sector-heading">
                  <th colSpan={days.length + 1} scope="rowgroup">
                    <div className="schedule-sector-title">
                      <strong>{sector.department.name}</strong>
                      <span className="schedule-sector-supervisor">
                        {sector.department.manager_name && (
                          <EmployeeAvatar
                            name={sector.department.manager_name}
                            photo={sector.department.manager_photo_url}
                          />
                        )}
                        <span>
                          {sector.department.manager_name
                            ? `Supervisor · ${sector.department.manager_name}`
                            : 'Supervisor não definido'}
                        </span>
                      </span>
                      <small>
                        {
                          sector.people.filter(
                            (person) =>
                              person.id !== sector.department.manager_id,
                          ).length
                        }{' '}
                        colaborador(es)
                      </small>
                    </div>
                  </th>
                </tr>
                {sector.people.map((person) => (
                  <tr key={person.id}>
                    <th scope="row">
                      <div className="schedule-person">
                        <EmployeeAvatar
                          name={person.name}
                          photo={person.photo_url}
                        />
                        <span>
                          <strong>{person.name}</strong>
                          <small>
                            {person.id === sector.department.manager_id
                              ? 'Supervisor deste setor'
                              : 'Colaborador'}
                            {person.can_edit ? '' : ' · Consulta'}
                          </small>
                        </span>
                      </div>
                    </th>
                    {days.map((day) => {
                      const entry = byDay.get(person.id + ':' + day);
                      const status = entry?.status || 'unplanned';
                      const hours =
                        status === 'work'
                          ? `${entry?.start_time}–${entry?.end_time}${entry?.end_time && entry.start_time && entry.end_time < entry.start_time ? ' +1' : ''}`
                          : '';
                      const description = `${person.name}, ${displayDate(day)}, ${SCHEDULE_LABELS[status]}${hours ? ', ' + hours : ''}${entry?.note ? ', ' + entry.note : ''}`;
                      return (
                        <td key={day} data-today={day === currentDay}>
                          <button
                            className="schedule-cell"
                            data-status={status}
                            title={description}
                            aria-label={description}
                            onClick={() => setEditor({ person, day, entry })}
                          >
                            <strong>
                              {view === 'month'
                                ? compactStatus[status]
                                : SCHEDULE_LABELS[status]}
                            </strong>
                            {view === 'week' && hours && <small>{hours}</small>}
                            {entry?.note && (
                              <span
                                className="schedule-note-dot"
                                aria-label="Com observação"
                              />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {!sector.people.length && (
                  <tr>
                    <td
                      colSpan={days.length + 1}
                      className="schedule-sector-empty"
                    >
                      Nenhum colaborador ativo vinculado a este setor.
                    </td>
                  </tr>
                )}
                <tr className="schedule-sector-coverage">
                  <th scope="row">Em trabalho</th>
                  {days.map((day) => (
                    <td key={day}>
                      {
                        sector.people.filter(
                          (person) =>
                            byDay.get(person.id + ':' + day)?.status === 'work',
                        ).length
                      }
                    </td>
                  ))}
                </tr>
              </tbody>
            ))}
          </table>
          {!visible.length && (
            <p className="schedule-empty">
              Nenhum colaborador encontrado para os filtros selecionados.
            </p>
          )}
        </div>
      )}
      {editor && (
        <ScheduleEditor
          person={editor.person}
          day={editor.day}
          entry={editor.entry}
          busy={saving}
          onClose={() => setEditor(null)}
          onSave={save}
        />
      )}
      {generator && (
        <ScheduleGenerator
          people={editable}
          from={from}
          to={to}
          busy={saving}
          onClose={() => setGenerator(false)}
          onSave={save}
        />
      )}
      {history && (
        <ScheduleHistoryDialog
          from={from}
          to={to}
          userId={personFilter}
          onClose={() => setHistory(false)}
        />
      )}
    </section>
  );
}
