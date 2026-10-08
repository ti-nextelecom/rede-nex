import { useEffect, useRef, useState } from 'react';
import {
  Activity, AlertCircle, AlertTriangle, BarChart3, CheckCircle2, ChevronDown,
  Circle, Clock, Edit2, FolderKanban, GripVertical, Layers, LayoutGrid,
  List, Loader2, Plus, RefreshCw, Trash2, X, Zap,
} from 'lucide-react';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/apiClient';

type Status = 'Backlog' | 'A Fazer' | 'Em Andamento' | 'Aguardando' | 'Bloqueado' | 'Concluído';
type Priority = 'Crítica' | 'Alta' | 'Média' | 'Baixa';
type ViewMode = 'gestor' | 'operacional';

interface TIProject {
  id: string; name: string; description: string; responsible: string;
  status: string; start_date: string | null; due_date: string | null;
  progress_pct: number; color: string; created_at: string; updated_at: string;
  pending_tasks: number; done_tasks: number; blocked_tasks: number;
  waiting_tasks: number; total_tasks: number;
}

interface TITask {
  id: string; project_id: string | null; title: string; description: string;
  category: string; priority: Priority; responsible: string; requester: string;
  status: Status; progress_pct: number; scheduled_date: string | null;
  scheduled_time: string | null; started_at: string | null; completed_at: string | null;
  due_date: string | null; blocked_reason: string; observations: string; result: string;
  created_at: string; updated_at: string; project_name: string | null; project_color: string | null;
}

interface Summary {
  today_total: number; in_progress: number; done_today: number; done_week: number;
  pending: number; waiting: number; blocked: number; overdue: number;
}

const KANBAN_COLS: { status: Status; label: string; accent: string; border: string }[] = [
  { status: 'Backlog',      label: 'Backlog',       accent: '#64748b', border: 'border-t-slate-400' },
  { status: 'A Fazer',      label: 'A Fazer',        accent: '#3b82f6', border: 'border-t-blue-500' },
  { status: 'Em Andamento', label: 'Em Andamento',   accent: '#f59e0b', border: 'border-t-amber-400' },
  { status: 'Aguardando',   label: 'Aguardando',     accent: '#8b5cf6', border: 'border-t-violet-500' },
  { status: 'Bloqueado',    label: 'Bloqueado',      accent: '#ef4444', border: 'border-t-red-500' },
  { status: 'Concluído',    label: 'Concluído',      accent: '#10b981', border: 'border-t-emerald-500' },
];

