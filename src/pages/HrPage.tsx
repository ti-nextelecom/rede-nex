import { Component, useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, ArrowUpRight, CalendarDays, CheckCircle2, Clock, Download, HelpCircle, History, LockKeyhole, Pencil, Plus, RefreshCw, Search, ShieldCheck, Users, X, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useHrAccess } from '../lib/hrAccess';
import { bulkGenerateVacations, exportHr, listHr, listHrHistory, type HrAuditRecord, type HrRecord, type HrTable } from '../lib/hrApi';
import { HrRecordForm } from '../components/HrRecordForm';
import { HrAvatar } from '../components/HrAvatar';
import { asoSummary, vacationSummary } from '../../shared/hr.mjs';
import './hr.css';

type Tab = 'overview' | HrTable | 'logs' | 'timeline';
const labels: Record<Tab,string> = { overview:'Visão geral',asos:'Cronograma de ASO',vacations:'Cronograma de Férias',employees:'Colaboradores do RH',logs:'Logs de Auditoria',timeline:'Linha do Tempo' };
const dateLabel = (v?: string|null) => v ? new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC'}).format(new Date(v+'T12:00:00Z')) : 'Não informado';
const monthLabel = (v?: string|null) => v ? new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(v.slice(0,7)+'-01T12:00:00Z')) : 'Sem programação';
const vacationLabels: Record<string,string> = { draft:'A programar',planned:'Programadas',completed:'Concluídas',cancelled:'Canceladas' };
const sumAso = (r: HrRecord, t: string) => asoSummary({...r, periodicity_months:r.periodicity_months||12}, t);
const sumVac = (r: HrRecord, t: string) => vacationSummary({...r, leave_days:r.leave_days||30, concession_end:r.concession_end||'', acquisition_end:r.acquisition_end||''}, t);
const vacExpired = (r: HrRecord, today: string) => !!(r.acquisition_end && r.acquisition_end < today && r.status !== 'completed' && r.status !== 'cancelled');
const vacExpiring = (r: HrRecord, today: string) => { if (!r.acquisition_end || r.status==='completed' || r.status==='cancelled') return false; const d=Math.round((Date.parse(r.acquisition_end)-Date.parse(today))/86400000); return d>=0&&d<=60; };

const HR_FIELD_LABELS: Record<string,string> = {full_name:'Nome',team:'Equipe',employee_code:'Matrícula',role:'Cargo',hired_on:'Admissão',termination_on:'Demissão',archived:'Arquivado',last_aso:'Último ASO',scheduled_on:'Agendado em',planned_month:'Mês planejado',periodicity_months:'Periodicidade (meses)',aso_type:'Tipo de exame',notes:'Obs.',start_on:'Início férias',status:'Situação',leave_days:'Dias',acquisition_start:'Início aquisitivo',acquisition_end:'Fim aquisitivo',concession_end:'Limite concessão',checklist:'Checklist',needs_review:'Revisão pendente'};
const fmtAuditVal = (v: unknown): string => { if (v===null||v===undefined) return '—'; if (typeof v==='boolean') return v?'Sim':'Não'; if (typeof v==='object') return '(atualizado)'; return String(v); };
const auditDiff = (h: HrAuditRecord): {f:string;b:string;a:string}[] => { if (!h.after_data) return []; const skip = new Set(['id','user_id','employee_id','created_at','updated_at']); if (h.operation==='update'&&h.before_data) { const bef = h.before_data as Record<string,unknown>; return Object.keys(h.after_data as Record<string,unknown>).filter(k=>!skip.has(k)&&JSON.stringify(bef[k])!==JSON.stringify((h.after_data as Record<string,unknown>)[k])).slice(0,8).map(k=>({f:HR_FIELD_LABELS[k]||k,b:fmtAuditVal(bef[k]),a:fmtAuditVal((h.after_data as Record<string,unknown>)[k])})); } if (h.operation==='create') { return Object.entries(h.after_data as Record<string,unknown>).filter(([k,v])=>!skip.has(k)&&v!==null&&v!==undefined&&v!=='').slice(0,8).map(([k,v])=>({f:HR_FIELD_LABELS[k]||k,b:'',a:fmtAuditVal(v)})); } return []; };

