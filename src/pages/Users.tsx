import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Users as UsersIcon, Search, Grid3X3, List, Plus,
  Mail, Building2, UserCheck, UserX, Network, Activity, ArrowUpRight,
  Edit2, Power, X, Eye, EyeOff, Loader2, AlertCircle,
} from 'lucide-react';
import { createUser, updateUser } from '../lib/appApi';
import { apiGet } from '../lib/apiClient';
import { useAuth } from '../lib/auth';
import type { CreateUserInput } from '../lib/appApi';
import { Card } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import type { Role, User } from '../types';
import { EmployeeAvatar } from '../components/EmployeeAvatar';
import { BehavioralIdentity } from '../components/BehavioralIdentity';
import './people-workspace.css';

const ROLE_COLORS: Record<string, string> = {
  Administrador: 'people-role-admin',
  Gestor: 'people-role-manager',
  Editor: 'people-role-editor',
  Colaborador: 'people-role-member',
};

function formatDate(dateStr?: string) {
  if (!dateStr) return '-';
  const date = new Date(dateStr.slice(0, 10) + 'T12:00:00');
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
}

function formatPresence(user: User) {
  if (user.status !== 'active') return 'Acesso inativo';
  if (user.online) return 'Online';
  const seconds = user.seconds_since_seen;
  if (seconds == null) return 'Sem presença registrada';
  if (seconds < 3600) return `Off há ${Math.max(1, Math.floor(seconds / 60))} min`;
  if (seconds < 86400) return `Off há ${Math.floor(seconds / 3600)}h`;
  return `Off há ${Math.floor(seconds / 86400)}d`;
}

const emptyForm: CreateUserInput & { status?: string } = {
  name: '', email: '', password: '', position: '',
  department_id: '', role_id: '', phone: '', admission_date: '', birth_date: '', status: 'active',
};

interface ModalState {
  open: boolean;
  mode: 'create' | 'edit';
  user?: User;
}

interface ConfirmState {
  open: boolean;
  userId: string;
  userName: string;
  nextStatus?: 'active' | 'inactive';
}

