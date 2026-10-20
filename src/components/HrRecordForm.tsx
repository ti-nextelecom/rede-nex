import { useEffect, useState, type FormEvent } from 'react';
import { Save, X } from 'lucide-react';
import { AccessibleModal } from './AccessibleModal';
import { listHrUsers, saveHr, type HrRecord, type HrTable, type HrUser } from '../lib/hrApi';
import { HrAvatar } from './HrAvatar';
import { addMonths } from '../../shared/hr.mjs';

type Field = { key: string; label: string; type?: string; required?: boolean; min?: number; max?: number; step?: string };
const employeeFields: Field[] = [
  { key:'employee_code',label:'Matrícula' }, { key:'short_name',label:'Nome curto' },
  { key:'team',label:'Equipe / setor',required:true }, { key:'area',label:'Área' }, { key:'company',label:'Empresa' }, { key:'position',label:'Cargo' }, { key:'admission_on',label:'Admissão',type:'date' }, { key:'termination_on',label:'Demissão',type:'date' },
];
const asoFields: Field[] = [
  { key:'last_exam_on',label:'Último exame de referência',type:'date' }, { key:'periodicity_months',label:'Periodicidade (meses)',type:'number',required:true,min:1,max:60 },
  { key:'scheduled_on',label:'Agendamento — data exata',type:'date' }, { key:'planned_month',label:'Ou mês previsto',type:'month' }, { key:'completed_on',label:'Exame realizado em',type:'date' },
];
const vacationFields: Field[] = [
  { key:'acquisition_start',label:'Início do período aquisitivo',type:'date',required:true }, { key:'acquisition_end',label:'Fim do período aquisitivo',type:'date',required:true },
  { key:'concession_end',label:'Fim do período concessivo',type:'date',required:true }, { key:'balance_days',label:'Saldo de dias (inclusive fracionado)',type:'number',required:true,min:0,max:366,step:'0.01' },
  { key:'start_on',label:'Início das férias — data exata',type:'date' }, { key:'planned_month',label:'Ou mês previsto',type:'month' },
  { key:'leave_days',label:'Dias de gozo',type:'number',required:true,min:1,max:60 }, { key:'bonus_days',label:'Dias de abono',type:'number',required:true,min:0,max:30 },
];
const titles = { employees:'Colaborador do RH',asos:'Controle de ASO',vacations:'Período de férias' };
export function HrRecordForm({ table, record, employees, onClose, onSaved }: { table: HrTable; record?: HrRecord; employees: HrRecord[]; onClose: () => void; onSaved: (row: HrRecord) => void }) {
  const fields = table === 'employees' ? employeeFields : table === 'asos' ? asoFields : vacationFields;
  const initial: Record<string,string> = { employee_id:record?.employee_id || '',periodicity_months:'12',leave_days:'30',bonus_days:'0',balance_days:'30',status:'draft' };
  for (const [key,value] of Object.entries(record || {})) if (value !== null && typeof value !== 'object') initial[key] = String(value);
  initial.planned_month = initial.planned_month?.slice(0,7) || '';
  const [values,setValues] = useState(initial);
  const [error,setError] = useState('');
  const [saving,setSaving] = useState(false);
  const [users,setUsers] = useState<HrUser[]>([]);
  const [userSearch,setUserSearch] = useState('');
  const [usersLoading,setUsersLoading] = useState(table==='employees');
  const [usersError,setUsersError] = useState('');
  useEffect(()=>{
    let alive=true;
    if(table==='employees') void listHrUsers().then(result=>{if(alive)setUsers(result.users);}).catch((error:Error)=>{if(alive)setUsersError(error.message);}).finally(()=>{if(alive)setUsersLoading(false);});
    return ()=>{alive=false;};
  },[table]);
  const selectedUser=users.find(user=>user.id===values.user_id);
  const selectedEmployee=employees.find(employee=>employee.id===values.employee_id);
  function chooseUser(id:string) {
    const user=users.find(item=>item.id===id);
    setValues(prev=>({...prev,user_id:id,full_name:user?.name || '',short_name:user?.name.split(' ')[0] || '',team:user?.department_name || '',position:user?.position || '',admission_on:user?.admission_date?.slice(0,10) || ''}));
  }
  function change(key: string, value: string) {
    setValues(prev => {
      const next = { ...prev,[key]:value };
      if (value && key === 'planned_month') { next.scheduled_on=''; next.start_on=''; }
      if (value && ['scheduled_on','start_on'].includes(key)) next.planned_month='';
      if (key === 'acquisition_end' && value && !prev.concession_end) next.concession_end=addMonths(value,12) || '';
      return next;
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('');
    const data = new FormData(event.currentTarget);
    const body: Record<string,unknown> = { ...record,...values,version:record?.version,planned_month:values.planned_month ? values.planned_month+'-01' : null };
    for (const field of fields) if (field.type === 'number') body[field.key] = field.key === 'balance_days' ? values[field.key] : Number(values[field.key]);
    for (const key of ['awaiting_employee','needs_review','archived']) body[key]=data.get(key)==='on';
    body.checklist = table === 'employees' ? undefined : { ...(record?.checklist || {}) };
    if (table !== 'employees') for (const key of table === 'asos' ? ['appointment','documents'] : ['notice','payment','return']) (body.checklist as Record<string,boolean>)[key]=data.get('check_'+key)==='on';
    try { const { record:saved } = await saveHr(table,body,record?.id); onSaved(saved); }
    catch (error) { setError((error as Error).message); }
    finally { setSaving(false); }
  }
  return <AccessibleModal title={titles[table]} onClose={() => { if (!saving) onClose(); }} className="hr-space hr-dialog">
    <header><div><span className="hr-eyebrow">{record ? 'Atualizar registro' : 'Novo registro'}</span><h2>{titles[table]}</h2></div><button type="button" className="hr-icon-button" aria-label="Fechar formulário" disabled={saving} onClick={onClose}><X size={22} /></button></header>
    <form onSubmit={submit}>
      {error && <div className="hr-alert" role="alert">{error}</div>}
      {usersError && <div className="hr-alert" role="alert">Não foi possível carregar os usuários: {usersError}</div>}
      <div className="hr-form-grid">
        {table==='employees' && <div className="hr-full hr-user-picker">
          {!record && <label>Buscar usuário existente<input value={userSearch} disabled={saving || usersLoading} onChange={e=>setUserSearch(e.target.value)} placeholder="Nome ou setor do usuário…" /></label>}
          <label>Usuário da REDE NEX *<select aria-label="Usuário da REDE NEX" required disabled={saving || usersLoading || !!record} value={values.user_id || ''} onChange={e=>chooseUser(e.target.value)}><option value="">{usersLoading ? 'Carregando usuários…' : 'Selecione o colaborador existente…'}</option>{users.filter(user=>user.id===values.user_id || `${user.name} ${user.department_name || ''}`.toLocaleLowerCase('pt-BR').includes(userSearch.toLocaleLowerCase('pt-BR'))).map(user=>{const linked=employees.some(employee=>employee.user_id===user.id && employee.id!==record?.id);return <option key={user.id} value={user.id} disabled={linked}>{user.name} · {user.department_name || 'Sem setor'}{linked ? ' (já vinculado)' : user.status!=='active' ? ' (conta inativa)' : ''}</option>;})}</select></label>
          {(selectedUser || record) && <div className="hr-linked-user"><HrAvatar name={selectedUser?.name || record?.full_name || ''} photo={selectedUser?.photo_url || record?.photo_url}/><div><strong>{selectedUser?.name || record?.full_name}</strong><p>Vinculado ao perfil existente · nome e foto atualizados pela REDE NEX</p></div></div>}
        </div>}
        {table !== 'employees' && <div className="hr-full hr-user-picker"><label>Colaborador<select aria-label="Colaborador" required value={values.employee_id} disabled={saving || !!record} onChange={e => change('employee_id',e.target.value)}><option value="">Selecione…</option>{employees.filter(e => !e.archived || e.id === values.employee_id).map(e => <option key={e.id} value={e.id}>{e.full_name} · {e.team || 'Sem equipe'}</option>)}</select></label>{selectedEmployee && <div className="hr-linked-user"><HrAvatar name={selectedEmployee.full_name || ''} photo={selectedEmployee.photo_url}/><div><strong>{selectedEmployee.full_name}</strong><p>Usuário vinculado da REDE NEX · {selectedEmployee.team}</p></div></div>}</div>}
        {fields.map(field => <label key={field.key}>{field.label}{field.required && ' *'}<input type={field.type || 'text'} required={field.required} min={field.min} max={field.max} step={field.step} maxLength={field.key === 'employee_code' ? 50 : 200} value={values[field.key] || ''} disabled={saving} onChange={e => change(field.key,e.target.value)} /></label>)}
        {table === 'vacations' && <label>Situação<select value={values.status} disabled={saving} onChange={e => change('status',e.target.value)}><option value="draft">Rascunho / a programar</option><option value="planned">Programadas</option><option value="completed">Concluídas</option><option value="cancelled">Canceladas</option></select></label>}
        {table !== 'employees' && <label className="hr-full">Observações administrativas<textarea aria-label="Observações administrativas" maxLength={2000} rows={3} value={values.notes || ''} disabled={saving} onChange={e => change('notes',e.target.value)} placeholder="Não inclua diagnósticos, laudos ou informações clínicas." /></label>}
      </div>
      {table === 'asos' && <p className="hr-help">A periodicidade deve seguir o PCMSO aplicável. A data de realização passa a ser a referência para a próxima validade. Alterações ficam no histórico.</p>}
      {table === 'vacations' && <p className="hr-help">A programação considera um bloco por período aquisitivo. Saldo fracionado é preservado; desdobramentos em vários blocos devem ser controlados pelo RH antes da confirmação. Confira DSR, feriados, acordos e regras aplicáveis.</p>}
      <div className="hr-checks">
        {table === 'employees' && <label><input name="needs_review" type="checkbox" defaultChecked={record?.needs_review} />Cadastro precisa de revisão</label>}
        {table === 'vacations' && <label><input name="awaiting_employee" type="checkbox" defaultChecked={record?.awaiting_employee} />Aguardando retorno do colaborador</label>}
        {(table === 'asos' ? [['appointment','Agendamento confirmado'],['documents','Documentação conferida']] : table === 'vacations' ? [['notice','Aviso de férias enviado'],['payment','Pagamento conferido'],['return','Retorno confirmado']] : []).map(([key,label]) => <label key={key}><input type="checkbox" name={'check_'+key} defaultChecked={record?.checklist?.[key]} />{label}</label>)}
        {record && <label><input name="archived" type="checkbox" defaultChecked={record.archived} />Arquivar registro (preserva o histórico)</label>}
      </div>
      <footer><button type="button" className="hr-button" disabled={saving} onClick={onClose}>Cancelar</button><button type="submit" className="hr-button hr-primary" disabled={saving || (table==='employees' && (!values.user_id || usersLoading || !!usersError))}><Save size={18} />{saving ? 'Salvando…' : 'Salvar registro'}</button></footer>
    </form>
  </AccessibleModal>;
}
