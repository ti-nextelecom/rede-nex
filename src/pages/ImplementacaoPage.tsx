import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Clock, FileText, Loader2, MessageSquare,
  Paperclip, Plus, Trash2, X,
} from 'lucide-react';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/apiClient';
import { useAuth } from '../lib/auth';

type DemandStage = 'aberto' | 'em_analise' | 'em_andamento' | 'finalizado';
type DemandType = 'implementacao' | 'correcao';
type DemandPriority = 'baixa' | 'media' | 'alta' | 'critica';

interface Demand {
  id: string;
  title: string;
  description: string;
  type: DemandType;
  stage: DemandStage;
  priority: DemandPriority;
  deadline: string | null;
  created_by: string;
  creator_name: string;
  creator_photo: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  created_at: string;
  updated_at: string;
}

interface DemandComment {
  id: string;
  demand_id: string;
  user_id: string;
  user_name: string;
  user_photo: string | null;
  content: string;
  created_at: string;
}

interface DemandFile {
  id: string;
  demand_id: string;
  user_id: string;
  user_name: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

const STAGES: { id: DemandStage; label: string; borderClass: string }[] = [
  { id: 'aberto',       label: 'Aberto',       borderClass: 'border-t-slate-400' },
  { id: 'em_analise',   label: 'Em Análise',   borderClass: 'border-t-blue-500' },
  { id: 'em_andamento', label: 'Em Andamento', borderClass: 'border-t-amber-400' },
  { id: 'finalizado',   label: 'Finalizado',   borderClass: 'border-t-emerald-500' },
];

const STAGE_BADGE: Record<DemandStage, string> = {
  aberto:       'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  em_analise:   'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  em_andamento: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  finalizado:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

const STAGE_LABEL: Record<DemandStage, string> = {
  aberto: 'Aberto', em_analise: 'Em Análise', em_andamento: 'Em Andamento', finalizado: 'Finalizado',
};

const PRIORITY_BADGE: Record<DemandPriority, string> = {
  baixa:   'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
  media:   'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
  alta:    'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  critica: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const PRIORITY_LABEL: Record<DemandPriority, string> = {
  baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  const dt = d.includes('T') ? d.split('T')[0] : d;
  const [y, m, day] = dt.split('-');
  return `${day}/${m}/${y}`;
}

function fmtDatetime(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function isOverdue(demand: Demand) {
  if (!demand.deadline || demand.stage === 'finalizado') return false;
  return new Date(demand.deadline) < new Date();
}

function formatBytes(b: number) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

function Avatar({ name, photo, size = 6 }: { name: string; photo?: string | null; size?: number }) {
  const sizeClass = `w-${size} h-${size}`;
  if (photo) return <img src={photo} alt={name} className={`${sizeClass} rounded-full object-cover flex-shrink-0`} />;
  return (
    <div className={`${sizeClass} rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center flex-shrink-0`}>
      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300">{name.charAt(0).toUpperCase()}</span>
    </div>
  );
}

function ModalOverlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}

function DemandCard({ demand, onClick }: { demand: Demand; onClick: () => void }) {
  const overdue = isOverdue(demand);
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-500/60 hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex flex-wrap items-center gap-1 mb-2">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${demand.type === 'implementacao' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`}>
          {demand.type === 'implementacao' ? 'IMPL' : 'CORR'}
        </span>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${PRIORITY_BADGE[demand.priority]}`}>
          {PRIORITY_LABEL[demand.priority]}
        </span>
        {demand.stage === 'em_andamento' && demand.deadline && (
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${overdue ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
            <Clock size={9} />
            {fmtDate(demand.deadline)}
          </span>
        )}
      </div>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
        {demand.title}
      </p>
      {demand.description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{demand.description}</p>
      )}
      <div className="flex items-center gap-1.5 mt-2.5">
        <Avatar name={demand.creator_name} photo={demand.creator_photo} size={5} />
        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex-1">{demand.creator_name}</span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">{fmtDate(demand.created_at)}</span>
      </div>
    </button>
  );
}

function CreateModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (d: { title: string; description: string; type: DemandType; priority: DemandPriority }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<DemandType>('implementacao');
  const [priority, setPriority] = useState<DemandPriority>('media');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Título obrigatório'); return; }
    setSaving(true);
    setError('');
    try {
      await onCreate({ title: title.trim(), description: description.trim(), type, priority });
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar demanda');
    }
    setSaving(false);
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Nova Demanda</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Título *</label>
            <input
              type="text"
              value={title}
              onChange={e => { setTitle(e.target.value); setError(''); }}
              placeholder="Descreva brevemente a solicitação..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Descrição</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Detalhe o que precisa ser feito, contexto, exemplos..."
              rows={4}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Tipo</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as DemandType)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="implementacao">Implementação</option>
                <option value="correcao">Correção</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Prioridade</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as DemandPriority)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Criar Demanda
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

function DetailModal({ demand, comments, files, loading, isAdmin, currentUserId, onClose, onStageChange, onDeadlineChange, onAddComment, onAddFile, onDeleteFile }: {
  demand: Demand;
  comments: DemandComment[];
  files: DemandFile[];
  loading: boolean;
  isAdmin: boolean;
  currentUserId: string;
  onClose: () => void;
  onStageChange: (s: DemandStage) => Promise<void>;
  onDeadlineChange: (d: string) => Promise<void>;
  onAddComment: (c: string) => Promise<void>;
  onAddFile: (b: string, n: string, m: string) => Promise<void>;
  onDeleteFile: (id: string) => Promise<void>;
}) {
  const [commentText, setCommentText] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [savingStage, setSavingStage] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const overdue = isOverdue(demand);
  const isCreator = demand.created_by === currentUserId;
  const canUpload = isCreator || isAdmin;

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setSavingComment(true);
    try { await onAddComment(commentText.trim()); setCommentText(''); } catch {}
    setSavingComment(false);
  };

  const handleStageChange = async (s: DemandStage) => {
    if (s === demand.stage) return;
    setSavingStage(s);
    try { await onStageChange(s); } catch {}
    setSavingStage('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = (reader.result as string).split(',')[1];
      try { await onAddFile(b64, file.name, file.type || 'application/octet-stream'); } catch {}
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.onerror = () => setUploadingFile(false);
    reader.readAsDataURL(file);
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 gap-3 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${demand.type === 'implementacao' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`}>
                {demand.type === 'implementacao' ? 'Implementação' : 'Correção'}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${PRIORITY_BADGE[demand.priority]}`}>
                {PRIORITY_LABEL[demand.priority]}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STAGE_BADGE[demand.stage]}`}>
                {STAGE_LABEL[demand.stage]}
              </span>
              {demand.stage === 'em_andamento' && demand.deadline && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${overdue ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                  <Clock size={10} />
                  Prazo: {fmtDate(demand.deadline)}
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-snug">{demand.title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              {/* Meta */}
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Avatar name={demand.creator_name} photo={demand.creator_photo} size={5} />
                <span>Aberto por <span className="font-semibold text-slate-700 dark:text-slate-300">{demand.creator_name}</span></span>
                <span>•</span>
                <span>{fmtDatetime(demand.created_at)}</span>
              </div>

              {/* Description */}
              {demand.description && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Descrição</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{demand.description}</p>
                </div>
              )}

              {/* Admin controls */}
              {isAdmin && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 flex flex-col gap-3">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Controles T.I.</p>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Etapa</p>
                    <div className="flex flex-wrap gap-1.5">
                      {STAGES.map(s => (
                        <button
                          key={s.id}
                          onClick={() => handleStageChange(s.id)}
                          disabled={!!savingStage}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border-2 ${demand.stage === s.id ? 'border-orange-400 dark:border-orange-500 opacity-100' : 'border-transparent opacity-60 hover:opacity-90'} ${STAGE_BADGE[s.id]}`}
                        >
                          {savingStage === s.id ? <Loader2 size={10} className="animate-spin inline" /> : STAGE_LABEL[s.id]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">Prazo</p>
                    <input
                      type="date"
                      key={demand.deadline || 'none'}
                      defaultValue={demand.deadline ? demand.deadline.split('T')[0] : ''}
                      onBlur={e => onDeadlineChange(e.target.value)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                </div>
              )}

              {/* Files */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Arquivos ({files.length})</p>
                  {canUpload && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                      className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 font-semibold transition-colors"
                    >
                      {uploadingFile ? <Loader2 size={11} className="animate-spin" /> : <Paperclip size={11} />}
                      Anexar
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
                </div>
                {files.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500">Nenhum arquivo anexado.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {files.map(f => (
                      <div key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                        <FileText size={13} className="text-slate-400 flex-shrink-0" />
                        <a
                          href={`/uploads/implementation/${f.filename}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-orange-500 dark:hover:text-orange-400 truncate transition-colors"
                        >
                          {f.original_name}
                        </a>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">{formatBytes(f.size_bytes)}</span>
                        {(f.user_id === currentUserId || isAdmin) && (
                          <button
                            onClick={() => onDeleteFile(f.id)}
                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Comments */}
              <div>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">Comentários ({comments.length})</p>
                {comments.length > 0 && (
                  <div className="flex flex-col gap-3 mb-4">
                    {comments.map(c => (
                      <div key={c.id} className="flex gap-2.5">
                        <Avatar name={c.user_name} photo={c.user_photo} size={6} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{c.user_name}</span>
                            <span className="text-[10px] text-slate-400">{fmtDatetime(c.created_at)}</span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">{c.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!isAdmin && comments.length === 0 && (
                  <p className="text-xs text-slate-400 dark:text-slate-500">Nenhum comentário do setor T.I. ainda.</p>
                )}
                {isAdmin && (
                  <div className="flex gap-2">
                    <textarea
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      placeholder="Adicionar comentário sobre esta demanda..."
                      rows={2}
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                    />
                    <button
                      onClick={handleAddComment}
                      disabled={savingComment || !commentText.trim()}
                      className="px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white transition-colors flex-shrink-0 self-end"
                    >
                      {savingComment ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}

export function ImplementacaoPage() {
  const { user } = useAuth();
  const isAdmin = ['Administrador', 'Gestor'].includes(user?.role_name ?? '');

  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [detailDemand, setDetailDemand] = useState<Demand | null>(null);
  const [comments, setComments] = useState<DemandComment[]>([]);
  const [files, setFiles] = useState<DemandFile[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadDemands = async () => {
    setLoading(true);
    try {
      const r = await apiGet('/implementation') as any;
      setDemands(r.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadDemands(); }, []);

  const openDetail = async (demand: Demand) => {
    setDetailDemand(demand);
    setComments([]);
    setFiles([]);
    setDetailLoading(true);
    try {
      const [cm, fl] = await Promise.all([
        apiGet(`/implementation/${demand.id}/comments`),
        apiGet(`/implementation/${demand.id}/files`),
      ]) as any[];
      setComments(cm.data || []);
      setFiles(fl.data || []);
    } catch {}
    setDetailLoading(false);
  };

  const closeDetail = () => { setDetailDemand(null); setComments([]); setFiles([]); };

  const handleCreate = async (data: { title: string; description: string; type: DemandType; priority: DemandPriority }) => {
    const r = await apiPost('/implementation', data) as any;
    if (r.data) {
      setDemands(prev => [r.data, ...prev]);
      setShowCreate(false);
    }
  };

  const handleStageChange = async (stage: DemandStage) => {
    if (!detailDemand) return;
    const r = await apiPut(`/implementation/${detailDemand.id}`, { stage }) as any;
    if (r.data) {
      setDetailDemand(r.data);
      setDemands(prev => prev.map(d => d.id === r.data.id ? r.data : d));
    }
  };

  const handleDeadlineChange = async (deadline: string) => {
    if (!detailDemand) return;
    const r = await apiPut(`/implementation/${detailDemand.id}`, { deadline: deadline || null }) as any;
    if (r.data) {
      setDetailDemand(r.data);
      setDemands(prev => prev.map(d => d.id === r.data.id ? r.data : d));
    }
  };

  const handleAddComment = async (content: string) => {
    if (!detailDemand) return;
    const r = await apiPost(`/implementation/${detailDemand.id}/comments`, { content }) as any;
    if (r.data) setComments(prev => [...prev, r.data]);
  };

  const handleAddFile = async (b64: string, name: string, mime: string) => {
    if (!detailDemand) return;
    const r = await apiPost(`/implementation/${detailDemand.id}/files`, { data: b64, filename: name, mime }) as any;
    if (r.data) setFiles(prev => [...prev, r.data]);
  };

  const handleDeleteFile = async (fileId: string) => {
    await apiDelete(`/implementation/files/${fileId}`);
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Implementação e Correção</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Solicitações de implementações e correções — {demands.length} demanda{demands.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus size={15} /> Nova Demanda
        </button>
      </div>

      {/* Kanban board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4">
          <div className="flex gap-4 h-full" style={{ minWidth: 'max-content' }}>
            {STAGES.map(stage => {
              const stageDemands = demands.filter(d => d.stage === stage.id);
              return (
                <div
                  key={stage.id}
                  className={`flex flex-col rounded-xl border border-t-4 ${stage.borderClass} border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm`}
                  style={{ width: '17rem', minWidth: '17rem' }}
                >
                  <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{stage.label}</span>
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      {stageDemands.length}
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2">
                    {stageDemands.length === 0 ? (
                      <div className="flex items-center justify-center py-8">
                        <p className="text-xs text-slate-400 dark:text-slate-500">Nenhuma demanda</p>
                      </div>
                    ) : (
                      stageDemands.map(demand => (
                        <DemandCard key={demand.id} demand={demand} onClick={() => openDetail(demand)} />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}
      {detailDemand && (
        <DetailModal
          demand={detailDemand}
          comments={comments}
          files={files}
          loading={detailLoading}
          isAdmin={isAdmin}
          currentUserId={user?.id || ''}
          onClose={closeDetail}
          onStageChange={handleStageChange}
          onDeadlineChange={handleDeadlineChange}
          onAddComment={handleAddComment}
          onAddFile={handleAddFile}
          onDeleteFile={handleDeleteFile}
        />
      )}
    </div>
  );
}
