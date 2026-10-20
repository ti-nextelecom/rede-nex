import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, BarChart3, CheckCircle2, Clock3, FilterX, Search, Users, X } from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { makeNocBuckets, resolutionHours, inNocRange, type NocBucket, type NocDateRange, type NocPeriod } from '../lib/nocAnalytics';
import type { NocIncident, NocType } from '../lib/nocStore';
import './noc-bi.css';

type Status = 'all' | 'open' | 'closed';
type Dimension = 'type' | 'motive' | 'cause';
type CatalogRow = { id: string; typeId: string; motiveId: string; name: string; context: string; open: number; closed: number; total: number };
type PersonRow = { id: string; name: string; opened: number; closed: number; total: number };

const orange = '#fb923c';
const green = '#34d399';
const tooltipStyle = { background: '#15202e', border: '1px solid #334155', borderRadius: 10, color: '#f8fafc', fontSize: 11 };
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

function aggregate(incidents: NocIncident[], types: NocType[], dimension: Dimension): CatalogRow[] {
  const rows = new Map<string, CatalogRow>();
  for (const item of incidents) {
    const type = types.find(entry => entry.id === item.typeId);
    const motive = type?.motives.find(entry => entry.id === item.motiveId);
    const cause = motive?.causes.find(entry => entry.id === item.causeId);
    const id = dimension === 'type' ? item.typeId : dimension === 'motive' ? item.motiveId : item.causeId;
    const name = dimension === 'type' ? type?.name ?? 'Tipo removido' : dimension === 'motive' ? motive?.name ?? 'Motivo removido' : cause?.name ?? 'Causa removida';
    const context = dimension === 'type' ? '' : dimension === 'motive' ? type?.name ?? 'Tipo removido' : `${type?.name ?? 'Tipo removido'} / ${motive?.name ?? 'Motivo removido'}`;
    const row = rows.get(id) ?? { id, typeId: item.typeId, motiveId: item.motiveId, name, context, open: 0, closed: 0, total: 0 };
    row.total += 1;
    if (item.closedAt) row.closed += 1; else row.open += 1;
    rows.set(id, row);
  }
  return [...rows.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));
}

function aggregatePeople(incidents: NocIncident[]): PersonRow[] {
  const rows = new Map<string, PersonRow>();
  for (const item of incidents) {
    const opener = rows.get(item.openedBy.id) ?? { id: item.openedBy.id, name: item.openedBy.name, opened: 0, closed: 0, total: 0 };
    opener.opened += 1;
    opener.total += 1;
    rows.set(opener.id, opener);
    if (item.closedBy) {
      const closer = rows.get(item.closedBy.id) ?? { id: item.closedBy.id, name: item.closedBy.name, opened: 0, closed: 0, total: 0 };
      closer.closed += 1;
      closer.total += 1;
      rows.set(closer.id, closer);
    }
  }
  return [...rows.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));
}

function Metric({ label, value, hint, icon: Icon, tone, onClick, selected }: {
  label: string; value: string | number; hint: string; icon: typeof Activity; tone: string; onClick?: () => void; selected?: boolean;
}) {
  const content = <><span className={`noc-bi-metric-icon ${tone}`}><Icon size={18} /></span><span className="noc-bi-metric-copy"><small>{label}</small><strong>{value}</strong><em>{hint}</em></span></>;
  return onClick ? <button className={`noc-bi-metric ${selected ? 'active' : ''}`} onClick={onClick}>{content}</button> : <div className="noc-bi-metric">{content}</div>;
}

