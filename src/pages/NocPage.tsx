import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Activity, ArrowRight, BarChart3, CalendarDays, Check, CheckCircle2, ChevronRight, Clock3,
  Filter, LayoutDashboard, List, MessageSquare, PhoneCall, Plus, RadioTower, Search, Send, Settings2, ShieldAlert, Timer,
  Trash2, UserRound, Users, X,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog';
import { getNocDateRange, inNocRange, makeNocBuckets, resolutionHours, type NocBucket, type NocPeriod } from '../lib/nocAnalytics';
import { NOC_STORAGE_KEY, newNocId, readNocStore, saveNocStore, type NocActivation, type NocIncident, type NocStore, type NocType } from '../lib/nocStore';
import './noc.css';

const NocBI = lazy(() => import('./NocBI').then(module => ({ default: module.NocBI })));

type View = 'overview' | 'bi' | 'incidents' | 'catalog';
type StatusFilter = 'all' | 'open' | 'closed';
type CatalogLevel = 'type' | 'motive' | 'cause';
type ActorFilter = { id: string; name: string; role: 'opened' | 'closed' } | null;
type PerformanceFilter = 'all' | 'fast' | 'slow';
type TeamMode = 'openers' | 'closers' | 'performance';
type BreakdownSort = 'total' | 'open' | 'closed';
type BreakdownLevel = 'type' | 'motive' | 'cause';
type BreakdownRow = { id: string; typeId: string; motiveId: string; name: string; context: string; open: number; closed: number; total: number };

const dateTime = (value: string) => new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(value));

const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
const pad = (value: number) => String(value).padStart(2, '0');

function localDateTimeInput() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function SlaClock({ openedAt, closedAt = null, compact = false }: { openedAt: string; closedAt?: string | null; compact?: boolean }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (closedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), compact ? 30000 : 1000);
    return () => window.clearInterval(timer);
  }, [closedAt, compact]);
  const seconds = Math.max(0, Math.floor(((closedAt ? new Date(closedAt).getTime() : now) - new Date(openedAt).getTime()) / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds / 3600) % 24;
  const minutes = Math.floor(seconds / 60) % 60;
  const value = compact ? `${days ? `${days}d ` : ''}${days ? pad(hours) : hours}h ${pad(minutes)}min` : `${days ? `${days}d ` : ''}${pad(hours)}:${pad(minutes)}:${pad(seconds % 60)}`;
  return <span className={`noc-sla ${closedAt ? 'finished' : ''}`} aria-label={`${closedAt ? 'Tempo total do incidente' : 'Tempo em aberto do incidente'}: ${value}`}><Timer size={compact ? 13 : 18} /><span>{closedAt ? 'Tempo total' : 'SLA · em aberto'}</span><strong>{value}</strong></span>;
}

function Person({ name, detail }: { name: string; detail?: string }) {
  return <span className="noc-person"><span className="noc-person-avatar">{initials(name) || <UserRound size={14} />}</span><span><strong>{name}</strong>{detail && <small>{detail}</small>}</span></span>;
}

function breakdownRows(incidents: NocIncident[], types: NocType[], level: BreakdownLevel, sort: BreakdownSort): BreakdownRow[] {
  const rows = new Map<string, BreakdownRow>();
  for (const item of incidents) {
    const type = types.find(entry => entry.id === item.typeId);
    const motive = type?.motives.find(entry => entry.id === item.motiveId);
    const cause = motive?.causes.find(entry => entry.id === item.causeId);
    const id = level === 'type' ? item.typeId : level === 'motive' ? item.motiveId : item.causeId;
    const name = level === 'type' ? type?.name ?? 'Tipo removido' : level === 'motive' ? motive?.name ?? 'Motivo removido' : cause?.name ?? 'Causa removida';
    const context = level === 'type' ? '' : level === 'motive' ? type?.name ?? 'Tipo removido' : `${type?.name ?? 'Tipo removido'} / ${motive?.name ?? 'Motivo removido'}`;
    const row = rows.get(id) ?? { id, typeId: item.typeId, motiveId: item.motiveId, name, context, open: 0, closed: 0, total: 0 };
    row.total += 1;
    if (item.closedAt) row.closed += 1; else row.open += 1;
    rows.set(id, row);
  }
  return [...rows.values()].sort((a, b) => b[sort] - a[sort] || b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));
}

function BreakdownColumn({ title, rows, selectedId, onSelect }: { title: string; rows: BreakdownRow[]; selectedId: string; onSelect: (row: BreakdownRow) => void }) {
  const max = Math.max(1, ...rows.map(row => row.total));
  return <div className="noc-breakdown-column">
    <div className="noc-breakdown-column-title"><strong>{title}</strong><span>{rows.length} {rows.length === 1 ? 'categoria' : 'categorias'}</span></div>
    <div className="noc-breakdown-rows">{rows.length ? rows.map((row, index) => <button key={row.id} className={`noc-breakdown-row ${selectedId === row.id ? 'active' : ''}`} onClick={() => onSelect(row)} aria-pressed={selectedId === row.id} aria-label={`${row.name}: ${row.open} abertos e ${row.closed} fechados. Filtrar incidentes`}>
      <span className="noc-breakdown-rank">{String(index + 1).padStart(2, '0')}</span><span className="noc-breakdown-content"><span className="noc-breakdown-name"><strong>{row.name}</strong><b>{row.total}</b></span>{row.context && <small>{row.context}</small>}<span className="noc-breakdown-bar"><i className="open" style={{ width: `${row.open / max * 100}%` }} /><i className="closed" style={{ width: `${row.closed / max * 100}%` }} /></span><span className="noc-breakdown-counts"><span>{row.open} abertos</span><span>{row.closed} fechados</span></span></span><ChevronRight size={15} />
    </button>) : <div className="noc-breakdown-empty">Nenhum incidente neste recorte.</div>}</div>
  </div>;
}

