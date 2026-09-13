import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle, Clock, FileSignature, Plus, Shield, Trash2, Upload, X, XCircle,
} from 'lucide-react';
import { apiDelete, apiGet, apiPost } from '../lib/apiClient';
import { getUsers } from '../lib/appApi';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/utils';

interface SignRequest {
  id: string;
  status: 'pending' | 'signed' | 'rejected';
  signed_at?: string;
  user: { id: string; name: string; photo_url?: string };
}

interface SignDoc {
  id: string;
  title: string;
  file_url: string;
  created_at: string;
  creator?: { id: string; name: string; photo_url?: string };
  requests: SignRequest[];
}

interface User { id: string; name: string; photo_url?: string; }

export function SignPage() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<SignDoc[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', file_url: '', signer_ids: [] as string[] });
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try { const r = await apiGet<{ data: SignDoc[] }>('/sign/documents'); setDocs(r.data ?? []); }
    catch { setDocs([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); getUsers().then(setUsers).catch(() => {}); }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      await new Promise<void>((resolve, reject) => {
        reader.onload = async () => {
          try {
            const r = await apiPost<{ data: { public_url: string } }>('/sign/media', {
              data: reader.result, file_name: file.name, file_type: file.type,
            });
            setForm(f => ({ ...f, file_url: r.data.public_url, title: f.title || file.name.replace(/\.[^.]+$/, '') }));
            resolve();
          } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const createDoc = async () => {
    if (!form.title || !form.file_url) return;
    setSaving(true);
    try {
      await apiPost('/sign/documents', form);
      setShowModal(false);
      setForm({ title: '', file_url: '', signer_ids: [] });
      await load();
    } finally { setSaving(false); }
  };

  const sign = async (docId: string) => {
    if (!confirm('Confirma a assinatura eletrônica? Ao assinar, você concorda com o conteúdo do documento.')) return;
    try { await apiPost(`/sign/documents/${docId}/sign`, {}); await load(); }
    catch { alert('Erro ao assinar. Tente novamente.'); }
  };

  const reject = async (docId: string) => {
    if (!confirm('Rejeitar este documento?')) return;
    try { await apiPost(`/sign/documents/${docId}/reject`, {}); await load(); }
    catch { alert('Erro ao rejeitar. Tente novamente.'); }
  };

  const deleteDoc = async (id: string) => {
    if (!confirm('Remover este documento?')) return;
    await apiDelete(`/sign/documents/${id}`); await load();
  };

  const toggleSigner = (uid: string) => {
    setForm(f => ({
      ...f,
      signer_ids: f.signer_ids.includes(uid) ? f.signer_ids.filter(id => id !== uid) : [...f.signer_ids, uid],
    }));
  };

  const myRequestFor = (doc: SignDoc) => doc.requests.find(r => r.user.id === user?.id);

  const statusBadge = (status: string) => {
    if (status === 'signed') return <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full whitespace-nowrap"><CheckCircle size={10} /> Assinado</span>;
    if (status === 'rejected') return <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full whitespace-nowrap"><XCircle size={10} /> Rejeitado</span>;
    return <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full whitespace-nowrap"><Clock size={10} /> Pendente</span>;
  };

  const overallStatus = (doc: SignDoc) => {
    if (!doc.requests.length) return 'pending';
    if (doc.requests.every(r => r.status === 'signed')) return 'signed';
    if (doc.requests.some(r => r.status === 'rejected')) return 'rejected';
    return 'pending';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSignature size={20} className="text-orange-500" />
          <h1 className="text-lg font-bold text-slate-800">Assinatura</h1>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors min-h-[40px]">
          <Plus size={15} /> <span className="hidden sm:inline">Novo doc</span><span className="sm:hidden">Novo</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Carregando...</div>
      ) : docs.length === 0 ? (
        <div className="py-12 text-center bg-white border border-slate-200 rounded-xl">
          <FileSignature size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Nenhum documento para assinar</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-orange-600 text-sm font-medium hover:underline">Enviar documento</button>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map(doc => {
            const myReq = myRequestFor(doc);
            const status = overallStatus(doc);
            return (
              <div key={doc.id} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                    status === 'signed' ? 'bg-emerald-50' : status === 'rejected' ? 'bg-red-50' : 'bg-amber-50')}>
                    <FileSignature size={18} className={status === 'signed' ? 'text-emerald-600' : status === 'rejected' ? 'text-red-500' : 'text-amber-500'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-bold text-slate-800 hover:text-orange-600 transition-colors truncate max-w-[180px] sm:max-w-none">
                        {doc.title}
                      </a>
                      {statusBadge(status)}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {doc.creator?.name} · {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                    </p>

                    {doc.requests.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-xs font-semibold text-slate-500">Assinaturas:</p>
                        {doc.requests.map(req => (
                          <div key={req.id} className="flex items-center gap-2 flex-wrap">
                            <img src={req.user.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.user.name)}&size=20&background=f97316&color=fff`}
                              alt={req.user.name} className="w-5 h-5 rounded-full flex-shrink-0" />
                            <span className="text-xs text-slate-700">{req.user.name}</span>
                            {statusBadge(req.status)}
                            {req.status === 'signed' && req.signed_at && (
                              <span className="text-[10px] text-slate-400">{new Date(req.signed_at).toLocaleString('pt-BR')}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action buttons — below content on mobile */}
                    {(myReq?.status === 'pending' || doc.creator?.id === user?.id) && (
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {myReq?.status === 'pending' && (
                          <>
                            <button onClick={() => sign(doc.id)}
                              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-white rounded-lg text-xs font-semibold hover:bg-emerald-600 transition-colors min-h-[36px]">
                              <Shield size={12} /> Assinar
                            </button>
                            <button onClick={() => reject(doc.id)}
                              className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors min-h-[36px]">
                              <X size={12} /> Rejeitar
                            </button>
                          </>
                        )}
                        {doc.creator?.id === user?.id && (
                          <button onClick={() => deleteDoc(doc.id)}
                            className="p-2 border border-slate-200 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">Novo documento</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Título *</label>
                <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-400" placeholder="Nome do documento" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Arquivo *</label>
                {form.file_url ? (
                  <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <CheckCircle size={14} className="text-emerald-600 flex-shrink-0" />
                    <span className="text-xs text-emerald-700 flex-1 truncate">Arquivo enviado</span>
                    <button onClick={() => setForm(f => ({...f, file_url: ''}))} className="text-slate-400 hover:text-red-500 p-1"><X size={13} /></button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-orange-400 hover:text-orange-500 transition-colors disabled:opacity-60 min-h-[56px]">
                    <Upload size={16} /> {uploading ? 'Enviando...' : 'Toque para fazer upload (PDF, imagem)'}
                  </button>
                )}
                <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileUpload} />
              </div>
              {users.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">Signatários</label>
                  <div className="max-h-40 overflow-y-auto space-y-1 border border-slate-100 rounded-lg p-2">
                    {users.filter(u => u.id !== user?.id).map(u => (
                      <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded px-1 py-1 min-h-[40px]">
                        <input type="checkbox" checked={form.signer_ids.includes(u.id)} onChange={() => toggleSigner(u.id)} className="accent-orange-500 w-4 h-4" />
                        <img src={u.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&size=24&background=f97316&color=fff`}
                          alt={u.name} className="w-6 h-6 rounded-full" />
                        <span className="text-sm text-slate-700">{u.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-3 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors min-h-[48px]">Cancelar</button>
              <button onClick={createDoc} disabled={saving || !form.title || !form.file_url}
                className="flex-1 py-3 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 min-h-[48px]">
                {saving ? 'Criando...' : 'Criar documento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
