import { useEffect, useRef, useState } from 'react';
import {
  Building2, Plus, Edit2, Trash2, Users, X, Loader2, AlertCircle,
} from 'lucide-react';
import { getDepartments, createDepartment, updateDepartment, deleteDepartmentById, type Department } from '../lib/appApi';
import { Card } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { useAuth } from '../lib/auth';

interface ModalState {
  open: boolean;
  mode: 'create' | 'edit';
  dept?: Department;
}

interface ConfirmState {
  open: boolean;
  dept?: Department;
}

export function Departments() {
  const { user } = useAuth();
  const roleName = user?.roles?.name || user?.role_name || '';
  const canEdit = ['Administrador', 'Gestor'].includes(roleName);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'create' });
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);
  useEffect(() => { if (modal.open) setTimeout(() => nameRef.current?.focus(), 60); }, [modal.open]);

  async function load() {
    setLoading(true);
    const data = await getDepartments().catch(() => []);
    setDepartments(data as Department[]);
    setLoading(false);
  }

  function openCreate() {
    setName('');
    setDescription('');
    setFormError('');
    setModal({ open: true, mode: 'create' });
  }

  function openEdit(dept: Department) {
    setName(dept.name);
    setDescription(dept.description ?? '');
    setFormError('');
    setModal({ open: true, mode: 'edit', dept });
  }

  function closeModal() {
    setModal({ open: false, mode: 'create' });
  }

  async function handleSave() {
    setFormError('');
    if (!name.trim()) { setFormError('Nome é obrigatório.'); return; }
    setSaving(true);
    try {
      if (modal.mode === 'create') {
        const created = await createDepartment(name.trim(), description.trim() || undefined);
        setDepartments(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      } else if (modal.dept) {
        const updated = await updateDepartment(modal.dept.id, { name: name.trim(), description: description.trim() || undefined });
        setDepartments(prev => prev.map(d => d.id === modal.dept!.id ? { ...d, ...updated } : d));
      }
      closeModal();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar setor.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm.dept) return;
    setDeleting(true);
    try {
      await deleteDepartmentById(confirm.dept.id);
      setDepartments(prev => prev.filter(d => d.id !== confirm.dept!.id));
    } catch {
      // silently close
    } finally {
      setDeleting(false);
      setConfirm({ open: false });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Setores e Departamentos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {departments.length} setor{departments.length !== 1 ? 'es' : ''} cadastrado{departments.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
          >
            <Plus size={15} />
            Novo Setor
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : departments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Building2 size={24} className="text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">Nenhum setor cadastrado</p>
          {canEdit && (
            <p className="text-xs text-slate-400 mt-1">Clique em "Novo Setor" para começar</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map(dept => (
            <Card key={dept.id} className="border-slate-200 hover:border-orange-200 hover:shadow-md transition-all duration-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <Building2 size={18} className="text-orange-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-800 text-sm leading-tight truncate">{dept.name}</h3>
                    {dept.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{dept.description}</p>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(dept)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setConfirm({ open: true, dept })}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-slate-100">
                <Users size={12} className="text-slate-400" />
                <span className="text-xs text-slate-500">
                  {(dept as Department & { user_count?: number }).user_count ?? 0} colaborador{((dept as Department & { user_count?: number }).user_count ?? 0) !== 1 ? 'es' : ''}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-orange-500" />
                <h2 className="font-semibold text-slate-800 text-sm">
                  {modal.mode === 'create' ? 'Novo Setor' : 'Editar Setor'}
                </h2>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <X size={15} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                  <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-600">{formError}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Nome *</label>
                <input
                  ref={nameRef}
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  placeholder="Ex: Suporte Técnico"
                  maxLength={100}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Descrição</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Descreva a função deste setor..."
                  maxLength={500}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={closeModal}
                className="h-9 px-4 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-9 px-5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-60"
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                {modal.mode === 'create' ? 'Criar Setor' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirm.open && confirm.dept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <Trash2 size={18} className="text-red-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">Excluir setor?</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Esta ação não pode ser desfeita</p>
                </div>
              </div>
              <p className="text-sm text-slate-600">
                O setor <strong>"{confirm.dept.name}"</strong> será removido.
                {(confirm.dept as Department & { user_count?: number }).user_count
                  ? ` Os ${(confirm.dept as Department & { user_count?: number }).user_count} colaboradores serão desvinculados.`
                  : ''}
              </p>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setConfirm({ open: false })}
                className="h-9 px-4 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="h-9 px-4 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-60"
              >
                {deleting && <Loader2 size={13} className="animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
