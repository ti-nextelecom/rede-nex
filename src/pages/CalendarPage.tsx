import { useEffect, useMemo, useState } from 'react';
import {
  Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Plus,
  Trash2, Users, X, Edit2, Check,
} from 'lucide-react';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/apiClient';
import { getUsers } from '../lib/appApi';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/utils';

interface CalEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  color: string;
  created_by: string;
  creator?: { id: string; name: string; photo_url?: string };
  participants?: { id: string; name: string; photo_url?: string }[];
  source?: string;
}

interface User { id: string; name: string; photo_url?: string; }

const COLORS = ['#f97316','#3b82f6','#10b981','#8b5cf6','#ef4444','#f59e0b','#ec4899','#06b6d4'];
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAYS_FULL = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DAYS_SHORT = ['D','S','T','Q','Q','S','S'];

function pad2(n: number) { return String(n).padStart(2, '0'); }
function toLocalISOString(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

type View = 'month' | 'agenda';

export function CalendarPage() {
  const { user } = useAuth();
  const today = new Date();
  // Default to agenda on mobile
  const [view, setView] = useState<View>(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'agenda' : 'month'
  );
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editEvent, setEditEvent] = useState<CalEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [saving, setSaving] = useState(false);

  const defaultStart = () => { const d = new Date(); d.setMinutes(0,0,0); return toLocalISOString(d); };
  const defaultEnd   = () => { const d = new Date(); d.setHours(d.getHours()+1,0,0,0); return toLocalISOString(d); };

  const [form, setForm] = useState({
    title: '', description: '', location: '',
    start_at: defaultStart(), end_at: defaultEnd(),
    all_day: false, color: COLORS[0], participant_ids: [] as string[],
  });

  const prevMonth = () => { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); };

  const loadEvents = async () => {
    setLoading(true);
    try {
      const from = new Date(year, month, 1).toISOString();
      const to   = new Date(year, month+1, 0, 23, 59, 59).toISOString();
      const res  = await apiGet<{ data: CalEvent[] }>(`/calendar/events?from=${from}&to=${to}`);
      setEvents(res.data ?? []);
    } catch { setEvents([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadEvents(); }, [year, month]);
  useEffect(() => { getUsers().then(setUsers).catch(() => {}); }, []);

  const openCreate = (date?: Date) => {
    const s = date ? toLocalISOString(date) : defaultStart();
    const e = date ? toLocalISOString(new Date(date.getTime() + 3600000)) : defaultEnd();
    setEditEvent(null);
    setForm({ title: '', description: '', location: '', start_at: s, end_at: e, all_day: false, color: COLORS[0], participant_ids: [] });
    setShowModal(true);
  };

  const openEdit = (ev: CalEvent) => {
    setEditEvent(ev);
    setForm({
      title: ev.title, description: ev.description || '', location: ev.location || '',
      start_at: toLocalISOString(new Date(ev.start_at)),
      end_at: toLocalISOString(new Date(ev.end_at)),
      all_day: ev.all_day, color: ev.color,
      participant_ids: ev.participants?.map(p => p.id) || [],
    });
    setSelectedEvent(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        start_at: new Date(form.start_at).toISOString(),
        end_at: new Date(form.end_at).toISOString(),
      };
      if (editEvent) await apiPut(`/calendar/events/${editEvent.id}`, payload);
      else await apiPost('/calendar/events', payload);
      setShowModal(false);
      await loadEvents();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este evento?')) return;
    await apiDelete(`/calendar/events/${id}`);
    setSelectedEvent(null);
    await loadEvents();
  };

  // Calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({length: daysInMonth}, (_,i) => i+1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsForDay = (day: number) => {
    const d = `${year}-${pad2(month+1)}-${pad2(day)}`;
    return events.filter(ev => ev.start_at.slice(0,10) <= d && d <= ev.end_at.slice(0,10));
  };

  const agendaEvents = useMemo(
    () => [...events].sort((a,b) => a.start_at.localeCompare(b.start_at)),
    [events]
  );

  const toggleParticipant = (uid: string) => {
    setForm(f => ({
      ...f,
      participant_ids: f.participant_ids.includes(uid) ? f.participant_ids.filter(id => id !== uid) : [...f.participant_ids, uid],
    }));
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={20} className="text-orange-500" />
          <h1 className="text-lg font-bold text-slate-800">Calendário</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
            {(['month','agenda'] as View[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn('px-2.5 py-1.5 transition-colors', view === v ? 'bg-orange-500 text-white' : 'text-slate-600 hover:bg-slate-50')}>
                {v === 'month' ? 'Mês' : 'Lista'}
              </button>
            ))}
          </div>
          <button onClick={() => openCreate()}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
            <Plus size={15} /> <span className="hidden sm:inline">Novo evento</span>
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
        <button onClick={prevMonth} className="p-1.5 rounded hover:bg-slate-100 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center">
          <ChevronLeft size={18} className="text-slate-600" />
        </button>
        <span className="flex-1 text-center font-semibold text-slate-800 text-sm">
          {MONTHS[month]} {year}
        </span>
        <button onClick={nextMonth} className="p-1.5 rounded hover:bg-slate-100 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center">
          <ChevronRight size={18} className="text-slate-600" />
        </button>
        <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
          className="px-2 py-1 text-xs font-medium text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors">
          Hoje
        </button>
      </div>

      {view === 'month' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-100">
            {DAYS_FULL.map((d, i) => (
              <div key={d} className="py-2 text-center text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <span className="hidden sm:inline">{d}</span>
                <span className="sm:hidden">{DAYS_SHORT[i]}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const dayEvents = day ? eventsForDay(day) : [];
              return (
                <div key={i}
                  onClick={() => day && openCreate(new Date(year, month, day))}
                  className={cn(
                    'min-h-[52px] sm:min-h-[76px] border-b border-r border-slate-100 p-0.5 sm:p-1.5 cursor-pointer hover:bg-slate-50/60 transition-colors',
                    !day && 'bg-slate-50/30 cursor-default',
                    i % 7 === 6 && 'border-r-0'
                  )}
                >
                  {day && (
                    <>
                      <span className={cn(
                        'inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 text-[10px] sm:text-xs font-medium rounded-full mb-0.5',
                        isToday ? 'bg-orange-500 text-white' : 'text-slate-700'
                      )}>{day}</span>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map(ev => (
                          <div key={ev.id}
                            onClick={e => { e.stopPropagation(); setSelectedEvent(ev); }}
                            className="text-[8px] sm:text-[10px] font-medium text-white rounded px-0.5 sm:px-1 py-0.5 truncate cursor-pointer"
                            style={{ backgroundColor: ev.color }}>
                            <span className="hidden sm:inline">{ev.title}</span>
                            <span className="sm:hidden">·</span>
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[8px] sm:text-[10px] text-slate-500 px-0.5">+{dayEvents.length - 2}</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">Carregando eventos...</div>
          ) : agendaEvents.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar size={36} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">Nenhum evento neste mês</p>
              <button onClick={() => openCreate()} className="mt-3 text-orange-600 text-sm font-medium hover:underline">Criar evento</button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {agendaEvents.map(ev => (
                <div key={ev.id} onClick={() => setSelectedEvent(ev)}
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 cursor-pointer transition-colors">
                  <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: ev.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{ev.title}</p>
                      {ev.source === 'google' && <span className="flex-shrink-0 text-[9px] font-bold bg-[#4285F4] text-white rounded px-1 py-0.5 leading-none">G</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1"><Clock size={11} />
                        {new Date(ev.start_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                      </span>
                      {ev.location && <span className="flex items-center gap-1 truncate"><MapPin size={11} />{ev.location}</span>}
                    </div>
                  </div>
                  {ev.participants && ev.participants.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
                      <Users size={12} /> {ev.participants.length}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Event detail modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
              <div className="w-4 h-4 rounded-full mt-0.5 flex-shrink-0" style={{ backgroundColor: selectedEvent.color }} />
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-slate-800">{selectedEvent.title}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {new Date(selectedEvent.start_at).toLocaleString('pt-BR',{dateStyle:'full',timeStyle:'short'})}
                </p>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-slate-600 p-1"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {selectedEvent.source === 'google' && (
                <div className="flex items-center gap-1.5 text-xs text-blue-600">
                  <span className="font-bold bg-[#4285F4] text-white rounded px-1.5 py-0.5 text-[10px]">G</span>
                  Google Calendar
                </div>
              )}
              {selectedEvent.description && <p className="text-sm text-slate-700">{selectedEvent.description}</p>}
              {selectedEvent.location && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin size={14} className="text-orange-500 flex-shrink-0" /> {selectedEvent.location}
                </div>
              )}
              {selectedEvent.participants && selectedEvent.participants.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1.5">Participantes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedEvent.participants.map(p => (
                      <div key={p.id} className="flex items-center gap-1.5 bg-slate-100 rounded-full px-2.5 py-1">
                        <img src={p.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&size=20&background=f97316&color=fff`}
                          alt={p.name} className="w-4 h-4 rounded-full" />
                        <span className="text-xs text-slate-700">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {selectedEvent.created_by === user?.id && (
              <div className="flex gap-2 px-5 pb-5">
                <button onClick={() => openEdit(selectedEvent)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors min-h-[44px]">
                  <Edit2 size={14} /> Editar
                </button>
                <button onClick={() => handleDelete(selectedEvent.id)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors min-h-[44px]">
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">{editEvent ? 'Editar evento' : 'Novo evento'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Título *</label>
                <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" placeholder="Nome do evento" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Início *</label>
                  <input type="datetime-local" value={form.start_at} onChange={e => setForm(f => ({...f, start_at: e.target.value}))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Fim *</label>
                  <input type="datetime-local" value={form.end_at} onChange={e => setForm(f => ({...f, end_at: e.target.value}))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Local</label>
                <input value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" placeholder="Sala, endereço ou link" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Descrição</label>
                <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                  rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" placeholder="Detalhes..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Cor</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({...f, color: c}))}
                      className={cn('w-8 h-8 rounded-full border-2 transition-all', form.color === c ? 'border-slate-700 scale-110' : 'border-transparent')}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              {users.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">Participantes</label>
                  <div className="max-h-36 overflow-y-auto space-y-1 border border-slate-100 rounded-lg p-2">
                    {users.filter(u => u.id !== user?.id).map(u => (
                      <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded px-1 py-1 min-h-[36px]">
                        <input type="checkbox" checked={form.participant_ids.includes(u.id)} onChange={() => toggleParticipant(u.id)} className="accent-orange-500 w-4 h-4" />
                        <img src={u.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&size=24&background=f97316&color=fff`}
                          alt={u.name} className="w-6 h-6 rounded-full" />
                        <span className="text-sm text-slate-700">{u.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors min-h-[44px]">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving || !form.title.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 min-h-[44px]">
                {saving ? 'Salvando...' : <><Check size={15} /> {editEvent ? 'Atualizar' : 'Criar'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
