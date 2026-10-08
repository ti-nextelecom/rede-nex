import { useEffect, useState } from 'react';
import {
  CheckSquare, ChevronDown, ClipboardList, Eye, GripVertical,
  ListChecks, MessageSquare, Plus, ToggleLeft, Trash2, Type, X,
} from 'lucide-react';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/apiClient';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/utils';

interface FormField {
  id: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio';
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

interface Form {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  published: boolean;
  response_count: number;
  field_count: number;
  creator?: { id: string; name: string; photo_url?: string };
  created_at: string;
  updated_at: string;
}

interface FormResponse {
  id: string;
  answers: Record<string, string | string[]>;
  submitted_at: string;
  user?: { id: string; name: string; photo_url?: string };
}

const FIELD_TYPES = [
  { value: 'text', label: 'Texto curto', icon: Type },
  { value: 'textarea', label: 'Texto longo', icon: MessageSquare },
  { value: 'select', label: 'Seleção', icon: ChevronDown },
  { value: 'checkbox', label: 'Múltipla', icon: CheckSquare },
  { value: 'radio', label: 'Único', icon: ToggleLeft },
];

function uid() { return Math.random().toString(36).slice(2); }

type View = 'list' | 'edit' | 'respond' | 'responses';

export function FormsPage() {
  const { user } = useAuth();
  const isAdmin = ['Administrador', 'Gestor'].includes(user?.role_name ?? '');
  const [view, setView] = useState<View>('list');
  const [forms, setForms] = useState<Form[]>([]);
  const [currentForm, setCurrentForm] = useState<Form | null>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editFields, setEditFields] = useState<FormField[]>([]);
  const [editPublished, setEditPublished] = useState(false);

  const loadForms = async () => {
    setLoading(true);
    try { const r = await apiGet<{ data: Form[] }>('/forms'); setForms(r.data ?? []); }
    catch { setForms([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadForms(); }, []);

  const startCreate = () => {
    setCurrentForm(null);
    setEditTitle(''); setEditDesc(''); setEditFields([]); setEditPublished(false);
    setView('edit');
  };

  const startEdit = (form: Form) => {
    setCurrentForm(form);
    setEditTitle(form.title); setEditDesc(form.description || '');
    setEditFields(JSON.parse(JSON.stringify(form.fields)));
    setEditPublished(form.published);
    setView('edit');
  };

  const startRespond = (form: Form) => {
    setCurrentForm(form); setAnswers({}); setView('respond');
  };

  const viewResponses = async (form: Form) => {
    setCurrentForm(form);
    try {
      const r = await apiGet<{ data: FormResponse[] }>(`/forms/${form.id}/responses`);
      setResponses(r.data ?? []);
    } catch { setResponses([]); }
    setView('responses');
  };

  const saveForm = async () => {
    setSaving(true);
    try {
      const payload = { title: editTitle, description: editDesc, fields: editFields, published: editPublished };
      if (currentForm) {
        await apiPut(`/forms/${currentForm.id}`, payload);
      } else {
        await apiPost('/forms', payload);
      }
      await loadForms();
      setView('list');
    } finally { setSaving(false); }
  };

  const deleteForm = async (id: string) => {
    if (!confirm('Remover este formulário e todas as respostas?')) return;
    await apiDelete(`/forms/${id}`);
    await loadForms();
  };

  const submitForm = async () => {
    if (!currentForm) return;
    setSaving(true);
    try {
      await apiPost(`/forms/${currentForm.id}/responses`, { answers });
      alert('Resposta enviada com sucesso!');
      setView('list');
    } finally { setSaving(false); }
  };

  const addField = (type: FormField['type']) => {
    setEditFields(f => [...f, {
      id: uid(), type, label: '', required: false,
      options: ['select','checkbox','radio'].includes(type) ? ['Opção 1'] : undefined,
    }]);
  };

  const updateField = (id: string, patch: Partial<FormField>) => {
    setEditFields(f => f.map(field => field.id === id ? { ...field, ...patch } : field));
  };

  const removeField = (id: string) => setEditFields(f => f.filter(field => field.id !== id));

  const addOption = (fieldId: string) => {
    setEditFields(f => f.map(field => field.id === fieldId
      ? { ...field, options: [...(field.options || []), `Opção ${(field.options?.length || 0) + 1}`] }
      : field
    ));
  };

  const updateOption = (fieldId: string, idx: number, val: string) => {
    setEditFields(f => f.map(field => {
      if (field.id !== fieldId) return field;
      const options = [...(field.options || [])];
      options[idx] = val;
      return { ...field, options };
    }));
  };

  const removeOption = (fieldId: string, idx: number) => {
    setEditFields(f => f.map(field => {
      if (field.id !== fieldId) return field;
      return { ...field, options: field.options?.filter((_, i) => i !== idx) };
    }));
  };

  const setAnswer = (fieldId: string, val: string, multi = false) => {
    if (!multi) { setAnswers(a => ({ ...a, [fieldId]: val })); return; }
    setAnswers(a => {
      const current = (a[fieldId] as string[]) || [];
      const exists = current.includes(val);
      return { ...a, [fieldId]: exists ? current.filter(v => v !== val) : [...current, val] };
    });
  };

  if (view === 'edit') return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button onClick={() => setView('list')}
          className="text-sm text-orange-600 hover:underline font-medium min-h-[44px] flex items-center">
          ← Voltar
        </button>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer min-h-[44px]">
            <input type="checkbox" checked={editPublished} onChange={e => setEditPublished(e.target.checked)} className="accent-orange-500 w-4 h-4" />
            Publicado
          </label>
          <button onClick={saveForm} disabled={saving || !editTitle.trim()}
            className="px-4 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 min-h-[44px]">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
        <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
          placeholder="Título do formulário"
          className="w-full text-lg font-bold border-b border-slate-200 dark:border-slate-600 pb-2 outline-none text-slate-800 dark:text-slate-100 focus:border-orange-400 bg-transparent dark:bg-transparent" />
        <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)}
          placeholder="Descrição (opcional)" rows={2}
          className="w-full text-sm text-slate-600 dark:text-slate-300 border-none outline-none resize-none bg-transparent dark:bg-transparent" />
      </div>

