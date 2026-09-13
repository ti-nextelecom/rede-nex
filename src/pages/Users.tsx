import { useEffect, useRef, useState } from 'react';
import {
  Users as UsersIcon, Search, Grid3X3, List, Plus,
  Mail, Building2, UserCheck, UserX,
  Edit2, Trash2, X, Eye, EyeOff, Loader2, AlertCircle,
} from 'lucide-react';
import { getDepartments, getUsers, getRoles, createUser, updateUser, deleteUser } from '../lib/appApi';
import type { CreateUserInput } from '../lib/appApi';
import { Card } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import type { Role, User } from '../types';

const ROLE_COLORS: Record<string, string> = {
  Administrador: 'bg-red-100 text-red-700',
  Gestor: 'bg-blue-100 text-blue-700',
  Editor: 'bg-amber-100 text-amber-700',
  Colaborador: 'bg-green-100 text-green-700',
};

function formatDate(dateStr?: string) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function formatPresence(user: User) {
  if (user.online) return 'Online';
  const seconds = user.seconds_since_seen;
  if (!seconds) return 'Nunca acessou';
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
}

export function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'cards' | 'list'>('cards');
  const [filterDept, setFilterDept] = useState('all');
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
    const [nextUsers, nextDepartments, nextRoles] = await Promise.all([
      getUsers(), getDepartments(), getRoles(),
    ]);
    setUsers(nextUsers);
    setDepartments(nextDepartments);
    setRoles(nextRoles);
    setLoading(false);
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

  async function handleDelete() {
    if (!confirm.userId) return;
    setDeleting(true);
    try {
      await deleteUser(confirm.userId);
      setUsers(prev => prev.map(u => u.id === confirm.userId ? { ...u, status: 'inactive' as const } : u));
      setConfirm({ open: false, userId: '', userName: '' });
    } catch {
      setConfirm({ open: false, userId: '', userName: '' });
    } finally {
      setDeleting(false);
    }
  }

  const filtered = users.filter(u => {
    const matchSearch = !search
      || u.name.toLowerCase().includes(search.toLowerCase())
      || u.email.toLowerCase().includes(search.toLowerCase())
      || u.position?.toLowerCase().includes(search.toLowerCase());
    const matchDept = filterDept === 'all' || u.departments?.name === filterDept;
    const matchStatus = filterStatus === 'all' || u.status === filterStatus;
    return matchSearch && matchDept && matchStatus;
  });

  const stats = {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    inactive: users.filter(u => u.status === 'inactive').length,
  };

  const inputCls = 'w-full px-3 h-9 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400';
  const labelCls = 'block text-xs font-semibold text-slate-700 mb-1';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Colaboradores</h1>
          <p className="text-sm text-slate-600 mt-0.5">Gestão de usuários e colaboradores</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
        >
          <Plus size={14} /> Novo Colaborador
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: UsersIcon, color: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'Ativos', value: stats.active, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Inativos', value: stats.inactive, icon: UserX, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(s => (
          <Card key={s.label} className="p-4 border-slate-200">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.bg}`}>
                <s.icon size={18} className={s.color} />
              </div>
              <div>
                <p className="text-xs text-slate-600">{s.label}</p>
                <p className="text-2xl font-bold text-slate-800">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Pesquisar colaboradores..."
            className="w-full pl-9 pr-4 h-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
        >
          <option value="all">Todos os setores</option>
          {departments.map(d => (
            <option key={d.id} value={d.name}>{d.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
        <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white">
          <button
            onClick={() => setView('cards')}
            className={`px-3 py-2 transition-colors ${view === 'cards' ? 'bg-orange-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Grid3X3 size={15} />
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-3 py-2 transition-colors ${view === 'list' ? 'bg-orange-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <List size={15} />
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-600">{filtered.length} colaborador(es) encontrado(s)</p>

      {/* Cards */}
      {view === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="p-5 border-slate-200 text-center space-y-3">
                  <Skeleton className="w-16 h-16 rounded-full mx-auto" />
                  <Skeleton className="h-4 w-3/4 mx-auto" />
                  <Skeleton className="h-3 w-1/2 mx-auto" />
                </Card>
              ))
            : filtered.map(user => (
                <Card key={user.id} className="p-5 border-slate-200 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                  <div className="text-center">
                    <div className="relative inline-block mb-3">
                      <img
                        src={user.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&size=64&background=ff7a00&color=fff`}
                        alt={user.name}
                        className="w-16 h-16 rounded-full object-cover mx-auto ring-2 ring-slate-100"
                      />
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${user.online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800 line-clamp-1">{user.name}</h3>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">{user.position || '-'}</p>
                    {user.roles?.name && (
                      <span className={`inline-block mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[user.roles.name] || 'bg-gray-100 text-gray-700'}`}>
                        {user.roles.name}
                      </span>
                    )}
                    <p className={`mt-2 text-[11px] font-medium ${user.online ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {formatPresence(user)}
                    </p>
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                      {user.departments?.name && (
                        <p className="text-[11px] text-slate-600 flex items-center justify-center gap-1">
                          <Building2 size={10} /> {user.departments.name}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-600 flex items-center justify-center gap-1 truncate">
                        <Mail size={10} /> {user.email}
                      </p>
                    </div>
                    {/* Actions */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex justify-center gap-2">
                      <button
                        onClick={() => openEdit(user)}
                        className="p-1.5 rounded-lg text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => setConfirm({ open: true, userId: user.id, userName: user.name })}
                        className="p-1.5 rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Desativar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
        </div>
      ) : (
        /* List view */
        <Card className="border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Colaborador', 'Cargo', 'Setor', 'Perfil', 'Admissão', 'Presença', 'Status', 'Ações'].map(h => (
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
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                        ))}
                      </tr>
                    ))
                  : filtered.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={user.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&size=32&background=ff7a00&color=fff`}
                              alt={user.name}
                              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                            />
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                              <p className="text-[11px] text-slate-600">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">{user.position || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{user.departments?.name || '-'}</td>
                        <td className="px-4 py-3">
                          {user.roles?.name ? (
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[user.roles.name] || 'bg-gray-100 text-gray-700'}`}>
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
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(user)}
                              className="p-1 rounded hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors"
                              title="Editar"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => setConfirm({ open: true, userId: user.id, userName: user.name })}
                              className="p-1 rounded hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"
                              title="Desativar"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <UsersIcon size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600 font-medium">Nenhum colaborador encontrado</p>
          <p className="text-slate-500 text-sm mt-1">Tente ajustar os filtros de busca</p>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  {modal.mode === 'create' ? 'Novo Colaborador' : 'Editar Colaborador'}
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  {modal.mode === 'create' ? 'Preencha os dados para criar o acesso' : `Editando: ${modal.user?.name}`}
                </p>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
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
                  <label className={labelCls}>Nome completo *</label>
                  <input
                    ref={nameRef}
                    type="text"
                    className={inputCls}
                    placeholder="Ex: João Silva"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>E-mail *</label>
                  <input
                    type="email"
                    className={inputCls}
                    placeholder="colaborador@empresa.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>{modal.mode === 'create' ? 'Senha *' : 'Nova senha (deixe vazio para manter)'}</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className={`${inputCls} pr-9`}
                      placeholder={modal.mode === 'create' ? 'Mínimo 8 caracteres' : 'Nova senha (opcional)'}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Cargo</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="Ex: Analista de TI"
                    value={form.position}
                    onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelCls}>Telefone</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="(00) 00000-0000"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelCls}>Setor</label>
                  <select
                    className={`${inputCls} cursor-pointer`}
                    value={form.department_id}
                    onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}
                  >
                    <option value="">Selecionar setor</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Perfil</label>
                  <select
                    className={`${inputCls} cursor-pointer`}
                    value={form.role_id}
                    onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))}
                  >
                    <option value="">Selecionar perfil</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Data de admissão</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={form.admission_date}
                    onChange={e => setForm(f => ({ ...f, admission_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelCls}>Data de aniversário</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={form.birth_date}
                    onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
                  />
                </div>
                {modal.mode === 'edit' && (
                  <div>
                    <label className={labelCls}>Status</label>
                    <select
                      className={`${inputCls} cursor-pointer`}
                      value={form.status}
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
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-full bg-red-50">
                <AlertCircle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Desativar colaborador</h3>
                <p className="text-sm text-slate-600 mt-0.5">Esta ação pode ser revertida depois.</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 mb-5">
              Deseja desativar <span className="font-semibold">{confirm.userName}</span>? O colaborador perderá acesso ao sistema.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirm({ open: false, userId: '', userName: '' })}
                disabled={deleting}
                className="flex-1 h-9 rounded-lg border border-slate-300 text-sm text-slate-700 font-medium hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 h-9 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 size={13} className="animate-spin" />}
                Desativar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
