import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertCircle, ArrowUpRight, Building2, Edit2, Loader2, Network, Plus, Search, Trash2, UserCheck, Users, X } from 'lucide-react';
import { createDepartment, updateDepartment, deleteDepartmentById, type Department } from '../lib/appApi';
import { apiGet } from '../lib/apiClient';
import { useAuth } from '../lib/auth';
import type { User } from '../types';
import { EmployeeAvatar } from '../components/EmployeeAvatar';
import './people-workspace.css';
import './departments-workspace.css';

export function Departments() {
  const { user } = useAuth();
  const canEdit = ['Administrador', 'Gestor'].includes(user?.role_name || user?.roles?.name || '');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [people, setPeople] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState<{ dept?: Department } | null>(null);
  const [confirm, setConfirm] = useState<Department | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const mutationLock = useRef(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [d, p] = await Promise.all([apiGet<{ data: Department[] }>('/departments'), apiGet<{ data: User[] }>('/users')]);
      setDepartments(d.data || []); setPeople(p.data || []);
    } catch { setError('Não foi possível carregar os setores e seus responsáveis.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const manager = (d: Department) => people.find(p => p.id === d.manager_id);
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const visible = departments.filter(d => normalize(`${d.name} ${d.description || ''} ${manager(d)?.name || ''}`).includes(normalize(query.trim())) && (filter === 'all' || (filter === 'managed' ? Boolean(d.manager_id) : !d.manager_id)));
  function open(dept?: Department) { setName(dept?.name || ''); setDescription(dept?.description || ''); setFormError(''); setModal({ dept }); }
  async function save() {
    if (!canEdit || !modal || mutationLock.current) return;
    if (!name.trim()) { setFormError('Informe o nome do setor.'); return; }
    mutationLock.current = true; setSaving(true); setFormError('');
    try {
      const saved = modal.dept ? await updateDepartment(modal.dept.id, { name: name.trim(), description: description.trim() }) : await createDepartment(name.trim(), description.trim() || undefined);
      setDepartments(prev => (modal.dept ? prev.map(d => d.id === saved.id ? { ...d, ...saved } : d) : [...prev, saved]).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
      setModal(null);
    } catch (e) { setFormError(e instanceof Error ? e.message : 'Não foi possível salvar o setor.'); }
    finally { mutationLock.current = false; setSaving(false); }
  }
  async function remove() {
    if (!canEdit || !confirm || mutationLock.current) return;
    mutationLock.current = true; setSaving(true); setFormError('');
    try { await deleteDepartmentById(confirm.id); setConfirm(null); await load(); }
    catch (e) { setFormError(e instanceof Error ? e.message : 'Não foi possível excluir o setor.'); }
    finally { mutationLock.current = false; setSaving(false); }
  }
  const count = (d: Department) => Number(d.user_count ?? people.filter(p => p.department_id === d.id).length);
  return <div className="people-page departments-page">
    <header className="people-hero"><div><span className="people-eyebrow"><Building2 size={16} /> PESSOAS / EQUIPES</span><h1>Setores e departamentos</h1><p>Uma visão clara de cada equipe, suas pessoas e responsabilidades.</p></div><div className="people-hero-actions"><Link className="people-button" to="/organograma"><Network size={17} /> Organograma <ArrowUpRight size={15} /></Link>{canEdit && <button className="people-button dept-primary" onClick={() => open()}><Plus size={18} /> Novo setor</button>}</div></header>
    <div className="dept-metrics">{[{ label: 'Setores cadastrados', value: departments.length, Icon: Building2 }, { label: 'Colaboradores vinculados', value: departments.reduce((sum, d) => sum + count(d), 0), Icon: Users }, { label: 'Com responsável definido', value: departments.filter(d => d.manager_id).length, Icon: UserCheck }, { label: 'Sem responsável', value: departments.filter(d => !d.manager_id).length, Icon: Network }].map(({ label, value, Icon }) => <div key={label}><Icon size={21} /><span>{label}</span><strong>{loading || error ? '—' : value}</strong></div>)}</div>
    <section className="dept-directory"><div className="people-section-heading"><div><h2>Equipes da REDE NEX</h2><p>Encontre um setor e acesse os colaboradores vinculados.</p></div><span className="people-result-count" aria-live="polite">{loading ? 'Carregando…' : error ? 'Dados indisponíveis' : `${visible.length} setor(es)`}</span></div>
      <div className="dept-toolbar"><label className="dept-search"><Search size={18} /><input aria-label="Buscar setores" placeholder="Buscar setor, descrição ou responsável" value={query} onChange={e => setQuery(e.target.value)} /></label><select aria-label="Filtrar por responsável" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todos os setores</option><option value="managed">Com responsável</option><option value="unmanaged">Sem responsável</option></select></div>
      {loading ? <div className="people-empty" role="status"><Loader2 className="animate-spin" /> Carregando equipes…</div> : error ? <div className="people-empty" role="alert"><AlertCircle size={30} /><h3>Setores indisponíveis</h3><p>{error}</p><button className="people-button" onClick={load}>Tentar novamente</button></div> : !visible.length ? <div className="people-empty"><Building2 size={34} /><h3>{departments.length ? 'Nenhum setor encontrado' : 'Suas equipes começam aqui'}</h3><p>{departments.length ? 'Ajuste a busca ou o filtro de responsável.' : 'Os setores cadastrados aparecerão nesta tela.'}</p>{(query || filter !== 'all') && <button className="people-button" onClick={() => { setQuery(''); setFilter('all'); }}>Limpar filtros</button>}</div> : <div className="dept-grid">{visible.map(d => { const lead = manager(d); const parent = departments.find(p => p.id === d.parent_id); return <article className="dept-card" key={d.id}>
        <div className="dept-card-top"><span className="dept-icon"><Building2 size={23} /></span><span className="dept-count"><Users size={14} /> {count(d)} pessoa(s)</span></div><h3>{d.name}</h3><p className="dept-description">{d.description || 'A descrição desta equipe ainda não foi informada.'}</p><div className="dept-lead"><EmployeeAvatar name={lead?.name || '?'} photo={lead?.photo_url} className="employee-avatar-small" /><div><span>Responsável</span><strong>{lead?.name || (d.manager_id ? 'Cadastro indisponível' : 'Não definido')}</strong></div></div><p className="dept-parent"><Network size={14} /> {parent ? `Vinculado a ${parent.name}` : 'Setor raiz da organização'}</p><footer><Link className="people-button" to={`/colaboradores?setor=${encodeURIComponent(d.id)}`}>Ver equipe <ArrowUpRight size={16} /></Link>{canEdit && <><button className="people-button" aria-label={`Editar ${d.name}`} onClick={() => open(d)}><Edit2 size={16} /></button><button className="people-button dept-delete" aria-label={`Excluir ${d.name}`} onClick={() => { setFormError(''); setConfirm(d); }}><Trash2 size={16} /></button></>}</footer>
      </article>; })}</div>}
    </section>
    <Dialog.Root open={Boolean(modal || confirm)} onOpenChange={value => { if (!value && !saving) { setModal(null); setConfirm(null); } }}><Dialog.Portal><Dialog.Overlay className="people-modal-overlay" /><Dialog.Content className="people-page people-dialog dept-dialog" onEscapeKeyDown={e => { if (saving) e.preventDefault(); }} onInteractOutside={e => { if (saving) e.preventDefault(); }}>
      <header><div><Dialog.Title>{confirm ? 'Excluir setor?' : modal?.dept ? 'Editar setor' : 'Novo setor'}</Dialog.Title><Dialog.Description>{confirm ? 'A exclusão é permanente. Confira os vínculos antes de confirmar.' : 'Mantenha as informações da sua equipe claras e atualizadas.'}</Dialog.Description></div><button className="people-button" aria-label="Fechar setor" disabled={saving} onClick={() => { setModal(null); setConfirm(null); }}><X size={18} /></button></header><div className="dept-form">{formError && <p role="alert" className="people-form-error">{formError}</p>}{confirm ? <p>O setor <strong>{confirm.name}</strong> será excluído. Seus colaboradores serão desvinculados, mas não serão excluídos. Revise também os setores subordinados no organograma.</p> : <><label htmlFor="dept-name">Nome do setor *</label><input id="dept-name" maxLength={100} value={name} disabled={saving} onChange={e => setName(e.target.value)} /><label htmlFor="dept-description">Descrição</label><textarea id="dept-description" maxLength={500} rows={4} disabled={saving} value={description} onChange={e => setDescription(e.target.value)} /><p>Os responsáveis e a hierarquia podem ser organizados diretamente no mapa da organização.</p></>}</div><footer><button className="people-button" disabled={saving} onClick={() => { setModal(null); setConfirm(null); }}>Cancelar</button><button className={`people-button ${confirm ? 'dept-danger' : 'dept-primary'}`} disabled={saving} onClick={confirm ? remove : save}>{saving && <Loader2 size={17} className="animate-spin" />}{saving ? 'Salvando…' : confirm ? 'Excluir setor' : 'Salvar setor'}</button></footer>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}
