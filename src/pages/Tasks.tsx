import {
  FormEvent, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Calendar, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CheckSquare, Clock, Flag,
  FolderOpen, FolderPlus, GanttChartSquare, KanbanSquare, LayoutList, ListTodo, Loader2, MessageSquare,
  Link, Pencil, Plus, RowsIcon, Trash2, User, X,
  BookmarkPlus,
  Copy,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { apiDelete, apiDeleteJson, apiGet, apiPatch, apiPost, apiPut } from '../lib/apiClient';
import { getUsers } from '../lib/appApi';
import { useAuth } from '../lib/auth';
import { dispatchXPEvent } from '../lib/xpEvents';
import { cn } from '../lib/utils';
import type { User as UserType } from '../types';
import { AccessibleModal } from '../components/AccessibleModal';

/* ── types ─────────────────────────────────────────────────────────────── */
interface ChecklistItem { id: string; content: string; completed: boolean; assignee_id?: string; assignee?: TaskUser; sort_order: number; }
interface Checklist { id: string; title: string; sort_order: number; items: ChecklistItem[]; }
interface TaskComment { id: string; content: string; created_at: string; user: { id: string; name: string; photo_url?: string }; }
interface TaskFile { id: string; name: string; file_url: string; file_type?: string; file_size?: number; uploader_name?: string; uploader_photo?: string; created_at: string; }
interface TaskUser { id: string; name: string; photo_url?: string; }
interface Task {
  id: string; title: string; description?: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_by?: string; owner_id?: string; deadline?: string;
  created_at: string; updated_at: string;
  owner?: TaskUser; creator?: TaskUser;
  assignees: TaskUser[];
  checklists: Checklist[];
  comments: TaskComment[];
  custom_list_id?: string | null;
  custom_list_name?: string | null;
  protocol?: string;
}

interface CustomList { id: string; name: string; position: number; created_at: string; }
interface TaskTemplate { id: string; title: string; description: string; priority: string; category: string; created_by?: string; created_at: string; assigned_to?: string | null; is_shared: boolean; assigned_user?: { id: string; name: string; photo_url?: string } | null; }
const templateApi = {
  list: () => apiGet<{ data: TaskTemplate[] }>('/tasks/templates').then(r => r.data ?? []),
  create: (input: object) => apiPost<{ data: TaskTemplate }>('/tasks/templates', input).then(r => r.data!),
  remove: (id: string) => apiDelete(`/tasks/templates/${id}`),
};

/* ── api helpers ────────────────────────────────────────────────────────── */
const listApi = {
  list: () => apiGet<{ data: CustomList[] }>('/tasks/lists').then(r => r.data ?? []),
  create: (name: string) => apiPost<{ data: CustomList }>('/tasks/lists', { name }).then(r => r.data!),
  rename: (id: string, name: string) => apiPut<{ data: CustomList }>(`/tasks/lists/${id}`, { name }).then(r => r.data!),
  remove: (id: string) => apiDelete(`/tasks/lists/${id}`),
};

const api = {
  list: () => apiGet<{ data: Task[] }>('/tasks').then(r => r.data ?? []),
  create: (input: object) => apiPost<{ data: Task }>('/tasks', input).then(r => r.data!),
  update: async (id: string, input: object) => {
    const r = await apiPut<{ data: Task; gamification?: unknown }>(`/tasks/${id}`, input);
    if ((input as Record<string, unknown>).status === 'done') dispatchXPEvent(r.gamification);
    return r.data!;
  },
  remove: (id: string) => apiDelete(`/tasks/${id}`),
  addChecklist: (taskId: string, title: string) =>
    apiPost<{ data: Task }>(`/tasks/${taskId}/checklists`, { title }).then(r => r.data!),
  deleteChecklist: (taskId: string, clId: string) =>
    apiDeleteJson<{ data: Task }>(`/tasks/${taskId}/checklists/${clId}`).then(r => r.data),
  addItem: (taskId: string, clId: string, content: string) =>
    apiPost<{ data: Task }>(`/tasks/${taskId}/checklists/${clId}/items`, { content }).then(r => r.data!),
  toggleItem: (taskId: string, clId: string, itemId: string, completed: boolean) =>
    apiPatch<{ data: Task }>(`/tasks/${taskId}/checklists/${clId}/items/${itemId}`, { completed }).then(r => r.data!),
  setItemAssignee: (taskId: string, clId: string, itemId: string, assigneeId: string | null) =>
    apiPatch<{ data: Task }>(`/tasks/${taskId}/checklists/${clId}/items/${itemId}`, { assignee_id: assigneeId }).then(r => r.data!),
  deleteItem: (taskId: string, clId: string, itemId: string) =>
    apiDeleteJson<{ data: Task }>(`/tasks/${taskId}/checklists/${clId}/items/${itemId}`).then(r => r.data),
  updateItem: (taskId: string, clId: string, itemId: string, content: string) =>
    apiPatch<{ data: Task }>(`/tasks/${taskId}/checklists/${clId}/items/${itemId}`, { content }).then(r => r.data!),
  updateChecklist: (taskId: string, clId: string, title: string) =>
    apiPatch<{ data: Task }>(`/tasks/${taskId}/checklists/${clId}`, { title }).then(r => r.data!),
  addComment: (taskId: string, content: string) =>
    apiPost<{ data: Task }>(`/tasks/${taskId}/comments`, { content }).then(r => r.data!),
  listFiles: (taskId: string) => apiGet<{ data: TaskFile[] }>(`/tasks/${taskId}/files`).then(r => r.data ?? []),
  addFile: (taskId: string, input: object) => apiPost<{ data: TaskFile }>(`/tasks/${taskId}/files`, input).then(r => r.data!),
  removeFile: (taskId: string, fileId: string) => apiDelete(`/tasks/${taskId}/files/${fileId}`),
};

/* ── constants ─────────────────────────────────────────────────────────── */
const STATUS_LABELS: Record<string, string> = { todo: 'A Fazer', in_progress: 'Em Andamento', done: 'Concluída' };
const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
};
const PRIORITY_LABELS: Record<string, string> = { low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente' };
const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-slate-500 dark:text-slate-400', normal: 'text-blue-500 dark:text-blue-400',
  high: 'text-orange-500 dark:text-orange-400', urgent: 'text-red-600 dark:text-red-400',
};
const KANBAN_COLS = [
  { id: 'overdue', label: 'Vencido', color: 'border-t-red-500' },
  { id: 'today', label: 'Vencimento hoje', color: 'border-t-orange-500' },
  { id: 'week', label: 'Esta semana', color: 'border-t-yellow-400' },
  { id: 'later', label: 'Próximas semanas', color: 'border-t-blue-400' },
  { id: 'none', label: 'Sem prazo', color: 'border-t-slate-300' },
  { id: 'done', label: 'Concluída', color: 'border-t-emerald-500' },
];

