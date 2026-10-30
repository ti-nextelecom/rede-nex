import {
  FormEvent, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Calendar, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CheckSquare, Clock, Flag,
  FolderOpen, FolderPlus, GanttChartSquare, KanbanSquare, LayoutList, ListTodo, Loader2, MessageSquare,
  Link, Pencil, Plus, RowsIcon, Trash2, User, X,
  BookmarkPlus,
  Copy, Paperclip, Images, Share2,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { clearAssistantIntent, readAssistantIntent } from '../lib/assistantIntent';
import { apiDelete, apiDeleteJson, apiGet, apiPatch, apiPost, apiPut } from '../lib/apiClient';
import { getUsers } from '../lib/appApi';
import { useAuth } from '../lib/auth';
import { dispatchXPEvent } from '../lib/xpEvents';
import { cn } from '../lib/utils';
import type { User as UserType } from '../types';
import { AccessibleModal } from '../components/AccessibleModal';
import { TaskConversation } from '../components/TaskConversation';
import { TaskFileCard } from '../components/TaskFileCard';
import { TaskDescription } from '../components/TaskDescription';
import { ChecklistItemMedia } from '../components/ChecklistItemMedia';
import { TaskComposer } from '../components/TaskComposer';
import { ChecklistPeopleFields } from '../components/TaskPeoplePicker';
import { TaskModelSharing, TaskSharingFields } from '../components/TaskModelSharing';
import { blueprintFromTemplate, normalizeTaskBlueprint, type TaskBlueprint } from '../../shared/taskBlueprint.mjs';
import { canManageTask, canRemoveTaskFile, distinctObserverIds, taskLink } from '../../shared/taskCollaboration.mjs';
import { uploadChatMedia } from '../lib/chatApi';
import { TASK_UPLOAD_ACCEPT, taskUploadType, safeTaskFileUrl, taskMediaKind, descriptionImageMarkdown } from '../../shared/taskMedia.mjs';
import { dayKey, isFinished, isTaskMine } from '../../shared/personalWork.mjs';
import { appendTaskChecklists } from '../../shared/taskChecklist.mjs';
import { parseTaskDeadline, taskDeadlineInput, taskDeadlineValue } from '../../shared/taskDates.mjs';
import './tasks.css';
import './task-detail.css';
import './task-conversation.css';
import './people-workspace.css';
import './tasks-density.css';

/* ── types ─────────────────────────────────────────────────────────────── */
interface ChecklistItem { id: string; content: string; completed: boolean; assignee_id?: string; assignee?: TaskUser; sort_order: number; participant_ids?: string[]; observer_ids?: string[]; }
interface Checklist { id: string; title: string; sort_order: number; items: ChecklistItem[]; }
interface TaskComment { id: string; content: string; created_at: string; user: { id: string; name: string; photo_url?: string }; }
interface TaskFile { id: string; name: string; file_url: string; file_type?: string; file_size?: number; uploader_name?: string; uploader_photo?: string; created_at?: string; checklist_item_id?: string | null; uploaded_by?: string; }
interface TaskUser { id: string; name: string; photo_url?: string; }
interface Task {
  id: string; title: string; description?: string;
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_by?: string; owner_id?: string; deadline?: string;
  created_at: string; updated_at: string;
  owner?: TaskUser; creator?: TaskUser;
  assignees: TaskUser[];
  observers?: TaskUser[];
  checklists: Checklist[];
  comments: TaskComment[];
  custom_list_id?: string | null;
  custom_list_name?: string | null;
  protocol?: string;
}

interface CustomList { id: string; name: string; position: number; created_at: string; }
interface TaskTemplate { id: string; title: string; description: string; priority: string; category: string; created_by?: string; created_at: string; assigned_to?: string | null; assignee_ids?: string[]; checklist_items?: unknown[]; task_snapshot?: TaskBlueprint; shared_user_ids?: string[]; can_manage?: boolean; is_shared: boolean; assigned_user?: { id: string; name: string; photo_url?: string } | null; }
const templateApi = {
  list: () => apiGet<{ data: TaskTemplate[] }>('/tasks/templates').then(r => r.data ?? []),
  create: (input: object) => apiPost<{ data: TaskTemplate }>('/tasks/templates', input).then(r => r.data!),
  share: (id: string, input: object) => apiPut<{data: TaskTemplate}>(`/tasks/templates/${id}/sharing`, input).then(r=>r.data),
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
  addItem: (taskId: string, clId: string, content: string, people: object = {}) =>
    apiPost<{ data: Task }>(`/tasks/${taskId}/checklists/${clId}/items`, { ...people, content }).then(r => r.data!),
  setItemPeople: (taskId: string, clId: string, itemId: string, people: object) =>
    apiPatch<{ data: Task }>(`/tasks/${taskId}/checklists/${clId}/items/${itemId}`, people).then(r => r.data!),
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
const STATUS_LABELS: Record<string, string> = { todo: 'A Fazer', in_progress: 'Em Andamento', done: 'Concluída', cancelled: 'Cancelada' };
const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  cancelled: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
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
  { id: 'cancelled', label: 'Canceladas', color: 'border-t-slate-400' },
];

/* ── helpers ────────────────────────────────────────────────────────────── */
function fmtDate(dateStr?: string) {
  if (!dateStr) return '';
  return parseTaskDeadline(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtDateTime(dateStr?: string) {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return fmtDate(dateStr);
  const d = parseTaskDeadline(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function deadlineColumn(task: Task): string {
  if (task.status === 'cancelled') return 'cancelled';
  if (task.status === 'done') return 'done';
  if (!task.deadline) return 'none';
  const now = new Date();
  const dl = new Date(`${dayKey(task.deadline)}T12:00:00`);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7); weekEnd.setHours(23, 59, 59, 999);
  if (dayKey(task.deadline)! < dayKey()!) return 'overdue';
  if (dl <= todayEnd) return 'today';
  if (dl <= weekEnd) return 'week';
  return 'later';
}
function isOverdue(task: Task) {
  return !isFinished(task.status) && !!dayKey(task.deadline) && dayKey(task.deadline)! < dayKey()!;
}
function isNearDeadline(task: Task) {
  if (isFinished(task.status) || !task.deadline) return false;
  const dl = parseTaskDeadline(task.deadline);
  const now = new Date();
  if (dl < now) return false;
  return (dl.getTime() - now.getTime()) <= 2 * 24 * 60 * 60 * 1000;
}
function checklistProgress(cl: Checklist) {
  if (!cl.items.length) return { done: 0, total: 0 };
  return { done: cl.items.filter(i => i.completed).length, total: cl.items.length };
}

function TaskDeadlineEditor({ value, onSave }: { value?: string; onSave: (deadline: string | null) => Promise<boolean> }) {
  const [draft, setDraft] = useState(() => taskDeadlineInput(value));
  useEffect(() => { setDraft(taskDeadlineInput(value)); }, [value]);
  const changed = draft !== taskDeadlineInput(value);
  return <div className="space-y-2">
    <input aria-label="Prazo da tarefa" type="datetime-local" value={draft} onChange={event => setDraft(event.target.value)}
      className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-orange-400 hover:border-orange-300 transition-colors" />
    {changed && <button type="button" onClick={() => { void onSave(taskDeadlineValue(draft)); }} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500">Salvar prazo</button>}
  </div>;
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
function MultiUserPicker({ users, value, onChange, label = 'participantes' }: {
  users: UserType[]; value: string[]; onChange: (ids: string[]) => void; label?: string;
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
      >
        {selected.length ? selected.map(u => (
          <div key={u.id} className="flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 pl-0.5 pr-1.5 py-0.5">
            <Avatar user={u} size={5} />
            <span className="text-xs text-blue-800 dark:text-blue-300">{u.name.split(' ')[0]}</span>
            <button
              type="button"
              aria-label={`Remover ${u.name} de ${label}`}
              onClick={e => { e.stopPropagation(); toggle(u.id); }}
              className="ml-0.5 text-blue-400 hover:text-blue-600 transition-colors"
            >
              <X size={10} />
            </button>
          </div>
        )) : null}
        <button type="button" aria-label={`Selecionar ${label}`} aria-expanded={open} onClick={() => setOpen(o => !o)} className="task-people-select text-sm text-slate-400 dark:text-slate-400 self-center px-1">{selected.length ? '+ Adicionar' : `Selecionar ${label}…`}</button>
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
      title={task.title}
      className={cn(
        'task-card w-full rounded-xl border border-slate-200 dark:border-slate-700 border-l-4 p-3 text-left shadow-sm relative',
        'hover:shadow-lg transition-all duration-200 space-y-2.5 group active:scale-[0.98]',
        style.border, style.bg, style.pulse
      )}
    >
      {overdue && (
        <span className="absolute inset-0 rounded-xl animate-pulse pointer-events-none shadow-[inset_0_0_0_1px_rgba(239,68,68,0.45)]" />
      )}
      <p className="task-card-title text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
        {task.title}
      </p>

      <div className="task-card-badges flex items-center gap-1.5 flex-wrap">
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', STATUS_COLORS[task.status])}>
          {STATUS_LABELS[task.status] || task.status || 'Não informado'}
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

      <div className="task-card-dates space-y-0.5">
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
        <div className="task-card-footer flex items-center justify-between pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
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
  onTemplatesChanged?: () => void;
}

function TaskDetail({ task, users, onClose, onUpdate, onDelete, customLists = [], onTemplatesChanged }: TaskDetailProps) {
  const { user: me } = useAuth();
  const canEdit = canManageTask(task, me);
  const [copyFeedback, setCopyFeedback] = useState({ text: '', error: false });
  const [checklistUploading, setChecklistUploading] = useState(false);
  const checklistUploadBusy = useRef(false);
  const [editTitle, setEditTitle] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [editDesc, setEditDesc] = useState(false);
  const [pastingDescription, setPastingDescription] = useState(false);
  const descriptionInput = useRef<HTMLTextAreaElement>(null), descriptionImageInput = useRef<HTMLInputElement>(null), descriptionUploadBusy = useRef(false);
  const [newCl, setNewCl] = useState('');
  const [addingCl, setAddingCl] = useState(false);
  const [newItems, setNewItems] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const changingRef = useRef(false);
  const mutationVersion = useRef(0), uploadCount = useRef(0);
  const [changeError, setChangeError] = useState('');
  const [activeTab, setActiveTab] = useState<'detail' | 'files' | 'media'>('detail');
  const [showConversation, setShowConversation] = useState(false);
  const [showProps, setShowProps] = useState(false);
  const [copiedChecklist, setCopiedChecklist] = useState<Checklist | null>(null);
  const [taskFiles, setTaskFiles] = useState<TaskFile[]>([]);
  const [filesLoaded, setFilesLoaded] = useState(false);
  const [filesError, setFilesError] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const taskFileInput = useRef<HTMLInputElement>(null);
  const [addingFile, setAddingFile] = useState(false);
  const [newFileUrl, setNewFileUrl] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveModalTitle, setSaveModalTitle] = useState('');
  const [saveModalShared, setSaveModalShared] = useState(false);
  const [saveModalRecipients, setSaveModalRecipients] = useState<string[]>([]);
  const [templateError, setTemplateError] = useState('');
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
    observer_ids: [] as string[],
  });

  async function runChange(operation: () => Promise<Task | undefined>) {
    if (uploadCount.current) { setChangeError('Aguarde o envio dos anexos para alterar a tarefa.'); return false; }
    if (changingRef.current) return false;
    changingRef.current = true; mutationVersion.current++; setSaving(true); setChangeError('');
    try {
      const updated = await operation();
      if (!updated) throw new Error('Não foi possível confirmar a alteração. Atualize a tarefa e tente novamente.');
      onUpdate(updated); return true;
    } catch (error) {
      setChangeError(error instanceof Error ? error.message : 'Não foi possível salvar a alteração. Tente novamente.');
      return false;
    } finally { changingRef.current = false; setSaving(false); }
  }
  async function patch(input: object) { return runChange(() => api.update(task.id, input)); }

  async function saveTitle() {
    if (title.trim() && title !== task.title && !await patch({ title: title.trim() })) return;
    setEditTitle(false);
  }
  async function saveDesc() {
    if (pastingDescription) return;
    if (description.length > 10000) { setChangeError('A descrição pode ter até 10.000 caracteres, incluindo as referências das imagens.'); return; }
    if (await patch({ description })) setEditDesc(false);
  }
  useEffect(() => { if (!editDesc) setDescription(task.description || ''); }, [task.description, editDesc]);
  async function pasteDescriptionImages(files: File[], start = description.length, end = start) {
    if (descriptionUploadBusy.current || saving) return;
    const permitted = me && (['Administrador', 'Gestor'].includes(me.role_name || '') || task.owner_id === me.id || task.created_by === me.id);
    if (!permitted) { setChangeError('Somente o responsável, o criador ou um administrador pode editar a descrição.'); return; }
    const images = files.filter(file => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type));
    if (!images.length) { setChangeError('Cole ou selecione uma imagem PNG, JPEG, WebP ou GIF.'); return; }
    descriptionUploadBusy.current = true; setPastingDescription(true); setEditDesc(true); setChangeError('');
    let draft = description;
    try {
      let position = Math.min(start, draft.length), selectionEnd = Math.min(end, draft.length);
      for (const image of images) {
        const saved = await uploadTaskFile(image), reference = descriptionImageMarkdown(saved);
        const next = draft.slice(0, position) + reference + draft.slice(selectionEnd);
        if (next.length > 10000) throw new Error('A imagem foi salva em Arquivos, mas a descrição atingiu o limite de 10.000 caracteres. Remova parte do texto antes de inserir a imagem.');
        draft = next; setDescription(draft); position += reference.length; selectionEnd = position;
      }
    } catch (error) { setChangeError(error instanceof Error ? error.message : 'Não foi possível colar a imagem. Seu texto foi preservado.'); }
    finally { descriptionUploadBusy.current = false; setPastingDescription(false); if (descriptionImageInput.current) descriptionImageInput.current.value = ''; }
  }

  async function handleAddChecklist(e: FormEvent) {
    e.preventDefault();
    if (!newCl.trim()) return;
    if (await runChange(() => api.addChecklist(task.id, newCl.trim()))) { setNewCl(''); setAddingCl(false); }
  }
  async function handleToggleItem(cl: Checklist, item: ChecklistItem) {
    await runChange(() => api.toggleItem(task.id, cl.id, item.id, !item.completed));
  }
  async function handleSetItemAssignee(cl: Checklist, item: ChecklistItem, assigneeId: string) {
    await runChange(() => api.setItemAssignee(task.id, cl.id, item.id, assigneeId || null));
  }
  async function handleAddItem(cl: Checklist) {
    const content = newItems[cl.id]?.trim();
    if (!content) return;
    if (await runChange(() => api.addItem(task.id, cl.id, content))) setNewItems(prev => ({ ...prev, [cl.id]: '' }));
  }
  async function handleDeleteItem(cl: Checklist, itemId: string) {
    await runChange(() => api.deleteItem(task.id, cl.id, itemId));
  }
  async function handleUpdateItem(cl: Checklist, item: ChecklistItem, content: string) {
    if (!content.trim() || content.trim() === item.content) { setEditingItem(null); return; }
    if (await runChange(() => api.updateItem(task.id, cl.id, item.id, content.trim()))) setEditingItem(null);
  }

  async function handleUpdateChecklist(cl: Checklist, title: string) {
    if (!title.trim() || title.trim() === cl.title) { setEditingCl(null); return; }
    if (await runChange(() => api.updateChecklist(task.id, cl.id, title.trim()))) setEditingCl(null);
  }

  async function handleSaveEdit() {
    const saved = await patch({
      title: editForm.title.trim() || task.title,
      description: editForm.description,
      priority: editForm.priority,
      status: editForm.status,
      deadline: taskDeadlineValue(editForm.deadline),
      owner_id: editForm.owner_id || null,
      assignee_ids: editForm.assignee_ids,
      observer_ids: editForm.observer_ids,
    });
    if (saved) setShowEditModal(false);
  }

  async function handleSaveAsTemplate() {
    if (savingTemplate || !saveModalTitle.trim()) return;
    setSavingTemplate(true);
    setTemplateError('');
    try {
      await templateApi.create({
        title: saveModalTitle.trim(),
        description: task.description || '',
        priority: task.priority || 'normal',
        category: 'Geral',
        is_shared: saveModalShared,
        shared_user_ids: saveModalRecipients,
        source_task_id: task.id,
        checklist_items: task.checklists.map(cl => ({
          title: cl.title,
          items: cl.items.map(i => i.content),
        })),
        assignee_ids: task.assignees?.map((a) => a.id) ?? [],
      });
      setShowSaveModal(false);
      setSaveModalTitle('');
      onTemplatesChanged?.();
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : 'Não foi possível copiar a tarefa como modelo.');
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleDeleteChecklist(clId: string) {
    await runChange(() => api.deleteChecklist(task.id, clId));
  }
  useEffect(() => {
    let active = true;
    const version = mutationVersion.current;
    api.listFiles(task.id).then(files => { if (active && version === mutationVersion.current) { setTaskFiles(files); setFilesLoaded(true); setFilesError(''); } })
      .catch(() => { if (active) setFilesError('Não foi possível carregar os arquivos da tarefa.'); });
    return () => { active = false; };
  }, [task.id]);
  useEffect(() => {
    let active = true, refreshing = false;
    const refresh = async () => {
      if (document.visibilityState === 'hidden' || changingRef.current || uploadCount.current || refreshing) return;
      refreshing = true;
      const version = mutationVersion.current;
      try {
        const [response, files] = await Promise.all([apiGet<{ data: Task }>(`/tasks/${task.id}`), api.listFiles(task.id)]);
        if (active && !changingRef.current && version === mutationVersion.current) { onUpdate(response.data); setTaskFiles(files); setFilesLoaded(true); setRefreshError(''); }
      } catch { if (active) setRefreshError('A atualização automática está indisponível. Seu texto foi preservado.'); }
      finally { refreshing = false; }
    };
    const timer = window.setInterval(() => { void refresh(); }, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [task.id, onUpdate]);
  async function refreshConversation() {
    if (changingRef.current || uploadCount.current) return;
    const version = mutationVersion.current;
    try {
      const [response, files] = await Promise.all([apiGet<{ data: Task }>(`/tasks/${task.id}`), api.listFiles(task.id)]);
      if (!changingRef.current && version === mutationVersion.current) { onUpdate(response.data); setTaskFiles(files); setFilesLoaded(true); setFilesError(''); setRefreshError(''); }
    } catch { setRefreshError('Não foi possível atualizar a conversa. Tente novamente.'); }
  }
  async function uploadTaskFile(file: File, checklistItemId?: string) {
    const type = taskUploadType(file);
    const source = file.type ? file : new File([file], file.name, { type });
    mutationVersion.current++; uploadCount.current++;
    try {
      const url = await uploadChatMedia(source);
      if (!safeTaskFileUrl(url)) throw new Error('O servidor não retornou o endereço do arquivo.');
      const saved = await api.addFile(task.id, { name: file.name, file_url: url, file_type: type, file_size: file.size, ...(checklistItemId ? { checklist_item_id: checklistItemId } : {}) });
      setTaskFiles(files => [...files, saved]); setFilesLoaded(true);
      return saved;
    } finally { uploadCount.current--; }
  }
  async function uploadTaskFiles(files: File[]) {
    if (uploadingFile) return;
    setUploadingFile(true); setFilesError('');
    try { for (const file of files) await uploadTaskFile(file); }
    catch (error) { setFilesError(error instanceof Error ? error.message : 'Não foi possível enviar o arquivo.'); }
    finally { setUploadingFile(false); if (taskFileInput.current) taskFileInput.current.value = ''; }
  }
  async function uploadChecklistMedia(itemId: string, files: File[]) {
    if (!canEdit || changingRef.current || checklistUploadBusy.current) throw new Error('Aguarde a alteração atual antes de anexar arquivos.');
    checklistUploadBusy.current = true; setChecklistUploading(true);
    try { for (const file of files) await uploadTaskFile(file, itemId); }
    finally { checklistUploadBusy.current = false; setChecklistUploading(false); }
  }
  async function copyTaskValue(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setCopyFeedback({ text: `${label} copiado.`, error: false }); }
    catch { setCopyFeedback({ text: 'Não foi possível copiar automaticamente. Selecione o link abaixo e copie.', error: true }); }
  }
  async function removeTaskFile(file: TaskFile) {
    if (!window.confirm(`Remover o vínculo de "${file.name}" desta tarefa?`)) return;
    mutationVersion.current++;
    try { await api.removeFile(task.id, file.id); setTaskFiles(files => files.filter(item => item.id !== file.id)); }
    catch (error) { const message = error instanceof Error ? error.message : 'Não foi possível remover o arquivo.'; setFilesError(message); setChangeError(message); }
  }

  const totalItems = task.checklists.reduce((s, cl) => s + cl.items.length, 0);
  const doneItems = task.checklists.reduce((s, cl) => s + cl.items.filter(i => i.completed).length, 0);

  const propertiesPanel = (
    <fieldset disabled={saving || checklistUploading || !canEdit} className="task-properties p-5 space-y-5">
      <div className="task-properties-heading"><span>ACOMPANHAMENTO</span><h3>Organize a entrega</h3><p>Status, pessoas e prazo em um só lugar.</p></div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">Status</p>
        <select aria-label="Status da tarefa" value={task.status} onChange={e => patch({ status: e.target.value })}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-orange-400 hover:border-orange-300 transition-colors cursor-pointer">
          <option value="todo">A Fazer</option>
          <option value="in_progress">Em Andamento</option>
          <option value="done">Concluída</option>
          <option value="cancelled">Cancelada</option>
        </select>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">Prioridade</p>
        <select aria-label="Prioridade da tarefa" value={task.priority} onChange={e => patch({ priority: e.target.value })}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-orange-400 hover:border-orange-300 transition-colors cursor-pointer">
          <option value="low">Baixa</option>
          <option value="normal">Normal</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </select>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">Prazo</p>
        <TaskDeadlineEditor value={task.deadline} onSave={deadline => patch({ deadline })} />
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">Responsável</p>
        <UserPicker users={users} value={task.owner_id || ''} onChange={(id) => patch({ owner_id: id || null })} placeholder="Ninguém" />
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">Participantes</p>
        <MultiUserPicker users={users} value={task.assignees.map(a => a.id)} onChange={(ids) => patch({ assignee_ids: ids })} />
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">Observadores</p>
        <MultiUserPicker label="observadores" users={users.filter(person => person.id !== task.owner_id && person.id !== task.created_by && !task.assignees.some(a => a.id === person.id))} value={(task.observers || []).map(person => person.id)} onChange={ids => patch({ observer_ids: ids })} />
        <p className="task-role-help">Acompanham, recebem notificações e podem comentar, sem assumir a execução da tarefa.</p>
      </div>
      {customLists.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">Lista</p>
          <select aria-label="Lista da tarefa" value={task.custom_list_id || ''} onChange={e => patch({ custom_list_id: e.target.value || null })}
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
      <div className="task-status-actions flex gap-2">
        <button onClick={() => patch({ status: 'in_progress' })} disabled={task.status === 'in_progress'}
          className="flex-1 h-9 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-40 active:scale-95 transition-all duration-200">
          Iniciar
        </button>
        <button onClick={() => patch({ status: 'done' })} disabled={task.status === 'done'}
          className="flex-1 h-9 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-40 active:scale-95 transition-all duration-200">
          Concluir
        </button>
      </div>
    </fieldset>
  );

  return (
    <AccessibleModal title={task.title} onClose={onClose} className="nex-task-detail task-detail-dialog task-collaboration-dialog fixed z-50 outline-none">

      <div className="task-detail-shell relative flex h-full w-full flex-col sm:flex-row bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-blue-400 to-orange-400 z-10" />

        {/* Left: detail */}
        <div className="task-detail-main flex flex-col flex-1 min-w-0 overflow-hidden pt-1" data-mobile-hidden={showConversation}>
          <div className="task-detail-heading flex items-start gap-3 border-b border-slate-100 dark:border-slate-700 px-4 sm:px-6 py-4">
            <div className="flex-1 min-w-0">
              <span className="task-detail-eyebrow">TAREFA / ESPAÇO DE TRABALHO</span>
              {editTitle ? (
                <input
                  autoFocus value={title}
                  onChange={e => setTitle(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitle(task.title); setEditTitle(false); } }}
                  className="w-full text-lg font-bold text-slate-900 dark:text-slate-100 dark:bg-transparent outline-none border-b-2 border-orange-400 pb-0.5"
                />
              ) : (
                <button disabled={!canEdit} onClick={() => setEditTitle(true)} className="text-left group">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-orange-600 transition-colors">{task.title}</h2>
                </button>
              )}
              <div className="task-identity">
                <button type="button" title={task.id} aria-label="Copiar ID da tarefa" onClick={() => { void copyTaskValue(task.id, 'ID'); }}><Copy size={13} /><span>ID: {task.id}</span></button>
                <button type="button" onClick={() => { void copyTaskValue(window.location.origin + taskLink(task.id), 'Link'); }}><Link size={14} />Copiar link</button>
                {task.protocol && <span className="task-protocol">{task.protocol}</span>}
              </div>
              {copyFeedback.text && <p className="task-copy-feedback" role={copyFeedback.error ? 'alert' : 'status'}>{copyFeedback.text}</p>}
              {copyFeedback.error && <input className="task-copy-fallback" aria-label="Link direto da tarefa" readOnly value={window.location.origin + taskLink(task.id)} onFocus={event => event.target.select()} />}
            </div>
            <div className="task-heading-actions flex items-center gap-1 flex-shrink-0">
              {saving && <Loader2 size={15} className="animate-spin text-orange-400" />}
              <button
                onClick={() => {
                  setEditForm({
                    title: task.title,
                    description: task.description || '',
                    priority: task.priority || 'normal',
                    status: task.status || 'todo',
                    deadline: taskDeadlineInput(task.deadline),
                    owner_id: task.owner_id || '',
                    assignee_ids: task.assignees.map(a => a.id),
                    observer_ids: (task.observers || []).map(person => person.id),
                  });
                  setShowEditModal(true);
                }}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-all duration-200"
                disabled={!canEdit || saving || checklistUploading} title="Editar tarefa" aria-label="Editar tarefa">
                <Pencil size={14} />
              </button>
              <button
                onClick={() => { setSaveModalTitle(task.title); setShowSaveModal(true); }}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600 transition-all duration-200"
                title="Copiar tarefa como modelo" aria-label="Copiar tarefa como modelo">
                <BookmarkPlus size={15} />
              </button>
              {/* Mobile: toggle properties panel */}
              <button className="task-chat-open" onClick={() => setShowConversation(true)} aria-label="Abrir bate-papo da tarefa"><MessageSquare size={17} />Conversa</button>
              <button
                onClick={() => setShowProps(p => !p)} aria-expanded={showProps}
                className="sm:hidden h-8 px-2 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 text-xs font-semibold"
              >
                {showProps ? 'Voltar' : 'Configurar'}
              </button>
              <button
                onClick={() => { if (confirm('Excluir tarefa?')) { onDelete(task.id); onClose(); } }} disabled={!canEdit || saving || checklistUploading} aria-label="Excluir tarefa"
                className="h-8 w-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-all duration-200 active:scale-90"
              >
                <Trash2 size={15} />
              </button>
              <button
                onClick={onClose} aria-label="Fechar tarefa"
                className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 active:scale-90"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {changeError && <p className="task-change-error" role="alert">{changeError}</p>}
          <div className="task-detail-overview" aria-label="Resumo da tarefa"><span data-status={task.status}>{STATUS_LABELS[task.status]}</span><span><Flag size={14} />{PRIORITY_LABELS[task.priority]}</span><span><CheckSquare size={15} />{totalItems ? `${doneItems} de ${totalItems} etapas` : 'Sem etapas cadastradas'}</span>{saving && <span role="status">Salvando…</span>}</div>
          {/* Mobile properties panel (toggled) */}
          {showProps && (
            <div className="task-mobile-properties sm:hidden overflow-y-auto border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900">
              {propertiesPanel}
            </div>
          )}

          {!showProps && (
            <>
              <div className="task-detail-tabs flex border-b border-slate-100 dark:border-slate-700 px-4 sm:px-6">
                {(['detail', 'files', 'media'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} aria-pressed={activeTab === tab}
                    className={cn('py-2.5 px-4 text-sm font-semibold border-b-2 -mb-px transition-all duration-200',
                      activeTab === tab ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200')}>
                    {tab === 'detail' ? 'Visão geral' : tab === 'media' ? 'Mídias' : `Arquivos (${taskFiles.length})`}
                  </button>
                ))}
              </div>

              <div className="task-detail-content flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {activeTab === 'detail' ? (
                  <>
                    <section className="task-description-section" onPaste={event => {
                      const files = Array.from(event.clipboardData.files);
                      if (files.some(file => file.type.startsWith('image/'))) {
                        event.preventDefault(); event.stopPropagation();
                        const input = descriptionInput.current;
                        void pasteDescriptionImages(files, editDesc ? input?.selectionStart : undefined, editDesc ? input?.selectionEnd : undefined);
                      }
                    }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void pasteDescriptionImages(Array.from(event.dataTransfer.files)); }}>
                      <div className="task-description-toolbar"><p>DESCRIÇÃO</p><button type="button" disabled={!canEdit || pastingDescription || saving || checklistUploading} onClick={() => descriptionImageInput.current?.click()}><Images size={16} />Inserir imagem</button></div>
                      <input hidden ref={descriptionImageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Inserir imagem na descrição" multiple onChange={event => { void pasteDescriptionImages(Array.from(event.target.files || [])); }} />
                      {editDesc ? (
                        <div className="space-y-2">
                          <textarea ref={descriptionInput} value={description} disabled={pastingDescription} aria-label="Descrição da tarefa" maxLength={10000} onChange={e => setDescription(e.target.value)} rows={5}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-orange-400 resize-none transition-colors" />
                          <div className="flex gap-2">
                            <button onClick={saveDesc} disabled={saving || pastingDescription} className="h-8 px-4 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-all duration-200">Salvar descrição</button>
                            <button disabled={saving || pastingDescription} onClick={() => { setDescription(task.description || ''); setEditDesc(false); }} className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
                          </div>
                          <p className="task-description-hint" role={pastingDescription ? 'status' : undefined}>{pastingDescription ? 'Enviando a imagem para a tarefa…' : 'Cole com Ctrl + V ou Colar do mouse. Imagens já enviadas ficam em Arquivos; salve a descrição para publicar a posição delas.'}</p>
                          {description.includes('![') && <div className="task-description-preview"><strong>PRÉVIA DA DESCRIÇÃO</strong><TaskDescription value={description} /></div>}
                        </div>
                      ) : (
                        <div className="task-description-read" tabIndex={0} aria-label="Descrição da tarefa. Cole uma imagem aqui.">
                          {description ? <TaskDescription value={description} /> : <p>Descreva a entrega e cole os prints de referência aqui.</p>}
                          <button disabled={!canEdit || checklistUploading} onClick={() => setEditDesc(true)} aria-label="Editar descrição da tarefa">Editar descrição</button>
                        </div>
                      )}
                    </section>

                    <fieldset disabled={!canEdit || saving || checklistUploading} className="task-checklists-section">
                      <div className="task-checklists-heading flex items-center justify-between mb-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                          Checklists {totalItems > 0 && `(${doneItems}/${totalItems})`}
                        </p>
                        {copiedChecklist && (
                          <button
                            disabled={saving} onClick={async () => {
                              const saved = await runChange(() => appendTaskChecklists(task, [{ title: copiedChecklist.title, items: copiedChecklist.items.map(item => ({ content: item.content, assignee_id: item.assignee_id, participant_ids: item.participant_ids, observer_ids: item.observer_ids })) }], api));
                              if (saved) setCopiedChecklist(null);
                            }}
                            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700 transition-colors">
                            <Copy size={13} /> Colar "{copiedChecklist.title}"
                          </button>
                        )}
                        <button onClick={() => setAddingCl(true)} disabled={saving} className="task-add-checklist flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 font-semibold hover:text-orange-700 transition-colors">
                          <Plus size={16} /> Nova checklist
                        </button>
                      </div>
                      {addingCl && (
                        <form onSubmit={handleAddChecklist} className="mb-3 flex gap-2">
                          <input autoFocus value={newCl} onChange={e => setNewCl(e.target.value)}
                            placeholder="Nome da checklist" className="flex-1 h-9 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 text-sm outline-none focus:border-orange-400 transition-colors" />
                          <button type="submit" disabled={saving || !newCl.trim()} className="h-9 px-4 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-all duration-200">Criar</button>
                          <button type="button" onClick={() => setAddingCl(false)} className="h-9 w-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            <X size={14} />
                          </button>
                        </form>
                      )}
                      {task.checklists.map(cl => {
                        const prog = checklistProgress(cl);
                        const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;
                        return (
                          <div key={cl.id} className="task-checklist mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/40 p-3 transition-all duration-200">
                            <div className="task-checklist-heading flex items-center gap-2 mb-2">
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
                                <button type="button" aria-label={`Renomear checklist ${cl.title}`}
                                  onClick={() => setEditingCl({ id: cl.id, title: cl.title })}
                                  className="text-sm font-bold text-slate-700 dark:text-slate-200 flex-1 cursor-text hover:text-orange-600 dark:hover:text-orange-400 select-none">
                                  {cl.title}
                                </button>
                              )}
                              {prog.total > 0 && <span className="text-xs text-slate-500 dark:text-slate-400">{prog.done}/{prog.total}</span>}
                              <button onClick={() => setCopiedChecklist(cl)} className="task-checklist-icon text-slate-400 hover:text-blue-500 transition-colors" title="Copiar etapas" aria-label={`Copiar checklist ${cl.title}`}>
                                <Copy size={13} />
                              </button>
                              <button disabled={saving} onClick={() => handleDeleteChecklist(cl.id)} className="task-checklist-icon text-slate-400 hover:text-red-500 transition-colors" aria-label={`Excluir checklist ${cl.title}`}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                            {prog.total > 0 && (
                              <div className="task-checklist-progress mb-3 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-label={`Progresso de ${cl.title}`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                                <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-orange-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                              </div>
                            )}
                            <div className="space-y-1">
                              {cl.items.map(item => (
                                <div key={item.id} className="task-checklist-step">
                                <div className="task-checklist-item flex items-center gap-2 group rounded-lg px-2 py-1 transition-all duration-150" data-completed={item.completed}>
                                  <button onClick={() => handleToggleItem(cl, item)} disabled={saving} role="checkbox" aria-checked={item.completed} aria-label={item.content}
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
                                    <button type="button" disabled={item.completed} aria-label={`Editar etapa ${item.content}`}
                                      onClick={() => !item.completed && setEditingItem({ clId: cl.id, itemId: item.id, content: item.content })}
                                      className={cn('text-sm flex-1 transition-all duration-200 dark:text-slate-300 select-none',
                                        item.completed
                                          ? 'line-through text-slate-400 dark:text-slate-500 cursor-default'
                                          : 'cursor-text hover:text-orange-600 dark:hover:text-orange-400'
                                      )}>
                                      {item.content}
                                    </button>
                                  )}
                                  <ItemAssigneePicker users={users} value={item.assignee_id || ''} onChange={(id) => handleSetItemAssignee(cl, item, id)} />
                                  <button onClick={() => handleDeleteItem(cl, item.id)} disabled={saving} aria-label={`Excluir etapa ${item.content}`}
                                    className="task-checklist-remove text-slate-400 hover:text-red-500 transition-all duration-150 flex-shrink-0">
                                    <X size={12} />
                                  </button>
                                </div>
                                <ChecklistPeopleFields users={users} item={item} showResponsible={false} onChange={input => { void runChange(() => api.setItemPeople(task.id,cl.id,item.id,input)); }} />
                                <ChecklistItemMedia title={item.content} files={taskFiles.filter(file => file.checklist_item_id === item.id)} editable={canEdit} disabled={saving || checklistUploading} onUpload={files => uploadChecklistMedia(item.id, files)} onRemove={file => { void removeTaskFile(file); }} />
                                </div>
                              ))}
                            </div>
                            <div className="task-checklist-add mt-2 flex gap-2">
                              <input
                                value={newItems[cl.id] || ''}
                                onChange={e => setNewItems(p => ({ ...p, [cl.id]: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(cl); } }}
                                aria-label={`Nova etapa em ${cl.title}`} placeholder="Adicionar uma etapa…" className="flex-1 h-8 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-400 px-3 text-xs outline-none focus:border-orange-400 transition-colors" />
                              <button onClick={() => handleAddItem(cl)} disabled={saving || !newItems[cl.id]?.trim()} aria-label={`Adicionar etapa em ${cl.title}`} className="h-8 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600 hover:border-orange-200 transition-all duration-200">
                                <Plus size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {!task.checklists.length && <div className="task-checklist-empty"><CheckSquare size={26} /><h4>Divida a entrega em etapas</h4><p>Crie uma checklist para acompanhar o que já foi feito e o que falta concluir.</p></div>}
                    </fieldset>
                    <section className="task-inline-properties" aria-label="Propriedades da tarefa">{propertiesPanel}</section>
                  </>
                ) : (
                  <div className="task-file-library space-y-3" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void uploadTaskFiles(Array.from(e.dataTransfer.files)); }}>
                    <div className="task-file-library-heading"><div><h3>{activeTab === 'media' ? 'Mídias da tarefa' : 'Arquivos e documentos'}</h3><p>Envie do computador ou arraste arquivos para este painel.</p></div><button onClick={() => taskFileInput.current?.click()} disabled={uploadingFile}><Paperclip size={16} />Enviar arquivo</button></div>
                    <input hidden ref={taskFileInput} type="file" multiple accept={TASK_UPLOAD_ACCEPT} aria-label="Selecionar arquivos da tarefa" onChange={e => { void uploadTaskFiles(Array.from(e.target.files || [])); }} />
                    {uploadingFile && <p role="status">Salvando arquivo na tarefa…</p>}
                    {filesError && <p className="task-chat-error" role="alert">{filesError}<button onClick={refreshConversation}>Tentar novamente</button></p>}
                    {!filesLoaded && !filesError && (
                      <div className="py-8 text-center"><Loader2 size={18} className="animate-spin text-slate-400 mx-auto" /></div>
                    )}
                    {filesLoaded && taskFiles.filter(file => activeTab !== 'media' || taskMediaKind(file) !== 'file').map(file => <TaskFileCard key={file.id} file={file} onRemove={canRemoveTaskFile(task, me, file) ? () => { void removeTaskFile(file); } : undefined} />)}
                    {filesLoaded && !filesError && !taskFiles.some(file => activeTab !== 'media' || taskMediaKind(file) !== 'file') && !addingFile && (
                      <div className="task-checklist-empty"><Images size={28} /><h4>{activeTab === 'media' ? 'Nenhuma mídia anexada' : 'Nenhum arquivo anexado'}</h4><p>Imagens, vídeos, áudio, PDF, Word e Excel. Até 20 MB por arquivo.</p></div>
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
                              const url = safeTaskFileUrl(newFileUrl);
                              if (!url) { setFilesError('Informe um link HTTP ou HTTPS válido.'); return; }
                              try {
                                mutationVersion.current++;
                                const f = await api.addFile(task.id, { name: newFileName.trim(), file_url: url });
                                setTaskFiles(prev => [...prev, f]); setFilesError('');
                                setNewFileName(''); setNewFileUrl(''); setAddingFile(false);
                              } catch (error) { setFilesError(error instanceof Error ? error.message : 'Não foi possível salvar o link.'); }
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
                )}
              </div>
            </>
          )}
        </div>

        <TaskConversation comments={task.comments} files={taskFiles} people={Array.from(new Map([task.owner, task.creator, ...task.assignees, ...(task.observers || [])].filter((person): person is TaskUser => Boolean(person)).map(person => [person.id, person])).values())} currentUserId={me?.id} busy={saving || checklistUploading} onSend={content => runChange(() => api.addComment(task.id, content))} onUpload={uploadTaskFile} onClose={onClose} onBack={() => setShowConversation(false)} onRefresh={refreshConversation} refreshError={refreshError} active={showConversation} />
      </div>
      {showSaveModal && (
        <AccessibleModal title="Salvar tarefa como modelo" onClose={() => { if (!savingTemplate) setShowSaveModal(false); }} className="task-sharing-dialog task-copy-template-panel outline-none">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4">Salvar como modelo</h3>
            <p className='task-role-help'>Copia descrição, planejamento, pessoas, checklists e anexos. Não copia comentários, histórico ou etapas concluídas.</p>
            {templateError && <p role='alert' className='task-form-error'>{templateError}</p>}
            <input
              autoFocus
              value={saveModalTitle}
              onChange={e => setSaveModalTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveAsTemplate()}
              placeholder="Nome do modelo..."
              className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 px-3 text-sm outline-none focus:border-orange-400 mb-3 transition-colors"
            />
            <fieldset disabled={savingTemplate}><TaskSharingFields users={users.filter(person=>person.id!==me?.id)} shared={saveModalShared} recipients={saveModalRecipients} onSharedChange={setSaveModalShared} onRecipientsChange={setSaveModalRecipients} /></fieldset>
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
        </AccessibleModal>
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
                  <option value="cancelled">Cancelada</option>
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
            <label className="block mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Observadores</label>
            <div className="mb-5">
              <MultiUserPicker label="observadores" users={users.filter(person => person.id !== editForm.owner_id && person.id !== task.created_by && !editForm.assignee_ids.includes(person.id))} value={distinctObserverIds(editForm.observer_ids, { created_by: task.created_by, owner_id: editForm.owner_id, assignees: editForm.assignee_ids.map(id => ({ id })) })} onChange={ids => setEditForm(f => ({ ...f, observer_ids: ids }))} />
              <p className="task-role-help">Acompanham e comentam sem assumir a execução.</p>
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
function CreateTaskModal({ users, onCreate, onClose, customLists = [], defaultListId = null, initialTitle = '', initialDescription = '', initialAssigneeIds, initialPriority = 'normal', initialDeadline = '', initialChecklists = [], template }: {
  users: UserType[]; onCreate: (task: Task) => void; onClose: () => void; customLists?: CustomList[]; defaultListId?: string | null;
  initialTitle?: string; initialDescription?: string; initialAssigneeIds?: string[]; initialPriority?: string; initialDeadline?: string;
  initialChecklists?: unknown[]; template?: TaskTemplate | null;
}) {
  const { user } = useAuth();
  const initial = template ? blueprintFromTemplate(template) : normalizeTaskBlueprint({ title: initialTitle, description: initialDescription, assignee_ids: initialAssigneeIds || [], priority: initialPriority, deadline: taskDeadlineValue(initialDeadline), checklists: initialChecklists });
  return <TaskComposer users={users} initial={{ ...initial, owner_id: initial.owner_id || user?.id || null }} currentUserId={user?.id} lists={customLists} defaultListId={defaultListId || ''} onClose={onClose}
    onSubmit={async (draft, options) => { const saved = await api.create({ ...draft, custom_list_id: options.custom_list_id, ...(template ? { template_id: template.id } : {}) }); onCreate(saved); }} />;
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
        <div key={col.id} className="task-kanban-column flex flex-col flex-shrink-0 w-72">
          <div className={cn('task-kanban-heading mb-3 rounded-t-xl border-t-4 bg-white dark:bg-slate-800 px-3 py-2 border border-slate-200 dark:border-slate-700 shadow-sm', col.color)}>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{col.label}</p>
              <span className="task-kanban-count ml-auto rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                {columns[col.id]?.length || 0}
              </span>
            </div>
          </div>
          <div className="task-kanban-body flex-1 space-y-2 overflow-y-auto">
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
                  {STATUS_LABELS[t.status] || t.status || 'Não informado'}
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
        const key = parseTaskDeadline(t.deadline).toDateString();
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
  const todayKey = dayKey()!;
  const today = useMemo(() => new Date(`${todayKey}T12:00:00`), [todayKey]);
  const startDate = useMemo(() => {
    const dates = tasks.map(t => new Date(t.created_at)).concat([today]);
    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    min.setDate(1);
    return min;
  }, [tasks, today]);

  const endDate = useMemo(() => {
    const dates = tasks.filter(t => t.deadline).map(t => parseTaskDeadline(t.deadline));
    if (!dates.length) { const d = new Date(today); d.setMonth(d.getMonth() + 2); return d; }
    const max = new Date(Math.max(...dates.map(d => d.getTime())));
    max.setDate(max.getDate() + 7);
    return max;
  }, [tasks, today]);

  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);
  const DAY_W = 24;

  function dayOffset(d: Date) { return Math.ceil((d.getTime() - startDate.getTime()) / 86400000); }

  const weeks: Date[] = [];
  const cur = new Date(startDate);
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
              const end = t.deadline ? dayOffset(parseTaskDeadline(t.deadline)) : start + 7;
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
function TemplateFormModal({ users, onSave, onClose, source }: { users: UserType[]; onSave: () => Promise<void>; onClose: () => void; source?: TaskTemplate | null }) {
  const { user } = useAuth();
  return <TaskComposer mode='template' users={users} currentUserId={user?.id} initial={source ? blueprintFromTemplate(source) : undefined} modelName={source ? `Cópia de ${source.title}` : ''} onClose={onClose}
    onSubmit={async (draft, options) => { await templateApi.create({ title: options.modelName, category: options.category, task_snapshot: draft, is_shared: options.is_shared, shared_user_ids: options.shared_user_ids, ...(source ? { source_template_id: source.id } : {}) }); await onSave(); }} />;
}

function TemplatesView({ templates, users, onUseTemplate, onDelete, onRefresh }: {
  templates: TaskTemplate[]; users: UserType[]; onUseTemplate: (template: TaskTemplate) => void; onDelete: (id: string) => Promise<void>; onRefresh: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [showForm,setShowForm] = useState(false), [copySource,setCopySource] = useState<TaskTemplate|null>(null), [sharing,setSharing] = useState<TaskTemplate|null>(null), [error,setError] = useState('');
  const categories = [...new Set(templates.map(template=>template.category))].sort();
  return <div className='task-model-library'>
    <header><div><span>BIBLIOTECA DE TRABALHO</span><h2>Modelos de tarefa</h2><p>Reutilize a estrutura completa. Compartilhe com a equipe sem modificar o original.</p></div><button type='button' onClick={()=>{setCopySource(null);setShowForm(true);}}><Plus size={18}/> Novo modelo</button></header>
    {error && <p role='alert' className='task-form-error'>{error}</p>}
    {showForm && <TemplateFormModal users={users} source={copySource} onClose={()=>setShowForm(false)} onSave={async()=>{setShowForm(false);try {await onRefresh();}catch {setError('Modelo salvo. Atualize a página para recarregar a biblioteca.');}}} />}
    {sharing && <TaskModelSharing title={sharing.title} users={users.filter(person=>person.id!==user?.id)} initialShared={sharing.is_shared} initialRecipients={sharing.shared_user_ids} onClose={()=>setSharing(null)} onSave={async input=>{await templateApi.share(sharing.id,input);await onRefresh();}} />}
    {!templates.length && <div className='task-composer-empty'><CheckSquare size={28}/><h3>Sua biblioteca começa com uma tarefa</h3><p>Crie um modelo aqui ou use “Copiar tarefa como modelo” em uma tarefa existente.</p></div>}
    {categories.map(category=><section key={category}><h3>{category}</h3><div className='task-model-cards'>{templates.filter(template=>template.category===category).map(template=>{
      const canManage = template.can_manage ?? template.created_by===user?.id;
      return <article key={template.id}><div className='task-model-card-heading'><CheckSquare size={22}/><span>{template.is_shared ? 'Toda a equipe' : template.shared_user_ids?.length ? `${template.shared_user_ids.length} pessoa(s)` : canManage ? 'Privado' : 'Compartilhado com você'}</span></div>
        <h4>{template.title}</h4><p>{template.description || 'Estrutura reutilizável de tarefa.'}</p>
        <small>{template.task_snapshot?.checklists?.length ?? template.checklist_items?.length ?? 0} checklist(s) · {template.task_snapshot?.files?.length || 0} anexo(s)</small>
        <footer><button type='button' onClick={()=>onUseTemplate(template)}>Usar modelo</button><button type='button' aria-label={`Copiar modelo ${template.title}`} onClick={()=>{setCopySource(template);setShowForm(true);}}><Copy size={17}/> Copiar</button>
          {canManage && <button type='button' aria-label={`Compartilhar modelo ${template.title}`} onClick={()=>setSharing(template)}><Share2 size={18}/></button>}
          {canManage && <button type='button' aria-label={`Excluir modelo ${template.title}`} onClick={async()=>{setError('');try {await onDelete(template.id);}catch(err){setError(err instanceof Error ? err.message : 'Não foi possível excluir o modelo.');}}}><Trash2 size={18}/></button>}
        </footer>
      </article>;
    })}</div></section>)}
  </div>;
}

export function Tasks() {
  const { user } = useAuth();
  const [scope, setScope] = useState<'mine' | 'all' | 'observing' | 'overdue' | 'today' | 'done'>('mine');
  const [sortBy, setSortBy] = useState('deadline');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [view, setView] = useState<View>('lista');
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
  const [assistantDraft,setAssistantDraft]=useState<{title:string;deadline:string}|null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTask = searchParams.get('tarefa');
  const requestedProtocol = searchParams.get('protocolo');

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
    if (loading) return;
    if (!requestedTask && !requestedProtocol) { setSelectedTask(null); return; }
    const found = tasks.find(t => t.id === requestedTask || (!!requestedProtocol && t.protocol === requestedProtocol.toUpperCase()));
    if (found) { setSelectedTask(found); return; }
    // Direct links still pass through the API authorization, including for admins.
    let active = true;
    const endpoint = requestedTask ? `/tasks/${encodeURIComponent(requestedTask)}` : `/tasks/by-protocol/${encodeURIComponent(requestedProtocol!.toUpperCase())}`;
    apiGet<{ data: Task }>(endpoint).then(response => { if (active) setSelectedTask(response.data); })
      .catch(() => { if (active) setLoadError('Não foi possível abrir esta tarefa. Confira o link e sua permissão de acesso.'); });
    return () => { active = false; };
  }, [loading, tasks, requestedTask, requestedProtocol, setSearchParams]);
  useEffect(()=>{
    if(loading)return;
    const intent=readAssistantIntent(searchParams);
    if(intent.create){setAssistantDraft({title:intent.title,deadline:intent.day?`${intent.day}T${intent.time || '23:59'}`:''});setTemplateForCreate(null);setSelectedTask(null);setCreating(true);}
    if(intent.search)setSearch(intent.search);
    if(intent.scope)setScope(intent.scope);
    if(intent.create||intent.search||intent.scope)setSearchParams(clearAssistantIntent,{replace:true});
  },[loading,searchParams,setSearchParams]);

  const today = dayKey();
  const mine = tasks.filter(task => isTaskMine(task, user?.id));
  const overdueCount = mine.filter(task => !isFinished(task.status) && dayKey(task.deadline) && dayKey(task.deadline)! < today!).length;
  const todayCount = mine.filter(task => !isFinished(task.status) && dayKey(task.deadline) === today).length;

  const filtered = useMemo(() => {
    let t = tasks;
    if (scope !== 'all' && scope !== 'observing') t = t.filter(task => isTaskMine(task, user?.id));
    if (scope === 'observing') t = t.filter(task => task.observers?.some(person => person.id === user?.id));
    if (scope === 'mine' && !filterStatus) t = t.filter(task => !isFinished(task.status));
    if (scope === 'overdue') t = t.filter(task => !isFinished(task.status) && dayKey(task.deadline) && dayKey(task.deadline)! < today!);
    if (scope === 'today') t = t.filter(task => !isFinished(task.status) && dayKey(task.deadline) === today);
    if (scope === 'done') t = t.filter(task => task.status === 'done');
    if (selectedListId) t = t.filter(x => x.custom_list_id === selectedListId);
    if (search) t = t.filter(x => x.title.toLowerCase().includes(search.toLowerCase()) || x.id.toLowerCase().includes(search.toLowerCase()) || (x.protocol && x.protocol.toUpperCase().includes(search.toUpperCase())));
    if (filterStatus) t = t.filter(x => x.status === filterStatus);
    const priorities = { urgent: 0, high: 1, normal: 2, low: 3 };
    return [...t].sort((a, b) => sortBy === 'priority' ? priorities[a.priority] - priorities[b.priority]
      : sortBy === 'title' ? a.title.localeCompare(b.title, 'pt-BR')
      : Number(isFinished(a.status)) - Number(isFinished(b.status)) || (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  }, [tasks, search, filterStatus, selectedListId, scope, user?.id, today, sortBy]);

  function handleUpdate(updated: Task) {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    if (selectedTask?.id === updated.id) setSelectedTask(updated);
  }
  function openTask(task: Task) {
    setSelectedTask(task);
    setSearchParams(params => { const next = new URLSearchParams(params); next.set('tarefa', task.id); next.delete('protocolo'); return next; }, { replace: true });
  }
  function handleCreate(task: Task) { setTasks(prev => [task, ...prev]); setCreating(false); openTask(task); }
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
      <header className="tasks-hero">
        <div><span className="tasks-kicker">MEU ESPAÇO DE TRABALHO</span><h1>Tarefas e entregas</h1><p>Organize o dia, acompanhe os prazos e avance com sua equipe.</p></div>
        <button type="button" onClick={() => setCreating(true)}><Plus size={20} /> Nova tarefa</button>
      </header>
      <section className="tasks-summary" aria-label="Resumo das minhas tarefas">
        <button aria-pressed={scope === 'mine'} onClick={() => { setScope('mine'); setFilterStatus(''); }}><ListTodo size={21} /><span><strong>{mine.filter(t => !isFinished(t.status)).length}</strong><small>Minhas pendências</small></span></button>
        <button className="is-overdue" aria-pressed={scope === 'overdue'} onClick={() => { setScope('overdue'); setFilterStatus(''); }}><Clock size={21} /><span><strong>{overdueCount}</strong><small>Prazo vencido</small></span></button>
        <button aria-pressed={scope === 'today'} onClick={() => { setScope('today'); setFilterStatus(''); }}><CalendarDays size={21} /><span><strong>{todayCount}</strong><small>Para hoje</small></span></button>
        <button aria-pressed={scope === 'done'} onClick={() => { setScope('done'); setFilterStatus(''); }}><CheckSquare size={21} /><span><strong>{mine.filter(t => t.status === 'done').length}</strong><small>Concluídas</small></span></button>
      </section>
      {/* Header */}
      <div className="tasks-header flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <ListTodo size={20} className="text-orange-500" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedListId ? customLists.find(l => l.id === selectedListId)?.name : 'Todas as listas'}</h2>
          <span className="rounded-full bg-blue-50 dark:bg-blue-900/40 border border-blue-100 dark:border-blue-800 px-2 py-0.5 text-xs font-bold text-blue-600 dark:text-blue-300">{tasks.length}</span>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="tasks-inline-create flex items-center gap-2 h-9 px-4 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 active:scale-95 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <Plus size={15} /> Nova tarefa
        </button>

        <div className="tasks-search flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
          <select aria-label="Envolvimento nas tarefas" value={scope} onChange={e => setScope(e.target.value as typeof scope)}><option value="mine">Minhas tarefas</option><option value="all">Todas em que estou envolvido</option><option value="observing">Estou observando</option><option value="overdue">Minhas vencidas</option><option value="today">Minhas para hoje</option><option value="done">Minhas concluídas</option></select>
          <select aria-label="Ordenar tarefas" value={sortBy} onChange={e => setSortBy(e.target.value)}><option value="deadline">Por prazo</option><option value="priority">Por prioridade</option><option value="title">Por título</option></select>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Título, ID ou protocolo…" aria-label="Buscar tarefas por título, ID ou protocolo"
            className="h-9 flex-1 sm:w-40 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-400 px-3 text-sm outline-none focus:border-orange-400 hover:border-slate-300 transition-colors" />
          <select aria-label="Filtrar tarefas por status" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 text-sm outline-none focus:border-orange-400 hover:border-slate-300 transition-colors cursor-pointer">
            <option value="">Todos</option>
            <option value="todo">A Fazer</option>
            <option value="in_progress">Andamento</option>
            <option value="done">Concluída</option>
            <option value="cancelled">Cancelada</option>
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
      <div className="tasks-body flex flex-1 min-h-0">
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
        <span className="tasks-result-count">{filtered.length} resultado(s)</span>
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
          <KanbanView tasks={filtered} onSelect={openTask} />
        ) : view === 'lista' ? (
          <ListView tasks={filtered} onSelect={openTask} />
        ) : view === 'planejador' ? (
          <PlannerView tasks={filtered} users={users} onSelect={openTask} />
        ) : view === 'calendario' ? (
          <CalendarView tasks={filtered} onSelect={openTask} />
        ) : view === 'modelos' ? (
          <TemplatesView
            templates={templates}
            users={users}
            onUseTemplate={(tmpl) => { setTemplateForCreate(tmpl); setView('lista'); setCreating(true); }}
            onDelete={async (id) => { if (!window.confirm('Excluir este modelo de tarefa?')) return; await templateApi.remove(id); setTemplates(prev => prev.filter(t => t.id !== id)); }}
            onRefresh={async () => setTemplates(await templateApi.list())}
          />
        ) : (
          <GanttView tasks={filtered} onSelect={openTask} />
        )}
      </div>

        </div>
      </div>

      {selectedTask && (
        <TaskDetail key={selectedTask.id} task={selectedTask} users={users} onTemplatesChanged={() => { void templateApi.list().then(setTemplates).catch(()=>{}); }} onClose={() => { setSelectedTask(null); setSearchParams(params => { const next = new URLSearchParams(params); next.delete('tarefa'); next.delete('protocolo'); return next; }, { replace: true }); }} onUpdate={handleUpdate} onDelete={handleDelete} customLists={customLists} />
      )}
      {creating && (
        <CreateTaskModal users={users} template={templateForCreate} onCreate={(task) => { handleCreate(task); setTemplateForCreate(null);setAssistantDraft(null); }} onClose={() => { setCreating(false); setTemplateForCreate(null);setAssistantDraft(null); }} customLists={customLists} defaultListId={selectedListId} initialTitle={assistantDraft?.title || ''} initialDeadline={assistantDraft?.deadline || ''} />
      )}
    </div>
  );
}