export function Users() {
  const { user: currentUser } = useAuth();
  // Match the server's existing requireAdmin guard; this does not grant permissions.
  const canManage = ['Administrador', 'Gestor'].includes(currentUser?.role_name || '');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [statusNotice, setStatusNotice] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'cards' | 'list'>('cards');
  const [params, setParams] = useSearchParams();
  const filterDept = params.get('setor') || 'all';
  function setFilterDept(value: string) {
    const next = new URLSearchParams(params);
    if (value === 'all') next.delete('setor'); else next.set('setor', value);
    setParams(next, { replace: true });
  }
  const [filterStatus, setFilterStatus] = useState('all');
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'create' });
  const [form, setForm] = useState({ ...emptyForm });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [confirm, setConfirm] = useState<ConfirmState>({ open: false, userId: '', userName: '' });
  const [deleting, setDeleting] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (modal.open) setTimeout(() => nameRef.current?.focus(), 50);
  }, [modal.open]);

  async function loadData() {
    setLoading(true);
    setLoadError('');
    try {
      // Empty/error responses must not be replaced with local demo employees.
      const [nextUsers, nextDepartments, nextRoles] = await Promise.all([
        apiGet<{ data: User[] }>('/users'),
        apiGet<{ data: { id: string; name: string }[] }>('/departments'),
        apiGet<{ data: Role[] }>('/roles'),
      ]);
      setUsers(nextUsers.data || []);
      setDepartments(nextDepartments.data || []);
      setRoles(nextRoles.data || []);
    } catch {
      setLoadError('Não foi possível carregar os colaboradores. Tente novamente.');
    } finally { setLoading(false); }
  }

  function openCreate() {
    setForm({ ...emptyForm });
    setFormError('');
    setShowPassword(false);
    setModal({ open: true, mode: 'create' });
  }

  function openEdit(user: User) {
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      position: user.position ?? '',
      department_id: user.department_id ?? '',
      role_id: user.role_id ?? '',
      phone: user.phone ?? '',
      admission_date: user.admission_date ? user.admission_date.slice(0, 10) : '',
      birth_date: user.birth_date ? user.birth_date.slice(0, 10) : '',
      status: user.status,
    });
    setFormError('');
    setShowPassword(false);
    setModal({ open: true, mode: 'edit', user });
  }

  function closeModal() {
    setModal({ open: false, mode: 'create' });
  }

  async function handleSave() {
    if (!canManage) return;
    setFormError('');
    if (!form.name.trim() || !form.email.trim()) {
      setFormError('Nome e e-mail são obrigatórios.');
      return;
    }
    if (modal.mode === 'create' && !form.password) {
      setFormError('Senha é obrigatória para novos colaboradores.');
      return;
    }
    if (form.password && form.password.length < 8) {
      setFormError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    setSaving(true);
    try {
      if (modal.mode === 'create') {
        const created = await createUser(form as CreateUserInput);
        setUsers(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      } else if (modal.user) {
        const payload: Partial<CreateUserInput> & { status?: string } = {
          name: form.name, email: form.email,
          position: form.position, department_id: form.department_id,
          role_id: form.role_id, phone: form.phone,
          admission_date: form.admission_date, birth_date: form.birth_date, status: form.status,
        };
        if (form.password) payload.password = form.password;
        const updated = await updateUser(modal.user.id, payload);
        setUsers(prev => prev.map(u => u.id === modal.user!.id ? updated : u));
      }
      closeModal();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar colaborador.');
    } finally {
      setSaving(false);
    }
  }

  function confirmStatus(user: User) {
    if (!canManage || user.id === currentUser?.id || deleting) return;
    setDeleteError(''); setStatusNotice('');
    setConfirm({ open: true, userId: user.id, userName: user.name, nextStatus: user.status === 'active' ? 'inactive' : 'active' });
  }

  async function handleStatusChange() {
    if (!canManage || !confirm.userId || !confirm.nextStatus || deleting || confirm.userId === currentUser?.id) return;
    setDeleting(true);
    try {
      const updated = await updateUser(confirm.userId, { status: confirm.nextStatus });
      setUsers(prev => prev.map(u => u.id === confirm.userId ? { ...u, ...updated } : u));
      setStatusNotice(`${confirm.userName} ${updated.status === 'active' ? 'ativado' : 'inativado'} com sucesso.`);
      setConfirm({ open: false, userId: '', userName: '' });
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Não foi possível alterar o status. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  }

  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const term = normalize(search.trim());
  const filtered = users.filter(u => {
    const matchSearch = !search
      || normalize([u.name, u.email, u.position, u.departments?.name].filter(Boolean).join(' ')).includes(term);
    const matchDept = filterDept === 'all' || (u.department_id || u.departments?.id) === filterDept;
    const matchStatus = filterStatus === 'all' || u.status === filterStatus;
    return matchSearch && matchDept && matchStatus;
  });

  const stats = {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    inactive: users.filter(u => u.status === 'inactive').length,
    online: users.filter(u => u.online && u.status === 'active').length,
  };

  const inputCls = 'w-full px-3 h-9 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400';
  const labelCls = 'block text-xs font-semibold text-slate-700 mb-1';

  return (
    <div className="people-page people-directory space-y-6">
      {/* Header */}
      <div className="people-hero">
        <div>
          <span className="people-eyebrow"><UsersIcon size={16} aria-hidden="true" /> PESSOAS / REDE NEX</span>
          <h1 className="text-xl font-bold text-slate-800">Colaboradores</h1>
          <p className="text-sm text-slate-600 mt-0.5">Conheça quem faz a nossa rede acontecer.</p>
        </div>
        <div className="people-hero-actions">
        <Link to="/organograma" className="people-button"><Network size={18} aria-hidden="true" /> Ver organograma <ArrowUpRight size={15} aria-hidden="true" /></Link>
        {canManage && <button
          onClick={openCreate}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
        >
          <Plus size={18} aria-hidden="true" /> Novo colaborador
        </button>}
        </div>
      </div>

      {/* Stats */}
      <div className="people-metrics" aria-label="Resumo de colaboradores">
        {[
          { label: 'Total', value: stats.total, icon: UsersIcon, color: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'Ativos', value: stats.active, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Inativos', value: stats.inactive, icon: UserX, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Online agora', value: stats.online, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map(s => (
          <Card key={s.label} className="people-metric p-4 border-slate-200">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.bg}`}>
                <s.icon size={21} className={s.color} aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs text-slate-600">{s.label}</p>
                <p className="text-2xl font-bold text-slate-800">{loading || loadError ? '—' : s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="people-section-heading"><div><h2>Diretório da equipe</h2><p>Pessoas, setores e conexões em um só lugar.</p></div><span className="people-result-count" aria-live="polite">{loading ? 'Carregando…' : loadError ? 'Dados indisponíveis' : `${filtered.length} colaborador(es)`}</span></div>
      <div className="people-filters">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input
            type="text"
            placeholder="Pesquisar colaboradores..."
            aria-label="Pesquisar colaboradores"
            className="w-full pl-9 pr-4 h-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Filtrar por setor"
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
        >
          <option value="all">Todos os setores</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          aria-label="Filtrar por status"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
        <div className="people-view-toggle" role="group" aria-label="Visualização de colaboradores">
          <button
            onClick={() => setView('cards')}
            aria-label="Visualizar cartões" aria-pressed={view === 'cards'}
            className={`px-3 py-2 transition-colors ${view === 'cards' ? 'bg-orange-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Grid3X3 size={18} aria-hidden="true" />
          </button>
          <button
            onClick={() => setView('list')}
            aria-label="Visualizar lista" aria-pressed={view === 'list'}
            className={`px-3 py-2 transition-colors ${view === 'list' ? 'bg-orange-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <List size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {statusNotice && <p className="people-status-notice" role="status"><UserCheck size={18} />{statusNotice}</p>}
      {loadError && <div className="people-empty" role="alert"><AlertCircle size={30} /><h3>Não foi possível carregar a equipe</h3><p>{loadError}</p><button className="people-button" onClick={loadData}>Tentar novamente</button></div>}

      {/* Cards */}
      {!loadError && (view === 'cards' ? (
        <div className="people-grid">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="p-5 border-slate-200 text-center space-y-3">
                  <Skeleton className="w-16 h-16 rounded-full mx-auto" />
                  <Skeleton className="h-4 w-3/4 mx-auto" />
                  <Skeleton className="h-3 w-1/2 mx-auto" />
                </Card>
              ))
            : filtered.map(user => (
                <Card key={user.id} className="people-card" data-status={user.status}>
                  <div className="people-card-top"><span className={`people-status ${user.status === 'active' ? 'is-active' : ''}`}>{user.status === 'active' ? 'Ativo' : 'Inativo'}</span><span className="people-presence" data-online={Boolean(user.online)}><i />{formatPresence(user)}</span></div>
                  <div className="people-card-main">
                    <EmployeeAvatar userId={user.id} name={user.name} photo={user.photo_url} />
                    <div className="people-identity"><h3>{user.name}</h3><p>{user.position || 'Cargo não informado'}</p><BehavioralIdentity userId={user.id} compact/>
                    {user.roles?.name && (
                      <span className={`people-role inline-block mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[user.roles.name] || 'people-role-default'}`}>
                        {user.roles.name}
                      </span>
                    )}
                    </div>
                  </div>
                    <div className="people-card-contact">
                      <p><Building2 size={16} aria-hidden="true" /><span>{user.departments?.name || 'Sem setor definido'}</span></p>
                      <a href={`mailto:${user.email}`}><Mail size={16} aria-hidden="true" /><span>{user.email}</span></a>
                    </div>
                    {/* Actions */}
                    {canManage && <div className="people-card-actions">
                      <button
                        onClick={() => openEdit(user)}
                        className="p-1.5 rounded-lg text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        title="Editar" aria-label={`Editar ${user.name}`}
                      >
                        <Edit2 size={16} aria-hidden="true" /> Editar perfil
                      </button>
                      <button
                        onClick={() => confirmStatus(user)} disabled={deleting || user.id === currentUser?.id}
                        className="people-status-action" data-activate={user.status !== 'active'}
                        title={user.id === currentUser?.id ? 'Não é possível alterar seu próprio acesso por esta ação' : undefined}
                        aria-label={`${user.status === 'active' ? 'Inativar' : 'Ativar'} ${user.name}`}
                      >
                        <Power size={16} aria-hidden="true" /> {user.status === 'active' ? 'Inativar' : 'Ativar'}
                      </button>
                    </div>}
                </Card>
              ))}
        </div>
      ) : (
        /* List view */
        <Card className="people-table border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Colaborador', 'Cargo', 'Setor', 'Perfil', 'Admissão', 'Presença', 'Status', ...(canManage ? ['Ações'] : [])].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: canManage ? 8 : 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                        ))}
                      </tr>
                    ))
                  : filtered.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <EmployeeAvatar userId={user.id} name={user.name} photo={user.photo_url} className="employee-avatar-small" />
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                              <BehavioralIdentity userId={user.id} compact/>
                              <p className="text-[11px] text-slate-600">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">{user.position || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{user.departments?.name || '-'}</td>
                        <td className="px-4 py-3">
                          {user.roles?.name ? (
                            <span className={`people-role text-[10px] font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[user.roles.name] || 'people-role-default'}`}>
                              {user.roles.name}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{formatDate(user.admission_date)}</td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 ${user.online ? 'text-emerald-600' : 'text-slate-600'}`}>
                            <span className={`h-2 w-2 rounded-full ${user.online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            {formatPresence(user)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full ${user.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {user.status === 'active' ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        {canManage && <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(user)}
                              className="p-1 rounded hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors"
                              title="Editar" aria-label={`Editar ${user.name}`}
                            >
                              <Edit2 size={17} />
                            </button>
                            <button
                              onClick={() => confirmStatus(user)} disabled={deleting || user.id === currentUser?.id}
                              className="people-status-action" data-activate={user.status !== 'active'}
                              title={user.id === currentUser?.id ? 'Não é possível alterar seu próprio acesso por esta ação' : undefined}
                              aria-label={`${user.status === 'active' ? 'Inativar' : 'Ativar'} ${user.name}`}
                            >
                              <Power size={16} /> {user.status === 'active' ? 'Inativar' : 'Ativar'}
                            </button>
                          </div>
                        </td>}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {!loading && !loadError && filtered.length === 0 && (
        <div className="people-empty text-center py-16">
          <UsersIcon size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600 font-medium">Nenhum colaborador encontrado</p>
          <p className="text-slate-500 text-sm mt-1">Tente ajustar os filtros de busca</p>
          {(search || filterDept !== 'all' || filterStatus !== 'all') && <button className="people-button" onClick={() => { setSearch(''); setFilterDept('all'); setFilterStatus('all'); }}>Limpar filtros</button>}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modal.open && canManage && (
        <Dialog.Root open onOpenChange={open => { if (!open && !saving) closeModal(); }}><Dialog.Portal>
          <Dialog.Overlay className="people-modal-overlay" />
          <Dialog.Content className="people-page people-dialog w-full max-w-lg" aria-describedby={undefined}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <Dialog.Title className="text-base font-bold text-slate-800">
                  {modal.mode === 'create' ? 'Novo Colaborador' : 'Editar Colaborador'}
                </Dialog.Title>
                <p className="text-xs text-slate-600 mt-0.5">
                  {modal.mode === 'create' ? 'Preencha os dados para criar o acesso' : `Editando: ${modal.user?.name}`}
                </p>
              </div>
              <button onClick={closeModal} disabled={saving} aria-label="Fechar formulário do colaborador" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {formError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label htmlFor="person-name" className={labelCls}>Nome completo *</label>
                  <input
                    ref={nameRef}
                    id="person-name"
                    type="text"
                    className={inputCls}
                    placeholder="Ex: João Silva"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="person-email" className={labelCls}>E-mail *</label>
                  <input
                    type="email"
                    id="person-email"
                    className={inputCls}
                    placeholder="colaborador@empresa.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="person-password" className={labelCls}>{modal.mode === 'create' ? 'Senha *' : 'Nova senha (deixe vazio para manter)'}</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="person-password" autoComplete="new-password"
                      className={`${inputCls} pr-9`}
                      placeholder={modal.mode === 'create' ? 'Mínimo 8 caracteres' : 'Nova senha (opcional)'}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="person-position" className={labelCls}>Cargo</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="Ex: Analista de TI"
                    id="person-position"
                    value={form.position}
                    onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="person-phone" className={labelCls}>Telefone</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="(00) 00000-0000"
                    id="person-phone"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="person-department" className={labelCls}>Setor</label>
                  <select
                    className={`${inputCls} cursor-pointer`}
                    value={form.department_id}
                    id="person-department"
                    onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}
                  >
                    <option value="">Selecionar setor</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="person-role" className={labelCls}>Perfil</label>
                  <select
                    className={`${inputCls} cursor-pointer`}
                    value={form.role_id}
                    id="person-role"
                    onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))}
                  >
                    <option value="">Selecionar perfil</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="person-admission" className={labelCls}>Data de admissão</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={form.admission_date}
                    id="person-admission"
                    onChange={e => setForm(f => ({ ...f, admission_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="person-birth" className={labelCls}>Data de aniversário</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={form.birth_date}
                    id="person-birth"
                    onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
                  />
                </div>
                {modal.mode === 'edit' && (
                  <div>
                    <label htmlFor="person-status" className={labelCls}>Status</label>
                    <select
                      className={`${inputCls} cursor-pointer`}
                      value={form.status}
                      id="person-status"
                      onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    >
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={closeModal}
                disabled={saving}
                className="h-9 px-4 rounded-lg border border-slate-300 text-sm text-slate-700 font-medium hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-9 px-5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                {modal.mode === 'create' ? 'Criar Colaborador' : 'Salvar Alterações'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal></Dialog.Root>
      )}

      {/* Confirm Delete */}
      {confirm.open && canManage && (
        <Dialog.Root open onOpenChange={open => { if (!open && !deleting) setConfirm({ open: false, userId: '', userName: '' }); }}><Dialog.Portal>
          <Dialog.Overlay className="people-modal-overlay" />
          <Dialog.Content className="people-page people-dialog people-confirm people-status-confirm w-full max-w-sm p-6" aria-describedby={undefined}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-full bg-red-50">
                <AlertCircle size={20} className="text-red-600" />
              </div>
              <div>
                <Dialog.Title className="font-bold text-slate-800">{confirm.nextStatus === 'active' ? 'Ativar' : 'Inativar'} colaborador</Dialog.Title>
                <p className="text-sm text-slate-600 mt-0.5">Esta ação pode ser revertida depois.</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 mb-5">
              Deseja {confirm.nextStatus === 'active' ? 'ativar' : 'inativar'} <span className="font-semibold">{confirm.userName}</span>? {confirm.nextStatus === 'active' ? 'O acesso será restabelecido com o perfil e as permissões já cadastrados.' : 'O acesso será bloqueado, preservando os registros e o histórico do colaborador.'}
            </p>
            {deleteError && <p role="alert" className="people-form-error">{deleteError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setConfirm({ open: false, userId: '', userName: '' })}
                disabled={deleting}
                className="flex-1 h-9 rounded-lg border border-slate-300 text-sm text-slate-700 font-medium hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleStatusChange}
                disabled={deleting}
                className={`flex-1 h-9 rounded-lg ${confirm.nextStatus === 'active' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'} text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2`}
              >
                {deleting && <Loader2 size={13} className="animate-spin" />}
                {confirm.nextStatus === 'active' ? 'Ativar' : 'Inativar'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal></Dialog.Root>
      )}
    </div>
  );
}