function TimelineView({asos,vacations,today}:{asos:HrRecord[];vacations:HrRecord[];today:string}){
  const [filter,setFilter]=useState<'all'|'asos'|'vacations'>('all');
  const [tlYear,setTlYear]=useState('');
  const [tlMonth,setTlMonth]=useState('');
  type TLEv={key:string;type:'aso'|'vacation';month:string;sortKey?:string;name:string;team?:string;photo?:string|null;detail:string;status:string;cls:string};
  const rEnd=new Date(today);rEnd.setMonth(rEnd.getMonth()+14);const rES=rEnd.toISOString().slice(0,7);
  const rStart=today.slice(0,7);
  const evs:TLEv[]=[];
  if(filter!=='vacations'){
    for(const r of asos){
      const m=r.scheduled_on?.slice(0,7)||r.planned_month?.slice(0,7)||null;
      if(!m||!/^\d{4}-\d{2}$/.test(m)||m<rStart||m>rES)continue;
      const aso=sumAso(r,today);
      evs.push({key:'a-'+r.id,type:'aso',month:m,name:r.full_name||'',team:r.team,photo:r.photo_url,
        detail:r.scheduled_on?dateLabel(r.scheduled_on):monthLabel(r.planned_month),
        status:aso.status,cls:aso.remaining!==null&&aso.remaining<0?'danger':aso.remaining!==null&&aso.remaining<=30?'warning':aso.remaining!==null?'info':''});
    }
  }
  if(filter!=='asos'){
    for(const r of vacations){
      const mS=r.start_on?.slice(0,7)||r.planned_month?.slice(0,7)||null;
      const mC=r.concession_end?.slice(0,7)||null;
      const mSok=mS&&/^\d{4}-\d{2}$/.test(mS)&&mS>=rStart&&mS<=rES;
      const mCok=mC&&/^\d{4}-\d{2}$/.test(mC)&&mC>=rStart&&mC<=rES;
      const m=mSok?mS:mCok?mC:null;
      if(!m)continue;
      const vac=sumVac(r,today);
      const isNow=!!(r.start_on&&r.start_on<=today&&vac.end&&vac.end>=today);
      evs.push({key:'v-'+r.id,type:'vacation',month:m,sortKey:r.concession_end||m+'~',name:r.full_name||'',team:r.team,photo:r.photo_url,
        detail:(r.start_on?dateLabel(r.start_on)+(r.leave_days?' · '+String(r.leave_days)+' dias':''):(r.planned_month?monthLabel(r.planned_month):'A programar'))+(r.concession_end?' · Limite: '+dateLabel(r.concession_end):''),
        status:isNow?'Em férias':(vacationLabels[r.status||'draft']||''),
        cls:isNow?'success':r.status==='planned'?'info':r.status==='completed'?'success':''});
    }
  }
  evs.sort((a,b)=>a.month.localeCompare(b.month)||(a.sortKey||'').localeCompare(b.sortKey||'')||a.name.localeCompare(b.name));
  const allTlYears=[...new Set(evs.map(e=>e.month.slice(0,4)))].sort();
  const evsFilt=evs.filter(e=>{if(!tlYear)return true;if(!e.month.startsWith(tlYear))return false;if(tlMonth&&e.month!==tlYear+'-'+tlMonth)return false;return true;});
  const byMonth=new Map<string,TLEv[]>();
  for(const e of evsFilt){if(!byMonth.has(e.month))byMonth.set(e.month,[]);byMonth.get(e.month)!.push(e);}
  const todayM=today.slice(0,7);
  return <div className="hr-timeline">
    <div className="hr-tl-filters">
      {(['all','vacations','asos'] as const).map(f=><button key={f} className={filter===f?'active':''} onClick={()=>setFilter(f)}>{f==='all'?'Todos':f==='vacations'?'Férias':'ASO'}</button>)}
      <select aria-label="Filtrar ano" value={tlYear} onChange={e=>{setTlYear(e.target.value);setTlMonth('');}}>
        <option value="">Todos os anos</option>
        {allTlYears.map(y=><option key={y} value={y}>{y}</option>)}
      </select>
      {tlYear&&<select aria-label="Filtrar mês" value={tlMonth} onChange={e=>setTlMonth(e.target.value)}>
        <option value="">Todos os meses</option>
        {['01','02','03','04','05','06','07','08','09','10','11','12'].map(mm=><option key={mm} value={mm}>{new Intl.DateTimeFormat('pt-BR',{month:'long',timeZone:'UTC'}).format(new Date(tlYear+'-'+mm+'-15T12:00:00Z'))}</option>)}
      </select>}
    </div>
    {byMonth.size===0&&<div className="hr-empty"><Clock size={34}/><h3>Sem eventos no período</h3><p>Nenhum agendamento de {filter==='asos'?'ASO':filter==='vacations'?'férias':'ASO ou férias'} encontrado para os próximos meses.</p></div>}
    <div className="hr-tl-track">
      {[...byMonth.entries()].map(([m,list])=><div key={m} className={'hr-tl-group'+(m===todayM?' is-current':'')}>
        <div className="hr-tl-month">
          <span>{new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-15T12:00:00Z'))}</span>
          {m===todayM&&<span className="hr-tl-now">Mês atual</span>}
          <small>{list.length} evento{list.length!==1?'s':''}</small>
        </div>
        <div className="hr-tl-cards">
          {list.map(ev=><div key={ev.key} className={'hr-tl-card hr-tl-'+ev.type}>
            <span className="hr-tl-type-badge">{ev.type==='aso'?'ASO':'Férias'}</span>
            <HrAvatar name={ev.name} photo={ev.photo}/>
            <div className="hr-tl-body">
              <strong>{ev.name}</strong>
              {ev.team&&<span className="hr-tl-team">{ev.team}</span>}
              <p>{ev.detail}</p>
            </div>
            {ev.status&&<span className={'hr-badge '+ev.cls}>{ev.status}</span>}
          </div>)}
        </div>
      </div>)}
    </div>
  </div>;
}

class TLBoundary extends Component<{children?:any},{err:Error|null}>{
  constructor(p:any){super(p);this.state={err:null};}
  static getDerivedStateFromError(e:Error){return {err:e};}
  render(){
    if(this.state.err)return <div style={{padding:24,background:'var(--hr-bg,#fff)',border:'2px solid #c41f32',borderRadius:8,margin:16}}>
      <strong style={{color:'#c41f32',display:'block',marginBottom:8}}>Erro na Linha do Tempo:</strong>
      <pre style={{whiteSpace:'pre-wrap',fontSize:12,color:'#333',margin:0}}>{this.state.err.message}</pre>
      <pre style={{whiteSpace:'pre-wrap',fontSize:11,color:'#666',marginTop:8}}>{this.state.err.stack}</pre>
    </div>;
    return this.props.children as any;
  }
}

export function HrPage() {
  const { allowed,admin,loading:aL,error:aE } = useHrAccess();
  const cA=allowed('rh.view'),cAso=allowed('aso.view'),cVac=allowed('vacations.view'),cR=allowed('rh.manage');
  const [rows,setRows] = useState<Record<HrTable,HrRecord[]>>({employees:[],asos:[],vacations:[]});
  const [history,setHistory] = useState<HrAuditRecord[]>([]);
  const [showHelp,setShowHelp] = useState(false);
  const [showHelpAso,setShowHelpAso] = useState(false);
  const [tab,setTab] = useState<Tab>('overview');
  const [search,setSearch] = useState('');
  const [team,setTeam] = useState('');
  const [status,setStatus] = useState('');
  const [showArchived,setShowArchived] = useState(false);
  const [month,setMonth] = useState(new Date().toLocaleDateString('en-CA',{timeZone:'America/Bahia'}).slice(0,7));
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [truncated,setTruncated] = useState(false);
  const [exporting,setExporting] = useState(false);
  const [editor,setEditor] = useState<{table:HrTable;record?:HrRecord}|null>(null);
  const [bulkDialog,setBulkDialog] = useState(false);
  const [bulkYear,setBulkYear] = useState(new Date().getFullYear()+1);
  const [bulkBusy,setBulkBusy] = useState(false);
  const [filterYear,setFilterYear]=useState('');
  const [filterMonth,setFilterMonth]=useState('');
  const today = new Date().toLocaleDateString('en-CA',{timeZone:'America/Bahia'});
  const load = useCallback(async () => {
    if (!cA) { setRows({employees:[],asos:[],vacations:[]}); setLoading(false); return; }
    setLoading(true); setError('');
    const tables: HrTable[] = [...(cR||cAso||cVac ? ['employees' as const] : []),...(cAso ? ['asos' as const] : []),...(cVac ? ['vacations' as const] : [])];
    try {
      const res = await Promise.all(tables.map(async t => ({t,...await listHr(t)})));
      const n: Record<HrTable,HrRecord[]> = {employees:[],asos:[],vacations:[]};
      for (const r of res) n[r.t]=r.records;
      setRows(n); setTruncated(res.some(r=>r.truncated));
    } catch(e) { setRows({employees:[],asos:[],vacations:[]}); setError((e as Error).message); }
    finally { setLoading(false); }
  }, [cA,cAso,cVac,cR]);
  useEffect(() => { void load(); }, [load]);
  const tabs: Tab[] = ['overview',...(cAso ? ['asos' as const] : []),...(cVac ? ['vacations' as const] : []),...((cAso||cVac) ? ['timeline' as const] : []),...(cR ? ['employees' as const] : []),...(cA ? ['logs' as const] : [])];
  const at = tabs.includes(tab) ? tab : 'overview';
  useEffect(() => { if (at === 'logs') listHrHistory().then(r => setHistory(r.records)).catch(()=>{}); }, [at]);
  const aAsos = rows.asos.filter(r=>!r.archived&&!r.employee_archived);
  const aVacs = rows.vacations.filter(r=>!r.archived&&!r.employee_archived&&r.status!=='cancelled');
  const overdueAso = aAsos.filter(r=>(sumAso(r,today).remaining??Infinity)<0);
  const expiringAso = aAsos.filter(r=>{const d=sumAso(r,today).remaining;return d!==null&&d>=0&&d<=30;});
  const expiredVac = aVacs.filter(r=>vacExpired(r,today));
  const expiringVac = aVacs.filter(r=>vacExpiring(r,today));
  const pendingVac = aVacs.filter(r=>r.status!=='completed'&&(!r.start_on||sumVac(r,today).warnings.length>0));
  const activeEmp = rows.employees.filter(r=>!r.archived);
  const demitidos = rows.employees.filter(r=>!!r.termination_on);
  const teams = [...new Set(rows.employees.map(r=>r.team).filter((v): v is string=>!!v))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const match = (r: HrRecord) => (!team||r.team===team)&&`${r.full_name} ${r.employee_code||''} ${r.team||''}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'));
  const asoYears=[...new Set(rows.asos.map(r=>(r.scheduled_on||r.planned_month||'').slice(0,4)).filter(y=>/^\d{4}$/.test(y)))].sort();
  const vacYears=[...new Set(rows.vacations.map(r=>(r.concession_end||'').slice(0,4)).filter(y=>/^\d{4}$/.test(y)))].sort();
  const filtered = at==='overview' || at==='logs' || at==='timeline' ? [] : rows[at as HrTable].filter(r => {
    if (!match(r)) return false;
    if (!showArchived&&(r.archived||r.employee_archived)) return false;
    if (filterYear&&(at==='asos'||at==='vacations')){const d=(at==='asos'?(r.scheduled_on||r.planned_month||''):(r.concession_end||'')).slice(0,7);if(!d.startsWith(filterYear))return false;if(filterMonth&&d!==filterYear+'-'+filterMonth)return false;}
    if (!status) return true;
    if (at==='asos') return sumAso(r,today).status===status;
    if (at==='vacations') { if (status==='expired') return vacExpired(r,today); if (status==='expiring') return vacExpiring(r,today); return r.status===status; }
    if (at==='employees') { if (status==='demitidos') return !!r.termination_on; if (status==='review') return !!r.needs_review; }
    return true;
  });
  const agenda: {key:string;date:string;name:string;label:string;table:HrTable;record:HrRecord}[] = [];
  for (const r of aAsos.filter(match)) {
    const due=sumAso(r,today).due;
    if (due) agenda.push({key:r.id+'due',date:due,name:r.full_name||'',label:'Validade do ASO',table:'asos',record:r});
    if (r.scheduled_on||r.planned_month) agenda.push({key:r.id+'sch',date:r.scheduled_on||r.planned_month||'',name:r.full_name||'',label:r.scheduled_on?'ASO agendado':'ASO · mês a confirmar',table:'asos',record:r});
  }
  for (const r of aVacs.filter(r=>match(r)&&r.status!=='completed')) {
    const d=sumVac(r,today);
    for (const [dt,lb,k] of [[r.start_on||r.planned_month,r.start_on?'Início de férias':'Férias · mês a confirmar','start'],[d.notice,'Prazo do aviso','notice'],[d.payment,'Prazo do pagamento','payment'],[d.returnOn,'Retorno de férias','return']] as [string|null,string,string][]) {
      if (dt&&!r.checklist?.[k]) agenda.push({key:r.id+k,date:dt,name:r.full_name||'',label:lb,table:'vacations',record:r});
    }
  }
  const events = agenda.filter(e=>e.date.startsWith(month)).sort((a,b)=>a.date.localeCompare(b.date));
  const sw = (v:Tab) => { setTab(v);setStatus('');setSearch('');setFilterYear('');setFilterMonth(''); };
  async function dl(table:'asos'|'vacations') { setExporting(true);setError(''); try{await exportHr(table);setNotice('Arquivo exportado. Mantenha-o em local restrito ao RH.');}catch(e){setError((e as Error).message);}finally{setExporting(false);} }
  async function doBulk() {
    setBulkBusy(true);setError('');
    try { const r=await bulkGenerateVacations(bulkYear); setBulkDialog(false); setNotice(`Lançamento concluído: ${r.created} período(s) criado(s), ${r.skipped} já existiam.`); void load(); }
    catch(e){ setError((e as Error).message); }
    finally { setBulkBusy(false); }
  }
  if (aL) return <div className="hr-space hr-empty" role="status">Conferindo suas permissões…</div>;
  if (!cA) return <div className="hr-space hr-panel hr-denied"><LockKeyhole size={40}/><h1>Módulo RH restrito</h1><p>{aE?'Não foi possível confirmar seu acesso. Tente novamente ou contate o administrador.':'Solicite ao administrador a permissão de acesso ao RH e às áreas necessárias.'}</p><Link to="/" className="hr-button">Voltar à central</Link></div>;
  return <div className="hr-space">
    <header className="hr-hero"><div className="hr-hero-copy"><span className="hr-eyebrow"><ShieldCheck size={17}/> Gestão de pessoas · REDE NEX</span><h1>Módulo RH</h1><p>Pessoas bem cuidadas. Prazos sob controle.</p><span className="hr-privacy"><LockKeyhole size={14}/> Acesso restrito · dados administrativos de RH</span></div><div className="hr-hero-actions">{admin&&<Link to="/permissoes" className="hr-button"><ShieldCheck size={18}/>Gerenciar acesso<ArrowUpRight size={16}/></Link>}<button className="hr-icon-button" onClick={load} disabled={loading} aria-label="Atualizar dados de RH"><RefreshCw size={20} className={loading?'animate-spin':''}/></button></div></header>
    <div className="hr-tabs" role="navigation" aria-label="Áreas do RH">{tabs.map(v=><button key={v} className={at===v?'active':''} onClick={()=>sw(v)} aria-current={at===v?'page':undefined}>{v==='overview'?<Activity size={18}/>:v==='timeline'?<Clock size={18}/>:v==='employees'?<Users size={18}/>:<CalendarDays size={18}/>}{labels[v]}</button>)}</div>
    {error&&<div className="hr-alert" role="alert"><div><strong>Não foi possível carregar ou salvar</strong><p>{error}</p></div><button className="hr-button" onClick={load} disabled={loading}>Tentar novamente</button></div>}
    {notice&&<div className="hr-notice" role="status">{notice}<button className="hr-icon-button" aria-label="Fechar aviso" onClick={()=>setNotice('')}><X size={17}/></button></div>}
    {truncated&&<div className="hr-alert">Há mais de 2.500 registros. A listagem está limitada; solicite uma extração administrativa.</div>}
    {!error&&<div className="hr-stats">
      {cAso&&(at==='overview'||at==='asos')&&<><button className="hr-stat hr-danger" onClick={()=>{sw('asos');setStatus('Vencido');}}><span>ASOs vencidos<Activity size={20}/></span><strong>{overdueAso.length}</strong><small>Exigem atenção do RH</small></button><button className="hr-stat hr-warning" onClick={()=>{sw('asos');setStatus('Vence em 30 dias');}}><span>ASOs · vencem em 30 dias<CalendarDays size={20}/></span><strong>{expiringAso.length}</strong><small>Antecipe os agendamentos</small></button></>}
      {cVac&&(at==='overview'||at==='vacations')&&<><button className="hr-stat hr-danger" onClick={()=>{sw('vacations');setStatus('expired');}}><span>Férias vencidas<AlertTriangle size={20}/></span><strong>{expiredVac.length}</strong><small>Período aquisitivo vencido</small></button><button className="hr-stat hr-warning" onClick={()=>{sw('vacations');setStatus('expiring');}}><span>Férias · vencem em 60 dias<CalendarDays size={20}/></span><strong>{expiringVac.length}</strong><small>Programar com urgência</small></button></>}
      {cVac&&at==='overview'&&<button className="hr-stat hr-info" onClick={()=>sw('vacations')}><span>Férias a acompanhar<CalendarDays size={20}/></span><strong>{pendingVac.length}</strong><small>Sem data ou com alertas</small></button>}
      {(at==='overview'||at==='employees')&&<button className="hr-stat" disabled={!cR} onClick={()=>sw('employees')}><span>Colaboradores do RH<Users size={20}/></span><strong>{activeEmp.length}</strong><small>{demitidos.length>0?`${demitidos.length} demitido(s)`:'Vinculados aos usuários da REDE NEX'}</small></button>}
    </div>}
    {!error&&<section className="hr-panel">
      <div className="hr-section-heading"><div><span className="hr-eyebrow">{at==='overview'?'Planejamento mensal':'Controle e acompanhamento'}</span><h2>{at==='overview'?'Agenda do RH':labels[at]}</h2><p>{at==='overview'?'Vencimentos, agendamentos e ações em um só lugar.':`${filtered.length} registro(s) encontrado(s) · alterações preservadas em histórico.`}</p></div>
        <div className="hr-actions">{at==='overview'?<label className="hr-month">Mês da agenda<input type="month" required value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value);}}/></label>:<>
          {at!=='employees'&&at!=='logs'&&at!=='timeline'&&allowed((at==='asos'?'aso':'vacations')+'.export')&&<button className="hr-button" disabled={loading||exporting} onClick={()=>dl(at as 'asos'|'vacations')}><Download size={18}/>{exporting?'Exportando…':'Exportar CSV'}</button>}
          {at==='vacations'&&allowed('vacations.manage')&&<button className="hr-button hr-bulk" onClick={()=>setBulkDialog(true)} disabled={loading}><Zap size={17}/>Gerar em Massa</button>}{at==='asos'&&<button className="hr-icon-button" style={{marginLeft:4}} onClick={()=>setShowHelpAso(true)} title="Entenda os indicadores de ASO" aria-label="Ajuda sobre ASO"><HelpCircle size={19}/></button>}{at==='vacations'&&<button className="hr-icon-button" style={{marginLeft:4}} onClick={()=>setShowHelp(true)} title="Entenda os indicadores de férias" aria-label="Ajuda sobre férias"><HelpCircle size={19}/></button>}
          {at!=='logs'&&at!=='timeline'&&allowed((at==='employees'?'rh':at==='asos'?'aso':'vacations')+'.manage')&&<button className="hr-button hr-primary" onClick={()=>setEditor({table:at as HrTable})} disabled={loading}><Plus size={19}/>{at==='employees'?'Vincular colaborador':at==='asos'?'Novo ASO':'Novo período'}</button>}
        </>}</div>
      </div>
      <div className="hr-filters"><label className="hr-search"><Search size={19}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nome ou matrícula…" aria-label="Buscar colaborador no RH"/></label><select aria-label="Filtrar equipe" value={team} onChange={e=>setTeam(e.target.value)}><option value="">Todas as equipes</option>{teams.map(t=><option key={t}>{t}</option>)}</select>
        {(at==='asos'||at==='vacations')&&<select aria-label="Filtrar ano" value={filterYear} onChange={e=>{setFilterYear(e.target.value);setFilterMonth('');}}><option value="">Todos os anos</option>{(at==='asos'?asoYears:vacYears).map(y=><option key={y} value={y}>{y}</option>)}</select>}
        {(at==='asos'||at==='vacations')&&filterYear&&<select aria-label="Filtrar mês" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}><option value="">Todos os meses</option>{['01','02','03','04','05','06','07','08','09','10','11','12'].map(mm=><option key={mm} value={mm}>{new Intl.DateTimeFormat('pt-BR',{month:'long',timeZone:'UTC'}).format(new Date(filterYear+'-'+mm+'-15T12:00:00Z'))}</option>)}</select>}
        {at!=='overview'&&at!=='logs'&&at!=='timeline'&&<><select aria-label="Filtrar situação" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todas as situações</option>{at==='asos'&&['Vencido','Vence em 30 dias','Em dia','Sem referência'].map(v=><option key={v} value={v}>{v}</option>)}{at==='vacations'&&<>{Object.entries(vacationLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}<option value="expired">Vencido (aquisitivo)</option><option value="expiring">A Vencer (60 dias)</option></>}{at==='employees'&&<><option value="demitidos">Demitidos</option><option value="review">Precisa de revisão</option></>}</select><label className="hr-check-inline"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/>Incluir arquivados</label></>}
      </div>
      {loading?<div className="hr-empty" role="status">Carregando dados do RH…</div>:at==='overview'?<div className="hr-agenda">
        {!cAso&&!cVac&&<div className="hr-empty">O acesso ao módulo foi liberado. Solicite também a visualização de ASO ou Férias ao administrador.</div>}
        {events.map(ev=><div className="hr-agenda-row" key={ev.key}><div className="hr-date-tile"><strong>{ev.label.includes('mês a confirmar')?'—':ev.date.slice(8,10)}</strong><small>{monthLabel(ev.date).split(' de ')[0]}</small></div><HrAvatar name={ev.name} photo={ev.record.photo_url}/><div className="hr-event-person"><strong>{ev.name}</strong><p>{ev.label}</p></div><button className="hr-button" onClick={()=>{sw(ev.table);setSearch(ev.name);}}>Ver registro<ArrowUpRight size={17}/></button></div>)}
        {!events.length&&(cAso||cVac)&&<div className="hr-empty"><CalendarDays size={34}/><h3>Nenhum evento neste mês</h3><p>Escolha outro mês ou cadastre os primeiros cronogramas nas abas de ASO e Férias.</p></div>}
      </div>:at==='logs'?<div className="hr-log-list">{history.map(h=>{const diff=auditDiff(h);return <div key={h.id} className="hr-log-item"><div className="hr-log-row"><span className={`hr-log-op ${h.operation==='create'?'hr-log-op--create':h.operation==='update'?'hr-log-op--update':h.operation==='access_change'?'hr-log-op--access':''}`}>{h.operation==='create'?'Criado':h.operation==='update'?'Atualizado':h.operation==='access_change'?'Permissão':h.operation}</span><span className="hr-log-resource">{({rh:'Colaborador',aso:'ASO',vacations:'Férias',permissions:'Acesso'} as Record<string,string>)[h.resource]||h.resource}</span>{h.entity_name&&<span className="hr-log-entity">{h.entity_name}</span>}<span className="hr-log-actor">{h.actor_name||'Sistema'}</span><span className="hr-log-date">{new Date(h.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'})}</span></div>{diff.length>0&&<div className="hr-log-diff">{diff.map(d=><span key={d.f}><em>{d.f}:</em>{d.b?<> <s>{d.b}</s>{' → '}<b>{d.a}</b></>:<b>{d.a}</b>}</span>)}</div>}</div>;})
}{!history.length&&<div className="hr-empty"><History size={34}/><h3>Nenhum log ainda</h3><p>As operações de cadastro e edição ficam registradas aqui.</p></div>}</div>:at==='timeline'?<TLBoundary><TimelineView asos={aAsos} vacations={aVacs} today={today}/></TLBoundary>:<div className="hr-record-grid">
        {filtered.map(row=>{
          const aso=at==='asos'?sumAso(row,today):null;
          const vac=at==='vacations'?sumVac(row,today):null;
          const overlaps=at==='vacations'&&row.start_on&&row.status!=='cancelled'?aVacs.filter(o=>o.id!==row.id&&o.team===row.team&&o.start_on&&o.status==='planned'&&o.start_on<=(vac?.end||'')&&(sumVac(o,today).end||'')>=row.start_on!):[];
          const isExp=at==='vacations'&&vacExpired(row,today);
          const isExpiring=at==='vacations'&&!isExp&&vacExpiring(row,today);
          return <article className="hr-record" key={row.id}><div className="hr-record-heading"><HrAvatar name={row.full_name||'?'} photo={row.photo_url}/><div><h3>{row.full_name}</h3><p>{row.team||'Sem equipe'}{row.employee_code?` · ${row.employee_code}`:''}</p></div>{allowed((at==='employees'?'rh':at==='asos'?'aso':'vacations')+'.manage')&&<button className="hr-icon-button" aria-label={`Editar ${row.full_name}`} onClick={()=>setEditor({table:at as HrTable,record:row})}><Pencil size={19}/></button>}</div>
            {row.user_status==='inactive'&&<span className="hr-badge warning">Conta vinculada inativa</span>}
            {(row.archived||row.employee_archived)&&<span className="hr-badge">Arquivado</span>}
            {aso&&<><span className={`hr-badge ${aso.remaining!==null&&aso.remaining<0?'danger':aso.remaining!==null&&aso.remaining<=30?'warning':aso.remaining!==null?'info':''}`}>{aso.status}</span><dl><div><dt>Validade</dt><dd>{dateLabel(aso.due)}</dd></div><div><dt>Último realizado</dt><dd>{dateLabel(row.completed_on||row.last_exam_on)}</dd></div><div><dt>Periodicidade</dt><dd>{row.periodicity_months} meses</dd></div><div><dt>Agendamento</dt><dd>{row.scheduled_on?dateLabel(row.scheduled_on):monthLabel(row.planned_month)}</dd></div></dl>{row.scheduled_on&&row.scheduled_on<today&&(!row.completed_on||row.completed_on<row.scheduled_on)&&<p className="hr-inline-warning">Agendamento passado: confirme a realização.</p>}</>}
            {vac&&<><div className="hr-badges">{row.status==='planned'?<span className="hr-badge info">{vacationLabels['planned']}</span>:<span className="hr-badge">{vacationLabels[row.status||'draft']}</span>}{isExp&&<span className="hr-badge danger hr-immutable" title="Calculado automaticamente — período concessivo vencido">Vencido</span>}{isExpiring&&<span className="hr-badge warning hr-immutable" title="Calculado automaticamente — concessivo vence em 60 dias">A Vencer</span>}{row.awaiting_employee&&<span className="hr-badge warning">Aguardando colaborador</span>}</div><dl><div><dt>Ano base</dt><dd>{row.acquisition_start?new Date(row.acquisition_start+'T12:00:00Z').getUTCFullYear():'—'}</dd></div><div><dt>Período aquisitivo</dt><dd>{dateLabel(row.acquisition_start)} → {dateLabel(row.acquisition_end)}</dd></div><div><dt>Fim concessivo</dt><dd>{dateLabel(row.concession_end)}</dd></div><div><dt>Saldo / gozo / abono</dt><dd>{Number(row.balance_days).toLocaleString('pt-BR')} / {row.leave_days} / {row.bonus_days} dias</dd></div><div><dt>Início</dt><dd>{row.start_on?dateLabel(row.start_on):monthLabel(row.planned_month)}</dd></div><div><dt>Retorno</dt><dd>{dateLabel(vac.returnOn)}</dd></div><div><dt>Último início estimado</dt><dd>{dateLabel(vac.limit)}</dd></div><div><dt>Aviso / pagamento</dt><dd>{dateLabel(vac.notice)} / {dateLabel(vac.payment)}</dd></div></dl>{row.status!=='completed'&&row.status!=='cancelled'&&vac.warnings.map(w=><p className="hr-inline-warning" key={w}>{w}</p>)}{overlaps.length>0&&<p className="hr-inline-warning">Sobreposição de férias com {overlaps.length} pessoa(s) da equipe. Confira a cobertura.</p>}</>}
            {at==='employees'&&<><dl><div><dt>Cargo</dt><dd>{row.position||'Não informado'}</dd></div><div><dt>Empresa</dt><dd>{row.company||'Não informada'}</dd></div><div><dt>Admissão</dt><dd>{dateLabel(row.admission_on)}</dd></div><div><dt>Demissão</dt><dd>{row.termination_on?dateLabel(row.termination_on):'—'}</dd></div></dl>{row.needs_review&&<span className="hr-badge warning">Cadastro a revisar</span>}{row.termination_on&&<span className="hr-badge danger">Demitido</span>}</>}
            {row.notes&&<p className="hr-record-notes">{row.notes}</p>}
            {row.checklist&&Object.entries(row.checklist).some(([,v])=>v)&&<div className="hr-record-checks">{Object.entries(row.checklist).filter(([,v])=>v).map(([k])=><span key={k}><CheckCircle2 size={14}/>{({appointment:'Agendamento',documents:'Documentação',notice:'Aviso',payment:'Pagamento',return:'Retorno'}[k]||k)}</span>)}</div>}
          </article>;
        })}
        {!filtered.length&&<div className="hr-empty"><Users size={34}/><h3>Nenhum registro encontrado</h3><p>{search||team||status?'Revise os filtros para encontrar o colaborador.':'Use o botão acima para cadastrar. Os esboços também podem ser importados pelo procedimento administrativo documentado.'}</p></div>}
      </div>}
    </section>}
    <p className="hr-footer-note"><ShieldCheck size={16}/>Informações restritas. Os indicadores auxiliam o planejamento; confirme datas e regras com o RH. Nenhum dado deste módulo é enviado ao Copiloto.</p>
    {bulkDialog&&<div className="hr-bulk-overlay" role="dialog" aria-modal="true" aria-label="Gerar férias em massa"><div className="hr-dialog" style={{maxWidth:480,display:'flex',flexDirection:'column',gap:0}}>
      <header><div style={{display:'flex',alignItems:'center',gap:9}}><Zap size={21} style={{color:'#ea580c'}}/><h2 style={{margin:0}}>Gerar Férias em Massa</h2></div><button className="hr-icon-button" onClick={()=>setBulkDialog(false)} aria-label="Fechar"><X size={19}/></button></header>
      <div style={{padding:'18px 22px',display:'grid',gap:16}}>
        <p style={{margin:0,fontSize:14,color:'var(--hr-muted)'}}>Cria períodos de férias em rascunho para todos os colaboradores ativos sem registro no ano selecionado.</p>
        <label style={{display:'grid',gap:6,fontSize:13,fontWeight:600}}>Ano de referência (início do período aquisitivo)<input type="number" min={new Date().getFullYear()} max={new Date().getFullYear()+5} value={bulkYear} onChange={e=>setBulkYear(Number(e.target.value))} style={{width:130}}/></label>
        <p style={{margin:0,fontSize:12,color:'var(--hr-muted)'}}>Os registros são criados como <strong>A programar</strong> e podem ser editados normalmente.</p>
      </div>
      <footer style={{display:'flex',justifyContent:'flex-end',gap:10,padding:'14px 22px',borderTop:'1px solid var(--hr-line)'}}><button className="hr-button" onClick={()=>setBulkDialog(false)} disabled={bulkBusy}>Cancelar</button><button className="hr-button hr-primary" onClick={doBulk} disabled={bulkBusy}><Zap size={16}/>{bulkBusy?'Gerando…':'Gerar períodos'}</button></footer>
    </div></div>}
{showHelpAso&&<div className="hr-bulk-overlay" role="dialog" aria-modal="true" aria-label="Sobre ASO"><div className="hr-dialog" style={{maxWidth:520,display:'flex',flexDirection:'column',gap:0}}><header><div style={{display:'flex',alignItems:'center',gap:9}}><HelpCircle size={21} style={{color:'#ea580c'}}/>  <h2 style={{margin:0}}>Guia de ASO</h2></div><button className="hr-icon-button" onClick={()=>setShowHelpAso(false)} aria-label="Fechar"><X size={19}/></button></header><div style={{padding:'18px 22px',display:'grid',gap:14,fontSize:14}}><div><strong>O que é o ASO?</strong><p style={{margin:'4px 0 0',color:'var(--hr-muted)'}}>Atestado de Saúde Ocupacional — documento emitido pelo médico do trabalho após a realização de exames. Obrigatório para admissão, periodicamente e na demissão.</p></div><div><strong style={{color:'#c41f32'}}>Vencido</strong><p style={{margin:'4px 0 0',color:'var(--hr-muted)'}}>O prazo de validade foi ultrapassado. O sistema calcula a validade somando a <strong>periodicidade em meses</strong> (campo configurável no cadastro) à data do último exame realizado. Quando a data resultante for anterior a hoje, o status muda para <strong>Vencido</strong>. Agende imediatamente um novo exame ocupacional.</p></div><div><strong style={{color:'#995900'}}>Vence em 30 dias</strong><p style={{margin:'4px 0 0',color:'var(--hr-muted)'}}>O ASO expira nos próximos 30 dias. Antecipe o agendamento para evitar o vencimento e garantir a regularidade legal.</p></div><div><strong style={{color:'#1d4ed8'}}>Em dia</strong><p style={{margin:'4px 0 0',color:'var(--hr-muted)'}}>O ASO está dentro do prazo de validade. Nenhuma ação imediata necessária.</p></div><div><strong>Periodicidade</strong><p style={{margin:'4px 0 0',color:'var(--hr-muted)'}}>Intervalo em meses entre exames periódicos, definido pelo PCMSO da empresa (padrão: 12 meses). Funções de risco podem exigir periodicidade menor.</p></div><div><strong>Tipos de exame</strong><p style={{margin:'4px 0 0',color:'var(--hr-muted)'}}><strong>Admissional:</strong> antes do início das atividades. <strong>Periódico:</strong> durante o vínculo (anual ou conforme PCMSO). <strong>Retorno:</strong> após afastamento ≥30 dias. <strong>Demissional:</strong> até 10 dias antes ou após o desligamento.</p></div><div><strong>Agendamento vs. Mês planejado</strong><p style={{margin:'4px 0 0',color:'var(--hr-muted)'}}>Se a data exata está confirmada, use Agendamento. Se apenas o mês foi definido, use Mês a confirmar — assim o sistema não cobra data específica.</p></div></div><footer style={{display:'flex',justifyContent:'flex-end',padding:'14px 22px',borderTop:'1px solid var(--hr-line)'}}><button className="hr-button hr-primary" onClick={()=>setShowHelpAso(false)}>Entendi</button></footer></div></div>}
        {showHelp&&<div className="hr-bulk-overlay" role="dialog" aria-modal="true" aria-label="Sobre Férias"><div className="hr-dialog" style={{maxWidth:520,display:'flex',flexDirection:'column',gap:0}}><header><div style={{display:'flex',alignItems:'center',gap:9}}><HelpCircle size={21} style={{color:'#2563eb'}}/><h2 style={{margin:0}}>Guia de Férias</h2></div><button className="hr-icon-button" onClick={()=>setShowHelp(false)} aria-label="Fechar"><X size={19}/></button></header><div style={{padding:'18px 22px',display:'grid',gap:14,fontSize:14}}><div><strong>Período Aquisitivo</strong><p style={{margin:'4px 0 0',color:'var(--hr-muted)'}}>12 meses de trabalho contados a partir da admissão. Ao completar 1 ano, o colaborador adquire direito a 30 dias de férias.</p></div><div><strong>Período Concessivo</strong><p style={{margin:'4px 0 0',color:'var(--hr-muted)'}}>12 meses seguintes ao aquisitivo. As férias devem ser gozadas dentro desse prazo — caso contrário, o período expira.</p></div><div><strong style={{color:'#c41f32'}}>Vencido</strong><p style={{margin:'4px 0 0',color:'var(--hr-muted)'}}>O período concessivo expirou sem que as férias fossem concluídas ou canceladas. Requer ação imediata do RH.</p></div><div><strong style={{color:'#995900'}}>A Vencer</strong><p style={{margin:'4px 0 0',color:'var(--hr-muted)'}}>O período concessivo encerra em até 60 dias. Planeje a programação com urgência para evitar vencimento.</p></div><div><strong>Saldo · Gozo · Abono</strong><p style={{margin:'4px 0 0',color:'var(--hr-muted)'}}>Saldo: dias disponíveis. Gozo: dias programados para férias efetivas. Abono: dias vendidos (pecuniários). Gozo + Abono não pode superar o Saldo.</p></div><div><strong>Ano Base</strong><p style={{margin:'4px 0 0',color:'var(--hr-muted)'}}>Ano em que se iniciou o período aquisitivo. Identifica a qual ciclo anual o registro pertence.</p></div><div><strong>Aviso · Pagamento · Último início estimado</strong><p style={{margin:'4px 0 0',color:'var(--hr-muted)'}}>Calculados automaticamente. Aviso: 30 dias antes do início. Pagamento: 2 dias antes. Último início: garante encerramento dentro do concessivo.</p></div></div><footer style={{display:'flex',justifyContent:'flex-end',padding:'14px 22px',borderTop:'1px solid var(--hr-line)'}}><button className="hr-button hr-primary" onClick={()=>setShowHelp(false)}>Entendi</button></footer></div></div>}{editor&&allowed((editor.table==='employees'?'rh':editor.table==='asos'?'aso':'vacations')+'.manage')&&<HrRecordForm table={editor.table} record={editor.record} employees={rows.employees} onClose={()=>setEditor(null)} onSaved={()=>{setEditor(null);setNotice('Registro salvo no banco e histórico atualizado.');void load();}}/>}
  </div>;
}