export function NocPage() {
  const { user } = useAuth();
  const explorerRef = useRef<HTMLElement>(null);
  const [store, setStore] = useState<NocStore>(readNocStore);
  const [view, setView] = useState<View>('overview');
  const [period, setPeriod] = useState<NocPeriod>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [actor, setActor] = useState<ActorFilter>(null);
  const [performance, setPerformance] = useState<PerformanceFilter>('all');
  const [teamMode, setTeamMode] = useState<TeamMode>('openers');
  const [bucket, setBucket] = useState<NocBucket | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [motiveFilter, setMotiveFilter] = useState('all');
  const [causeFilter, setCauseFilter] = useState('all');
  const [breakdownSort, setBreakdownSort] = useState<BreakdownSort>('total');
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [resolution, setResolution] = useState('');
  const [form, setForm] = useState({ description: '', typeId: '', motiveId: '', causeId: '', activationKind: '' as '' | NocActivation['kind'], activationTeam: '', activationAt: '' });
  const [commentDraft, setCommentDraft] = useState('');
  const [activationOpen, setActivationOpen] = useState(false);
  const [activationDraft, setActivationDraft] = useState({ kind: '' as '' | NocActivation['kind'], team: '', at: '' });
  const [detailError, setDetailError] = useState('');
  const [formError, setFormError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState(store.types[0]?.id ?? '');
  const [selectedMotiveId, setSelectedMotiveId] = useState(store.types[0]?.motives[0]?.id ?? '');
  const [newTypeName, setNewTypeName] = useState('');
  const [newMotiveName, setNewMotiveName] = useState('');
  const [newCauseName, setNewCauseName] = useState('');
  const [editing, setEditing] = useState<{ level: CatalogLevel; id: string; name: string } | null>(null);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === NOC_STORAGE_KEY) setStore(readNocStore());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  function commit(next: NocStore) {
    try {
      saveNocStore(next);
      setStore(next);
      setSaveError('');
      return true;
    } catch {
      setSaveError('Não foi possível salvar neste navegador. Verifique o espaço disponível e tente novamente.');
      return false;
    }
  }

  function labels(item: NocIncident) {
    const type = store.types.find(entry => entry.id === item.typeId);
    const motive = type?.motives.find(entry => entry.id === item.motiveId);
    return [type?.name ?? 'Tipo removido', motive?.name ?? 'Motivo removido', motive?.causes.find(entry => entry.id === item.causeId)?.name ?? 'Causa removida'];
  }

  const range = getNocDateRange(period, customStart, customEnd);
  const sorted = useMemo(() => [...store.incidents].sort((a, b) => b.openedAt.localeCompare(a.openedAt)), [store.incidents]);
  const periodItems = sorted.filter(item => inNocRange(item.openedAt, range));
  const searchTerm = query.trim().toLocaleLowerCase('pt-BR');
  const searchable = (item: NocIncident) => {
    if (!searchTerm) return true;
    return `${labels(item).join(' ')} ${item.description} ${item.openedBy.name} ${item.closedBy?.name ?? ''} ${item.activation?.team ?? ''} ${(item.comments ?? []).map(comment => comment.body).join(' ')}`.toLocaleLowerCase('pt-BR').includes(searchTerm);
  };
  const searchableItems = periodItems.filter(searchable);
  const rosterSource = searchableItems.filter(item => (typeFilter === 'all' || item.typeId === typeFilter) && (motiveFilter === 'all' || item.motiveId === motiveFilter) && (causeFilter === 'all' || item.causeId === causeFilter));
  const actorSource = rosterSource.filter(item => !actor || (actor.role === 'opened' ? item.openedBy.id === actor.id : item.closedBy?.id === actor.id));
  const performanceSource = actorSource.filter(item => !bucket || inNocRange(item.openedAt, bucket));
  const scoped = actorSource.filter(item => {
    const hours = resolutionHours(item);
    return performance === 'all' || (hours !== null && (performance === 'fast' ? hours <= 4 : hours > 24));
  });
  const focused = scoped.filter(item => !bucket || inNocRange(item.openedAt, bucket));
  const visible = focused.filter(item => status === 'all' || (status === 'open' ? !item.closedAt : !!item.closedAt));
  const openCount = focused.filter(item => !item.closedAt).length;
  const closedItems = focused.filter(item => !!item.closedAt);
  const closedCount = closedItems.length;
  const averageHours = closedCount ? closedItems.reduce((sum, item) => sum + (resolutionHours(item) ?? 0), 0) / closedCount : 0;
  const performanceTotal = performanceSource.filter(item => !!item.closedAt).length;
  const fastestCount = performanceSource.filter(item => { const hours = resolutionHours(item); return hours !== null && hours <= 4; }).length;
  const slowestCount = performanceSource.filter(item => { const hours = resolutionHours(item); return hours !== null && hours > 24; }).length;
  const trend = makeNocBuckets(scoped, range, period);
  const trendMax = Math.max(1, ...trend.flatMap(item => [item.opened, item.closed]));
  const analysisSource = searchableItems.filter(item => {
    const actorMatches = !actor || (actor.role === 'opened' ? item.openedBy.id === actor.id : item.closedBy?.id === actor.id);
    const hours = resolutionHours(item);
    const performanceMatches = performance === 'all' || (hours !== null && (performance === 'fast' ? hours <= 4 : hours > 24));
    return actorMatches && performanceMatches && (!bucket || inNocRange(item.openedAt, bucket));
  });
  const typeRows = breakdownRows(analysisSource, store.types, 'type', breakdownSort);
  const motiveRows = breakdownRows(analysisSource.filter(item => typeFilter === 'all' || item.typeId === typeFilter), store.types, 'motive', breakdownSort);
  const causeRows = breakdownRows(analysisSource.filter(item => (typeFilter === 'all' || item.typeId === typeFilter) && (motiveFilter === 'all' || item.motiveId === motiveFilter)), store.types, 'cause', breakdownSort);

  const people = new Map<string, { id: string; name: string; count: number; hours: number }>();
  for (const item of rosterSource) {
    const person = teamMode === 'openers' ? item.openedBy : item.closedBy;
    if (!person) continue;
    const current = people.get(person.id) ?? { ...person, count: 0, hours: 0 };
    current.count += 1;
    current.hours += resolutionHours(item) ?? 0;
    people.set(person.id, current);
  }
  const ranking = [...people.values()].sort((a, b) => teamMode === 'performance'
    ? (a.hours / a.count) - (b.hours / b.count) || b.count - a.count
    : b.count - a.count || a.name.localeCompare(b.name, 'pt-BR')).slice(0, 6);

  const selected = store.incidents.find(item => item.id === selectedId) ?? null;
  const closing = store.incidents.find(item => item.id === closingId) ?? null;
  const selectedType = store.types.find(item => item.id === selectedTypeId);
  const selectedMotive = selectedType?.motives.find(item => item.id === selectedMotiveId);
  const formType = store.types.find(item => item.id === form.typeId);
  const formMotive = formType?.motives.find(item => item.id === form.motiveId);

  function reveal(nextStatus: StatusFilter) {
    setStatus(nextStatus);
    window.requestAnimationFrame(() => explorerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function selectActor(next: NonNullable<ActorFilter>) {
    setActor(current => current?.id === next.id && current.role === next.role ? null : next);
    setStatus('all');
  }

  function selectBreakdown(level: BreakdownLevel, row: BreakdownRow) {
    if (level === 'type') {
      const next = typeFilter === row.id ? 'all' : row.id;
      setTypeFilter(next); setMotiveFilter('all'); setCauseFilter('all');
    } else if (level === 'motive') {
      setTypeFilter(row.typeId); setMotiveFilter(motiveFilter === row.id ? 'all' : row.id); setCauseFilter('all');
    } else {
      setTypeFilter(row.typeId); setMotiveFilter(row.motiveId); setCauseFilter(causeFilter === row.id ? 'all' : row.id);
    }
    window.requestAnimationFrame(() => explorerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function resetFilters() {
    setActor(null); setPerformance('all'); setBucket(null); setTypeFilter('all'); setMotiveFilter('all'); setCauseFilter('all'); setStatus('all'); setQuery('');
  }

  function openCreate() {
    setForm({ description: '', typeId: '', motiveId: '', causeId: '', activationKind: '', activationTeam: '', activationAt: '' });
    setFormError('');
    setIncidentOpen(true);
  }

  function openDetail(id: string) {
    setCreatedId(null);
    setDetailError('');
    setCommentDraft('');
    setActivationOpen(false);
    setActivationDraft({ kind: '', team: '', at: '' });
    setSelectedId(id);
  }

  function createIncident(event: FormEvent) {
    event.preventDefault();
    const type = store.types.find(item => item.id === form.typeId);
    const motive = type?.motives.find(item => item.id === form.motiveId);
    if (!form.description.trim() || !motive?.causes.some(item => item.id === form.causeId)) {
      setFormError('Selecione tipo, motivo e causa e descreva o ocorrido.');
      return;
    }
    if (form.activationKind && (!form.activationTeam.trim() || !form.activationAt || !Number.isFinite(new Date(form.activationAt).getTime()))) {
      setFormError('Informe equipe, data e hora do acionamento, ou selecione "Ainda não acionada".');
      return;
    }
    const openedAt = new Date().toISOString();
    const openedBy = { id: user?.id ?? 'local', name: user?.name ?? 'Usuário local' };
    const incident: NocIncident = {
      id: newNocId(), description: form.description.trim(), typeId: form.typeId,
      motiveId: form.motiveId, causeId: form.causeId, openedAt, openedBy,
      closedAt: null, closedBy: null, resolution: '',
      activation: form.activationKind ? { kind: form.activationKind, team: form.activationTeam.trim(), at: new Date(form.activationAt).toISOString(), recordedBy: openedBy } : null,
      comments: [],
    };
    if (commit({ ...store, incidents: [incident, ...store.incidents] })) {
      setIncidentOpen(false);
      setCreatedId(incident.id);
      setPeriod('all'); resetFilters(); setStatus('open'); setView('incidents');
    }
  }

  function addComment(event: FormEvent) {
    event.preventDefault();
    if (!selected || selected.closedAt || !commentDraft.trim()) return;
    const comment = { id: newNocId(), body: commentDraft.trim(), createdAt: new Date().toISOString(), createdBy: { id: user?.id ?? 'local', name: user?.name ?? 'Usuário local' } };
    const incidents = store.incidents.map(item => item.id === selected.id ? { ...item, comments: [...item.comments, comment] } : item);
    if (commit({ ...store, incidents })) { setCommentDraft(''); setDetailError(''); }
  }

  function registerActivation(event: FormEvent) {
    event.preventDefault();
    if (!selected || selected.closedAt || selected.activation) return;
    if (!activationDraft.kind || !activationDraft.team.trim() || !activationDraft.at || !Number.isFinite(new Date(activationDraft.at).getTime())) {
      setDetailError('Selecione interno ou externo e informe equipe, data e hora do acionamento.');
      return;
    }
    const activation: NocActivation = { kind: activationDraft.kind, team: activationDraft.team.trim(), at: new Date(activationDraft.at).toISOString(), recordedBy: { id: user?.id ?? 'local', name: user?.name ?? 'Usuário local' } };
    const incidents = store.incidents.map(item => item.id === selected.id ? { ...item, activation } : item);
    if (commit({ ...store, incidents })) { setActivationOpen(false); setDetailError(''); }
  }

  function closeIncident(event: FormEvent) {
    event.preventDefault();
    if (!closing || !resolution.trim()) return;
    const next = store.incidents.map(item => item.id === closing.id && !item.closedAt ? {
      ...item, closedAt: new Date().toISOString(), closedBy: { id: user?.id ?? 'local', name: user?.name ?? 'Usuário local' }, resolution: resolution.trim(),
    } : item);
    if (commit({ ...store, incidents: next })) { setClosingId(null); setResolution(''); setStatus('closed'); }
  }

  function addCatalogItem(level: CatalogLevel) {
    const name = (level === 'type' ? newTypeName : level === 'motive' ? newMotiveName : newCauseName).trim();
    if (!name) return;
    const id = newNocId();
    if (level === 'type') {
      if (store.types.some(item => item.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) return setSaveError('Já existe um tipo com esse nome.');
      if (commit({ ...store, types: [...store.types, { id, name, motives: [] }] })) { setSelectedTypeId(id); setSelectedMotiveId(''); setNewTypeName(''); }
      return;
    }
    if (!selectedType) return;
    if (level === 'motive') {
      if (selectedType.motives.some(item => item.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) return setSaveError('Já existe um motivo com esse nome.');
      const types = store.types.map(item => item.id === selectedType.id ? { ...item, motives: [...item.motives, { id, name, causes: [] }] } : item);
      if (commit({ ...store, types })) { setSelectedMotiveId(id); setNewMotiveName(''); }
      return;
    }
    if (!selectedMotive) return;
    if (selectedMotive.causes.some(item => item.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) return setSaveError('Já existe uma causa com esse nome.');
    const types = store.types.map(item => item.id === selectedType.id ? { ...item, motives: item.motives.map(motive => motive.id === selectedMotive.id ? { ...motive, causes: [...motive.causes, { id, name }] } : motive) } : item);
    if (commit({ ...store, types })) setNewCauseName('');
  }

  function renameCatalogItem() {
    if (!editing?.name.trim()) return;
    const name = editing.name.trim();
    const siblings = editing.level === 'type' ? store.types : editing.level === 'motive' ? selectedType?.motives ?? [] : selectedMotive?.causes ?? [];
    if (siblings.some(item => item.id !== editing.id && item.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) return setSaveError('Já existe um item com esse nome neste nível.');
    const types = store.types.map(type => ({
      ...type, name: editing.level === 'type' && type.id === editing.id ? name : type.name,
      motives: type.motives.map(motive => ({
        ...motive, name: editing.level === 'motive' && motive.id === editing.id ? name : motive.name,
        causes: motive.causes.map(cause => ({ ...cause, name: editing.level === 'cause' && cause.id === editing.id ? name : cause.name })),
      })),
    }));
    if (commit({ ...store, types })) setEditing(null);
  }

  function removeCatalogItem(level: CatalogLevel, id: string) {
    const used = store.incidents.some(item => level === 'type' ? item.typeId === id : level === 'motive' ? item.motiveId === id : item.causeId === id);
    if (used) return setSaveError('Este item está associado a incidentes e não pode ser excluído. Você pode renomeá-lo.');
    if (!window.confirm('Excluir esta configuração?')) return;
    const types = level === 'type' ? store.types.filter(item => item.id !== id) : store.types.map(type => ({
      ...type, motives: level === 'motive' ? type.motives.filter(item => item.id !== id) : type.motives.map(motive => ({ ...motive, causes: motive.causes.filter(item => item.id !== id) })),
    }));
    if (commit({ ...store, types })) {
      if (level === 'type' && selectedTypeId === id) { setSelectedTypeId(types[0]?.id ?? ''); setSelectedMotiveId(types[0]?.motives[0]?.id ?? ''); }
      if (level === 'motive' && selectedMotiveId === id) setSelectedMotiveId(types.find(item => item.id === selectedTypeId)?.motives[0]?.id ?? '');
    }
  }

  const hasActiveFilters = !!actor || performance !== 'all' || !!bucket || typeFilter !== 'all' || motiveFilter !== 'all' || causeFilter !== 'all' || status !== 'all' || !!query;

  return <div className="noc-page">
    <div className="noc-hero">
      <div className="noc-hero-copy"><span className="noc-eyebrow"><RadioTower size={15} /> CENTRO DE OPERAÇÕES</span><h1>NOC <span>/ Incidentes</span></h1><p>Registre, acompanhe e conclua ocorrências com contexto e responsáveis claros.</p></div>
      <div className="noc-hero-actions"><span className="noc-local-badge">Prévia neste navegador</span><button className="noc-primary" onClick={openCreate}><Plus size={18} /> Novo incidente</button></div>
    </div>

    {saveError && <div className="noc-alert" role="alert"><ShieldAlert size={17} />{saveError}<button aria-label="Fechar aviso" onClick={() => setSaveError('')}><X size={16} /></button></div>}

    <div className="noc-tabs" role="tablist" aria-label="Seções do NOC">
      {([{ id: 'overview', label: 'Visão geral', icon: LayoutDashboard }, { id: 'bi', label: 'BI e gráficos', icon: BarChart3 }, { id: 'incidents', label: 'Incidentes', icon: List }, { id: 'catalog', label: 'Configurações', icon: Settings2 }] as const).map(tab => <button key={tab.id} role="tab" aria-selected={view === tab.id} className={view === tab.id ? 'active' : ''} onClick={() => setView(tab.id)}><tab.icon size={17} />{tab.label}</button>)}
    </div>

    {view !== 'catalog' && <section className="noc-period-panel" aria-label="Período dos indicadores">
      <div className="noc-period-intro"><CalendarDays size={19} /><span><strong>Período de abertura</strong><small>{range?.label ?? 'Todos os registros'}</small></span></div>
      <div className="noc-period-options">{([{ id: 'day', label: 'Dia' }, { id: 'week', label: 'Semana' }, { id: 'month', label: 'Mês' }, { id: 'custom', label: 'Personalizado' }, { id: 'all', label: 'Todos' }] as const).map(option => <button key={option.id} className={period === option.id ? 'active' : ''} onClick={() => { setPeriod(option.id); setBucket(null); }}>{option.label}</button>)}</div>
      {period === 'custom' && <div className="noc-custom-dates"><label>De <input type="date" value={customStart} onChange={event => { setCustomStart(event.target.value); setBucket(null); }} /></label><label>Até <input type="date" value={customEnd} onChange={event => { setCustomEnd(event.target.value); setBucket(null); }} /></label></div>}
      <span className="noc-period-note">{periodItems.length} {periodItems.length === 1 ? 'incidente aberto' : 'incidentes abertos'} no período</span>
    </section>}

    {view === 'overview' && <>
      <div className="noc-kpis">
        <button className={`noc-kpi ${status === 'all' && hasActiveFilters ? 'selected' : ''}`} onClick={() => reveal('all')}><span className="noc-kpi-icon blue"><Activity size={20} /></span><span className="noc-kpi-label">Total registrado</span><strong>{focused.length}</strong><span className="noc-kpi-link">Ver todos <ArrowRight size={14} /></span></button>
        <button className={`noc-kpi ${status === 'open' ? 'selected' : ''}`} onClick={() => reveal('open')}><span className="noc-kpi-icon orange"><RadioTower size={20} /></span><span className="noc-kpi-label">Incidentes abertos</span><strong>{openCount}</strong><span className="noc-kpi-link">Acompanhar <ArrowRight size={14} /></span></button>
        <button className={`noc-kpi ${status === 'closed' ? 'selected' : ''}`} onClick={() => reveal('closed')}><span className="noc-kpi-icon green"><CheckCircle2 size={20} /></span><span className="noc-kpi-label">Incidentes fechados</span><strong>{closedCount}</strong><span className="noc-kpi-link">Ver histórico <ArrowRight size={14} /></span></button>
      </div>

      <div className="noc-overview-grid">
        <section className="noc-panel noc-trend">
          <div className="noc-panel-heading"><div><span className="noc-section-kicker">MOVIMENTO</span><h2>Incidentes por abertura</h2><p>{period === 'all' ? 'Últimos 30 dias. ' : ''}Clique em uma coluna para filtrar a lista abaixo.</p></div><span className="noc-legend"><i className="opened" />Em aberto<i className="closed" />Concluídos</span></div>
          <div className="noc-chart" style={{ gridTemplateColumns: `repeat(${Math.max(1, trend.length)}, minmax(0, 1fr))` }} aria-label="Incidentes por data de abertura">{trend.map((item, index) => <div className="noc-chart-day" key={index}><div className="noc-chart-bars"><button className={`noc-bar opened ${bucket?.start.getTime() === item.start.getTime() && status === 'open' ? 'active' : ''}`} style={{ height: `${item.opened / trendMax * 100}%` }} title={`${item.opened} aberto(s) em ${item.label}`} aria-label={`${item.opened} abertos em ${item.label}`} onClick={() => { setBucket(item); setStatus('open'); }} disabled={!item.opened} /><button className={`noc-bar closed ${bucket?.start.getTime() === item.start.getTime() && status === 'closed' ? 'active' : ''}`} style={{ height: `${item.closed / trendMax * 100}%` }} title={`${item.closed} fechado(s) em ${item.label}`} aria-label={`${item.closed} fechados em ${item.label}`} onClick={() => { setBucket(item); setStatus('closed'); }} disabled={!item.closed} /></div><span>{item.label}</span></div>)}</div>
          {bucket && <button className="noc-inline-clear" onClick={() => setBucket(null)}>Exibindo {bucket.label} <X size={13} /></button>}
        </section>
        <section className="noc-panel noc-snapshot">
          <div className="noc-panel-heading"><div><span className="noc-section-kicker">DESEMPENHO</span><h2>Tempo de resolução</h2><p>Selecione um recorte para analisar os atendimentos.</p></div><Clock3 size={19} /></div>
          <div className="noc-snapshot-number">{Math.round(averageHours)}<span>h</span></div><p>Tempo médio dos {closedCount} {closedCount === 1 ? 'incidente fechado' : 'incidentes fechados'} no recorte atual</p>
          <div className="noc-performance-options"><button className={performance === 'all' ? 'active' : ''} onClick={() => setPerformance('all')}><span>Todos</span><strong>{performanceTotal}</strong></button><button className={performance === 'fast' ? 'active' : ''} onClick={() => { setPerformance('fast'); setStatus('closed'); setBreakdownSort('closed'); }}><span>Até 4h</span><strong>{fastestCount}</strong></button><button className={performance === 'slow' ? 'active' : ''} onClick={() => { setPerformance('slow'); setStatus('closed'); setBreakdownSort('closed'); }}><span>Acima de 24h</span><strong>{slowestCount}</strong></button></div>
        </section>
      </div>

      <div className="noc-overview-grid bottom">
        <section className="noc-panel"><div className="noc-panel-heading"><div><span className="noc-section-kicker">ACOMPANHAMENTO</span><h2>Abertos no recorte</h2></div><button className="noc-text-action" onClick={() => reveal('open')}>Ver todos <ArrowRight size={15} /></button></div>{focused.filter(item => !item.closedAt).slice(0, 4).length ? focused.filter(item => !item.closedAt).slice(0, 4).map(item => <button key={item.id} className="noc-recent-row" onClick={() => openDetail(item.id)}><span className="noc-recent-dot" /><span><strong>Tipo · {labels(item)[0]}</strong><small>Motivo · {labels(item)[1]}</small><small>Causa · {labels(item)[2]}</small><small>{item.description}</small></span><SlaClock openedAt={item.openedAt} compact /><ChevronRight size={16} /></button>) : <div className="noc-empty small"><CheckCircle2 size={26} /><strong>Nenhum incidente aberto</strong><span>Altere os filtros ou registre uma nova ocorrência.</span></div>}</section>
        <section className="noc-panel"><div className="noc-panel-heading"><div><span className="noc-section-kicker">EQUIPE</span><h2>Quem abriu e fechou</h2></div><Users size={19} /></div><div className="noc-team-tabs"><button className={teamMode === 'openers' ? 'active' : ''} onClick={() => setTeamMode('openers')}>Aberturas</button><button className={teamMode === 'closers' ? 'active' : ''} onClick={() => setTeamMode('closers')}>Fechamentos</button><button className={teamMode === 'performance' ? 'active' : ''} onClick={() => setTeamMode('performance')}>Desempenho</button></div><div className="noc-team-list">{ranking.length ? ranking.map((row, index) => { const role = teamMode === 'openers' ? 'opened' : 'closed'; const active = actor?.id === row.id && actor.role === role; return <button className={`noc-team-row ${active ? 'active' : ''}`} key={row.id} onClick={() => selectActor({ id: row.id, name: row.name, role })}><span className="noc-team-rank">{index + 1}</span><Person name={row.name} detail={teamMode === 'performance' ? `${row.count} encerramento(s)` : undefined} /><strong>{teamMode === 'performance' ? `${Math.round(row.hours / row.count)}h` : row.count}</strong><ChevronRight size={15} /></button>; }) : <div className="noc-empty small"><UserRound size={24} /><strong>Sem dados neste período</strong><span>Os responsáveis aparecerão após os registros.</span></div>}</div><button className="noc-team-all" onClick={() => setActor(null)} disabled={!actor}><Users size={14} /> Todos os usuários {actor && <X size={13} />}</button></section>
      </div>

      <section className="noc-panel noc-classification">
        <div className="noc-panel-heading"><div><span className="noc-section-kicker">CLASSIFICAÇÃO DINÂMICA</span><h2>Onde os incidentes se concentram</h2><p>Os rankings acompanham período, busca, usuário e desempenho. Selecione um tipo para detalhar motivos e causas.</p></div><button className="noc-text-action" onClick={() => setView('catalog')}>Configurar <ArrowRight size={15} /></button></div>
        <div className="noc-classification-toolbar"><div className="noc-filter-pills" aria-label="Ordenar classificação">{([{ id: 'total', label: 'Mais registrados' }, { id: 'open', label: 'Mais abertos' }, { id: 'closed', label: 'Mais fechados' }] as const).map(option => <button key={option.id} className={breakdownSort === option.id ? 'active' : ''} onClick={() => { if (option.id === 'open') setPerformance('all'); setBreakdownSort(option.id); setStatus(option.id === 'total' ? 'all' : option.id); }}>{option.label}</button>)}</div><span><i className="noc-class-dot open" />Abertos <i className="noc-class-dot closed" />Fechados</span></div>
        <div className="noc-breakdown-grid"><BreakdownColumn title="Tipos" rows={typeRows} selectedId={typeFilter} onSelect={row => selectBreakdown('type', row)} /><BreakdownColumn title="Motivos" rows={motiveRows} selectedId={motiveFilter} onSelect={row => selectBreakdown('motive', row)} /><BreakdownColumn title="Causas" rows={causeRows} selectedId={causeFilter} onSelect={row => selectBreakdown('cause', row)} /></div>
      </section>
    </>}

    {view === 'bi' && <Suspense fallback={<section className="noc-panel noc-empty"><BarChart3 size={28} /><strong>Preparando os gráficos...</strong></section>}><NocBI incidents={periodItems} types={store.types} period={period} range={range} onOpenIncident={openDetail} /></Suspense>}

    {(view === 'overview' || view === 'incidents') && <section ref={explorerRef} className="noc-panel noc-incidents">
      <div className="noc-panel-heading"><div><span className="noc-section-kicker">REGISTRO OPERACIONAL</span><h2>{status === 'open' ? 'Incidentes abertos' : status === 'closed' ? 'Incidentes fechados' : 'Todos os incidentes'} <span className="noc-count">{visible.length}</span></h2><p>Os resultados acompanham os filtros da dashboard.</p></div><button className="noc-primary compact" onClick={openCreate}><Plus size={16} /> Novo</button></div>
      {createdId && <div className="noc-created" role="status"><CheckCircle2 size={18} /><span><strong>Incidente registrado.</strong> Ele está na lista abaixo; abra o registro para acompanhar, comentar ou encerrar.</span><button onClick={() => setCreatedId(null)} aria-label="Dispensar aviso"><X size={15} /></button></div>}
      {hasActiveFilters && <div className="noc-active-filters">{actor && <button onClick={() => setActor(null)}>{actor.role === 'opened' ? 'Abriu' : 'Fechou'}: {actor.name} <X size={13} /></button>}{bucket && <button onClick={() => setBucket(null)}>Data: {bucket.label} <X size={13} /></button>}{performance !== 'all' && <button onClick={() => setPerformance('all')}>{performance === 'fast' ? 'Resolução até 4h' : 'Resolução acima de 24h'} <X size={13} /></button>}{typeFilter !== 'all' && <button onClick={() => { setTypeFilter('all'); setMotiveFilter('all'); setCauseFilter('all'); }}>Tipo: {store.types.find(item => item.id === typeFilter)?.name ?? 'Removido'} <X size={13} /></button>}{motiveFilter !== 'all' && <button onClick={() => { setMotiveFilter('all'); setCauseFilter('all'); }}>Motivo: {store.types.flatMap(item => item.motives).find(item => item.id === motiveFilter)?.name ?? 'Removido'} <X size={13} /></button>}{causeFilter !== 'all' && <button onClick={() => setCauseFilter('all')}>Causa: {store.types.flatMap(item => item.motives).flatMap(item => item.causes).find(item => item.id === causeFilter)?.name ?? 'Removida'} <X size={13} /></button>}<button className="clear-all" onClick={resetFilters}>Limpar filtros</button></div>}
      <div className="noc-filters"><label className="noc-search"><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar tipo, motivo, causa, descrição ou usuário" aria-label="Buscar incidentes" /></label><div className="noc-filter-pills" aria-label="Filtrar por situação">{([{ id: 'all', label: 'Todos' }, { id: 'open', label: 'Abertos' }, { id: 'closed', label: 'Fechados' }] as const).map(item => <button key={item.id} className={status === item.id ? 'active' : ''} onClick={() => setStatus(item.id)}>{item.label}</button>)}</div><label className="noc-type-filter"><Filter size={16} /><select value={typeFilter} onChange={event => { setTypeFilter(event.target.value); setMotiveFilter('all'); setCauseFilter('all'); }} aria-label="Filtrar por tipo"><option value="all">Todos os tipos</option>{store.types.map(type => <option value={type.id} key={type.id}>{type.name}</option>)}</select></label></div>
      <div className="noc-incident-list">{visible.length ? visible.map(item => <button className={`noc-incident-row noc-incident-card ${createdId === item.id ? 'new' : ''}`} key={item.id} onClick={() => openDetail(item.id)}>
        <span className="noc-incident-card-head"><span className={`noc-incident-status ${item.closedAt ? 'closed' : 'open'}`}>{item.closedAt ? <Check size={14} /> : <Activity size={14} />}{item.closedAt ? 'Fechado' : 'Aberto'}</span><span className="noc-incident-id">#{item.id.slice(0, 8)}</span><span className="noc-incident-date">Aberto em {dateTime(item.openedAt)}</span><ChevronRight size={18} className="noc-chevron" /></span>
        <span className="noc-incident-sequence">{labels(item).map((label, index) => <span key={index}><small>{['01 · Tipo', '02 · Motivo', '03 · Causa'][index]}</small><strong>{label}</strong></span>)}</span>
        <span className="noc-incident-description">{item.description}</span>
        <span className="noc-incident-card-foot"><Person name={item.openedBy.name} detail="Abriu o incidente" /><span className="noc-incident-foot-info"><span><PhoneCall size={13} />{item.activation ? `${item.activation.kind === 'internal' ? 'Interno' : 'Externo'} · ${item.activation.team} · ${dateTime(item.activation.at)}` : 'Sem acionamento'}</span><span><MessageSquare size={13} />{item.comments.length} {item.comments.length === 1 ? 'comentário' : 'comentários'}</span></span><SlaClock openedAt={item.openedAt} closedAt={item.closedAt} compact /></span>
      </button>) : <div className="noc-empty"><RadioTower size={30} /><strong>{store.incidents.length ? 'Nenhum resultado encontrado' : 'Seu NOC começa aqui'}</strong><span>{store.incidents.length ? 'Ajuste o período ou limpe os filtros.' : 'Cadastre o primeiro incidente para iniciar o acompanhamento.'}</span>{!store.incidents.length && <button className="noc-primary compact" onClick={openCreate}><Plus size={16} /> Novo incidente</button>}</div>}</div>
    </section>}

    {view === 'catalog' && <section className="noc-panel noc-catalog">
      <div className="noc-panel-heading"><div><span className="noc-section-kicker">CLASSIFICAÇÃO</span><h2>Tipos, motivos e causas</h2><p>Monte a sequência usada na abertura de cada incidente.</p></div></div>
      <div className="noc-catalog-flow">
        <div className="noc-catalog-column"><div className="noc-catalog-title"><span>01</span><strong>Tipos de incidente</strong></div><div className="noc-catalog-items">{store.types.map(item => <div key={item.id} className={`noc-catalog-item ${selectedTypeId === item.id ? 'active' : ''}`}><button onClick={() => { setSelectedTypeId(item.id); setSelectedMotiveId(item.motives[0]?.id ?? ''); }}><span>{item.name}</span><ChevronRight size={16} /></button><button className="noc-delete" title="Excluir tipo" aria-label={`Excluir tipo ${item.name}`} onClick={() => removeCatalogItem('type', item.id)}><Trash2 size={15} /></button><button className="noc-edit" onClick={() => setEditing({ level: 'type', id: item.id, name: item.name })}>Editar</button></div>)}</div><form className="noc-add" onSubmit={event => { event.preventDefault(); addCatalogItem('type'); }}><input value={newTypeName} onChange={event => setNewTypeName(event.target.value)} placeholder="Novo tipo" aria-label="Novo tipo" maxLength={80} /><button aria-label="Adicionar tipo" type="submit"><Plus size={17} /></button></form></div>
        <div className="noc-catalog-column"><div className="noc-catalog-title"><span>02</span><strong>Motivos</strong></div><div className="noc-catalog-items">{selectedType?.motives.map(item => <div key={item.id} className={`noc-catalog-item ${selectedMotiveId === item.id ? 'active' : ''}`}><button onClick={() => setSelectedMotiveId(item.id)}><span>{item.name}</span><ChevronRight size={16} /></button><button className="noc-delete" title="Excluir motivo" aria-label={`Excluir motivo ${item.name}`} onClick={() => removeCatalogItem('motive', item.id)}><Trash2 size={15} /></button><button className="noc-edit" onClick={() => setEditing({ level: 'motive', id: item.id, name: item.name })}>Editar</button></div>)}{!selectedType && <p className="noc-catalog-hint">Selecione um tipo primeiro.</p>}</div><form className="noc-add" onSubmit={event => { event.preventDefault(); addCatalogItem('motive'); }}><input disabled={!selectedType} value={newMotiveName} onChange={event => setNewMotiveName(event.target.value)} placeholder="Novo motivo" aria-label="Novo motivo" maxLength={80} /><button disabled={!selectedType} aria-label="Adicionar motivo" type="submit"><Plus size={17} /></button></form></div>
        <div className="noc-catalog-column"><div className="noc-catalog-title"><span>03</span><strong>Causas</strong></div><div className="noc-catalog-items">{selectedMotive?.causes.map(item => <div key={item.id} className="noc-catalog-item"><span className="noc-cause-name">{item.name}</span><button className="noc-delete" title="Excluir causa" aria-label={`Excluir causa ${item.name}`} onClick={() => removeCatalogItem('cause', item.id)}><Trash2 size={15} /></button><button className="noc-edit" onClick={() => setEditing({ level: 'cause', id: item.id, name: item.name })}>Editar</button></div>)}{!selectedMotive && <p className="noc-catalog-hint">Selecione um motivo primeiro.</p>}</div><form className="noc-add" onSubmit={event => { event.preventDefault(); addCatalogItem('cause'); }}><input disabled={!selectedMotive} value={newCauseName} onChange={event => setNewCauseName(event.target.value)} placeholder="Nova causa" aria-label="Nova causa" maxLength={80} /><button disabled={!selectedMotive} aria-label="Adicionar causa" type="submit"><Plus size={17} /></button></form></div>
      </div><p className="noc-catalog-note">Exemplo: TV PLUS <ChevronRight size={13} /> Encoder <ChevronRight size={13} /> Desligou. Categorias vinculadas a incidentes podem ser renomeadas, mas não excluídas.</p>
    </section>}

    <Dialog open={incidentOpen} onOpenChange={setIncidentOpen}><DialogContent className="noc-dialog noc-create-dialog">
      <DialogTitle>Novo incidente</DialogTitle><DialogDescription>Preencha a classificação em sequência e registre o ocorrido.</DialogDescription>
      <form onSubmit={createIncident} className="noc-form noc-sequential-form">
        <section className="noc-form-section"><div className="noc-step-heading"><span>01</span><div><strong>Classificação</strong><small>Escolha tipo, depois motivo e por fim causa.</small></div></div>
          <label>Tipo<select value={form.typeId} onChange={event => setForm({ ...form, typeId: event.target.value, motiveId: '', causeId: '' })} required><option value="">Selecione o tipo</option>{store.types.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Motivo<select value={form.motiveId} onChange={event => setForm({ ...form, motiveId: event.target.value, causeId: '' })} disabled={!form.typeId} required><option value="">{form.typeId ? 'Selecione o motivo' : 'Escolha um tipo primeiro'}</option>{formType?.motives.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Causa<select value={form.causeId} onChange={event => setForm({ ...form, causeId: event.target.value })} disabled={!form.motiveId} required><option value="">{form.motiveId ? 'Selecione a causa' : 'Escolha um motivo primeiro'}</option>{formMotive?.causes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        </section>
        <section className="noc-form-section"><div className="noc-step-heading"><span>02</span><div><strong>Ocorrido</strong><small>Descreva o impacto e o que foi observado.</small></div></div><label>Descrição do ocorrido<textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="O que aconteceu? Qual o impacto percebido?" rows={4} required /></label></section>
        <section className="noc-form-section"><div className="noc-step-heading"><span>03</span><div><strong>Acionamento da equipe</strong><small>Pode ser registrado agora ou depois, no incidente aberto.</small></div></div>
          <div className="noc-activation-choices" role="group" aria-label="Tipo de acionamento">{([{ value: '', label: 'Ainda não acionada' }, { value: 'internal', label: 'Interno' }, { value: 'external', label: 'Externo' }] as const).map(option => <button type="button" key={option.label} className={form.activationKind === option.value ? 'active' : ''} aria-pressed={form.activationKind === option.value} onClick={() => setForm({ ...form, activationKind: option.value, activationAt: option.value && !form.activationAt ? localDateTimeInput() : form.activationAt })}>{option.label}</button>)}</div>
          {form.activationKind && <div className="noc-activation-fields"><label>Equipe ou parceiro acionado<input value={form.activationTeam} onChange={event => setForm({ ...form, activationTeam: event.target.value })} placeholder="Nome da equipe ou parceiro" required /></label><label>Data e hora do acionamento<input type="datetime-local" value={form.activationAt} onChange={event => setForm({ ...form, activationAt: event.target.value })} required /></label></div>}
        </section>
        {formError && <p className="noc-form-error" role="alert">{formError}</p>}{!store.types.some(item => item.motives.some(motive => motive.causes.length)) && <p className="noc-form-help">Configure ao menos um tipo, motivo e causa para registrar incidentes.</p>}
        <div className="noc-dialog-actions"><button type="button" className="noc-secondary" onClick={() => setIncidentOpen(false)}>Cancelar</button><button type="submit" className="noc-primary">Registrar incidente</button></div>
      </form>
    </DialogContent></Dialog>

    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelectedId(null); }}><DialogContent className="noc-dialog noc-detail-dialog">{selected && <>
      <div className="noc-detail-top"><div><DialogTitle>Incidente #{selected.id.slice(0, 8)}</DialogTitle><DialogDescription>Acompanhamento, acionamento e histórico da ocorrência.</DialogDescription></div><span className={`noc-incident-status ${selected.closedAt ? 'closed' : 'open'}`}>{selected.closedAt ? 'Fechado' : 'Aberto'}</span></div>
      <SlaClock openedAt={selected.openedAt} closedAt={selected.closedAt} />
      <p className="noc-sla-note">Cronômetro desde a abertura; ainda não há uma meta de vencimento configurada.</p>
      <div className="noc-detail-classification">{labels(selected).map((label, index) => <div key={index}><span>{pad(index + 1)}</span><small>{['Tipo', 'Motivo', 'Causa'][index]}</small><strong>{label}</strong></div>)}</div>
      <div className="noc-detail-block"><h3>Descrição do ocorrido</h3><p>{selected.description}</p></div>
      <div className="noc-detail-block noc-activation-block"><div className="noc-detail-block-heading"><h3>Acionamento da equipe</h3><PhoneCall size={17} /></div>
        {selected.activation ? <div className="noc-activation-summary"><strong>{selected.activation.kind === 'internal' ? 'Interno' : 'Externo'} · {selected.activation.team}</strong><span>Acionada em {dateTime(selected.activation.at)}</span><small>Registrado por {selected.activation.recordedBy.name}</small></div> : <><p className="noc-muted-copy">Nenhuma equipe acionada registrada.</p>{!selected.closedAt && !activationOpen && <button className="noc-secondary" onClick={() => { setActivationOpen(true); setActivationDraft({ kind: '', team: '', at: localDateTimeInput() }); }}>Registrar acionamento</button>}{!selected.closedAt && activationOpen && <form className="noc-form noc-inline-activation" onSubmit={registerActivation}><div className="noc-activation-choices" role="group" aria-label="Tipo de acionamento">{([{ kind: 'internal', label: 'Interno' }, { kind: 'external', label: 'Externo' }] as const).map(option => <button type="button" key={option.kind} className={activationDraft.kind === option.kind ? 'active' : ''} aria-pressed={activationDraft.kind === option.kind} onClick={() => setActivationDraft({ ...activationDraft, kind: option.kind })}>{option.label}</button>)}</div><label>Equipe ou parceiro acionado<input value={activationDraft.team} onChange={event => setActivationDraft({ ...activationDraft, team: event.target.value })} placeholder="Nome da equipe ou parceiro" required /></label><label>Data e hora do acionamento<input type="datetime-local" value={activationDraft.at} onChange={event => setActivationDraft({ ...activationDraft, at: event.target.value })} required /></label><div className="noc-dialog-actions"><button type="button" className="noc-secondary" onClick={() => setActivationOpen(false)}>Cancelar</button><button type="submit" className="noc-primary compact">Salvar acionamento</button></div></form>}</>}
      </div>
      <div className="noc-detail-timeline"><div><span className="noc-timeline-marker opened" /><Person name={selected.openedBy.name} detail={`Abriu em ${dateTime(selected.openedAt)}`} /></div>{selected.closedAt && selected.closedBy && <div><span className="noc-timeline-marker closed" /><Person name={selected.closedBy.name} detail={`Fechou em ${dateTime(selected.closedAt)}`} /></div>}</div>
      <section className="noc-comments"><div className="noc-detail-block-heading"><h3>Comentários <span className="noc-count">{selected.comments.length}</span></h3><MessageSquare size={17} /></div>{selected.comments.length ? <div className="noc-comment-list">{selected.comments.map(comment => <div className="noc-comment" key={comment.id}><div><Person name={comment.createdBy.name} detail={dateTime(comment.createdAt)} /></div><p>{comment.body}</p></div>)}</div> : <p className="noc-muted-copy">Nenhum comentário registrado.</p>}{!selected.closedAt && <form className="noc-form noc-comment-form" onSubmit={addComment}><label>Adicionar comentário<textarea value={commentDraft} onChange={event => setCommentDraft(event.target.value)} rows={3} placeholder="Registre uma atualização, ação tomada ou observação..." required /></label><button className="noc-secondary" type="submit" disabled={!commentDraft.trim()}><Send size={15} /> Publicar comentário</button></form>}</section>
      {selected.closedAt && <div className="noc-detail-block resolution"><h3>Resolução</h3><p>{selected.resolution}</p></div>}
      {detailError && <p className="noc-form-error" role="alert">{detailError}</p>}
      {!selected.closedAt && <div className="noc-detail-footer"><span>Conclua somente após registrar a solução aplicada.</span><button className="noc-primary" onClick={() => { setClosingId(selected.id); setSelectedId(null); }}>Fechar incidente <ArrowRight size={16} /></button></div>}
    </>}</DialogContent></Dialog>

    <Dialog open={!!closing} onOpenChange={open => { if (!open) { setClosingId(null); setResolution(''); } }}><DialogContent className="noc-dialog"><DialogTitle>Fechar incidente</DialogTitle><DialogDescription>Incidente #{closing?.id.slice(0, 8)}. Descreva a solução aplicada para registrar o histórico.</DialogDescription>{closing && <div className="noc-detail-classification">{labels(closing).map((label, index) => <div key={index}><span>{pad(index + 1)}</span><small>{['Tipo', 'Motivo', 'Causa'][index]}</small><strong>{label}</strong></div>)}</div>}<form className="noc-form" onSubmit={closeIncident}><label>Como foi resolvido?<textarea value={resolution} onChange={event => setResolution(event.target.value)} rows={5} placeholder="Descreva a ação executada e o resultado..." required /></label><div className="noc-dialog-actions"><button type="button" className="noc-secondary" onClick={() => setClosingId(null)}>Cancelar</button><button type="submit" className="noc-primary"><Check size={16} /> Confirmar fechamento</button></div></form></DialogContent></Dialog>

    <Dialog open={!!editing} onOpenChange={open => { if (!open) setEditing(null); }}><DialogContent className="noc-dialog"><DialogTitle>Renomear {editing?.level === 'type' ? 'tipo' : editing?.level === 'motive' ? 'motivo' : 'causa'}</DialogTitle><DialogDescription>Os incidentes associados passarão a mostrar o novo nome.</DialogDescription><form className="noc-form" onSubmit={event => { event.preventDefault(); renameCatalogItem(); }}><label>Nome<input value={editing?.name ?? ''} onChange={event => setEditing(editing ? { ...editing, name: event.target.value } : null)} required maxLength={80} /></label><div className="noc-dialog-actions"><button type="button" className="noc-secondary" onClick={() => setEditing(null)}>Cancelar</button><button type="submit" className="noc-primary">Salvar nome</button></div></form></DialogContent></Dialog>
  </div>;
}
