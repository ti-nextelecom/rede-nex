import { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  User,
  AlertCircle,
  Clock,
  Database,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { apiGet } from '../lib/apiClient';
import { cn } from '../lib/utils';

interface AuditLogEntry {
  id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  entity_type: string;
  entity_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_photo: string | null;
}

interface LogsResponse {
  data: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

const ACTION_STYLE: Record<string, { label: string; className: string }> = {
  INSERT: { label: 'Criação',  className: 'bg-emerald-100 text-emerald-700' },
  UPDATE: { label: 'Edição',   className: 'bg-blue-100 text-blue-700' },
  DELETE: { label: 'Exclusão', className: 'bg-red-100 text-red-700' },
};

const ENTITY_LABELS: Record<string, string> = {
  users:             'Usuários',
  wiki_articles:     'Wiki',
  tasks:             'Tarefas',
  feed_posts:        'Feed',
  training_courses:  'Treinamentos',
  chat_messages:     'Chat',
  notifications:     'Notificações',
  departments:       'Departamentos',
  roles:             'Cargos',
  permissions:       'Permissões',
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function DiffView({ oldData, newData }: { oldData: Record<string, unknown> | null; newData: Record<string, unknown> | null }) {
  if (!oldData && !newData) return null;

  const allKeys = Array.from(new Set([
    ...Object.keys(oldData ?? {}),
    ...Object.keys(newData ?? {}),
  ])).filter(k => {
    const o = oldData?.[k];
    const n = newData?.[k];
    return JSON.stringify(o) !== JSON.stringify(n);
  });

  if (allKeys.length === 0) {
    return <p className="text-xs text-slate-400 italic">Nenhuma diferença detectada.</p>;
  }

  return (
    <div className="space-y-1 max-h-48 overflow-y-auto text-xs font-mono">
      {allKeys.map(key => (
        <div key={key} className="grid grid-cols-[120px_1fr_1fr] gap-1 items-start">
          <span className="text-slate-500 truncate font-sans">{key}</span>
          {oldData?.[key] !== undefined ? (
            <span className="bg-red-50 text-red-700 px-1 rounded truncate">{String(oldData[key])}</span>
          ) : (
            <span className="text-slate-300">—</span>
          )}
          {newData?.[key] !== undefined ? (
            <span className="bg-emerald-50 text-emerald-700 px-1 rounded truncate">{String(newData[key])}</span>
          ) : (
            <span className="text-slate-300">—</span>
          )}
        </div>
      ))}
    </div>
  );
}

function LogRow({ log }: { log: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const action = ACTION_STYLE[log.action] ?? { label: log.action, className: 'bg-slate-100 text-slate-600' };
  const entityLabel = ENTITY_LABELS[log.entity_type] ?? log.entity_type;
  const avatarUrl = log.actor_photo || (log.actor_name
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(log.actor_name)}&size=32&background=0057b8&color=fff`
    : null);

  return (
    <>
      <tr
        className="hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100"
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {avatarUrl ? (
              <img src={avatarUrl} alt={log.actor_name ?? ''} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                <User size={13} className="text-slate-400" />
              </div>
            )}
            <span className="text-sm text-slate-800 font-medium">{log.actor_name ?? 'Sistema'}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold', action.className)}>
            {action.label}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-slate-600">{entityLabel}</td>
        <td className="px-4 py-3 text-xs text-slate-400 font-mono truncate max-w-[120px]">{log.entity_id}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Clock size={11} />
            {formatDateTime(log.created_at)}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50 border-b border-slate-100">
          <td colSpan={5} className="px-6 py-3">
            <div className="space-y-2">
              {log.ip_address && (
                <p className="text-xs text-slate-500">IP: <span className="font-mono">{log.ip_address}</span></p>
              )}
              {log.action === 'UPDATE' && (
                <>
                  <p className="text-xs font-semibold text-slate-600 mb-1">Campos alterados:</p>
                  <div className="grid grid-cols-[120px_1fr_1fr] gap-1 text-xs font-semibold text-slate-400 mb-1">
                    <span>Campo</span><span>Antes</span><span>Depois</span>
                  </div>
                  <DiffView oldData={log.old_data} newData={log.new_data} />
                </>
              )}
              {log.action === 'INSERT' && log.new_data && (
                <>
                  <p className="text-xs font-semibold text-slate-600 mb-1">Dados criados:</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto text-xs font-mono">
                    {Object.entries(log.new_data).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-slate-400 font-sans w-32 flex-shrink-0">{k}</span>
                        <span className="text-emerald-700 truncate">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {log.action === 'DELETE' && log.old_data && (
                <>
                  <p className="text-xs font-semibold text-slate-600 mb-1">Dados excluídos:</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto text-xs font-mono">
                    {Object.entries(log.old_data).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-slate-400 font-sans w-32 flex-shrink-0">{k}</span>
                        <span className="text-red-600 truncate">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function Logs() {
  const { user } = useAuth();
  const isAdmin = ['Administrador', 'Gestor'].includes(user?.role_name ?? '');

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const pageSize = 50;

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) });
      if (filterAction) params.set('action', filterAction);
      if (filterEntity) params.set('entityType', filterEntity);
      const res = await apiGet<LogsResponse>(`/admin/logs?${params}`);
      setLogs(res.data ?? []);
      setTotal(res.total ?? 0);
      setPage(res.page ?? p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar logs');
    } finally {
      setLoading(false);
    }
  }, [filterAction, filterEntity]);

  useEffect(() => { load(1); }, [load]);

  const filtered = search.trim()
    ? logs.filter(l =>
        (l.actor_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (ENTITY_LABELS[l.entity_type] ?? l.entity_type).toLowerCase().includes(search.toLowerCase()) ||
        l.entity_id.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-slate-400">
        <AlertCircle size={48} />
        <p className="text-lg font-medium">Acesso restrito a administradores</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg">
          <Activity size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Logs de Auditoria</h1>
          <p className="text-sm text-slate-500">Rastreamento completo de todas as alterações do sistema</p>
        </div>
        <span className="ml-auto bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1 rounded-full">
          {total.toLocaleString('pt-BR')} registros
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white border border-slate-200 rounded-xl p-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] border border-slate-200 rounded-lg px-3 py-2">
          <Search size={14} className="text-slate-400 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por usuário, entidade ou ID..."
            className="flex-1 text-sm outline-none placeholder:text-slate-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            value={filterAction}
            onChange={e => { setFilterAction(e.target.value); setPage(1); }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white"
          >
            <option value="">Todas as ações</option>
            <option value="INSERT">Criação</option>
            <option value="UPDATE">Edição</option>
            <option value="DELETE">Exclusão</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Database size={14} className="text-slate-400" />
          <select
            value={filterEntity}
            onChange={e => { setFilterEntity(e.target.value); setPage(1); }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white"
          >
            <option value="">Todos os módulos</option>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {error && (
          <div className="p-4 text-center text-red-600 text-sm flex items-center justify-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm animate-pulse">Carregando logs...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Nenhum registro encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Usuário</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Ação</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Módulo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Data/Hora</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => <LogRow key={log.id} log={log} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Página {page} de {totalPages} ({total.toLocaleString('pt-BR')} registros)</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => load(page - 1)}
              disabled={page <= 1 || loading}
              className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pg = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
              return (
                <button
                  key={pg}
                  onClick={() => load(pg)}
                  disabled={loading}
                  className={cn(
                    'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                    pg === page ? 'bg-orange-500 text-white' : 'hover:bg-slate-100'
                  )}
                >
                  {pg}
                </button>
              );
            })}
            <button
              onClick={() => load(page + 1)}
              disabled={page >= totalPages || loading}
              className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
