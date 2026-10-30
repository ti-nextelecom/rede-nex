import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, RefreshCw } from 'lucide-react';
import { apiGet } from '../lib/apiClient';
import { dayKey } from '../../shared/personalWork.mjs';
import { calendarMonth, eventsOnDay, type AgendaEvent } from '../../shared/dashboardCalendar.mjs';

const dayLabel = (date: string) => new Date(`${date}T12:00:00-03:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bahia' });
export function DashboardCalendar({ userId, refreshKey }: { userId: string; refreshKey?: number }) {
  const today = dayKey()!;
  const [year, month] = today.split('-').map(Number);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(Date.UTC(year, month - 1, 1)));
  const [selected, setSelected] = useState(today);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const y = visibleMonth.getUTCFullYear(), m = visibleMonth.getUTCMonth();
  const cells = useMemo(() => calendarMonth(y, m), [y, m]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(false); setEvents([]);
    const start = `${y}-${String(m + 1).padStart(2, '0')}-01T00:00:00-03:00`;
    const next = new Date(Date.UTC(y, m + 1, 1)).toISOString().slice(0, 10) + 'T00:00:00-03:00';
    // Same authenticated, permission-filtered endpoint as the native calendar.
    void apiGet<{ data: AgendaEvent[] }>(`/calendar/events?from=${encodeURIComponent(start)}&to=${encodeURIComponent(next)}`)
      .then(result => { if (active) setEvents(result.data ?? []); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, y, m, revision, refreshKey]);
  const selectedEvents = eventsOnDay(events, selected);
  function changeMonth(offset: number) {
    const next = new Date(Date.UTC(y, m + offset, 1));
    setVisibleMonth(next); setSelected(next.toISOString().slice(0, 10));
  }
  function showToday() { setVisibleMonth(new Date(Date.UTC(year, month - 1, 1))); setSelected(today); }
  return <section className="work-hub-panel dashboard-calendar" aria-labelledby="dashboard-calendar-title">
    <div className="work-hub-panel-heading"><div><span className="work-hub-section-kicker">Sua agenda, por perto</span><h2 id="dashboard-calendar-title"><CalendarDays size={19} /> Calendário</h2></div><Link to="/calendario">Abrir agenda <ArrowUpRight size={15} /></Link></div>
    <div className="dashboard-calendar-body">
      <div className="dashboard-mini-month">
        <div className="dashboard-calendar-nav"><h3>{visibleMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h3><button onClick={showToday}>Hoje</button><button onClick={() => changeMonth(-1)} aria-label="Mês anterior"><ChevronLeft size={17} /></button><button onClick={() => changeMonth(1)} aria-label="Próximo mês"><ChevronRight size={17} /></button></div>
        <div className="dashboard-calendar-grid" aria-label="Dias do mês">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => <span key={day} className="dashboard-calendar-weekday">{day}</span>)}
          {cells.map((date, index) => date ? <button key={date} type="button" className={`${date === today ? 'is-today ' : ''}${date === selected ? 'is-selected' : ''}`} aria-label={dayLabel(date)} aria-pressed={date === selected} aria-current={date === today ? 'date' : undefined} onClick={() => setSelected(date)}><span>{Number(date.slice(-2))}</span>{eventsOnDay(events, date).length > 0 && <i aria-hidden="true" />}</button> : <span key={`empty-${index}`} />)}
        </div>
      </div>
      <div className="dashboard-day-agenda" aria-busy={loading}>
        <div className="dashboard-agenda-heading"><h3>{selected === today ? 'Hoje na sua agenda' : dayLabel(selected)}</h3><span>{loading ? 'Carregando' : error ? 'Indisponível' : `${selectedEvents.length} compromisso(s)`}</span></div>
        {error ? <div className="dashboard-agenda-empty" role="status"><p>Não foi possível carregar sua agenda.</p><button onClick={() => setRevision(value => value + 1)}><RefreshCw size={14} /> Tentar novamente</button></div> : loading ? <p className="dashboard-agenda-empty" role="status">Carregando seus compromissos…</p> : !selectedEvents.length ? <div className="dashboard-agenda-empty"><CalendarDays size={25} /><p>Nenhum compromisso neste dia.</p><Link to="/calendario">Organizar minha agenda <ArrowUpRight size={14} /></Link></div> : <ul>{selectedEvents.map(event => <li key={event.id}><span className="dashboard-event-mark" /><div><strong>{event.title}</strong><span><Clock3 size={13} />{event.all_day ? 'Dia inteiro' : new Date(event.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bahia' })}{event.location && <><MapPin size={13} /> {event.location}</>}</span></div></li>)}</ul>}
      </div>
    </div>
  </section>;
}