function RankingChart({ title, subtitle, rows, activeId, onSelect }: {
  title: string; subtitle: string; rows: CatalogRow[]; activeId: string; onSelect: (row: CatalogRow) => void;
}) {
  const shown = rows.slice(0, 8).map(row => ({ ...row, shortName: row.name.length > 16 ? `${row.name.slice(0, 15)}…` : row.name }));
  return <section className="noc-bi-card">
    <div className="noc-bi-card-heading"><div><span className="noc-section-kicker">RANKING</span><h3>{title}</h3><p>{subtitle}</p></div><span className="noc-bi-small-total">{rows.length} categorias</span></div>
    {shown.length ? <div className="noc-bi-chart" style={{ height: Math.max(230, shown.length * 40) }}><ResponsiveContainer width="100%" height="100%"><BarChart data={shown} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 0 }} barCategoryGap="33%"><CartesianGrid stroke="rgba(148,163,184,.11)" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis dataKey="shortName" type="category" width={110} tick={{ fill: '#cbd5e1', fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [value, name === 'open' ? 'Abertos' : 'Fechados']} labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ''} /><Bar dataKey="open" stackId="count" fill={orange} radius={[3, 0, 0, 3]} isAnimationActive={false} onClick={entry => onSelect(entry.payload as CatalogRow)} /><Bar dataKey="closed" stackId="count" fill={green} radius={[0, 3, 3, 0]} isAnimationActive={false} onClick={entry => onSelect(entry.payload as CatalogRow)} /></BarChart></ResponsiveContainer></div> : <div className="noc-bi-empty">Sem incidentes para este gráfico.</div>}
    <div className="noc-bi-ranking-list">{shown.map((row, index) => <button key={row.id} className={activeId === row.id ? 'active' : ''} onClick={() => onSelect(row)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{row.name}</strong><small>{row.open} abertos · {row.closed} fechados</small><ArrowRight size={13} /></button>)}</div>
    {rows.length > 8 && <p className="noc-bi-overflow">Exibindo os 8 primeiros. A visão geral mostra todas as categorias.</p>}
  </section>;
}