      <div className="space-y-3">
        {editFields.map((field) => (
          <div key={field.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <GripVertical size={16} className="text-slate-300 flex-shrink-0" />
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase flex-1 truncate">
                {FIELD_TYPES.find(t => t.value === field.type)?.label}
              </span>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer min-h-[36px]">
                <input type="checkbox" checked={field.required}
                  onChange={e => updateField(field.id, { required: e.target.checked })}
                  className="accent-orange-500 w-4 h-4" />
                Obrig.
              </label>
              <button onClick={() => removeField(field.id)}
                className="text-red-400 hover:text-red-600 transition-colors p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center">
                <Trash2 size={14} />
              </button>
            </div>
            <input value={field.label} onChange={e => updateField(field.id, { label: e.target.value })}
              placeholder="Rótulo da pergunta"
              className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-400 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100" />
            {(field.type === 'text' || field.type === 'textarea') && (
              <input value={field.placeholder || ''} onChange={e => updateField(field.id, { placeholder: e.target.value })}
                placeholder="Placeholder (opcional)"
                className="w-full border border-slate-100 dark:border-slate-600 rounded-lg px-3 py-2 text-xs outline-none text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900" />
            )}
            {field.options && (
              <div className="space-y-2">
                {field.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <div className={cn('w-3.5 h-3.5 flex-shrink-0 border border-slate-300 dark:border-slate-500',
                      field.type === 'radio' ? 'rounded-full' : 'rounded')} />
                    <input value={opt} onChange={e => updateOption(field.id, oi, e.target.value)}
                      className="flex-1 text-sm border-b border-slate-200 outline-none focus:border-orange-400 bg-transparent pb-0.5" />
                    <button onClick={() => removeOption(field.id, oi)}
                      className="text-slate-300 hover:text-red-400 transition-colors p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center">
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <button onClick={() => addOption(field.id)}
                  className="text-xs text-orange-600 hover:underline font-medium min-h-[36px] flex items-center">
                  + Adicionar opção
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 text-center uppercase tracking-wide">Adicionar campo</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {FIELD_TYPES.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.value} onClick={() => addField(t.value as FormField['type'])}
                className="flex flex-col items-center gap-1.5 py-3 border border-slate-200 dark:border-slate-600 rounded-lg hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 active:bg-orange-100 dark:active:bg-orange-900/30 transition-colors text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 min-h-[64px]">
                <Icon size={18} />
                <span className="text-[10px] font-medium text-center leading-tight">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (view === 'respond' && currentForm) return (
    <div className="space-y-4">
      <button onClick={() => setView('list')}
        className="text-sm text-orange-600 hover:underline font-medium min-h-[44px] flex items-center">
        ← Voltar
      </button>
      <div className="bg-white dark:bg-slate-800 border-t-4 border-orange-500 rounded-xl p-4 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{currentForm.title}</h2>
        {currentForm.description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{currentForm.description}</p>}
      </div>
      {currentForm.fields.map(field => (
        <div key={field.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
          <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </label>
          {field.type === 'text' && (
            <input value={(answers[field.id] as string) || ''} onChange={e => setAnswer(field.id, e.target.value)}
              placeholder={field.placeholder}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-400" />
          )}
          {field.type === 'textarea' && (
            <textarea value={(answers[field.id] as string) || ''} onChange={e => setAnswer(field.id, e.target.value)}
              placeholder={field.placeholder} rows={3}
              className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-400 resize-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100" />
          )}
          {field.type === 'select' && (
            <select value={(answers[field.id] as string) || ''} onChange={e => setAnswer(field.id, e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-400 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
              <option value="">Selecione...</option>
              {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
          {field.type === 'radio' && field.options?.map(o => (
            <label key={o} className="flex items-center gap-2 cursor-pointer min-h-[40px]">
              <input type="radio" name={field.id} value={o}
                checked={(answers[field.id] as string) === o}
                onChange={() => setAnswer(field.id, o)} className="accent-orange-500 w-4 h-4" />
              <span className="text-sm text-slate-700 dark:text-slate-200">{o}</span>
            </label>
          ))}
          {field.type === 'checkbox' && field.options?.map(o => (
            <label key={o} className="flex items-center gap-2 cursor-pointer min-h-[40px]">
              <input type="checkbox" value={o}
                checked={((answers[field.id] as string[]) || []).includes(o)}
                onChange={() => setAnswer(field.id, o, true)} className="accent-orange-500 w-4 h-4" />
              <span className="text-sm text-slate-700">{o}</span>
            </label>
          ))}
        </div>
      ))}
      <button onClick={submitForm} disabled={saving}
        className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-60 min-h-[48px]">
        {saving ? 'Enviando...' : 'Enviar resposta'}
      </button>
    </div>
  );

  if (view === 'responses' && currentForm) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setView('list')}
          className="text-sm text-orange-600 hover:underline font-medium min-h-[44px] flex items-center">
          ← Voltar
        </button>
        <span className="text-sm text-slate-500 dark:text-slate-400">{responses.length} resposta{responses.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{currentForm.title} — Respostas</h2>
        </div>
        {responses.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">Nenhuma resposta ainda</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {responses.map(r => (
              <div key={r.id} className="px-4 py-4">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {r.user && (
                    <img src={r.user.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.user.name)}&size=28&background=f97316&color=fff`}
                      alt={r.user.name} className="w-6 h-6 rounded-full flex-shrink-0" />
                  )}
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{r.user?.name || 'Anônimo'}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">{new Date(r.submitted_at).toLocaleString('pt-BR')}</span>
                </div>
                <div className="space-y-2">
                  {currentForm.fields.map(field => (
                    <div key={field.id} className="text-sm">
                      <span className="font-medium text-slate-600 dark:text-slate-300">{field.label}: </span>
                      <span className="text-slate-800 dark:text-slate-100">
                        {Array.isArray(r.answers[field.id])
                          ? (r.answers[field.id] as string[]).join(', ')
                          : String(r.answers[field.id] ?? '—')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList size={20} className="text-orange-500" />
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Formulários</h1>
        </div>
        {isAdmin && (
          <button onClick={startCreate}
            className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors min-h-[40px]">
            <Plus size={15} /> <span className="hidden sm:inline">Novo formulário</span><span className="sm:hidden">Novo</span>
          </button>
        )}
      </div>
      {loading ? (
        <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">Carregando...</div>
      ) : forms.length === 0 ? (
        <div className="py-12 text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
          <ClipboardList size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhum formulário</p>
          {isAdmin && (
            <button onClick={startCreate} className="mt-3 text-orange-600 text-sm font-medium hover:underline min-h-[44px] flex items-center mx-auto">
              Criar formulário
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {forms.map(form => (
            <div key={form.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 active:bg-slate-50 dark:active:bg-slate-700 transition-colors">
              <div className="flex items-start justify-between mb-2 gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{form.title}</h3>
                  {form.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{form.description}</p>}
                </div>
                <span className={cn('px-1.5 py-0.5 text-[10px] font-semibold rounded-full flex-shrink-0',
                  form.published ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400')}>
                  {form.published ? 'Pub.' : 'Rasc.'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 mb-3">
                <span><ListChecks size={11} className="inline mr-0.5" />{form.field_count} campo{Number(form.field_count) !== 1 ? 's' : ''}</span>
                <span>{form.response_count} resp.</span>
              </div>
              <div className="flex gap-2">
                {form.published && form.creator?.id !== user?.id && (
                  <button onClick={() => startRespond(form)}
                    className="flex-1 py-2 text-xs font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 active:bg-orange-700 transition-colors min-h-[40px]">
                    Responder
                  </button>
                )}
                {(isAdmin || form.creator?.id === user?.id) && (
                  <>
                    <button onClick={() => startEdit(form)}
                      className="flex-1 py-2 text-xs font-medium border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600 transition-colors min-h-[40px]">
                      Editar
                    </button>
                    <button onClick={() => viewResponses(form)}
                      className="p-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                      title="Ver respostas">
                      <Eye size={14} />
                    </button>
                    <button onClick={() => deleteForm(form.id)}
                      className="p-2 border border-red-100 text-red-400 rounded-lg hover:bg-red-50 active:bg-red-100 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
