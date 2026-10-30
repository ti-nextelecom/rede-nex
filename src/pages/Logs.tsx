import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Activity, AlertCircle, ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Clock3, Database, FileSearch, Filter, History, Loader2, Pencil, Plus, RefreshCw, Search, ShieldCheck, ShieldOff, Trash2, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { apiGet } from '../lib/apiClient';
import { EmployeeAvatar } from '../components/EmployeeAvatar';
import { auditFields, matchesAuditLog } from '../../shared/auditPresentation.mjs';
import './people-workspace.css';
import './audit-workspace.css';

interface AuditLogEntry {
  id: string; action: string; entity_type: string; entity_id: string;
  old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null;
  ip_address: string | null; created_at: string;
  actor_id: string | null; actor_name: string | null; actor_photo: string | null;
}
interface LogsResponse { data: AuditLogEntry[]; total: number; page: number; pageSize: number }
const ACTIONS = {
  INSERT: { label: 'Criação', tone: 'create', Icon: Plus },
  UPDATE: { label: 'Edição', tone: 'update', Icon: Pencil },
  DELETE: { label: 'Exclusão', tone: 'delete', Icon: Trash2 },
};
const ENTITY_LABELS: Record<string, string> = {
  users: 'Usuários', wiki_articles: 'Wiki', tasks: 'Tarefas', feed_posts: 'Feed', training_courses: 'Treinamentos',
  chat_messages: 'Chat', notifications: 'Notificações', departments: 'Departamentos', roles: 'Cargos', permissions: 'Permissões',
};
const actionFor = (action: string) => ACTIONS[action as keyof typeof ACTIONS] || { label: action, tone: 'other', Icon: Activity };
const actorFor = (log: AuditLogEntry) => log.actor_name || 'Origem não identificada';
const entityFor = (log: AuditLogEntry) => ENTITY_LABELS[log.entity_type] || log.entity_type;
function dateParts(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { day: 'Data indisponível', time: '—' };
  return {
    day: date.toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' }),
    time: date.toLocaleTimeString('pt-BR', { timeZone: 'America/Bahia', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
}
function ActionBadge({ action }: { action: string }) {
  const { label, tone, Icon } = actionFor(action);
  return <span className={`audit-action audit-action-${tone}`}><Icon size={13} aria-hidden="true" />{label}</span>;
}
function Actor({ log }: { log: AuditLogEntry }) {
  return <div className="audit-actor"><EmployeeAvatar name={log.actor_name || '?'} photo={log.actor_photo} className="employee-avatar-small" /><div><strong>{actorFor(log)}</strong><span>{log.actor_name ? 'Usuário registrado no evento' : 'Sem usuário associado'}</span></div></div>;
}
function AuditDetails({ log, onClose }: { log: AuditLogEntry; onClose: () => void }) {
  const fields = useMemo(() => auditFields(log.old_data, log.new_data, log.action), [log]);
  const date = dateParts(log.created_at);
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Overlay className="people-modal-overlay" /><Dialog.Content className="people-page people-dialog audit-dialog">
    <header className="audit-detail-header"><div><span className="people-eyebrow"><FileSearch size={15} aria-hidden="true" /> DETALHES DO EVENTO</span><Dialog.Title>{entityFor(log)} <ActionBadge action={log.action} /></Dialog.Title><Dialog.Description>Consulte os dados registrados no momento desta alteração.</Dialog.Description></div><button className="people-button" aria-label="Fechar detalhes do evento" onClick={onClose}><X size={19} /></button></header>
    <div className="audit-detail-body">
      <div className="audit-detail-summary"><Actor log={log} /><p><Clock3 size={17} aria-hidden="true" /><span>{date.day} às {date.time}<small>Horário da Bahia (UTC−3)</small></span></p></div>
      <dl className="audit-identifiers"><div><dt>ID do evento</dt><dd>{log.id}</dd></div><div><dt>ID do registro</dt><dd>{log.entity_id || 'Não registrado'}</dd></div><div><dt>Origem / IP</dt><dd>{log.ip_address || 'Não registrado'}</dd></div><div><dt>Entidade</dt><dd>{log.entity_type}</dd></div></dl>
      <div className="audit-change-heading"><div><h3>{log.action === 'INSERT' ? 'Dados criados' : log.action === 'DELETE' ? 'Dados excluídos' : 'Campos alterados'}</h3><p>{fields.length} campo(s) {log.action === 'UPDATE' ? 'com diferença' : 'no registro'}</p></div><span>Consulta somente leitura</span></div>
      {fields.length ? <div className="audit-diff-list">{fields.map(field => <section key={field.key} className="audit-diff-field"><h4>{field.key}</h4><div className="audit-diff-values">{log.action !== 'INSERT' && <div className="audit-before"><span><ArrowDownLeft size={14} aria-hidden="true" /> Antes</span><pre>{field.before}</pre></div>}{log.action !== 'DELETE' && <div className="audit-after"><span><ArrowUpRight size={14} aria-hidden="true" /> Depois</span><pre>{field.after}</pre></div>}</div></section>)}</div> : <div className="audit-empty-detail"><Database size={28} /><p>{log.old_data || log.new_data ? 'Nenhum campo diferente nos dados disponíveis.' : 'Este evento não contém um retrato dos dados.'}</p></div>}
      <p className="audit-sensitive-note">Valores de credenciais reconhecidas são ocultados nesta visualização. “Não registrado” indica ausência do campo; null é um valor nulo registrado.</p>
    </div><footer className="audit-detail-footer"><span><ShieldCheck size={15} aria-hidden="true" /> Histórico de auditoria</span><button className="people-button" onClick={onClose}>Fechar detalhes</button></footer>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}

export function Logs() {
  const { user } = useAuth();
  const canView = ['Administrador', 'Gestor'].includes(user?.role_name || '');
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  useEffect(() => {
    if (!canView) return;
    let active = true;
    setLoading(true); setError('');
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (filterAction) params.set('action', filterAction);
    if (filterEntity) params.set('entityType', filterEntity);
    // No writes, no demo fallback; stale responses from older filters are ignored.
    apiGet<LogsResponse>(`/admin/logs?${params}`).then(response => {
      if (!active) return;
      const lastPage = Math.max(1, Math.ceil((response.total || 0) / pageSize));
      if (page > lastPage) { setPage(lastPage); return; }
      setLogs(response.data || []); setTotal(response.total || 0); setUpdatedAt(new Date().toISOString());
    }).catch(e => { if (active) { setLogs([]); setTotal(0); setError(e instanceof Error ? e.message : 'Não foi possível carregar a auditoria.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canView, page, pageSize, filterAction, filterEntity, refresh]);
  const filtered = useMemo(() => logs.filter(log => matchesAuditLog(log, search, entityFor(log))), [logs, search]);
  const counts = useMemo(() => logs.reduce((result, log) => { if (log.action in result) result[log.action as keyof typeof result]++; return result; }, { INSERT: 0, UPDATE: 0, DELETE: 0 }), [logs]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const activeFilters = Boolean(search.trim() || filterAction || filterEntity);
  function clearFilters() { setSearch(''); setFilterAction(''); setFilterEntity(''); setPage(1); }

  if (!canView) return <div className="people-page audit-page"><div className="audit-denied"><ShieldOff size={44} /><h1>Acesso restrito</h1><p>Os logs de auditoria estão disponíveis para administradores e gestores autorizados.</p></div></div>;
  return <div className="people-page audit-page">
    <header className="people-hero"><div><span className="people-eyebrow"><ShieldCheck size={16} aria-hidden="true" /> ADMINISTRAÇÃO / RASTREABILIDADE</span><h1>Logs de auditoria</h1><p>Pessoas, ações e alterações. O contexto de cada evento em um só lugar.</p></div><div className="people-hero-actions"><span className="audit-readonly"><ShieldCheck size={15} /> Somente leitura</span><button className="people-button" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={17} className={loading ? 'animate-spin' : ''} />{loading ? 'Atualizando…' : 'Atualizar registros'}</button></div></header>
    <div className="audit-metrics" aria-label="Resumo dos registros">{[
      { label: 'Registros no filtro', value: total, hint: 'Total informado pelo servidor', Icon: History, tone: 'total' },
      { label: 'Criações', value: counts.INSERT, hint: 'Nesta página', Icon: Plus, tone: 'create' },
      { label: 'Edições', value: counts.UPDATE, hint: 'Nesta página', Icon: Pencil, tone: 'update' },
      { label: 'Exclusões', value: counts.DELETE, hint: 'Nesta página', Icon: Trash2, tone: 'delete' },
    ].map(({ label, value, hint, Icon, tone }) => <div key={label} className={`audit-metric audit-metric-${tone}`}><span className="audit-metric-icon"><Icon size={20} aria-hidden="true" /></span><span>{label}</span><strong>{loading || error ? '—' : value.toLocaleString('pt-BR')}</strong><small>{hint}</small></div>)}</div>
    <section className="audit-filter-panel" aria-labelledby="audit-filter-title"><div className="audit-filter-title"><h2 id="audit-filter-title"><Filter size={17} aria-hidden="true" /> Refine sua consulta</h2>{activeFilters && <button onClick={clearFilters}>Limpar filtros <X size={14} /></button>}</div>
      <div className="audit-filters"><label className="audit-search"><Search size={18} aria-hidden="true" /><input aria-label="Buscar nesta página de auditoria" placeholder="Buscar pessoa, módulo, IP ou ID nesta página" value={search} onChange={e => setSearch(e.target.value)} /></label><label className="audit-select"><span>Ação</span><select aria-label="Filtrar ação de auditoria" value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1); }}><option value="">Todas as ações</option>{Object.entries(ACTIONS).map(([value, action]) => <option key={value} value={value}>{action.label}</option>)}</select></label><label className="audit-select"><span>Módulo</span><select aria-label="Filtrar módulo de auditoria" value={filterEntity} onChange={e => { setFilterEntity(e.target.value); setPage(1); }}><option value="">Todos os módulos</option>{Object.entries(ENTITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <p>Ação e módulo filtram todo o histórico. A busca por texto considera somente a página carregada.</p>
    </section>
    <section className="audit-records" aria-labelledby="audit-records-title" aria-busy={loading}><div className="audit-records-heading"><div><h2 id="audit-records-title">Histórico de alterações</h2><p>Abra um evento para consultar o que foi registrado.</p></div><span className="people-result-count" aria-live="polite">{loading ? 'Carregando…' : error ? 'Dados indisponíveis' : `${filtered.length} de ${logs.length} evento(s) nesta página`}</span></div>
      {loading ? <div className="audit-state" role="status"><Loader2 size={27} className="animate-spin" /><h3>Carregando histórico…</h3><p>Consultando os registros de auditoria.</p></div> : error ? <div className="audit-state audit-error" role="alert"><AlertCircle size={30} /><h3>Não foi possível carregar os registros</h3><p>{error}</p><button className="people-button" onClick={() => setRefresh(value => value + 1)}>Tentar novamente</button></div> : !filtered.length ? <div className="audit-state"><FileSearch size={34} /><h3>{activeFilters ? 'Nenhum evento neste recorte' : 'Nenhum registro disponível'}</h3><p>{search.trim() ? 'A busca vale apenas para esta página. Tente outro termo, altere a página ou use os filtros de ação e módulo.' : 'Os eventos disponíveis aparecerão aqui conforme o histórico registrado pelo sistema.'}</p>{activeFilters && <button className="people-button" onClick={clearFilters}>Limpar filtros</button>}</div> : <>
        <div className="audit-table-wrap"><table className="audit-table"><caption className="sr-only">Eventos de auditoria. As datas usam o horário da Bahia.</caption><thead><tr><th scope="col">Pessoa / origem</th><th scope="col">Ação</th><th scope="col">Módulo e registro</th><th scope="col">Data e hora <small>UTC−3</small></th><th scope="col"><span className="sr-only">Detalhes</span></th></tr></thead><tbody>{filtered.map(log => { const date = dateParts(log.created_at); return <tr key={log.id}><td><Actor log={log} /></td><td><ActionBadge action={log.action} /></td><td><strong className="audit-entity">{entityFor(log)}</strong><code className="audit-entity-id" title={log.entity_id}>{log.entity_id || 'ID não registrado'}</code></td><td><time dateTime={log.created_at}>{date.day}<span>{date.time}</span></time></td><td><button className="people-button audit-detail-button" aria-label={`Ver evento ${log.id}`} onClick={() => setSelected(log)}><FileSearch size={17} /><span>Ver detalhes</span><ChevronRight size={15} /></button></td></tr>; })}</tbody></table></div>
        <div className="audit-mobile-list">{filtered.map(log => { const date = dateParts(log.created_at); return <article key={log.id}><header><ActionBadge action={log.action} /><time dateTime={log.created_at}>{date.day} · {date.time}</time></header><Actor log={log} /><p><Database size={15} aria-hidden="true" />{entityFor(log)}</p><code>{log.entity_id || 'ID não registrado'}</code><button className="people-button" aria-label={`Ver evento ${log.id} no celular`} onClick={() => setSelected(log)}>Ver detalhes do evento <ChevronRight size={17} /></button></article>; })}</div>
      </>}
      {!loading && !error && <footer className="audit-pagination"><div><strong>Página {page} de {totalPages}</strong><span>{total.toLocaleString('pt-BR')} registro(s) no filtro{updatedAt ? ` · Atualizado às ${dateParts(updatedAt).time}` : ''}</span></div><label><span>Por página</span><select aria-label="Registros de auditoria por página" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label><nav aria-label="Paginação dos logs"><button className="people-button" aria-label="Página anterior dos logs" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronLeft size={18} /></button><span aria-current="page">{page} / {totalPages}</span><button className="people-button" aria-label="Próxima página dos logs" disabled={page >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))}><ChevronRight size={18} /></button></nav></footer>}
    </section>
    {selected && <AuditDetails log={selected} onClose={() => setSelected(null)} />}
  </div>;
}