export function NocBI({ incidents, types, period, range, onOpenIncident }: {
  incidents: NocIncident[]; types: NocType[]; period: NocPeriod; range: NocDateRange | null; onOpenIncident: (id: string) => void;
}) {
  const [status, setStatus] = useState<Status>('all');
  const [typeId, setTypeId] = useState('all');
  const [motiveId, setMotiveId] = useState('all');
  const [causeId, setCauseId] = useState('all');
  const [userKey, setUserKey] = useState('all');
  const [query, setQuery] = useState('');
  const [bucket, setBucket] = useState<NocBucket | null>(null);
  const [showAll, setShowAll] = useState(false);

  const rangeStart = range?.start.getTime() ?? 0;
  const rangeEnd = range?.end.getTime() ?? 0;
  useEffect(() => setBucket(null), [period, rangeStart, rangeEnd]);

  const catalog = useMemo(() => {
    const names = new Map<string, string>();
    for (const type of types) {
      names.set(type.id, type.name);
      for (const motive of type.motives) {
        names.set(motive.id, motive.name);
        for (const cause of motive.causes) names.set(cause.id, cause.name);
      }
    }
    return names;
  }, [types]);

  const allPeople = useMemo(() => aggregatePeople(incidents), [incidents]);
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
  const searched = useMemo(() => incidents.filter(item => {
    const search = `${catalog.get(item.typeId) ?? ''} ${catalog.get(item.motiveId) ?? ''} ${catalog.get(item.causeId) ?? ''} ${item.description} ${item.openedBy.name} ${item.closedBy?.name ?? ''} ${item.activation?.team ?? ''} ${(item.comments ?? []).map(comment => comment.body).join(' ')}`.toLocaleLowerCase('pt-BR');
    return !normalizedQuery || search.includes(normalizedQuery);
  }), [incidents, catalog, normalizedQuery]);
  const common = useMemo(() => searched.filter(item => userKey === 'all' || (userKey.startsWith('opened:') ? item.openedBy.id === userKey.slice(7) : item.closedBy?.id === userKey.slice(7))), [searched, userKey]);
  const statusSource = common.filter(item => status === 'all' || (status === 'open' ? !item.closedAt : !!item.closedAt));
  const matchesClassification = (item: NocIncident) => (typeId === 'all' || item.typeId === typeId) && (motiveId === 'all' || item.motiveId === motiveId) && (causeId === 'all' || item.causeId === causeId);
  const classification = statusSource.filter(matchesClassification);
  const timeline = makeNocBuckets(classification, range, period);
  const timelineData = timeline.map(item => ({ ...item, open: item.opened, closed: item.closed }));
  const inBucket = (item: NocIncident) => !bucket || inNocRange(item.openedAt, bucket);
  const focused = classification.filter(inBucket);
  const summarySource = common.filter(item => matchesClassification(item) && inBucket(item));
  const typeRows = aggregate(statusSource.filter(inBucket), types, 'type');
  const motiveRows = aggregate(statusSource.filter(item => inBucket(item) && (typeId === 'all' || item.typeId === typeId)), types, 'motive');
  const causeRows = aggregate(statusSource.filter(item => inBucket(item) && (typeId === 'all' || item.typeId === typeId) && (motiveId === 'all' || item.motiveId === motiveId)), types, 'cause');
  const peopleRows = aggregatePeople(searched.filter(item => (status === 'all' || (status === 'open' ? !item.closedAt : !!item.closedAt)) && matchesClassification(item) && inBucket(item)));
  const openCount = summarySource.filter(item => !item.closedAt).length;
  const closedCount = summarySource.length - openCount;
  const averageHours = closedCount ? summarySource.reduce((sum, item) => sum + (resolutionHours(item) ?? 0), 0) / closedCount : 0;
  const closureRate = summarySource.length ? Math.round(closedCount / summarySource.length * 100) : 0;
  const listed = [...focused].sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  const topType = aggregate(focused, types, 'type')[0];
  const topMotive = aggregate(focused, types, 'motive')[0];
  const topCause = aggregate(focused, types, 'cause')[0];
  const activeFilters = status !== 'all' || typeId !== 'all' || motiveId !== 'all' || causeId !== 'all' || userKey !== 'all' || !!bucket || !!query;

  function reset() {
    setStatus('all'); setTypeId('all'); setMotiveId('all'); setCauseId('all'); setUserKey('all'); setBucket(null); setQuery(''); setShowAll(false);
  }

  function selectRow(dimension: Dimension, row: CatalogRow) {
    if (dimension === 'type') { setTypeId(current => current === row.id ? 'all' : row.id); setMotiveId('all'); setCauseId('all'); }
    if (dimension === 'motive') { setTypeId(row.typeId); setMotiveId(current => current === row.id ? 'all' : row.id); setCauseId('all'); }
    if (dimension === 'cause') { setTypeId(row.typeId); setMotiveId(row.motiveId); setCauseId(current => current === row.id ? 'all' : row.id); }
  }

  return <div className="noc-bi">
    <section className="noc-bi-intro"><div><span className="noc-section-kicker">INTELIGÊNCIA OPERACIONAL</span><h2>BI de incidentes</h2><p>Explore padrões, responsáveis e desempenho. Os cartões preservam os totais para comparação; gráficos e registros acompanham os recortes deste navegador.</p></div><BarChart3 size={31} /></section>

    <section className="noc-bi-controls" aria-label="Filtros do BI">
      <label className="noc-bi-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar classificação, descrição ou pessoa" aria-label="Buscar no BI" /></label>
      <div className="noc-filter-pills" aria-label="Filtrar situação no BI">{([{ id: 'all', label: 'Todos' }, { id: 'open', label: 'Abertos' }, { id: 'closed', label: 'Fechados' }] as const).map(option => <button key={option.id} className={status === option.id ? 'active' : ''} onClick={() => setStatus(option.id)}>{option.label}</button>)}</div>
      <select value={typeId} onChange={event => { setTypeId(event.target.value); setMotiveId('all'); setCauseId('all'); }} aria-label="Filtrar tipo"><option value="all">Todos os tipos</option>{types.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select>
      <select value={userKey} onChange={event => setUserKey(event.target.value)} aria-label="Filtrar usuário"><option value="all">Todos os usuários</option>{allPeople.map(person => <optgroup label={person.name} key={person.id}><option value={`opened:${person.id}`}>Abriu: {person.name}</option><option value={`closed:${person.id}`}>Fechou: {person.name}</option></optgroup>)}</select>
      <button className="noc-bi-reset" onClick={reset} disabled={!activeFilters}><FilterX size={15} /> Limpar</button>
    </section>

    {activeFilters && <div className="noc-bi-active">{typeId !== 'all' && <button onClick={() => { setTypeId('all'); setMotiveId('all'); setCauseId('all'); }}>Tipo: {catalog.get(typeId) ?? 'Removido'} <X size={12} /></button>}{motiveId !== 'all' && <button onClick={() => { setMotiveId('all'); setCauseId('all'); }}>Motivo: {catalog.get(motiveId) ?? 'Removido'} <X size={12} /></button>}{causeId !== 'all' && <button onClick={() => setCauseId('all')}>Causa: {catalog.get(causeId) ?? 'Removida'} <X size={12} /></button>}{bucket && <button onClick={() => setBucket(null)}>Período do gráfico: {bucket.label} <X size={12} /></button>}</div>}

    <div className="noc-bi-metrics">
      <Metric label="Incidentes no recorte" value={summarySource.length} hint="Total analisado" icon={BarChart3} tone="blue" onClick={() => setStatus('all')} selected={status === 'all'} />
      <Metric label="Em aberto" value={openCount} hint="Aguardando solução" icon={Activity} tone="orange" onClick={() => setStatus('open')} selected={status === 'open'} />
      <Metric label="Fechados" value={closedCount} hint="Com resolução registrada" icon={CheckCircle2} tone="green" onClick={() => setStatus('closed')} selected={status === 'closed'} />
      <Metric label="Taxa de fechamento" value={`${closureRate}%`} hint="Fechados sobre o total" icon={CheckCircle2} tone="green" />
      <Metric label="Tempo médio" value={`${Math.round(averageHours)}h`} hint="Entre abertura e fechamento" icon={Clock3} tone="blue" />
    </div>

    <div className="noc-bi-main-grid">
      <section className="noc-bi-card noc-bi-timeline"><div className="noc-bi-card-heading"><div><span className="noc-section-kicker">EVOLUÇÃO</span><h3>Movimento no período</h3><p>{period === 'all' ? 'Gráfico dos últimos 30 dias. ' : ''}Selecione um intervalo abaixo para aprofundar.</p></div><span className="noc-bi-small-total">Por data de abertura</span></div>
        {timelineData.length ? <div className="noc-bi-chart tall"><ResponsiveContainer width="100%" height="100%"><AreaChart data={timelineData} margin={{ top: 12, right: 10, left: -20, bottom: 0 }}><defs><linearGradient id="nocBiOpen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={orange} stopOpacity={.35} /><stop offset="100%" stopColor={orange} stopOpacity={0} /></linearGradient><linearGradient id="nocBiClosed" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={green} stopOpacity={.28} /><stop offset="100%" stopColor={green} stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} /><XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [value, name === 'open' ? 'Em aberto' : 'Fechados']} /><Legend formatter={value => value === 'open' ? 'Em aberto' : 'Fechados'} wrapperStyle={{ fontSize: 11 }} /><Area type="monotone" dataKey="open" stroke={orange} fill="url(#nocBiOpen)" strokeWidth={2} isAnimationActive={false} /><Area type="monotone" dataKey="closed" stroke={green} fill="url(#nocBiClosed)" strokeWidth={2} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div> : <div className="noc-bi-empty">Selecione um período válido para visualizar a evolução.</div>}
        <div className="noc-bi-buckets">{timeline.map(item => <button key={item.start.toISOString()} className={bucket?.start.getTime() === item.start.getTime() ? 'active' : ''} onClick={() => setBucket(current => current?.start.getTime() === item.start.getTime() ? null : item)}><strong>{item.label}</strong><span>{item.opened + item.closed}</span></button>)}</div>
      </section>
      <section className="noc-bi-card noc-bi-status"><div className="noc-bi-card-heading"><div><span className="noc-section-kicker">SITUAÇÃO</span><h3>Abertos x fechados</h3><p>Distribuição do recorte selecionado.</p></div></div>
        {summarySource.length ? <div className="noc-bi-chart donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: 'Abertos', value: openCount, key: 'open' }, { name: 'Fechados', value: closedCount, key: 'closed' }]} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="83%" paddingAngle={4} stroke="none" isAnimationActive={false} onClick={entry => setStatus(entry.key as Status)}><Cell fill={orange} /><Cell fill={green} /></Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer><div className="noc-bi-donut-center"><strong>{summarySource.length}</strong><small>incidentes</small></div></div> : <div className="noc-bi-empty">Sem dados neste recorte.</div>}
        <div className="noc-bi-status-legend"><button onClick={() => setStatus('open')}><i className="open" /> Abertos <strong>{openCount}</strong></button><button onClick={() => setStatus('closed')}><i className="closed" /> Fechados <strong>{closedCount}</strong></button></div>
      </section>
    </div>

    <div className="noc-bi-rankings"><RankingChart title="Tipos com maior volume" subtitle="Selecione um tipo para aprofundar motivos e causas." rows={typeRows} activeId={typeId} onSelect={row => selectRow('type', row)} /><RankingChart title="Motivos recorrentes" subtitle={typeId === 'all' ? 'Todos os tipos.' : `Dentro de ${catalog.get(typeId) ?? 'tipo selecionado'}.`} rows={motiveRows} activeId={motiveId} onSelect={row => selectRow('motive', row)} /><RankingChart title="Causas recorrentes" subtitle={motiveId === 'all' ? 'Todos os motivos do recorte.' : `Dentro de ${catalog.get(motiveId) ?? 'motivo selecionado'}.`} rows={causeRows} activeId={causeId} onSelect={row => selectRow('cause', row)} /></div>

    <div className="noc-bi-bottom-grid">
      <section className="noc-bi-card"><div className="noc-bi-card-heading"><div><span className="noc-section-kicker">PESSOAS</span><h3>Atividade por usuário</h3><p>Selecione quem abriu ou fechou para isolar os registros.</p></div><Users size={19} /></div><div className="noc-bi-people">{peopleRows.length ? peopleRows.slice(0, 10).map((person, index) => <div className="noc-bi-person" key={person.id}><span className="noc-bi-person-rank">{index + 1}</span><strong>{person.name}</strong><button className={userKey === `opened:${person.id}` ? 'active' : ''} onClick={() => setUserKey(current => current === `opened:${person.id}` ? 'all' : `opened:${person.id}`)}>{person.opened} abriu</button><button className={userKey === `closed:${person.id}` ? 'active' : ''} onClick={() => setUserKey(current => current === `closed:${person.id}` ? 'all' : `closed:${person.id}`)}>{person.closed} fechou</button></div>) : <div className="noc-bi-empty">Nenhuma atividade no recorte.</div>}</div></section>
      <section className="noc-bi-card"><div className="noc-bi-card-heading"><div><span className="noc-section-kicker">LEITURA RÁPIDA</span><h3>Principais sinais</h3><p>Resumo calculado a partir dos filtros atuais.</p></div><Activity size={19} /></div><div className="noc-bi-insights"><div><small>Tipo mais frequente</small><strong>{topType?.name ?? 'Sem dados'}</strong><span>{topType?.total ?? 0} incidentes</span></div><div><small>Motivo recorrente</small><strong>{topMotive?.name ?? 'Sem dados'}</strong><span>{topMotive?.total ?? 0} incidentes</span></div><div><small>Causa recorrente</small><strong>{topCause?.name ?? 'Sem dados'}</strong><span>{topCause?.total ?? 0} incidentes</span></div></div></section>
    </div>

    <section className="noc-bi-card noc-bi-records"><div className="noc-bi-card-heading"><div><span className="noc-section-kicker">DADOS QUE EXPLICAM OS GRÁFICOS</span><h3>Incidentes do recorte <span className="noc-count">{listed.length}</span></h3><p>Abra um registro para ver descrição, responsáveis e resolução.</p></div></div><div className="noc-bi-record-list">{listed.length ? listed.slice(0, showAll ? listed.length : 8).map(item => <button key={item.id} onClick={() => onOpenIncident(item.id)}><span className={`noc-incident-status ${item.closedAt ? 'closed' : 'open'}`}>{item.closedAt ? 'Fechado' : 'Aberto'}</span><span className="noc-bi-record-content"><span className="noc-bi-record-class"><span><small>Tipo</small><strong>{catalog.get(item.typeId) ?? 'Tipo removido'}</strong></span><span><small>Motivo</small><strong>{catalog.get(item.motiveId) ?? 'Motivo removido'}</strong></span><span><small>Causa</small><strong>{catalog.get(item.causeId) ?? 'Causa removida'}</strong></span></span><small>{item.description}</small></span><em>{shortDate.format(new Date(item.openedAt))}</em><ArrowRight size={15} /></button>) : <div className="noc-bi-empty">Nenhum incidente corresponde aos filtros. Experimente limpar o recorte.</div>}</div>{listed.length > 8 && <button className="noc-bi-show-all" onClick={() => setShowAll(current => !current)}>{showAll ? 'Mostrar menos' : `Ver todos os ${listed.length} incidentes`} <ArrowRight size={14} /></button>}</section>
  </div>;
}