const STATUS_BADGE: Record<Status, string> = {
  'Backlog':      'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  'A Fazer':      'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  'Em Andamento': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'Aguardando':   'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'Bloqueado':    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'Concluído':    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

const PRIORITY_BADGE: Record<Priority, string> = {
  'Crítica': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'Alta':    'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  'Média':   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'Baixa':   'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
};

const COLOR_HEX: Record<string, string> = {
  blue: '#3b82f6', orange: '#e65b12', teal: '#14b8a6',
  violet: '#8b5cf6', pink: '#ec4899', navy: '#1e3a5f', green: '#10b981',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  const [y, m, day] = (d.includes('T') ? d.split('T')[0] : d).split('-');
  return `${day}/${m}/${y}`;
}

function fmtDatetime(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function isOverdue(t: TITask) {
  if (!t.due_date || t.status === 'Concluído') return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(t.due_date + 'T00:00:00') < today;
}

function todayStr() { return new Date().toISOString().split('T')[0]; }

const emptyTask = (): Partial<TITask> => ({
  title: '', description: '', category: '', priority: 'Média',
  responsible: 'Wendel', requester: '', status: 'A Fazer',
  project_id: null, scheduled_date: '', due_date: '', blocked_reason: '', observations: '',
});

const emptyProject = (): Partial<TIProject> => ({
  name: '', description: '', responsible: 'Wendel', status: 'Em andamento',
  progress_pct: 0, color: 'blue', start_date: '', due_date: '',
});

/* ── Badge ──────────────────────────────────────────────────────────────── */
function Badge({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>{children}</span>;
}

/* ── MiniProgress ───────────────────────────────────────────────────────── */
function MiniProgress({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(var(--muted))' }}>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-medium tabular-nums" style={{ color: 'hsl(var(--muted-foreground))' }}>{pct}%</span>
    </div>
  );
}

/* ── StatusSelect ───────────────────────────────────────────────────────── */
function StatusSelect({ task, onChange }: { task: TITask; onChange: (t: TITask, s: Status) => void }) {
  return (
    <select
      className="text-[11px] font-semibold rounded-full px-2 py-0.5 border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
      style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' }}
      value={task.status}
      onChange={e => onChange(task, e.target.value as Status)}
    >
      {(['Backlog', 'A Fazer', 'Em Andamento', 'Aguardando', 'Bloqueado', 'Concluído'] as Status[]).map(s => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

/* ── SectionHeader ──────────────────────────────────────────────────────── */
function SectionHeader({ icon, title, badge, accent = 'rgba(230,91,18,0.08)', iconColor = 'text-primary', children }: {
  icon: React.ReactNode; title: string; badge?: number;
  accent?: string; iconColor?: string; children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
      <div className="flex items-center gap-3">
        <div className="p-1.5 rounded-lg" style={{ background: accent }}>
          <span className={iconColor}>{icon}</span>
        </div>
        <h2 className="text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{title}</h2>
        {badge !== undefined && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary">{badge}</span>
        )}
      </div>
      {children}
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────── */
export function PainelTIPage() {
  const [projects, setProjects] = useState<TIProject[]>([]);
  const [tasks, setTasks] = useState<TITask[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [view, setView] = useState<ViewMode>('gestor');
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');
  const [taskModal, setTaskModal] = useState<{ open: boolean; task: Partial<TITask> | null }>({ open: false, task: null });
  const [projectModal, setProjectModal] = useState<{ open: boolean; project: Partial<TIProject> | null }>({ open: false, project: null });
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<Status | ''>('');
  const dragTaskId = useRef<string | null>(null);

  async function load() {
    try {
      const [proj, tsk, sum] = await Promise.all([
        apiGet<TIProject[]>('/ti/projects'),
        apiGet<TITask[]>('/ti/tasks'),
        apiGet<Summary>('/ti/summary'),
      ]);
      setProjects(proj);
      setTasks(tsk);
      setSummary(sum);
      setLastUpdate(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveTask(data: Partial<TITask>) {
    setSaving(true);
    try {
      if (data.id) {
        const updated = await apiPut<TITask>(`/ti/tasks/${data.id}`, data);
        setTasks(ts => ts.map(t => t.id === updated.id ? updated : t));
      } else {
        const created = await apiPost<TITask>('/ti/tasks', data);
        setTasks(ts => [...ts, created]);
      }
      setTaskModal({ open: false, task: null });
      load();
    } catch { alert('Erro ao salvar tarefa'); }
    finally { setSaving(false); }
  }

  async function saveProject(data: Partial<TIProject>) {
    setSaving(true);
    try {
      if (data.id) {
        const updated = await apiPut<TIProject>(`/ti/projects/${data.id}`, data);
        setProjects(ps => ps.map(p => p.id === updated.id ? { ...p, ...updated } : p));
      } else {
        const created = await apiPost<TIProject>('/ti/projects', data);
        setProjects(ps => [...ps, { ...created, pending_tasks: 0, done_tasks: 0, blocked_tasks: 0, waiting_tasks: 0, total_tasks: 0 }]);
      }
      setProjectModal({ open: false, project: null });
    } catch { alert('Erro ao salvar projeto'); }
    finally { setSaving(false); }
  }

  async function deleteTask(id: string) {
    if (!confirm('Remover esta tarefa?')) return;
    await apiDelete(`/ti/tasks/${id}`);
    setTasks(ts => ts.filter(t => t.id !== id));
    load();
  }

  async function deleteProject(id: string) {
    if (!confirm('Remover este projeto e todas as suas tarefas?')) return;
    await apiDelete(`/ti/projects/${id}`);
    setProjects(ps => ps.filter(p => p.id !== id));
    setTasks(ts => ts.filter(t => t.project_id !== id));
    load();
  }

  async function quickStatusChange(task: TITask, newStatus: Status) {
    const updated = await apiPut<TITask>(`/ti/tasks/${task.id}`, { status: newStatus });
    setTasks(ts => ts.map(t => t.id === updated.id ? updated : t));
    load();
  }

  function onDragStart(taskId: string) { dragTaskId.current = taskId; }
  async function onDrop(newStatus: Status) {
    if (!dragTaskId.current) return;
    const task = tasks.find(t => t.id === dragTaskId.current);
    if (!task || task.status === newStatus) { dragTaskId.current = null; return; }
    await quickStatusChange(task, newStatus);
    dragTaskId.current = null;
  }

  const today = todayStr();
  const todayTasks = tasks.filter(t => t.scheduled_date === today);
  const overdueTasks = tasks.filter(t => isOverdue(t));
  const blockedTasks = tasks.filter(t => t.status === 'Bloqueado' || t.status === 'Aguardando');
  const nextDeliveries = tasks
    .filter(t => t.due_date && t.status !== 'Concluído' && t.due_date >= today)
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
    .slice(0, 8);
  const completedToday = tasks.filter(t => t.status === 'Concluído' && t.completed_at?.startsWith(today));
  const filteredTasks = filterStatus ? tasks.filter(t => t.status === filterStatus) : tasks;
  const totalActive = tasks.filter(t => t.status !== 'Concluído').length;
  const healthPct = totalActive ? Math.round(((totalActive - overdueTasks.length) / totalActive) * 100) : 100;

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <Loader2 size={28} className="animate-spin text-primary" />
      <span className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Carregando Painel T.I.</span>
    </div>
  );

  const summaryCards = [
    { label: 'Tarefas Hoje',        value: summary?.today_total ?? 0,                                         icon: Layers,        accent: '#3b82f6', bg: 'rgba(59,130,246,0.08)',   filter: '' as Status | '' },
    { label: 'Em Andamento',        value: summary?.in_progress ?? 0,                                          icon: Activity,      accent: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  filter: 'Em Andamento' as Status },
    { label: 'Concluídas Hoje',     value: summary?.done_today ?? 0,                                           icon: CheckCircle2,  accent: '#10b981', bg: 'rgba(16,185,129,0.08)', filter: 'Concluído' as Status },
    { label: 'Pendentes',           value: summary?.pending ?? 0,                                              icon: Circle,        accent: '#6366f1', bg: 'rgba(99,102,241,0.08)', filter: 'A Fazer' as Status },
    { label: 'Aguardando/Bloqueadas', value: Number(summary?.waiting ?? 0) + Number(summary?.blocked ?? 0),   icon: AlertCircle,   accent: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', filter: 'Aguardando' as Status },
    { label: 'Atrasadas',           value: summary?.overdue ?? 0,                                              icon: AlertTriangle, accent: '#ef4444', bg: 'rgba(239,68,68,0.08)',  filter: '' as Status | '' },
  ];

  return (
    <div className="space-y-5 page-enter">

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl p-6" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Zap size={13} className="text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'hsl(var(--muted-foreground))' }}>Gestão T.I.</span>
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'hsl(var(--foreground))' }}>
              Painel de <span className="text-primary">Atividades</span>
            </h1>
            <p className="text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Nex Telecom · {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              {lastUpdate && ` · Atualizado às ${lastUpdate}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
              style={{
                background: healthPct >= 80 ? 'rgba(16,185,129,0.08)' : healthPct >= 60 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
                color: healthPct >= 80 ? '#10b981' : healthPct >= 60 ? '#f59e0b' : '#ef4444',
              }}
            >
              <Activity size={13} />
              <span>{healthPct}% dentro do prazo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryCards.map(card => (
          <button
            key={card.label}
            onClick={() => card.filter && setFilterStatus(f => f === card.filter ? '' : card.filter)}
            className={`group rounded-2xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 ${filterStatus === card.filter && card.filter ? 'ring-2 ring-primary' : ''}`}
            style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 rounded-xl transition-all group-hover:scale-110" style={{ background: card.bg }}>
                <card.icon size={16} style={{ color: card.accent }} />
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums" style={{ color: 'hsl(var(--foreground))' }}>{card.value}</p>
            <p className="text-[11px] font-medium mt-0.5 leading-tight" style={{ color: 'hsl(var(--muted-foreground))' }}>{card.label}</p>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* View Toggle */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'hsl(var(--muted))' }}>
          {([
            { id: 'gestor' as ViewMode, label: 'Visão Gestor', icon: BarChart3 },
            { id: 'operacional' as ViewMode, label: 'Visão Operacional', icon: LayoutGrid },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                view === tab.id
                  ? 'bg-white shadow-sm text-primary dark:bg-card'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              style={{ color: view === tab.id ? undefined : 'hsl(var(--muted-foreground))' }}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setProjectModal({ open: true, project: emptyProject() })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
            style={{ border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))', background: 'hsl(var(--card))' }}
          >
            <FolderKanban size={13} /> Novo Projeto
          </button>
          <button
            onClick={() => setTaskModal({ open: true, task: emptyTask() })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:opacity-90 transition-all"
          >
            <Plus size={13} /> Nova Tarefa
          </button>
          <button
            onClick={load}
            className="p-1.5 rounded-lg transition-all hover:opacity-80"
            style={{ border: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))', background: 'hsl(var(--card))' }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── GESTOR VIEW ─────────────────────────────────────────────────── */}
      {view === 'gestor' && (
        <div className="space-y-5">

          {/* Projects */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
            <SectionHeader icon={<FolderKanban size={15} />} title="Projetos em Andamento" badge={projects.length} accent="rgba(59,130,246,0.08)" iconColor="text-blue-500">
              <button
                onClick={() => setProjectModal({ open: true, project: emptyProject() })}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:opacity-80"
              >
                <Plus size={13} /> Novo
              </button>
            </SectionHeader>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {projects.map(p => {
                const hex = COLOR_HEX[p.color] || '#3b82f6';
                return (
                  <div key={p.id} className="rounded-xl p-4 border-t-2 transition-all hover:-translate-y-0.5"
                    style={{ borderTopColor: hex, background: 'hsl(var(--background))', border: `1px solid hsl(var(--border))`, borderTopWidth: '3px', borderTopColor: hex }}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'hsl(var(--foreground))' }}>{p.name}</p>
                        {p.description && <p className="text-[11px] mt-0.5 line-clamp-1" style={{ color: 'hsl(var(--muted-foreground))' }}>{p.description}</p>}
                      </div>
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        <button className="p-1 rounded-lg hover:bg-muted transition-colors" onClick={() => setProjectModal({ open: true, project: p })}><Edit2 size={12} style={{ color: 'hsl(var(--muted-foreground))' }} /></button>
                        <button className="p-1 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors" onClick={() => deleteProject(p.id)}><Trash2 size={12} style={{ color: 'hsl(var(--muted-foreground))' }} /></button>
                      </div>
                    </div>
                    <MiniProgress pct={p.progress_pct} />
                    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                      <span className="text-[10px] font-medium text-emerald-600"><CheckCircle2 size={10} className="inline mr-0.5" />{p.done_tasks}</span>
                      <span className="text-[10px] font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}><Circle size={10} className="inline mr-0.5" />{p.pending_tasks}</span>
                      {Number(p.blocked_tasks) > 0 && <span className="text-[10px] font-medium text-red-500"><AlertCircle size={10} className="inline mr-0.5" />{p.blocked_tasks}</span>}
                      <span className="ml-auto">
                        <Badge cls={
                          p.status === 'Concluído' ? 'bg-emerald-100 text-emerald-700' :
                          p.status === 'Pausado' ? 'bg-slate-100 text-slate-600' :
                          'bg-amber-100 text-amber-700'
                        }>{p.status}</Badge>
                      </span>
                    </div>
                    {p.due_date && (
                      <p className="text-[10px] mt-1.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
                        <Clock size={9} className="inline mr-0.5" /> Previsão: {fmtDate(p.due_date)}
                      </p>
                    )}
                  </div>
                );
              })}
              <button
                onClick={() => setProjectModal({ open: true, project: emptyProject() })}
                className="rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all hover:bg-primary/5 border-2 border-dashed"
                style={{ borderColor: 'hsl(var(--border))' }}
              >
                <Plus size={20} className="text-primary opacity-50" />
                <span className="text-xs font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>Novo Projeto</span>
              </button>
            </div>
          </div>

          {/* Bottom Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Next Deliveries */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              <SectionHeader icon={<Clock size={15} />} title="Próximas Entregas" badge={nextDeliveries.length} accent="rgba(139,92,246,0.08)" iconColor="text-violet-500" />
              <div>
                {nextDeliveries.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Nenhuma entrega agendada</div>
                ) : nextDeliveries.map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                    <div className="flex-1 min-w-0">
                      {t.project_name && (
                        <p className="text-[10px] font-semibold uppercase tracking-wide truncate" style={{ color: COLOR_HEX[t.project_color || ''] || '#3b82f6' }}>{t.project_name}</p>
                      )}
                      <p className="text-xs font-medium truncate" style={{ color: 'hsl(var(--foreground))' }}>{t.title}</p>
                    </div>
                    <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }}>{fmtDate(t.due_date)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Blocked/Waiting + Overdue */}
            <div className="space-y-5">
              {blockedTasks.length > 0 && (
                <div className="rounded-2xl overflow-hidden" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
                  <SectionHeader icon={<AlertCircle size={15} />} title="Atenção Necessária" badge={blockedTasks.length} accent="rgba(139,92,246,0.08)" iconColor="text-violet-500" />
                  <div>
                    {blockedTasks.map(t => (
                      <div key={t.id} className="px-5 py-3 hover:bg-muted/30 transition-colors" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge cls={STATUS_BADGE[t.status]}>{t.status}</Badge>
                          {t.project_name && <span className="text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{t.project_name}</span>}
                        </div>
                        <p className="text-xs font-medium" style={{ color: 'hsl(var(--foreground))' }}>{t.title}</p>
                        {t.blocked_reason && <p className="text-[11px] mt-0.5 text-amber-600">⚠ {t.blocked_reason}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {overdueTasks.length > 0 && (
                <div className="rounded-2xl overflow-hidden" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
                  <SectionHeader icon={<AlertTriangle size={15} />} title="Atividades Atrasadas" badge={overdueTasks.length} accent="rgba(239,68,68,0.08)" iconColor="text-red-500" />
                  <div>
                    {overdueTasks.map(t => {
                      const daysLate = Math.floor((Date.now() - new Date(t.due_date! + 'T00:00:00').getTime()) / 86400000);
                      return (
                        <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: 'hsl(var(--foreground))' }}>{t.title}</p>
                            <p className="text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{t.project_name || '—'} · prazo {fmtDate(t.due_date)}</p>
                          </div>
                          <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">+{daysLate}d</span>
                          <StatusSelect task={t} onChange={quickStatusChange} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── OPERACIONAL VIEW ────────────────────────────────────────────── */}
      {view === 'operacional' && (
        <div className="space-y-5">

          {/* Foco do Dia */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
            <SectionHeader
              icon={<List size={15} />}
              title={`Foco do Dia — ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}`}
              badge={todayTasks.length}
              accent="rgba(230,91,18,0.08)"
            >
              <button
                onClick={() => setTaskModal({ open: true, task: { ...emptyTask(), scheduled_date: today } })}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:opacity-80"
              >
                <Plus size={13} /> Adicionar
              </button>
            </SectionHeader>
            {todayTasks.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <div className="mx-auto w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(230,91,18,0.08)' }}>
                  <List size={20} className="text-primary opacity-40" />
                </div>
                <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>Nenhuma tarefa agendada para hoje</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--muted)/0.4)' }}>
                      {['Prioridade', 'Tarefa', 'Projeto', 'Status', 'Progresso', ''].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold" style={{ color: 'hsl(var(--muted-foreground))' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {todayTasks.map(t => (
                      <tr key={t.id} className={`hover:bg-muted/30 transition-colors ${t.status === 'Concluído' ? 'opacity-60' : ''}`} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                        <td className="px-4 py-2.5"><Badge cls={PRIORITY_BADGE[t.priority]}>{t.priority}</Badge></td>
                        <td className="px-4 py-2.5 font-medium max-w-[220px] truncate" style={{ color: 'hsl(var(--foreground))' }}>{t.title}</td>
                        <td className="px-4 py-2.5" style={{ color: 'hsl(var(--muted-foreground))' }}>{t.project_name || '—'}</td>
                        <td className="px-4 py-2.5"><StatusSelect task={t} onChange={quickStatusChange} /></td>
                        <td className="px-4 py-2.5 w-32"><MiniProgress pct={t.progress_pct} /></td>
                        <td className="px-4 py-2.5">
                          <button className="p-1 rounded-lg hover:bg-muted transition-colors" onClick={() => setTaskModal({ open: true, task: t })}><Edit2 size={12} style={{ color: 'hsl(var(--muted-foreground))' }} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Kanban */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
            <SectionHeader icon={<LayoutGrid size={15} />} title="Quadro de Tarefas" accent="rgba(99,102,241,0.08)" iconColor="text-indigo-500" />
            <div className="p-4 overflow-x-auto">
              <div className="flex gap-3" style={{ minWidth: `${KANBAN_COLS.length * 220}px` }}>
                {KANBAN_COLS.map(col => (
                  <div
                    key={col.status}
                    className={`flex-1 min-w-[200px] rounded-xl border-t-2 ${col.border}`}
                    style={{ background: 'hsl(var(--background))', border: `1px solid hsl(var(--border))`, borderTopWidth: '2px', borderTopColor: col.accent }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => onDrop(col.status)}
                  >
                    <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                      <span className="text-xs font-semibold" style={{ color: col.accent }}>{col.label}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${col.accent}20`, color: col.accent }}>
                        {tasks.filter(t => t.status === col.status).length}
                      </span>
                    </div>
                    <div className="p-2 space-y-2 min-h-[120px]">
                      {tasks.filter(t => t.status === col.status).map(t => (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={() => onDragStart(t.id)}
                          className={`rounded-lg p-2.5 cursor-grab active:cursor-grabbing transition-all hover:shadow-sm ${isOverdue(t) ? 'ring-1 ring-red-400' : ''}`}
                          style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <Badge cls={PRIORITY_BADGE[t.priority]}>{t.priority}</Badge>
                            <div className="flex items-center gap-0.5">
                              <button className="p-0.5 rounded hover:bg-muted transition-colors" onClick={() => setTaskModal({ open: true, task: t })}><Edit2 size={10} style={{ color: 'hsl(var(--muted-foreground))' }} /></button>
                              <button className="p-0.5 rounded hover:bg-red-50 hover:text-red-500 transition-colors" onClick={() => deleteTask(t.id)}><Trash2 size={10} style={{ color: 'hsl(var(--muted-foreground))' }} /></button>
                            </div>
                          </div>
                          <p className="text-[12px] font-medium leading-tight" style={{ color: 'hsl(var(--foreground))' }}>{t.title}</p>
                          {t.project_name && (
                            <p className="text-[10px] mt-1 font-semibold" style={{ color: COLOR_HEX[t.project_color || ''] || '#888' }}>{t.project_name}</p>
                          )}
                          {t.due_date && (
                            <p className={`text-[10px] mt-1 ${isOverdue(t) ? 'text-red-500 font-semibold' : ''}`} style={!isOverdue(t) ? { color: 'hsl(var(--muted-foreground))' } : {}}>
                              📅 {fmtDate(t.due_date)}
                            </p>
                          )}
                          {t.blocked_reason && <p className="text-[10px] mt-1 text-amber-600">⚠ {t.blocked_reason}</p>}
                          {t.progress_pct > 0 && <MiniProgress pct={t.progress_pct} />}
                          <div className="flex justify-end mt-1.5">
                            <GripVertical size={10} style={{ color: 'hsl(var(--border))' }} />
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => setTaskModal({ open: true, task: { ...emptyTask(), status: col.status } })}
                        className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:bg-muted"
                        style={{ color: 'hsl(var(--muted-foreground))', border: '1px dashed hsl(var(--border))' }}
                      >
                        <Plus size={11} /> Adicionar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Completed Today */}
          {completedToday.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              <SectionHeader icon={<CheckCircle2 size={15} />} title="Entregas Realizadas Hoje" badge={completedToday.length} accent="rgba(16,185,129,0.08)" iconColor="text-emerald-500" />
              <div>
                {completedToday.map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                    <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: 'hsl(var(--foreground))' }}>{t.title}</p>
                      {t.project_name && <p className="text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{t.project_name}</p>}
                    </div>
                    <span className="text-[10px] flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }}>{fmtDatetime(t.completed_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TASK MODAL ──────────────────────────────────────────────────── */}
      {taskModal.open && taskModal.task && (
        <TaskModal
          task={taskModal.task}
          projects={projects}
          saving={saving}
          onSave={saveTask}
          onClose={() => setTaskModal({ open: false, task: null })}
        />
      )}

      {/* ── PROJECT MODAL ───────────────────────────────────────────────── */}
      {projectModal.open && projectModal.project && (
        <ProjectModal
          project={projectModal.project}
          saving={saving}
          onSave={saveProject}
          onClose={() => setProjectModal({ open: false, project: null })}
        />
      )}
    </div>
  );
}

/* ── Field ──────────────────────────────────────────────────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--muted-foreground))' }}>{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-1.5 rounded-lg text-sm border focus:outline-none focus:ring-1 focus:ring-primary';
const inputStyle = { background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' };

/* ── TaskModal ──────────────────────────────────────────────────────────── */
function TaskModal({ task, projects, saving, onSave, onClose }: {
  task: Partial<TITask>; projects: TIProject[]; saving: boolean;
  onSave: (t: Partial<TITask>) => void; onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<TITask>>(task);
  const set = (k: keyof TITask, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-xl" style={{ background: 'hsl(var(--card))' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
          <h3 className="text-sm font-bold" style={{ color: 'hsl(var(--foreground))' }}>{form.id ? 'Editar Tarefa' : 'Nova Tarefa'}</h3>
          <button className="p-1.5 rounded-lg hover:bg-muted transition-colors" onClick={onClose}><X size={15} style={{ color: 'hsl(var(--muted-foreground))' }} /></button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Título *">
            <input className={inputCls} style={inputStyle} value={form.title || ''} onChange={e => set('title', e.target.value)} placeholder="Título da tarefa" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Projeto">
              <select className={inputCls} style={inputStyle} value={form.project_id || ''} onChange={e => set('project_id', e.target.value || null)}>
                <option value="">Sem projeto</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={inputCls} style={inputStyle} value={form.status || 'A Fazer'} onChange={e => set('status', e.target.value)}>
                {['Backlog', 'A Fazer', 'Em Andamento', 'Aguardando', 'Bloqueado', 'Concluído'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Prioridade">
              <select className={inputCls} style={inputStyle} value={form.priority || 'Média'} onChange={e => set('priority', e.target.value as Priority)}>
                {['Crítica', 'Alta', 'Média', 'Baixa'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Responsável">
              <input className={inputCls} style={inputStyle} value={form.responsible || ''} onChange={e => set('responsible', e.target.value)} placeholder="Nome" />
            </Field>
            <Field label="Solicitante">
              <input className={inputCls} style={inputStyle} value={form.requester || ''} onChange={e => set('requester', e.target.value)} placeholder="Quem solicitou" />
            </Field>
            <Field label="Progresso (%)">
              <input type="number" min={0} max={100} className={inputCls} style={inputStyle} value={form.progress_pct || 0} onChange={e => set('progress_pct', Number(e.target.value))} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Data agendada">
              <input type="date" className={inputCls} style={inputStyle} value={form.scheduled_date || ''} onChange={e => set('scheduled_date', e.target.value || null)} />
            </Field>
            <Field label="Prazo final">
              <input type="date" className={inputCls} style={inputStyle} value={form.due_date || ''} onChange={e => set('due_date', e.target.value || null)} />
            </Field>
            <Field label="Categoria">
              <input className={inputCls} style={inputStyle} value={form.category || ''} onChange={e => set('category', e.target.value)} placeholder="Bug, Melhoria…" />
            </Field>
          </div>
          <Field label="Descrição">
            <textarea rows={2} className={inputCls} style={inputStyle} value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="Detalhes da tarefa" />
          </Field>
          {(form.status === 'Aguardando' || form.status === 'Bloqueado') && (
            <Field label="Motivo do bloqueio / aguardo">
              <input className={inputCls} style={inputStyle} value={form.blocked_reason || ''} onChange={e => set('blocked_reason', e.target.value)} placeholder="O que está impedindo o avanço?" />
            </Field>
          )}
          {form.status === 'Concluído' && (
            <Field label="Resultado">
              <textarea rows={2} className={inputCls} style={inputStyle} value={form.result || ''} onChange={e => set('result', e.target.value)} placeholder="O que foi entregue?" />
            </Field>
          )}
          <Field label="Observações">
            <textarea rows={2} className={inputCls} style={inputStyle} value={form.observations || ''} onChange={e => set('observations', e.target.value)} placeholder="Notas adicionais" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: '1px solid hsl(var(--border))' }}>
          <button className="px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-muted transition-colors" style={{ color: 'hsl(var(--foreground))' }} onClick={onClose}>Cancelar</button>
          <button
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-primary text-white hover:opacity-90 transition-all disabled:opacity-50"
            disabled={saving || !form.title}
            onClick={() => onSave(form)}
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── ProjectModal ───────────────────────────────────────────────────────── */
function ProjectModal({ project, saving, onSave, onClose }: {
  project: Partial<TIProject>; saving: boolean;
  onSave: (p: Partial<TIProject>) => void; onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<TIProject>>(project);
  const set = (k: keyof TIProject, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl" style={{ background: 'hsl(var(--card))' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
          <h3 className="text-sm font-bold" style={{ color: 'hsl(var(--foreground))' }}>{form.id ? 'Editar Projeto' : 'Novo Projeto'}</h3>
          <button className="p-1.5 rounded-lg hover:bg-muted transition-colors" onClick={onClose}><X size={15} style={{ color: 'hsl(var(--muted-foreground))' }} /></button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Nome do Projeto *">
            <input className={inputCls} style={inputStyle} value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="Nome" />
          </Field>
          <Field label="Descrição">
            <textarea rows={2} className={inputCls} style={inputStyle} value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="Breve descrição" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Status">
              <select className={inputCls} style={inputStyle} value={form.status || 'Em andamento'} onChange={e => set('status', e.target.value)}>
                {['Em andamento', 'A fazer', 'Concluído', 'Pausado'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Responsável">
              <input className={inputCls} style={inputStyle} value={form.responsible || ''} onChange={e => set('responsible', e.target.value)} />
            </Field>
            <Field label="Progresso (%)">
              <input type="number" min={0} max={100} className={inputCls} style={inputStyle} value={form.progress_pct || 0} onChange={e => set('progress_pct', Number(e.target.value))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início">
              <input type="date" className={inputCls} style={inputStyle} value={form.start_date || ''} onChange={e => set('start_date', e.target.value || null)} />
            </Field>
            <Field label="Previsão de conclusão">
              <input type="date" className={inputCls} style={inputStyle} value={form.due_date || ''} onChange={e => set('due_date', e.target.value || null)} />
            </Field>
          </div>
          <Field label="Cor do Projeto">
            <div className="flex gap-2 flex-wrap mt-1">
              {Object.entries(COLOR_HEX).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => set('color', k)}
                  className={`w-7 h-7 rounded-full transition-all hover:scale-110 ${form.color === k ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''}`}
                  style={{ background: v }}
                  title={k}
                />
              ))}
            </div>
          </Field>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: '1px solid hsl(var(--border))' }}>
          <button className="px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-muted transition-colors" style={{ color: 'hsl(var(--foreground))' }} onClick={onClose}>Cancelar</button>
          <button
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-primary text-white hover:opacity-90 transition-all disabled:opacity-50"
            disabled={saving || !form.name}
            onClick={() => onSave(form)}
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