/* ── helpers ────────────────────────────────────────────────────────────── */
function fmtDate(dateStr?: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtDateTime(dateStr?: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function deadlineColumn(task: Task): string {
  if (task.status === 'done') return 'done';
  if (!task.deadline) return 'none';
  const now = new Date();
  const dl = new Date(task.deadline);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7); weekEnd.setHours(23, 59, 59, 999);
  if (dl < now) return 'overdue';
  if (dl <= todayEnd) return 'today';
  if (dl <= weekEnd) return 'week';
  return 'later';
}
function isOverdue(task: Task) {
  return task.status !== 'done' && !!task.deadline && new Date(task.deadline) < new Date();
}
function isNearDeadline(task: Task) {
  if (task.status === 'done' || !task.deadline) return false;
  const dl = new Date(task.deadline);
  const now = new Date();
  if (dl < now) return false;
  return (dl.getTime() - now.getTime()) <= 2 * 24 * 60 * 60 * 1000;
}
function checklistProgress(cl: Checklist) {
  if (!cl.items.length) return { done: 0, total: 0 };
  return { done: cl.items.filter(i => i.completed).length, total: cl.items.length };
}

/* ── Avatar ─────────────────────────────────────────────────────────────── */
function Avatar({ user, size = 8 }: { user?: TaskUser | null; size?: number }) {
  if (!user) return null;
  const s = `h-${size} w-${size}`;
  if (user.photo_url) return <img src={user.photo_url} alt={user.name} className={cn(s, 'rounded-full object-cover')} />;
  return (
    <img
      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&size=40&background=0057b8&color=fff`}
      alt={user.name} className={cn(s, 'rounded-full object-cover')}
    />
  );
}

/* ── UserPicker ─────────────────────────────────────────────────────────── */
function UserPicker({ users, value, onChange, placeholder = 'Selecionar...' }: {
  users: UserType[]; value: string; onChange: (id: string) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = users.find(u => u.id === value);
  const filtered = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(''); }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-orange-400 transition-all duration-200 text-left active:scale-[0.99]"
      >
        {selected ? (
          <>
            <Avatar user={selected} size={6} />
            <span className="text-sm text-slate-800 dark:text-slate-200 flex-1 truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-sm text-slate-400 dark:text-slate-500 flex-1">{placeholder}</span>
        )}
        <ChevronDown size={14} className={cn('text-slate-400 flex-shrink-0 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-slate-100 dark:border-slate-700">
            <input
              autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
              className="w-full h-8 px-3 rounded-lg bg-slate-50 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 text-sm outline-none focus:bg-white dark:focus:bg-slate-600 border border-transparent focus:border-orange-400 transition-colors"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                <User size={12} className="text-slate-400" />
              </div>
              Ninguém
            </button>
            {filtered.map(u => (
              <button
                key={u.id} type="button"
                onClick={() => { onChange(u.id); setOpen(false); setSearch(''); }}
                className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors',
                  value === u.id && 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400')}
              >
                <Avatar user={u} size={6} />
                <span className="flex-1 text-left truncate dark:text-slate-200">{u.name}</span>
                {value === u.id && <span className="text-orange-500 text-xs font-bold">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── MultiUserPicker ────────────────────────────────────────────────────── */
function MultiUserPicker({ users, value, onChange }: {
  users: UserType[]; value: string[]; onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = users.filter(u => value.includes(u.id));
  const filtered = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(''); }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter(v => v !== id));
    else onChange([...value, id]);
  }

  return (
    <div ref={ref} className="relative">
      <div
        className="min-h-[42px] flex flex-wrap gap-1 p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 cursor-pointer hover:border-orange-400 transition-all duration-200"
        onClick={() => setOpen(o => !o)}
      >
        {selected.length ? selected.map(u => (
          <div key={u.id} className="flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 pl-0.5 pr-1.5 py-0.5">
            <Avatar user={u} size={5} />
            <span className="text-xs text-blue-800 dark:text-blue-300">{u.name.split(' ')[0]}</span>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); toggle(u.id); }}
              className="ml-0.5 text-blue-400 hover:text-blue-600 transition-colors"
            >
              <X size={10} />
            </button>
          </div>
        )) : (
          <span className="text-sm text-slate-400 dark:text-slate-500 self-center px-1">Selecionar participantes...</span>
        )}
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-slate-100 dark:border-slate-700">
            <input
              autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
              className="w-full h-8 px-3 rounded-lg bg-slate-50 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 text-sm outline-none border border-transparent focus:border-orange-400 transition-colors"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.map(u => {
              const sel = value.includes(u.id);
              return (
                <button
                  key={u.id} type="button" onClick={() => toggle(u.id)}
                  className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors',
                    sel && 'bg-blue-50 dark:bg-blue-900/30')}
                >
                  <Avatar user={u} size={6} />
                  <span className="flex-1 text-left truncate dark:text-slate-200">{u.name}</span>
                  <div className={cn('h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                    sel ? 'bg-orange-500 border-orange-500' : 'border-slate-300 dark:border-slate-500')}>
                    {sel && <span className="text-white text-[9px] font-bold">✓</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── ItemAssigneePicker ─────────────────────────────────────────────────── */
function ItemAssigneePicker({ users, value, onChange }: {
  users: UserType[]; value: string; onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = users.find(u => u.id === value);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(''); }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        title={selected?.name || 'Atribuir responsável'}
        className={cn(
          'h-6 w-6 rounded-full flex items-center justify-center transition-all duration-200 overflow-hidden flex-shrink-0',
          selected ? 'ring-2 ring-orange-400 hover:ring-orange-500' : 'border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-orange-400'
        )}
      >
        {selected
          ? <Avatar user={selected} size={6} />
          : <User size={10} className="text-slate-400" />}
      </button>

      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-52 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-2xl overflow-hidden">
          <div className="p-1.5 border-b border-slate-100 dark:border-slate-700">
            <input
              autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
              className="w-full h-7 px-2 rounded-lg bg-slate-50 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 text-xs outline-none border border-transparent focus:border-orange-400 transition-colors"
            />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {value && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <div className="h-5 w-5 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                  <X size={10} className="text-red-500" />
                </div>
                Remover responsável
              </button>
            )}
            {users.filter(u => u.name.toLowerCase().includes(search.toLowerCase())).map(u => (
              <button
                key={u.id} type="button"
                onClick={() => { onChange(u.id); setOpen(false); setSearch(''); }}
                className={cn('w-full flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors',
                  value === u.id && 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400')}
              >
                <Avatar user={u} size={5} />
                <span className="flex-1 text-left truncate dark:text-slate-200">{u.name}</span>
                {value === u.id && <span className="text-orange-500 font-bold">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── TaskCard ───────────────────────────────────────────────────────────── */
const CARD_STATUS_STYLE: Record<string, { border: string; bg: string; pulse?: string }> = {
  todo:        { border: 'border-l-slate-400',   bg: 'bg-white dark:bg-slate-800' },
  in_progress: { border: 'border-l-blue-500',    bg: 'bg-gradient-to-br from-blue-50/60 via-white to-sky-50/30 dark:from-blue-900/20 dark:via-slate-800 dark:to-sky-900/10' },
  done:        { border: 'border-l-emerald-500', bg: 'bg-gradient-to-br from-emerald-50/60 via-white to-teal-50/20 dark:from-emerald-900/20 dark:via-slate-800 dark:to-teal-900/10' },
  near:        { border: 'border-l-yellow-500',  bg: 'bg-gradient-to-br from-yellow-50 via-white to-amber-50/40 dark:from-yellow-900/20 dark:via-slate-800 dark:to-amber-900/10', pulse: 'shadow-[0_0_0_3px_rgba(234,179,8,0.3)]' },
  overdue:     { border: 'border-l-red-500',     bg: 'bg-gradient-to-br from-red-50 via-white to-rose-50/40 dark:from-red-900/20 dark:via-slate-800 dark:to-rose-900/10' },
};
const PRIORITY_BADGE: Record<string, string> = {
  low:    'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  high:   'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
};

function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const totalItems = task.checklists.reduce((s, cl) => s + cl.items.length, 0);
  const doneItems  = task.checklists.reduce((s, cl) => s + cl.items.filter(i => i.completed).length, 0);
  const overdue    = isOverdue(task);
  const near       = !overdue && isNearDeadline(task);
  const styleKey   = overdue ? 'overdue' : near ? 'near' : task.status;
  const style      = CARD_STATUS_STYLE[styleKey] ?? CARD_STATUS_STYLE.todo;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border border-slate-200 dark:border-slate-700 border-l-4 p-3 text-left shadow-sm relative',
        'hover:shadow-lg transition-all duration-200 space-y-2.5 group active:scale-[0.98]',
        style.border, style.bg, style.pulse
      )}
    >
      {overdue && (
        <span className="absolute inset-0 rounded-xl animate-pulse pointer-events-none shadow-[inset_0_0_0_1px_rgba(239,68,68,0.45)]" />
      )}
      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
        {task.title}
      </p>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', STATUS_COLORS[task.status])}>
          {STATUS_LABELS[task.status]}
        </span>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold flex items-center gap-0.5', PRIORITY_BADGE[task.priority])}>
          <Flag size={9} /> {PRIORITY_LABELS[task.priority]}
        </span>
        {overdue && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white animate-pulse">⚠ Vencido</span>
        )}
        {near && !overdue && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-yellow-400 text-yellow-900">
            ⏰ Vence em breve
          </span>
        )}
      </div>

      <div className="space-y-0.5">
        <p className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 flex-wrap leading-relaxed">
          <Calendar size={9} className="flex-shrink-0" /> <span>Aberta: {fmtDateTime(task.created_at)}</span>
        </p>
        {task.deadline ? (
          <p className={cn('flex items-center gap-1 text-xs font-semibold flex-wrap leading-relaxed', overdue ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300')}>
            <Clock size={10} className="flex-shrink-0" /> <span>Prazo: {fmtDateTime(task.deadline)}</span>
          </p>
        ) : (
          <p className="flex items-center gap-1 text-[10px] text-slate-300 dark:text-slate-600">
            <Clock size={9} /> Sem prazo
          </p>
        )}
      </div>

      {(totalItems > 0 || task.assignees.length > 0) && (
        <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
          {totalItems > 0 ? (
            <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
              <CheckSquare size={10} /> {doneItems}/{totalItems}
            </span>
          ) : <span />}
          <div className="flex -space-x-1">
            {task.assignees.slice(0, 3).map(a => <Avatar key={a.id} user={a} size={5} />)}
            {task.assignees.length > 3 && (
              <span className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-[9px] font-bold text-blue-600 dark:text-blue-300 flex items-center justify-center">
                +{task.assignees.length - 3}
              </span>
            )}
          </div>
        </div>
      )}
    </button>
  );
}

/* ── TaskDetail modal ───────────────────────────────────────────────────── */
interface TaskDetailProps {
  task: Task; users: UserType[]; onClose: () => void;
  onUpdate: (t: Task) => void; onDelete: (id: string) => void;
  customLists?: CustomList[];
}

function TaskDetail({ task, users, onClose, onUpdate, onDelete, customLists = [] }: TaskDetailProps) {
  const { user: me } = useAuth();
  const [editTitle, setEditTitle] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [editDesc, setEditDesc] = useState(false);
  const [newCl, setNewCl] = useState('');
  const [addingCl, setAddingCl] = useState(false);
  const [newItems, setNewItems] = useState<Record<string, string>>({});
  const [commentText, setCommentText] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'detail' | 'comments' | 'files'>('detail');
  const [showProps, setShowProps] = useState(false);
  const [copiedChecklist, setCopiedChecklist] = useState<Checklist | null>(null);
  const [taskFiles, setTaskFiles] = useState<TaskFile[]>([]);
  const [filesLoaded, setFilesLoaded] = useState(false);
  const [addingFile, setAddingFile] = useState(false);
  const [newFileUrl, setNewFileUrl] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveModalTitle, setSaveModalTitle] = useState('');
  const [saveModalShared, setSaveModalShared] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<{ clId: string; itemId: string; content: string } | null>(null);
  const [editingCl, setEditingCl] = useState<{ id: string; title: string } | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    priority: 'normal',
    status: 'todo',
    deadline: '',
    owner_id: '',
    assignee_ids: [] as string[],
  });

  async function patch(input: object) {
    setSaving(true);
    try { onUpdate(await api.update(task.id, input)); } finally { setSaving(false); }
  }

  async function saveTitle() {
    if (title.trim() && title !== task.title) await patch({ title: title.trim() });
    setEditTitle(false);
  }
  async function saveDesc() { await patch({ description }); setEditDesc(false); }

  async function handleAddChecklist(e: FormEvent) {
    e.preventDefault();
    if (!newCl.trim()) return;
    onUpdate(await api.addChecklist(task.id, newCl.trim()));
    setNewCl(''); setAddingCl(false);
  }
  async function handleToggleItem(cl: Checklist, item: ChecklistItem) {
    onUpdate(await api.toggleItem(task.id, cl.id, item.id, !item.completed));
  }
  async function handleSetItemAssignee(cl: Checklist, item: ChecklistItem, assigneeId: string) {
    onUpdate(await api.setItemAssignee(task.id, cl.id, item.id, assigneeId || null));
  }
  async function handleAddItem(cl: Checklist) {
    const content = newItems[cl.id]?.trim();
    if (!content) return;
    onUpdate(await api.addItem(task.id, cl.id, content));
    setNewItems(prev => ({ ...prev, [cl.id]: '' }));
  }
  async function handleDeleteItem(cl: Checklist, itemId: string) {
    const result = await api.deleteItem(task.id, cl.id, itemId);
    if (result) onUpdate(result);
  }
  async function handleUpdateItem(cl: Checklist, item: ChecklistItem, content: string) {
    if (!content.trim() || content.trim() === item.content) { setEditingItem(null); return; }
    onUpdate(await api.updateItem(task.id, cl.id, item.id, content.trim()));
    setEditingItem(null);
  }

  async function handleUpdateChecklist(cl: Checklist, title: string) {
    if (!title.trim() || title.trim() === cl.title) { setEditingCl(null); return; }
    onUpdate(await api.updateChecklist(task.id, cl.id, title.trim()));
    setEditingCl(null);
  }

  async function handleSaveEdit() {
    await patch({
      title: editForm.title.trim() || task.title,
      description: editForm.description,
      priority: editForm.priority,
      status: editForm.status,
      deadline: editForm.deadline || null,
      owner_id: editForm.owner_id || null,
      assignee_ids: editForm.assignee_ids,
    });
    setShowEditModal(false);
  }

  async function handleSaveAsTemplate() {
    if (savingTemplate || !saveModalTitle.trim()) return;
    setSavingTemplate(true);
    try {
      await templateApi.create({
        title: saveModalTitle.trim(),
        description: task.description || '',
        priority: task.priority || 'normal',
        category: 'Geral',
        is_shared: saveModalShared,
        checklist_items: task.checklists.map(cl => ({
          title: cl.title,
          items: cl.items.map(i => i.content),
        })),
      });
      setShowSaveModal(false);
      setSaveModalTitle('');
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleDeleteChecklist(clId: string) {
    const result = await api.deleteChecklist(task.id, clId);
    if (result) onUpdate(result);
  }
  useEffect(() => {
    if (activeTab === 'files' && !filesLoaded) {
      api.listFiles(task.id).then(f => { setTaskFiles(f); setFilesLoaded(true); }).catch(() => setFilesLoaded(true));
    }
  }, [activeTab, filesLoaded, task.id]);

  async function handleComment(e: FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    onUpdate(await api.addComment(task.id, commentText.trim()));
    setCommentText('');
  }

  const totalItems = task.checklists.reduce((s, cl) => s + cl.items.length, 0);
  const doneItems = task.checklists.reduce((s, cl) => s + cl.items.filter(i => i.completed).length, 0);

  const PropertiesPanel = () => (
    <div className="p-5 space-y-5">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">Status</p>
        <select value={task.status} onChange={e => patch({ status: e.target.value })}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-orange-400 hover:border-orange-300 transition-colors cursor-pointer">
          <option value="todo">A Fazer</option>
          <option value="in_progress">Em Andamento</option>
          <option value="done">Concluída</option>
        </select>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">Prioridade</p>
        <select value={task.priority} onChange={e => patch({ priority: e.target.value })}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-orange-400 hover:border-orange-300 transition-colors cursor-pointer">
          <option value="low">Baixa</option>
          <option value="normal">Normal</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </select>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">Prazo</p>
        <input type="datetime-local" value={task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : ''}
          onChange={e => patch({ deadline: e.target.value || null })}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-orange-400 hover:border-orange-300 transition-colors" />
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">Responsável</p>
        <UserPicker users={users} value={task.owner_id || ''} onChange={(id) => patch({ owner_id: id || null })} placeholder="Ninguém" />
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">Participantes</p>
        <MultiUserPicker users={users} value={task.assignees.map(a => a.id)} onChange={(ids) => patch({ assignee_ids: ids })} />
      </div>
      {customLists.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">Lista</p>
          <select value={task.custom_list_id || ''} onChange={e => patch({ custom_list_id: e.target.value || null })}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-orange-400 hover:border-orange-300 transition-colors cursor-pointer">
            <option value="">Sem lista</option>
            {customLists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      )}
      <div className="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
        {task.creator && (
          <div className="flex items-center gap-2">
            <Avatar user={task.creator} size={5} />
            <p><span className="font-semibold text-slate-600 dark:text-slate-300">Criado por:</span> {task.creator.name}</p>
          </div>
        )}
        <p><span className="font-semibold text-slate-600 dark:text-slate-300">Criado:</span> {fmtDateTime(task.created_at)}</p>
        <p><span className="font-semibold text-slate-600 dark:text-slate-300">Atualizado:</span> {fmtDateTime(task.updated_at)}</p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => patch({ status: 'in_progress' })} disabled={task.status === 'in_progress'}
          className="flex-1 h-9 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-40 active:scale-95 transition-all duration-200">
          Iniciar
        </button>
        <button onClick={() => patch({ status: 'done' })} disabled={task.status === 'done'}
          className="flex-1 h-9 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-40 active:scale-95 transition-all duration-200">
          Concluir
        </button>
      </div>
    </div>
  );

  return (
    <AccessibleModal title={task.title} onClose={onClose} className="nex-task-detail fixed top-0 right-0 z-50 h-dvh w-full max-w-[960px] outline-none">

      <div className="relative ml-auto flex h-full w-full flex-col sm:flex-row bg-white dark:bg-slate-900 shadow-2xl overflow-hidden" style={{ maxWidth: 960 }}>
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-blue-400 to-orange-400 z-10" />

        {/* Left: detail */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden border-r-0 sm:border-r border-slate-100 dark:border-slate-700 pt-1">
          <div className="flex items-start gap-3 border-b border-slate-100 dark:border-slate-700 px-4 sm:px-6 py-4">
            <div className="flex-1 min-w-0">
              {editTitle ? (
                <input
                  autoFocus value={title}
                  onChange={e => setTitle(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitle(task.title); setEditTitle(false); } }}
                  className="w-full text-lg font-bold text-slate-900 dark:text-slate-100 dark:bg-transparent outline-none border-b-2 border-orange-400 pb-0.5"
                />
              ) : (
                <button onClick={() => setEditTitle(true)} className="text-left group">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-orange-600 transition-colors">{task.title}</h2>
                </button>
              )}
              {task.protocol && (
                <button
                  onClick={() => navigator.clipboard.writeText(window.location.origin + '/tarefas?protocolo=' + task.protocol).catch(() => {})}
                  className="mt-1 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-orange-500 transition-colors font-mono"
                  title="Copiar link desta tarefa"
                >
                  <Link size={11} />
                  {task.protocol}
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {saving && <Loader2 size={15} className="animate-spin text-orange-400" />}
              <button
                onClick={() => {
                  setEditForm({
                    title: task.title,
                    description: task.description || '',
                    priority: task.priority || 'normal',
                    status: task.status || 'todo',
                    deadline: task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : '',
                    owner_id: task.owner_id || '',
                    assignee_ids: task.assignees.map((a: any) => a.id),
                  });
                  setShowEditModal(true);
                }}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-all duration-200"
                title="Editar tarefa">
                <Pencil size={14} />
              </button>
              <button
                onClick={() => { setSaveModalTitle(task.title); setShowSaveModal(true); }}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600 transition-all duration-200"
                title="Salvar como modelo">
                <BookmarkPlus size={15} />
              </button>
              {/* Mobile: toggle properties panel */}
              <button
                onClick={() => setShowProps(p => !p)}
                className="sm:hidden h-8 px-2 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 text-xs font-semibold"
              >
                {showProps ? 'Detalhes' : 'Config'}
              </button>
              <button
                onClick={() => { if (confirm('Excluir tarefa?')) { onDelete(task.id); onClose(); } }}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-all duration-200 active:scale-90"
              >
                <Trash2 size={15} />
              </button>
              <button
                onClick={onClose}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 active:scale-90"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Mobile properties panel (toggled) */}
          {showProps && (
            <div className="sm:hidden overflow-y-auto border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900">
              <PropertiesPanel />
            </div>
          )}

          {!showProps && (
            <>
              <div className="flex border-b border-slate-100 dark:border-slate-700 px-4 sm:px-6">
                {(['detail', 'comments', 'files'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={cn('py-2.5 px-4 text-sm font-semibold border-b-2 -mb-px transition-all duration-200',
                      activeTab === tab ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200')}>
                    {tab === 'detail' ? 'Detalhes' : tab === 'comments' ? `Comentários (${task.comments.length})` : `Arquivos (${taskFiles.length})`}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {activeTab === 'detail' ? (
                  <>
                    <div>
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">Descrição</p>
                      {editDesc ? (
                        <div className="space-y-2">
                          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={5}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-orange-400 resize-none transition-colors" />
                          <div className="flex gap-2">
                            <button onClick={saveDesc} className="h-8 px-4 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 active:scale-95 transition-all duration-200">Salvar</button>
                            <button onClick={() => { setDescription(task.description || ''); setEditDesc(false); }} className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setEditDesc(true)} className="w-full text-left rounded-lg border border-transparent hover:border-orange-200 hover:bg-orange-50/30 dark:hover:bg-orange-900/10 p-2 -m-2 group transition-all duration-200">
                          {description
                            ? <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{description}</p>
                            : <p className="text-sm text-slate-400 dark:text-slate-500 italic">Clique para adicionar descrição...</p>}
                        </button>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                          Checklists {totalItems > 0 && `(${doneItems}/${totalItems})`}
                        </p>
                        {copiedChecklist && (
                          <button
                            onClick={async () => {
                              const before = new Set(task.checklists.map((c: any) => c.id));
                              const newTask = await api.addChecklist(task.id, copiedChecklist.title);
                              const addedCl = newTask.checklists.find((c: any) => !before.has(c.id));
                              if (addedCl) {
                                let t = newTask;
                                for (const item of copiedChecklist.items) {
                                  t = await api.addItem(task.id, addedCl.id, item.content);
                                }
                                onUpdate(t);
                              }
                              setCopiedChecklist(null);
                            }}
                            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700 transition-colors">
                            <Copy size={13} /> Colar "{copiedChecklist.title}"
                          </button>
                        )}
                        <button onClick={() => setAddingCl(true)} className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 font-semibold hover:text-orange-700 transition-colors">
                          <Plus size={13} /> Adicionar
                        </button>
                      </div>
                      {addingCl && (
                        <form onSubmit={handleAddChecklist} className="mb-3 flex gap-2">
                          <input autoFocus value={newCl} onChange={e => setNewCl(e.target.value)}
                            placeholder="Nome da checklist" className="flex-1 h-9 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 text-sm outline-none focus:border-orange-400 transition-colors" />
                          <button type="submit" className="h-9 px-4 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 active:scale-95 transition-all duration-200">OK</button>
                          <button type="button" onClick={() => setAddingCl(false)} className="h-9 w-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            <X size={14} />
                          </button>
                        </form>
                      )}
                      {task.checklists.map(cl => {
                        const prog = checklistProgress(cl);
                        const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;
                        return (
                          <div key={cl.id} className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/40 p-3 hover:border-orange-100 dark:hover:border-orange-900/30 hover:bg-orange-50/20 dark:hover:bg-orange-900/10 transition-all duration-200">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckSquare size={14} className="text-orange-500" />
                              {editingCl?.id === cl.id ? (
                                <input
                                  autoFocus
                                  value={editingCl.title}
                                  onChange={e => setEditingCl(ec => ec ? { ...ec, title: e.target.value } : null)}
                                  onBlur={() => handleUpdateChecklist(cl, editingCl.title)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleUpdateChecklist(cl, editingCl.title);
                                    if (e.key === 'Escape') setEditingCl(null);
                                  }}
                                  className="text-sm font-bold flex-1 bg-transparent outline-none border-b border-orange-400 text-slate-700 dark:text-slate-200 dark:caret-white py-0.5 min-w-0"
                                />
                              ) : (
                                <p
                                  onClick={() => setEditingCl({ id: cl.id, title: cl.title })}
                                  className="text-sm font-bold text-slate-700 dark:text-slate-200 flex-1 cursor-text hover:text-orange-600 dark:hover:text-orange-400 select-none">
                                  {cl.title}
                                </p>
                              )}
                              {prog.total > 0 && <span className="text-xs text-slate-500 dark:text-slate-400">{prog.done}/{prog.total}</span>}
                              <button onClick={() => setCopiedChecklist(cl)} className="text-slate-400 hover:text-blue-500 transition-colors active:scale-90" title="Copiar etapas">
                                <Copy size={13} />
                              </button>
                              <button onClick={() => handleDeleteChecklist(cl.id)} className="text-slate-400 hover:text-red-500 transition-colors active:scale-90">
                                <Trash2 size={13} />
                              </button>
                            </div>
                            {prog.total > 0 && (
                              <div className="mb-3 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                                <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-orange-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                              </div>
                            )}
                            <div className="space-y-1">
                              {cl.items.map(item => (
                                <div key={item.id} className="flex items-center gap-2 group rounded-lg px-2 py-1 hover:bg-white dark:hover:bg-slate-700 transition-all duration-150">
                                  <button onClick={() => handleToggleItem(cl, item)}
                                    className={cn('h-4 w-4 rounded border flex-shrink-0 flex items-center justify-center transition-all duration-200 active:scale-90',
                                      item.completed ? 'bg-orange-500 border-orange-500 shadow-sm' : 'border-slate-300 dark:border-slate-600 hover:border-orange-400 bg-white dark:bg-slate-800')}>
                                    {item.completed && <span className="text-white text-[9px] font-bold">✓</span>}
                                  </button>
                                  {editingItem?.itemId === item.id ? (
                                    <input
                                      autoFocus
                                      value={editingItem.content}
                                      onChange={e => setEditingItem(ei => ei ? { ...ei, content: e.target.value } : null)}
                                      onBlur={() => handleUpdateItem(cl, item, editingItem.content)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') handleUpdateItem(cl, item, editingItem.content);
                                        if (e.key === 'Escape') setEditingItem(null);
                                      }}
                                      className="text-sm flex-1 bg-transparent outline-none border-b border-orange-400 dark:text-slate-200 dark:caret-white py-0.5 min-w-0"
                                    />
                                  ) : (
                                    <span
                                      onClick={() => !item.completed && setEditingItem({ clId: cl.id, itemId: item.id, content: item.content })}
                                      className={cn('text-sm flex-1 transition-all duration-200 dark:text-slate-300 select-none',
                                        item.completed
                                          ? 'line-through text-slate-400 dark:text-slate-500 cursor-default'
                                          : 'cursor-text hover:text-orange-600 dark:hover:text-orange-400'
                                      )}>
                                      {item.content}
                                    </span>
                                  )}
                                  <ItemAssigneePicker users={users} value={item.assignee_id || ''} onChange={(id) => handleSetItemAssignee(cl, item, id)} />
                                  <button onClick={() => handleDeleteItem(cl, item.id)}
                                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all duration-150 active:scale-90 flex-shrink-0">
                                    <X size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 flex gap-2">
                              <input
                                value={newItems[cl.id] || ''}
                                onChange={e => setNewItems(p => ({ ...p, [cl.id]: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(cl); } }}
                                placeholder="Novo item..." className="flex-1 h-8 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-400 px-3 text-xs outline-none focus:border-orange-400 transition-colors" />
                              <button onClick={() => handleAddItem(cl)} className="h-8 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600 hover:border-orange-200 transition-all duration-200 active:scale-95">
                                <Plus size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : activeTab === 'comments' ? (
                  <div className="space-y-4">
                    {task.comments.map(c => (
                      <div key={c.id} className="flex gap-3">
                        <Avatar user={c.user} size={8} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{c.user.name}</span>
                            <span className="text-[10px] text-slate-400">{fmtDateTime(c.created_at)}</span>
                          </div>
                          <p className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{c.content}</p>
                        </div>
                      </div>
                    ))}
                    {!task.comments.length && (
                      <div className="py-8 text-center text-sm text-slate-400">Nenhum comentário ainda.</div>
                    )}
                    <form onSubmit={handleComment} className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                      <Avatar user={me ? { id: me.id, name: me.name, photo_url: me.photo_url } : undefined} size={8} />
                      <div className="flex-1 flex gap-2">
                        <textarea value={commentText} onChange={e => setCommentText(e.target.value)} rows={2}
                          placeholder="Escreva um comentário..."
                          className="flex-1 rounded-xl border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-400 px-3 py-2 text-sm outline-none focus:border-orange-400 resize-none transition-colors" />
                        <button type="submit" disabled={!commentText.trim()}
                          className="h-9 px-3 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-40 self-end active:scale-95 transition-all duration-200">
                          <MessageSquare size={14} />
                        </button>
                      </div>
                    </form>
                  </div>
                ) : activeTab === 'files' ? (
                  <div className="space-y-3">
                    {!filesLoaded && (
                      <div className="py-8 text-center"><Loader2 size={18} className="animate-spin text-slate-400 mx-auto" /></div>
                    )}
                    {filesLoaded && taskFiles.map(f => (
                      <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                        <Link size={15} className="text-slate-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                            className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline truncate block">{f.name}</a>
                          {f.uploader_name && (
                            <p className="text-xs text-slate-400 mt-0.5">{f.uploader_name} · {fmtDateTime(f.created_at)}</p>
                          )}
                        </div>
                        <button onClick={async () => {
                            await api.removeFile(task.id, f.id);
                            setTaskFiles(prev => prev.filter(x => x.id !== f.id));
                          }}
                          className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    {filesLoaded && !taskFiles.length && !addingFile && (
                      <div className="py-8 text-center text-sm text-slate-400">Nenhum arquivo anexado.</div>
                    )}
                    {addingFile ? (
                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                        <input value={newFileName} onChange={e => setNewFileName(e.target.value)}
                          placeholder="Nome do arquivo"
                          className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 text-sm outline-none focus:border-orange-400 transition-colors" />
                        <input value={newFileUrl} onChange={e => setNewFileUrl(e.target.value)}
                          placeholder="URL (link externo, Google Drive, etc.)"
                          className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 text-sm outline-none focus:border-orange-400 transition-colors" />
                        <div className="flex gap-2">
                          <button onClick={async () => {
                              if (!newFileName.trim() || !newFileUrl.trim()) return;
                              const f = await api.addFile(task.id, { name: newFileName.trim(), file_url: newFileUrl.trim() });
                              setTaskFiles(prev => [...prev, f]);
                              setNewFileName(''); setNewFileUrl(''); setAddingFile(false);
                            }}
                            className="h-8 px-4 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 active:scale-95 transition-all duration-200">
                            Adicionar
                          </button>
                          <button onClick={() => { setAddingFile(false); setNewFileName(''); setNewFileUrl(''); }}
                            className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : filesLoaded && (
                      <button onClick={() => setAddingFile(true)}
                        className="flex items-center gap-2 text-sm font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-700 transition-colors">
                        <Plus size={14} /> Adicionar link de arquivo
                      </button>
                    )}
                  </div>
                ): null}
              </div>
            </>
          )}
        </div>

        {/* Right: properties — desktop only */}
        <div className="hidden sm:block w-64 flex-shrink-0 overflow-y-auto pt-1 bg-white dark:bg-slate-900 border-t-0 border-l border-slate-100 dark:border-slate-700">
          <PropertiesPanel />
        </div>
      </div>
      {showSaveModal && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4">Salvar como modelo</h3>
            <input
              autoFocus
              value={saveModalTitle}
              onChange={e => setSaveModalTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveAsTemplate()}
              placeholder="Nome do modelo..."
              className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 px-3 text-sm outline-none focus:border-orange-400 mb-3 transition-colors"
            />
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 mb-4 cursor-pointer">
              <input type="checkbox" checked={saveModalShared} onChange={e => setSaveModalShared(e.target.checked)} className="accent-orange-500" />
              Compartilhar com todos
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleSaveAsTemplate}
                disabled={!saveModalTitle.trim() || savingTemplate}
                className="flex-1 h-10 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-40 active:scale-95 transition-all duration-200">
                {savingTemplate ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={() => setShowSaveModal(false)}
                className="h-10 px-4 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      {showEditModal && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 overflow-y-auto py-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 my-auto">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-5 flex items-center gap-2">
              <Pencil size={15} className="text-blue-500" /> Editar tarefa
            </h3>

            <label className="block mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Título</label>
            <input
              autoFocus
              value={editForm.title}
              onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
              className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 px-3 text-sm outline-none focus:border-orange-400 mb-4 transition-colors"
            />

            <label className="block mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Descrição</label>
            <textarea
              value={editForm.description}
              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Descreva a tarefa..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-orange-400 mb-4 resize-none transition-colors"
            />

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</label>
                <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-orange-400 transition-colors cursor-pointer">
                  <option value="todo">A Fazer</option>
                  <option value="in_progress">Em Andamento</option>
                  <option value="done">Concluída</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Prioridade</label>
                <select value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-orange-400 transition-colors cursor-pointer">
                  <option value="low">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>

            <label className="block mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Prazo</label>
            <input
              type="datetime-local"
              value={editForm.deadline}
              onChange={e => setEditForm(f => ({ ...f, deadline: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-orange-400 mb-4 transition-colors"
            />

            <label className="block mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Responsável</label>
            <div className="mb-4">
              <UserPicker users={users} value={editForm.owner_id} onChange={id => setEditForm(f => ({ ...f, owner_id: id }))} placeholder="Ninguém" />
            </div>

            <label className="block mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Participantes</label>
            <div className="mb-5">
              <MultiUserPicker users={users} value={editForm.assignee_ids} onChange={ids => setEditForm(f => ({ ...f, assignee_ids: ids }))} />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={!editForm.title.trim() || saving}
                className="flex-1 h-10 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-40 active:scale-95 transition-all duration-200">
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="h-10 px-4 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </AccessibleModal>
  );
}

/* ── CreateTaskModal ────────────────────────────────────────────────────── */
function CreateTaskModal({ users, onCreate, onClose, customLists = [], defaultListId = null, initialTitle = '', initialDescription = '', initialAssigneeIds, initialPriority = 'normal' }: { users: UserType[]; onCreate: (t: Task) => void; onClose: () => void; customLists?: CustomList[]; defaultListId?: string | null; initialTitle?: string; initialDescription?: string; initialAssigneeIds?: string[]; initialPriority?: string }) {
  const { user: me } = useAuth();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState(initialPriority || 'normal');
  const [ownerId, setOwnerId] = useState(initialAssigneeIds?.[0] || me?.id || '');
  const [assigneeIds, setAssigneeIds] = useState<string[]>(initialAssigneeIds ?? (me ? [me.id] : []));
  const [saving, setSaving] = useState(false);
  const [customListId, setCustomListId] = useState<string | null>(defaultListId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const task = await api.create({ title: title.trim(), description, deadline: deadline || null, priority, owner_id: ownerId, assignee_ids: assigneeIds, custom_list_id: customListId || null });
      onCreate(task);
    } finally { setSaving(false); }
  }

  return (
    <AccessibleModal title="Nova tarefa" onClose={() => { if (!saving) onClose(); }} className="nex-task-create fixed left-1/2 top-1/2 z-50 w-[calc(100%-24px)] max-w-lg -translate-x-1/2 -translate-y-1/2 outline-none">
      <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="h-1 bg-gradient-to-r from-blue-600 via-blue-400 to-orange-400" />
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Nova Tarefa</h3>
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 transition-all duration-200"><X size={16} /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Título da tarefa *" aria-label="Título da tarefa" required
              className="w-full h-11 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-400 px-4 text-sm outline-none focus:border-orange-400 font-semibold transition-colors hover:border-slate-300" />
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Descrição (opcional)"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-400 px-4 py-3 text-sm outline-none focus:border-orange-400 resize-none transition-colors hover:border-slate-300" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">Prazo</label>
                <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 text-sm outline-none focus:border-orange-400 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">Prioridade</label>
                <select value={priority} onChange={e => setPriority(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 text-sm outline-none focus:border-orange-400 transition-colors cursor-pointer">
                  <option value="low">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">Responsável</label>
              <UserPicker users={users} value={ownerId} onChange={setOwnerId} placeholder="Selecionar responsável..." />
            </div>
            <div>
              <label className="block text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">Participantes</label>
              <MultiUserPicker users={users} value={assigneeIds} onChange={setAssigneeIds} />
            </div>
            {customLists.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">Lista</label>
                <select value={customListId || ''} onChange={e => setCustomListId(e.target.value || null)}
                  className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 text-sm outline-none focus:border-orange-400 transition-colors cursor-pointer">
                  <option value="">Sem lista</option>
                  {customLists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}
            <button type="submit" disabled={!title.trim() || saving}
              className="w-full h-11 rounded-xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 disabled:opacity-40 active:scale-[0.98] transition-all duration-200">
              {saving ? 'Criando...' : 'Criar Tarefa'}
            </button>
          </form>
        </div>
      </div>
    </AccessibleModal>
  );
}

/* ── KanbanView ──────────────────────────────────────────────────────────── */
function KanbanView({ tasks, onSelect }: { tasks: Task[]; onSelect: (t: Task) => void }) {
  const columns = useMemo(() => {
    const map: Record<string, Task[]> = {};
    KANBAN_COLS.forEach(c => { map[c.id] = []; });
    tasks.forEach(t => { const col = deadlineColumn(t); map[col]?.push(t); });
    return map;
  }, [tasks]);

  return (
    <div aria-label="Tarefas agrupadas por prazo" className="tasks-kanban flex gap-4 overflow-x-auto pb-4 min-h-0 flex-1">
      {KANBAN_COLS.map(col => (
        <div key={col.id} className="flex flex-col flex-shrink-0 w-72">
          <div className={cn('mb-3 rounded-t-xl border-t-4 bg-white dark:bg-slate-800 px-3 py-2 border border-slate-200 dark:border-slate-700 shadow-sm', col.color)}>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{col.label}</p>
              <span className="ml-auto rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                {columns[col.id]?.length || 0}
              </span>
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto">
            {columns[col.id]?.map(t => (
              <TaskCard key={t.id} task={t} onClick={() => onSelect(t)} />
            ))}
            {!columns[col.id]?.length && (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-4 text-center text-xs text-slate-400 dark:text-slate-500">Sem tarefas</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── ListView ────────────────────────────────────────────────────────────── */
function ListView({ tasks, onSelect }: { tasks: Task[]; onSelect: (t: Task) => void }) {
  return (
    <>
    <div className="tasks-mobile-cards">
      {tasks.map(task => <TaskCard key={task.id} task={task} onClick={() => onSelect(task)} />)}
      {!tasks.length && <p className="nex-empty-state">Nenhuma tarefa encontrada. Ajuste os filtros ou crie uma tarefa.</p>}
    </div>
    <div className="tasks-desktop-table rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-x-auto shadow-sm">
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
            <th className="px-4 py-3 text-left text-xs font-bold text-blue-600 dark:text-blue-400 w-full">Tarefa</th>
            <th className="px-4 py-3 text-left text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">Status</th>
            <th className="px-4 py-3 text-left text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">Prioridade</th>
            <th className="px-4 py-3 text-left text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">Prazo</th>
            <th className="px-4 py-3 text-left text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">Responsável</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(t => (
            <tr key={t.id} onClick={() => onSelect(t)}
              className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-orange-50/40 dark:hover:bg-orange-900/10 cursor-pointer transition-all duration-150 active:bg-orange-100/50 dark:active:bg-orange-900/20">
              <td className="px-4 py-3">
                <button className="font-semibold text-slate-800 dark:text-slate-100 text-left max-w-xs hover:underline" onClick={event => { event.stopPropagation(); onSelect(t); }}>{t.title}</button>
                {t.description && <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{t.description}</p>}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_COLORS[t.status])}>
                  {STATUS_LABELS[t.status]}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={cn('flex items-center gap-1 text-xs font-semibold', PRIORITY_COLORS[t.priority])}>
                  <Flag size={11} /> {PRIORITY_LABELS[t.priority]}
                </span>
              </td>
              <td className={cn('px-4 py-3 text-xs whitespace-nowrap', isOverdue(t) ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-slate-500 dark:text-slate-400')}>
                {t.deadline ? fmtDate(t.deadline) : '—'}
              </td>
              <td className="px-4 py-3">
                {t.owner ? (
                  <div className="flex items-center gap-2">
                    <Avatar user={t.owner} size={6} />
                    <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[100px]">{t.owner.name.split(' ')[0]}</span>
                  </div>
                ) : <span className="text-xs text-slate-400">—</span>}
              </td>
            </tr>
          ))}
          {!tasks.length && (
            <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">Nenhuma tarefa encontrada.</td></tr>
          )}
        </tbody>
      </table>
    </div>
    </>
  );
}

/* ── PlannerView ─────────────────────────────────────────────────────────── */
function PlannerView({ tasks, users, onSelect }: { tasks: Task[]; users: UserType[]; onSelect: (t: Task) => void }) {
  const byUser = useMemo(() => {
    const map = new Map<string, { user: UserType | null; tasks: Task[] }>();
    map.set('unassigned', { user: null, tasks: [] });
    users.forEach(u => map.set(u.id, { user: u, tasks: [] }));
    tasks.forEach(t => {
      if (!t.assignees.length) map.get('unassigned')!.tasks.push(t);
      else t.assignees.forEach(a => { if (map.has(a.id)) map.get(a.id)!.tasks.push(t); });
    });
    return Array.from(map.values()).filter(g => g.tasks.length > 0);
  }, [tasks, users]);

  return (
    <div className="space-y-6">
      {byUser.map((group, idx) => (
        <div key={idx}>
          <div className="flex items-center gap-3 mb-3 pb-2 border-b border-slate-100 dark:border-slate-700">
            {group.user
              ? <Avatar user={group.user} size={8} />
              : <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center"><User size={14} className="text-slate-400" /></div>}
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{group.user?.name || 'Sem responsável'}</p>
            <span className="text-xs text-slate-400 ml-1">{group.tasks.length} tarefa(s)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {group.tasks.map(t => <TaskCard key={t.id} task={t} onClick={() => onSelect(t)} />)}
          </div>
        </div>
      ))}
      {!byUser.length && <div className="py-16 text-center text-sm text-slate-400">Nenhuma tarefa ainda.</div>}
    </div>
  );
}

/* ── CalendarView ────────────────────────────────────────────────────── */
function CalendarView({ tasks, onSelect }: { tasks: Task[]; onSelect: (t: Task) => void }) {
  const [date, setDate] = useState(new Date());
  const [calMode, setCalMode] = useState<'hoje' | 'semana' | 'mes'>('mes');
  const year = date.getFullYear();
  const month = date.getMonth();

  const monthDays = useMemo(() => {
    if (calMode !== 'mes') return [];
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDow = (first.getDay() + 6) % 7;
    const totalCells = Math.ceil((startDow + last.getDate()) / 7) * 7;
    return Array.from({ length: totalCells }, (_, i) => {
      const d = new Date(year, month, 1 - startDow + i);
      return { date: d, inMonth: d.getMonth() === month };
    });
  }, [year, month, calMode]);

  const weekDays = useMemo(() => {
    if (calMode !== 'semana') return [] as Date[];
    const dow = (date.getDay() + 6) % 7;
    const monday = new Date(date);
    monday.setDate(date.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [date, calMode]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach(t => {
      if (t.deadline) {
        const key = new Date(t.deadline).toDateString();
        const arr = map.get(key) || [];
        arr.push(t);
        map.set(key, arr);
      }
    });
    return map;
  }, [tasks]);

  const todayTasks = useMemo(() => {
    if (calMode !== 'hoje') return [] as Task[];
    return tasksByDate.get(new Date().toDateString()) || [];
  }, [tasksByDate, calMode]);

  const todayStr = new Date().toDateString();
  const isToday = (d: Date) => d.toDateString() === todayStr;

  function shiftPeriod(dir: -1 | 1) {
    if (calMode === 'mes') setDate(d => new Date(d.getFullYear(), d.getMonth() + dir, 1));
    else if (calMode === 'semana') setDate(d => { const n = new Date(d); n.setDate(d.getDate() + dir * 7); return n; });
    else setDate(d => { const n = new Date(d); n.setDate(d.getDate() + dir); return n; });
  }

  function periodLabel() {
    if (calMode === 'mes') return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    if (calMode === 'semana' && weekDays.length) {
      const s = weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      const e = weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      return `${s} – ${e}`;
    }
    return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  }

  const taskChip = (t: Task) => cn(
    'w-full text-left truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight transition-all hover:brightness-95 active:scale-[0.98]',
    t.status === 'done' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
    isOverdue(t) ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
  );

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
      <div className="border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <button onClick={() => shiftPeriod(-1)} className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors active:scale-90">
            <ChevronLeft size={15} className="dark:text-slate-300" />
          </button>
          <p className="flex-1 text-center text-sm font-bold text-slate-800 dark:text-slate-100 capitalize truncate">{periodLabel()}</p>
          <button onClick={() => shiftPeriod(1)} className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors active:scale-90">
            <ChevronRight size={15} className="dark:text-slate-300" />
          </button>
          <button onClick={() => setDate(new Date())} className="h-8 px-3 flex-shrink-0 rounded-lg text-xs font-semibold text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors active:scale-95">Hoje</button>
        </div>
        <div className="flex justify-center pb-2 px-4">
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            {(['hoje', 'semana', 'mes'] as const).map(mode => (
              <button key={mode} onClick={() => setCalMode(mode)}
                className={cn('px-3 py-1.5 text-xs font-semibold transition-colors',
                  calMode === mode ? 'bg-orange-500 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700')}>
                {mode === 'hoje' ? 'Hoje' : mode === 'semana' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Month view */}
      {calMode === 'mes' && (
        <div className="grid grid-cols-7">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
            <div key={d} className="border-b border-slate-100 dark:border-slate-700 px-1 py-2 text-center text-[10px] sm:text-xs font-bold text-blue-600 dark:text-blue-400">{d}</div>
          ))}
          {monthDays.map((day, i) => {
            const dayTasks = tasksByDate.get(day.date.toDateString()) || [];
            return (
              <div key={i} className={cn('border-b border-r border-slate-100 dark:border-slate-700 min-h-[60px] sm:min-h-[80px] p-1 sm:p-1.5',
                !day.inMonth && 'bg-slate-50/60 dark:bg-slate-800/30', i % 7 === 0 && 'border-l')}>
                <p className={cn('text-[10px] font-semibold text-right mb-0.5 h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center rounded-full ml-auto',
                  isToday(day.date) ? 'bg-orange-500 text-white' : day.inMonth ? 'text-slate-700 dark:text-slate-300' : 'text-slate-300 dark:text-slate-600')}>
                  {day.date.getDate()}
                </p>
                <div className="space-y-0.5">
                  {dayTasks.slice(0, 2).map(t => (
                    <button key={t.id} onClick={() => onSelect(t)} className={taskChip(t)}>{t.title}</button>
                  ))}
                  {dayTasks.length > 2 && (
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 pl-0.5">+{dayTasks.length - 2}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Week view — horizontal scroll on mobile */}
      {calMode === 'semana' && (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 divide-x divide-slate-100 dark:divide-slate-700 min-w-[480px]">
            {weekDays.map((day, i) => (
              <div key={i}>
                <div className={cn('border-b border-slate-100 dark:border-slate-700 p-1.5 text-center',
                  isToday(day) && 'bg-orange-50 dark:bg-orange-900/10')}>
                  <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                    {day.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.','').toUpperCase()}
                  </p>
                  <span className={cn('inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold mt-0.5',
                    isToday(day) ? 'bg-orange-500 text-white' : 'text-slate-700 dark:text-slate-300')}>
                    {day.getDate()}
                  </span>
                </div>
                <div className="p-1 space-y-1 min-h-[160px] sm:min-h-[200px]">
                  {(tasksByDate.get(day.toDateString()) || []).map(t => (
                    <button key={t.id} onClick={() => onSelect(t)} className={taskChip(t)}>{t.title}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today view */}
      {calMode === 'hoje' && (
        <div className="p-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
            {date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
          {todayTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-600">
              <CalendarDays size={28} className="mb-2 opacity-40" />
              <p className="text-sm">Nenhuma tarefa com prazo hoje</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayTasks.map(t => (
                <button key={t.id} onClick={() => onSelect(t)}
                  className={cn('w-full text-left rounded-lg px-3 py-2.5 transition-all hover:brightness-95 active:scale-[0.99]',
                    t.status === 'done' ? 'bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' :
                    isOverdue(t) ? 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800' :
                    'bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800')}>
                  <p className={cn('text-sm font-semibold',
                    t.status === 'done' ? 'text-emerald-700 dark:text-emerald-300' :
                    isOverdue(t) ? 'text-red-700 dark:text-red-300' :
                    'text-blue-700 dark:text-blue-300')}>
                    {t.title}
                  </p>
                  {t.deadline && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Prazo: {fmtDateTime(t.deadline)}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── GanttView ───────────────────────────────────────────────────────────── */
function GanttView({ tasks, onSelect }: { tasks: Task[]; onSelect: (t: Task) => void }) {
  const today = new Date();
  const startDate = useMemo(() => {
    const dates = tasks.map(t => new Date(t.created_at)).concat([today]);
    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    min.setDate(1);
    return min;
  }, [tasks]);

  const endDate = useMemo(() => {
    const dates = tasks.filter(t => t.deadline).map(t => new Date(t.deadline!));
    if (!dates.length) { const d = new Date(today); d.setMonth(d.getMonth() + 2); return d; }
    const max = new Date(Math.max(...dates.map(d => d.getTime())));
    max.setDate(max.getDate() + 7);
    return max;
  }, [tasks]);

  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);
  const DAY_W = 24;

  function dayOffset(d: Date) { return Math.ceil((d.getTime() - startDate.getTime()) / 86400000); }

  const weeks: Date[] = [];
  let cur = new Date(startDate);
  while (cur <= endDate) { weeks.push(new Date(cur)); cur.setDate(cur.getDate() + 7); }

  const todayOffset = dayOffset(today);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-auto shadow-sm">
      <div className="flex">
        <div className="flex-shrink-0 w-48 sm:w-56 border-r border-slate-200 dark:border-slate-700">
          <div className="h-10 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-4 flex items-center">
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400">Tarefa</p>
          </div>
          {tasks.map(t => (
            <div key={t.id} className="h-12 border-b border-slate-50 dark:border-slate-700/50 px-4 flex items-center">
              <button onClick={() => onSelect(t)} className="text-left group">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate w-36 sm:w-44 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{t.title}</p>
              </button>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-x-auto">
          <div className="flex h-10 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80" style={{ width: totalDays * DAY_W }}>
            {weeks.map((w, i) => (
              <div key={i} className="flex-shrink-0 border-r border-slate-200 dark:border-slate-700 px-2 flex items-center" style={{ width: 7 * DAY_W }}>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  {w.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </p>
              </div>
            ))}
          </div>

          <div style={{ width: totalDays * DAY_W, position: 'relative' }}>
            <div className="absolute top-0 bottom-0 bg-orange-400/20 z-10 pointer-events-none"
              style={{ left: todayOffset * DAY_W, width: 2 }} />

            {tasks.map(t => {
              const start = dayOffset(new Date(t.created_at));
              const end = t.deadline ? dayOffset(new Date(t.deadline)) : start + 7;
              const w = Math.max(1, end - start) * DAY_W;
              const color = t.status === 'done' ? 'bg-emerald-500' :
                isOverdue(t) ? 'bg-red-500' :
                t.priority === 'urgent' ? 'bg-red-400' :
                t.priority === 'high' ? 'bg-orange-500' : 'bg-blue-500';
              return (
                <div key={t.id} className="h-12 border-b border-slate-50 dark:border-slate-700/50 flex items-center px-1 relative">
                  <button onClick={() => onSelect(t)}
                    className="absolute h-7 rounded-lg flex items-center px-2 text-white text-[10px] font-semibold shadow-sm hover:brightness-110 hover:shadow-md truncate transition-all duration-200 active:scale-[0.98]"
                    style={{ left: start * DAY_W, width: Math.max(w, 60) }}
                    title={`${t.title} ${t.deadline ? '→ ' + fmtDate(t.deadline) : ''}`}>
                    <span className={cn('absolute inset-0 rounded-lg opacity-90', color)} />
                    <span className="relative truncate">{t.title}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
type View = 'lista' | 'prazo' | 'planejador' | 'calendario' | 'gantt' | 'modelos';


/* ── TemplatesView ───────────────────────────────────────���──────────���────── */
function TemplatesView({ templates, users, onUseTemplate, onDelete, onRefresh }: {
  templates: TaskTemplate[];
  users: UserType[];
  onUseTemplate: (t: TaskTemplate) => void;
  onDelete: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const { user: me } = useAuth();
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Suporte');
  const [newAssignedTo, setNewAssignedTo] = useState('');
  const [newIsShared, setNewIsShared] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const categories = [...new Set(templates.map(t => t.category))].sort();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      await templateApi.create({ title: newTitle.trim(), category: newCategory, assigned_to: newAssignedTo || null, is_shared: newIsShared });
      setNewTitle(''); setNewAssignedTo(''); setNewIsShared(false); setAdding(false);
      await onRefresh();
    } finally { setSaving(false); }
  }

  return (
    <div className="max-w-4xl mx-auto py-2">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-700 dark:text-slate-200">Modelos de Tarefa</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Clique em "Usar" para criar uma tarefa com este modelo</p>
        </div>
        <button onClick={() => setAdding(o => !o)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 active:scale-95 transition-all">
          <Plus size={13} /> Novo modelo
        </button>
      </div>

      {adding && (
        <form onSubmit={handleCreate} className="mb-5 p-4 bg-white dark:bg-slate-800 rounded-xl border border-orange-200 dark:border-orange-800 shadow-sm flex flex-col gap-3">
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} autoFocus
            placeholder="Título do modelo..."
            className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 px-3 text-sm outline-none focus:border-orange-400" />
          <div className="grid grid-cols-2 gap-2">
            <input value={newCategory} onChange={e => setNewCategory(e.target.value)}
              placeholder="Categoria (ex: Suporte, Geral)"
              className="h-9 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 px-3 text-sm outline-none focus:border-orange-400" />
            <UserPicker users={users} value={newAssignedTo} onChange={setNewAssignedTo} placeholder="Responsável padrão..." />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-600 dark:text-slate-400">
              <input type="checkbox" checked={newIsShared} onChange={e => setNewIsShared(e.target.checked)}
                className="w-4 h-4 rounded accent-orange-500 cursor-pointer" />
              Compartilhar com todos
            </label>
            <div className="ml-auto flex gap-2">
              <button type="submit" disabled={saving || !newTitle.trim()}
                className="h-9 px-4 rounded-lg bg-orange-500 text-white text-sm font-semibold disabled:opacity-50 hover:bg-orange-600 transition-colors">
                {saving ? '...' : 'Salvar'}
              </button>
              <button type="button" onClick={() => setAdding(false)}
                className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      {templates.length === 0 ? (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400">
          <CheckSquare size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">Nenhum modelo cadastrado.</p>
          <p className="text-xs mt-1">Clique em "Novo modelo" para criar o primeiro.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map(cat => (
            <div key={cat}>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 px-1">{cat}</p>
              <div className="grid gap-2">
                {templates.filter(t => t.category === cat).map(template => (
                  <div key={template.id}
                    className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-orange-200 dark:hover:border-orange-800 hover:shadow-sm transition-all group">
                    <CheckSquare size={14} className="text-slate-300 dark:text-slate-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{template.title}</p>
                        {template.is_shared && (
                          <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">Compartilhado</span>
                        )}
                      </div>
                      {template.assigned_user && (
                        <p className="text-xs text-orange-500 dark:text-orange-400 truncate mt-0.5">👤 {template.assigned_user.name}</p>
                      )}
                      {!template.assigned_user && template.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{template.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => onUseTemplate(template)}
                        className="h-7 px-3 rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-semibold hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors whitespace-nowrap">
                        Usar
                      </button>
                      <button onClick={() => onDelete(template.id)}
                        className="h-7 w-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [view, setView] = useState<View>(() => window.matchMedia('(max-width: 639px)').matches ? 'lista' : 'prazo');
  const [loadError, setLoadError] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [customLists, setCustomLists] = useState<CustomList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');
  const [addingList, setAddingList] = useState(false);
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [templateForCreate, setTemplateForCreate] = useState<TaskTemplate | null>(null);

  const [searchParams] = useSearchParams();
  const initialUrlRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [t, u, ls, tmpl] = await Promise.all([api.list(), getUsers(), listApi.list(), templateApi.list()]);
      setTasks(t); setUsers(u); setCustomLists(ls); setTemplates(tmpl);
    } catch (error) { setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar as tarefas.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!loading && !initialUrlRef.current) {
      initialUrlRef.current = true;
      const p = searchParams.get('protocolo');
      if (p && tasks.length > 0) {
        const found = tasks.find(t => t.protocol === p.toUpperCase());
        if (found) setSelectedTask(found);
      }
    }
  }, [loading]);

  const filtered = useMemo(() => {
    let t = tasks;
    if (selectedListId) t = t.filter(x => x.custom_list_id === selectedListId);
    if (search) t = t.filter(x => x.title.toLowerCase().includes(search.toLowerCase()) || (x.protocol && x.protocol.toUpperCase().includes(search.toUpperCase())));
    if (filterStatus) t = t.filter(x => x.status === filterStatus);
    return t;
  }, [tasks, search, filterStatus, selectedListId]);

  function handleUpdate(updated: Task) {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    if (selectedTask?.id === updated.id) setSelectedTask(updated);
  }
  function handleCreate(task: Task) { setTasks(prev => [task, ...prev]); setCreating(false); setSelectedTask(task); }
  async function handleDelete(id: string) { await api.remove(id); setTasks(prev => prev.filter(t => t.id !== id)); setSelectedTask(null); }

  const VIEWS: { id: View; label: string; icon: typeof LayoutList }[] = [
    { id: 'lista', label: 'Lista', icon: LayoutList },
    { id: 'prazo', label: 'Prazo', icon: KanbanSquare },
    { id: 'planejador', label: 'Planejador', icon: RowsIcon },
    { id: 'calendario', label: 'Calendário', icon: CalendarDays },
    { id: 'gantt', label: 'Gantt', icon: GanttChartSquare },
    { id: 'modelos', label: 'Modelos', icon: CheckSquare },
  ];

  async function handleCreateList(e: React.FormEvent) {
    e.preventDefault();
    if (!newListName.trim()) return;
    const list = await listApi.create(newListName.trim());
    setCustomLists(prev => [...prev, list]);
    setNewListName(''); setAddingList(false);
    setSelectedListId(list.id);
  }

  async function handleRenameList(id: string) {
    if (!renameText.trim()) return;
    const updated = await listApi.rename(id, renameText.trim());
    if (updated) setCustomLists(prev => prev.map(l => l.id === id ? updated : l));
    setRenamingListId(null);
  }

  async function handleDeleteList(id: string) {
    if (!window.confirm('Excluir esta lista de tarefas?')) return;
    await listApi.remove(id);
    setCustomLists(prev => prev.filter(l => l.id !== id));
    if (selectedListId === id) setSelectedListId(null);
  }

  return (
    <div className="tasks-workspace">
      {/* Header */}
      <div className="tasks-header flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <ListTodo size={20} className="text-orange-500" />
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Tarefas</h1>
          <span className="rounded-full bg-blue-50 dark:bg-blue-900/40 border border-blue-100 dark:border-blue-800 px-2 py-0.5 text-xs font-bold text-blue-600 dark:text-blue-300">{tasks.length}</span>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 active:scale-95 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <Plus size={15} /> Nova tarefa
        </button>

        <div className="tasks-search flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Título ou protocolo…" aria-label="Buscar tarefas por título ou protocolo"
            className="h-9 flex-1 sm:w-40 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-400 px-3 text-sm outline-none focus:border-orange-400 hover:border-slate-300 transition-colors" />
          <select aria-label="Filtrar tarefas por status" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 text-sm outline-none focus:border-orange-400 hover:border-slate-300 transition-colors cursor-pointer">
            <option value="">Todos</option>
            <option value="todo">A Fazer</option>
            <option value="in_progress">Andamento</option>
            <option value="done">Concluída</option>
          </select>
        </div>
      </div>

      <div className="tasks-mobile-lists">
        {addingList ? <form onSubmit={handleCreateList} className="flex min-w-0 flex-1 gap-2">
          <input autoFocus value={newListName} onChange={e => setNewListName(e.target.value)} aria-label="Nome da nova lista" placeholder="Nome da lista" required />
          <button type="submit">Salvar</button><button type="button" aria-label="Cancelar nova lista" onClick={() => setAddingList(false)}><X size={16} /></button>
        </form> : <>
          <select aria-label="Selecionar lista de tarefas" value={selectedListId || ''} onChange={e => setSelectedListId(e.target.value || null)}><option value="">Todas as listas ({tasks.length})</option>{customLists.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}</select>
          <button onClick={() => setAddingList(true)} aria-label="Criar nova lista"><FolderPlus size={18} /></button>
        </>}
      </div>
      {/* Body: sidebar + main */}
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar — Custom Lists */}
        <aside aria-label="Listas de tarefas" className="tasks-sidebar w-44 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col overflow-y-auto hidden sm:flex">
          <div className="p-3 flex-shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 px-1">Listas</p>
            <button
              onClick={() => setSelectedListId(null)}
              className={cn('w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-semibold transition-colors',
                selectedListId === null ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800')}
            >
              <FolderOpen size={13} />
              <span className="truncate flex-1">Todas</span>
              <span className="text-[10px] font-bold text-slate-400">{tasks.length}</span>
            </button>
            {customLists.map(list => (
              <div key={list.id} className="group relative">
                {renamingListId === list.id ? (
                  <form onSubmit={e => { e.preventDefault(); handleRenameList(list.id); }} className="flex items-center gap-1 px-1 py-1">
                    <input autoFocus value={renameText} onChange={e => setRenameText(e.target.value)}
                      onBlur={() => setRenamingListId(null)}
                      className="flex-1 h-7 rounded border border-orange-300 px-2 text-xs outline-none focus:border-orange-500 dark:bg-slate-800 dark:text-slate-100" />
                  </form>
                ) : (
                  <button
                    onClick={() => setSelectedListId(list.id)}
                    className={cn('w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-semibold transition-colors',
                      selectedListId === list.id ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800')}
                  >
                    <FolderOpen size={13} />
                    <span className="truncate flex-1 text-left">{list.name}</span>
                    <span className="text-[10px] font-bold text-slate-400">{tasks.filter(t => t.custom_list_id === list.id).length}</span>
                  </button>
                )}
                <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                  <button onClick={() => { setRenamingListId(list.id); setRenameText(list.name); }} className="h-5 w-5 flex items-center justify-center rounded text-slate-400 hover:text-blue-500 hover:bg-blue-50"><Pencil size={9} /></button>
                  <button onClick={() => handleDeleteList(list.id)} className="h-5 w-5 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={9} /></button>
                </div>
              </div>
            ))}
            {addingList ? (
              <form onSubmit={handleCreateList} className="mt-1 flex items-center gap-1 px-1">
                <input autoFocus value={newListName} onChange={e => setNewListName(e.target.value)}
                  onBlur={() => { if (!newListName.trim()) setAddingList(false); }}
                  placeholder="Nome da lista"
                  className="flex-1 h-7 rounded border border-orange-300 px-2 text-xs outline-none focus:border-orange-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
              </form>
            ) : (
              <button onClick={() => setAddingList(true)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-orange-600 transition-colors mt-1">
                <FolderPlus size={12} /> Nova lista
              </button>
            )}
          </div>
        </aside>

        {/* Right: views */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
      {/* View tabs */}
      <div aria-label="Visualizações de tarefas" className="tasks-views flex items-center gap-0.5 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 flex-shrink-0 overflow-x-auto">
        {VIEWS.map(v => (
          <button key={v.id} aria-pressed={view === v.id} onClick={() => setView(v.id)}
            className={cn('flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all duration-200 whitespace-nowrap flex-shrink-0',
              view === v.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-200')}>
            <v.icon size={14} /> {v.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={cn('tasks-content flex-1 min-h-0 bg-slate-50 dark:bg-slate-950 p-4 overflow-auto', view === 'prazo' && 'flex flex-col')}>
        {loadError ? (
          <div className="nex-error-state" role="alert"><h2>Não foi possível carregar as tarefas</h2><p>{loadError}</p><button className="nex-retry" onClick={() => { void load(); }}>Tentar novamente</button></div>
        ) : loading ? (
          <div role="status" aria-label="Carregando tarefas" className="flex items-center justify-center h-full">
            <Loader2 size={28} className="animate-spin text-orange-400" />
          </div>
        ) : view === 'prazo' ? (
          <KanbanView tasks={filtered} onSelect={setSelectedTask} />
        ) : view === 'lista' ? (
          <ListView tasks={filtered} onSelect={setSelectedTask} />
        ) : view === 'planejador' ? (
          <PlannerView tasks={filtered} users={users} onSelect={setSelectedTask} />
        ) : view === 'calendario' ? (
          <CalendarView tasks={filtered} onSelect={setSelectedTask} />
        ) : view === 'modelos' ? (
          <TemplatesView
            templates={templates}
            users={users}
            onUseTemplate={(tmpl) => { setTemplateForCreate(tmpl); setView('lista'); setCreating(true); }}
            onDelete={async (id) => { if (!window.confirm('Excluir este modelo de tarefa?')) return; await templateApi.remove(id); setTemplates(prev => prev.filter(t => t.id !== id)); }}
            onRefresh={async () => setTemplates(await templateApi.list())}
          />
        ) : (
          <GanttView tasks={filtered} onSelect={setSelectedTask} />
        )}
      </div>

        </div>
      </div>

      {selectedTask && (
        <TaskDetail task={selectedTask} users={users} onClose={() => setSelectedTask(null)} onUpdate={handleUpdate} onDelete={handleDelete} customLists={customLists} />
      )}
      {creating && (
        <CreateTaskModal users={users} onCreate={(task) => { handleCreate(task); setTemplateForCreate(null); }} onClose={() => { setCreating(false); setTemplateForCreate(null); }} customLists={customLists} defaultListId={selectedListId} initialTitle={templateForCreate?.title || ''} initialDescription={templateForCreate?.description || ''} initialAssigneeIds={templateForCreate?.assigned_to ? [templateForCreate.assigned_to] : undefined} initialPriority={templateForCreate?.priority || 'normal'} />
      )}
    </div>
  );
}
