import { useEffect, useRef, useState } from 'react';
import {
  Cake, CalendarHeart, Eye, Film, Heart, Image as ImageIcon,
  ChevronDown, Lightbulb, Megaphone, MessageCircle, PartyPopper, Pencil, Plus,
  ThumbsUp, Trash2, X, BookOpen, ClipboardList, Search, Umbrella,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ImageLightbox } from '../components/ui/ImageLightbox';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { cn } from '../lib/utils';
import './jrh.css';
import {
  addComment, checkIsHR, createJRHPost, deleteJRHPost, getMonthBirthdays, getPostViews,
  listJRHPosts, updateJRHPost, uploadJRHFile,
  recordPostView, toggleReaction,
  type BirthdayUser, type JRHComment, type JRHPost, type JRHViewer,
} from '../lib/jrhApi';

const CATEGORIES = [
  { key: 'aniversariantes', label: 'Aniversariantes do mês', emoji: '🎂', icon: Cake,         color: 'bg-pink-100 text-pink-700',    ring: 'ring-pink-300' },
  { key: 'rh_informa',     label: 'RH Informa',             emoji: '📢', icon: Megaphone,      color: 'bg-rose-100 text-rose-700',    ring: 'ring-rose-300' },
  { key: 'acoes',          label: 'Ações do mês',           emoji: '💙', icon: CalendarHeart,  color: 'bg-blue-100 text-blue-700',    ring: 'ring-blue-300' },
  { key: 'dicas',          label: 'Dicas e conteúdos úteis',emoji: '📚', icon: BookOpen,       color: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-300' },
  { key: 'campanhas',      label: 'Campanhas e eventos',    emoji: '🎉', icon: PartyPopper,    color: 'bg-amber-100 text-amber-700',  ring: 'ring-amber-300' },
  { key: 'comunicados',    label: 'Comunicados importantes',emoji: '📋', icon: ClipboardList,  color: 'bg-violet-100 text-violet-700',ring: 'ring-violet-300' },
  { key: 'ferias',         label: 'Férias',                 emoji: '🏖️', icon: Umbrella,       color: 'bg-sky-100 text-sky-700',      ring: 'ring-sky-300' },
] as const;

type CategoryKey = typeof CATEGORIES[number]['key'];
type FeriasFilter = 'all' | 'vencido' | 'a_vencer';

const REACTIONS = [
  { key: 'like',       label: 'Curtir',    Icon: ThumbsUp,    color: 'text-blue-500',   activeBg: 'bg-blue-100 text-blue-600',   hoverClass: 'hover:bg-blue-50 hover:text-blue-500' },
  { key: 'love',       label: 'Amei',      Icon: Heart,       color: 'text-rose-500',   activeBg: 'bg-rose-100 text-rose-600',   hoverClass: 'hover:bg-rose-50 hover:text-rose-500' },
  { key: 'celebrate',  label: 'Parabéns',  Icon: PartyPopper, color: 'text-amber-500',  activeBg: 'bg-amber-100 text-amber-600', hoverClass: 'hover:bg-amber-50 hover:text-amber-500' },
  { key: 'insightful', label: 'Perspicaz', Icon: Lightbulb,   color: 'text-purple-500', activeBg: 'bg-purple-100 text-purple-600', hoverClass: 'hover:bg-purple-50 hover:text-purple-500' },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function avatar(name: string, photoUrl: string | null | undefined, fallbackColor = '6366f1') {
  return photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=80&background=${fallbackColor}&color=fff`;
}

function getCategoryMeta(key: string | null | undefined) {
  return CATEGORIES.find(c => c.key === key) ?? null;
}

function cleanContent(content: string | null | undefined): string | null {
  if (!content) return null;
  return content.replace(/\[bday:[a-f0-9-]+\]/g, '').trim() || null;
}

function toLocalDateInput(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  return isoDate.slice(0, 10);
}

function getFeriasBadge(expiresAt: string | null): 'vencido' | 'a_vencer' | null {
  if (!expiresAt) return null;
  const today = new Date().toLocaleDateString('sv-SE');
  const endDate = expiresAt.slice(0, 10);
  if (endDate < today) return 'vencido';
  const daysLeft = Math.round((new Date(endDate).getTime() - new Date(today).getTime()) / 86400000);
  if (daysLeft <= 60) return 'a_vencer';
  return null;
}

// ─── Viewers modal ───────────────────────────────────────────────────────────
function ViewersModal({ postId, viewCount, onClose }: { postId: string; viewCount: number; onClose: () => void }) {
  const [viewers, setViewers] = useState<JRHViewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getPostViews(postId).then(setViewers).catch(() => setError(true)).finally(() => setLoading(false));
  }, [postId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Quem visualizou a publicação" className="jrh-viewers-modal bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
              <Eye size={18} className="text-blue-500" />
              Quem viu esta publicação
            </h3>
            <p className="text-sm text-slate-500 mt-1">{viewCount} {viewCount === 1 ? 'visualização registrada' : 'visualizações registradas'}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar visualizações" className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>
        <div className="max-h-[min(60vh,480px)] overflow-y-auto p-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            </div>
          ) : error ? (
            <p role="alert" className="text-sm text-red-500 text-center py-6">Não foi possível carregar a lista de visualizações.</p>
          ) : viewers.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Nenhuma visualização registrada</p>
          ) : viewers.map(v => (
            <div key={v.user_id} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors">
              <img src={avatar(v.name, v.photo_url)} alt={v.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{v.name}</p>
                {v.department_name && <p className="text-xs text-slate-400 truncate">{v.department_name}</p>}
              </div>
              <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(v.viewed_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Create post modal ────────────────────────────────────────────────────────
function CreatePostModal({
  onClose, onCreated,
}: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<CategoryKey | ''>('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState('');

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(file ? URL.createObjectURL(file) : '');
  }

  function handleVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setVideoFile(e.target.files?.[0] ?? null);
  }

  async function handleSubmit() {
    if (!content.trim() && !imageFile && !videoFile) {
      setError('Adicione conteúdo, imagem ou vídeo');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      let image_url: string | undefined;
      let video_url: string | undefined;
      if (imageFile) {
        setUploadProgress('Enviando imagem...');
        image_url = await uploadJRHFile(imageFile);
      }
      if (videoFile) {
        setUploadProgress('Enviando vídeo...');
        video_url = await uploadJRHFile(videoFile);
      }
      setUploadProgress('Publicando...');
      await createJRHPost({
        title: title.trim() || undefined,
        content: content.trim() || undefined,
        category: category || undefined,
        image_url,
        video_url,
        period_start: (category === 'ferias' && periodStart) ? periodStart : null,
        expires_at: (category === 'ferias' && periodEnd) ? periodEnd : null,
      });
      onCreated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao publicar');
    } finally {
      setSubmitting(false);
      setUploadProgress('');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 pt-4 px-4 pb-20 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
            <Megaphone size={15} className="text-rose-500" />
            Nova publicação Conexão RH
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={15} className="text-slate-500" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Categoria</p>
            <div className="grid grid-cols-2 gap-1.5">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategory(category === cat.key ? '' : cat.key)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left',
                    category === cat.key
                      ? `${cat.color} border-transparent ring-2 ${cat.ring}`
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  )}
                >
                  <span className="text-base leading-none">{cat.emoji}</span>
                  <span className="truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          <input
            type="text"
            placeholder="Título (opcional)"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 font-medium transition-all"
          />
          <textarea
            placeholder="Conteúdo da publicação..."
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={4}
            className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 resize-none transition-all"
          />

          {category === 'ferias' && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">Período aquisitivo</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[11px] text-slate-400 mb-1">Início</p>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={e => setPeriodStart(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400 transition-all"
                  />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 mb-1">Fim (concessivo)</p>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={e => setPeriodEnd(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400 transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Imagem (opcional)</p>
            <label className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 border border-slate-200 border-dashed rounded-xl cursor-pointer hover:bg-rose-50 hover:border-rose-300 transition-colors group">
              <ImageIcon size={15} className="text-slate-400 group-hover:text-rose-400 flex-shrink-0 transition-colors" />
              <span className="text-sm text-slate-500 truncate group-hover:text-rose-500 transition-colors">
                {imageFile ? imageFile.name : 'Selecionar imagem...'}
              </span>
              <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleImageChange} />
            </label>
            {imagePreview && (
              <div className="mt-2 relative">
                <img src={imagePreview} alt="Preview" className="w-full rounded-xl object-cover max-h-40" />
                <button
                  type="button"
                  onClick={() => { setImageFile(null); URL.revokeObjectURL(imagePreview); setImagePreview(''); }}
                  className="absolute top-1.5 right-1.5 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Vídeo (opcional)</p>
            <label className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 border border-slate-200 border-dashed rounded-xl cursor-pointer hover:bg-rose-50 hover:border-rose-300 transition-colors group">
              <Film size={15} className="text-slate-400 group-hover:text-rose-400 flex-shrink-0 transition-colors" />
              <span className="text-sm text-slate-500 truncate group-hover:text-rose-500 transition-colors">
                {videoFile ? videoFile.name : 'Selecionar vídeo...'}
              </span>
              <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={handleVideoChange} />
            </label>
            {videoFile && (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-xs text-green-600 font-medium">✓ {(videoFile.size / 1024 / 1024).toFixed(1)} MB</span>
                <button
                  type="button"
                  onClick={() => setVideoFile(null)}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                >
                  remover
                </button>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
        </div>
        <div className="flex gap-2 p-4 pt-0">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 rounded-xl hover:bg-rose-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? (uploadProgress || 'Publicando...') : 'Publicar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit post modal ──────────────────────────────────────────────────────────
function EditPostModal({ post, onClose, onUpdated }: { post: JRHPost; onClose: () => void; onUpdated: () => void }) {
  const [title, setTitle] = useState(post.title || '');
  const [content, setContent] = useState(cleanContent(post.content) || '');
  const [category, setCategory] = useState<CategoryKey | ''>((post.category as CategoryKey) || '');
  const [periodStart, setPeriodStart] = useState(toLocalDateInput(post.period_start));
  const [periodEnd, setPeriodEnd] = useState(toLocalDateInput(post.expires_at));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!content.trim() && !post.image_url && !post.video_url) {
      setError('O post precisa ter conteúdo ou mídia');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await updateJRHPost(post.id, {
        title: title.trim() || null,
        content: content.trim() || null,
        category: category || null,
        image_url: post.image_url,
        video_url: post.video_url,
        period_start: (category === 'ferias' && periodStart) ? periodStart : null,
        expires_at: (category === 'ferias' && periodEnd) ? periodEnd : null,
      });
      onUpdated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 pt-4 px-4 pb-20 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
            <Pencil size={15} className="text-blue-500" />
            Editar publicação
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={15} className="text-slate-500" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Categoria</p>
            <div className="grid grid-cols-2 gap-1.5">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategory(prev => prev === cat.key ? '' : cat.key)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left',
                    category === cat.key
                      ? `${cat.color} border-transparent ring-2 ${cat.ring}`
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  )}
                >
                  <span className="text-base leading-none">{cat.emoji}</span>
                  <span className="truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          <input
            type="text"
            placeholder="Título (opcional)"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 font-medium transition-all"
          />
          <textarea
            placeholder="Conteúdo da publicação..."
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={4}
            className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 resize-none transition-all"
          />

          {category === 'ferias' && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">Período aquisitivo</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[11px] text-slate-400 mb-1">Início</p>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={e => setPeriodStart(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400 transition-all"
                  />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 mb-1">Fim (concessivo)</p>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={e => setPeriodEnd(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400 transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {post.image_url && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">Imagem atual (mantida)</p>
              <img src={post.image_url} alt="Imagem atual" className="w-full rounded-xl object-contain max-h-40 opacity-80" />
            </div>
          )}

          {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
        </div>
        <div className="flex gap-2 p-4 pt-0">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Post card ────────────────────────────────────────────────────────────────
function JRHPostCard({
  post, isHR, currentUserId, onReload,
}: {
  post: JRHPost; isHR: boolean; currentUserId: string; onReload: () => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const [reacting, setReacting] = useState(false);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const catMeta = getCategoryMeta(post.category);

  const canManage = isHR || post.author_id === currentUserId;
  const feriasBadge = post.category === 'ferias' ? getFeriasBadge(post.expires_at) : null;

  const reactionCounts: Record<string, number> = {};
  for (const like of post.likes) {
    reactionCounts[like.reaction] = (reactionCounts[like.reaction] ?? 0) + 1;
  }

  const myReactions = post.likes.filter(like => like.user_id === currentUserId);
  const activeReaction = REACTIONS.find(reaction => myReactions.some(like => like.reaction === reaction.key));

  async function handleReaction(key: string) {
    if (reacting) return;
    setReacting(true);
    setReactionError(null);
    setReactionPickerOpen(false);
    try {
      for (const existing of myReactions) {
        if (existing.reaction !== key || myReactions.length > 1) {
          await toggleReaction(post.id, existing.reaction);
        }
      }
      await toggleReaction(post.id, key);
    } catch (error) {
      setReactionError(error instanceof Error ? error.message : 'Não foi possível registrar sua reação.');
    } finally {
      setReacting(false);
      onReload();
    }
  }

  async function handleComment() {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await addComment(post.id, commentText);
      setCommentText('');
      onReload();
    } catch {
      // silent
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteJRHPost(post.id);
      onReload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir publicação';
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  }

  const totalReactions = post.likes.length;

  return (
    <article className={cn(
      'jrh-post bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden',
      post.pinned && 'ring-2 ring-orange-400/40',
      feriasBadge === 'vencido' && 'opacity-75',
    )}>
      {confirmDelete && (
        <div className="border-b border-red-100 bg-red-50 px-4 py-3 flex flex-col gap-2">
          {deleteError ? (
            <p className="text-xs text-red-700 font-semibold">Erro: {deleteError}</p>
          ) : (
            <p className="text-xs text-red-700 font-medium">Excluir esta publicação? Esta ação não pode ser desfeita.</p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setConfirmDelete(false); setDeleteError(null); }}
              disabled={deleting}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {deleting ? 'Excluindo...' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}

      {post.pinned && (
        <div className="px-4 pt-3 pb-0">
          <span className="text-[11px] font-semibold text-orange-500 uppercase tracking-wide">📌 Fixado</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 p-4 sm:p-5 sm:pb-3 pb-3">
        <img
          src={avatar(post.users?.name || 'RH', post.users?.photo_url, 'e11d48')}
          alt={post.users?.name || 'RH'}
          className="w-10 h-10 rounded-full object-cover ring-2 ring-rose-100 flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-base text-slate-900 leading-tight">{post.users?.name || 'Conexão RH'}</p>
          <p className="text-sm text-slate-400 mt-0.5">{post.users?.department_name || 'Recursos Humanos'} · {timeAgo(post.created_at)}</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
            <button
              onClick={() => setEditing(true)}
              title="Editar publicação"
              className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-300 hover:text-blue-500 transition-colors"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              title="Excluir publicação"
              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {catMeta && (
        <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', catMeta.color)}>
            <span>{catMeta.emoji}</span>
            {catMeta.label}
          </span>
          {feriasBadge && (
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold',
              feriasBadge === 'vencido' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-700'
            )}>
              {feriasBadge === 'vencido' ? 'Vencido' : 'A Vencer'}
            </span>
          )}
          {post.category === 'ferias' && post.period_start && post.expires_at && (
            <span className="text-[10px] text-slate-400">
              {new Date(post.period_start).toLocaleDateString('pt-BR')} → {new Date(post.expires_at).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>
      )}

      <div className="px-4 sm:px-5 pb-4">
        {post.title && <h3 className="font-bold text-slate-900 text-xl mb-2 leading-snug">{post.title}</h3>}
        {cleanContent(post.content) && (
          <p className="jrh-post-content text-base text-slate-700 whitespace-pre-wrap leading-relaxed">{cleanContent(post.content)}</p>
        )}
      </div>

      {post.image_url && (
        <div className="px-4 sm:px-5 pb-4">
          <img
            src={post.image_url}
            alt={post.title || 'Imagem'}
            className="jrh-post-image w-full rounded-xl object-contain max-h-[700px] cursor-pointer"
            onClick={() => setLightboxImage(post.image_url!)}
          />
        </div>
      )}

      {post.video_url && (
        <div className="px-4 sm:px-5 pb-4">
          <video src={post.video_url} controls className="w-full rounded-xl max-h-72" />
        </div>
      )}

      <div className="jrh-engagement px-4 sm:px-5 py-3 flex items-center gap-3 flex-wrap">
        {(totalReactions > 0 || post.comments.length > 0) && (
          <div className="flex items-center gap-3 flex-wrap">
            {totalReactions > 0 && (
              <div className="flex items-center gap-1.5">
                {REACTIONS.filter(r => (reactionCounts[r.key] ?? 0) > 0).map(r => (
                  <span key={r.key} className={cn('flex items-center gap-0.5 text-xs', r.color)}>
                    <r.Icon size={11} />
                    {reactionCounts[r.key]}
                  </span>
                ))}
                <span className="text-xs text-slate-400">
                  {totalReactions} {totalReactions === 1 ? 'reação' : 'reações'}
                </span>
              </div>
            )}
            {post.comments.length > 0 && (
              <>
                {totalReactions > 0 && <span className="text-slate-200">·</span>}
                <button
                  type="button"
                  onClick={() => setShowComments(v => !v)}
                  className="text-xs text-slate-400 hover:text-blue-500 transition-colors"
                >
                  {post.comments.length} {post.comments.length === 1 ? 'comentário' : 'comentários'}
                </button>
              </>
            )}
          </div>
        )}
        {isHR ? (
          <button
            type="button"
            onClick={() => setShowViewers(true)}
            className="jrh-viewers-button"
            aria-label={`Ver quem visualizou esta publicação: ${post.view_count} ${post.view_count === 1 ? 'visualização' : 'visualizações'}`}
          >
            {post.viewers?.length > 0 && (
              <span className="jrh-viewer-avatars" aria-hidden="true">
                {post.viewers.slice(0, 3).map(viewer => (
                  <img key={viewer.user_id} src={avatar(viewer.name || 'Colaborador', viewer.photo_url)} alt="" />
                ))}
              </span>
            )}
            <Eye size={16} aria-hidden="true" />
            <strong>{post.view_count}</strong>
            <span>{post.view_count === 1 ? 'visualização' : 'visualizações'}</span>
            <span className="jrh-viewers-link">Ver quem viu →</span>
          </button>
        ) : (
          <div className="jrh-viewers-count" aria-label={`${post.view_count} ${post.view_count === 1 ? 'visualização' : 'visualizações'}`}>
            <Eye size={16} aria-hidden="true" />
            <strong>{post.view_count}</strong>
            <span>{post.view_count === 1 ? 'visualização' : 'visualizações'}</span>
          </div>
        )}
      </div>

      {reactionError && <p role="alert" className="px-4 text-sm text-red-500">{reactionError}</p>}
      <div className="jrh-post-actions px-4 sm:px-5 pb-4 pt-3 flex items-center gap-2 border-t border-slate-100">
        <div className={cn('jrh-like-action', activeReaction && 'is-active')}>
          <button
            type="button"
            onClick={() => handleReaction('like')}
            disabled={reacting}
            className="jrh-like-main"
            aria-pressed={activeReaction?.key === 'like'}
            title={activeReaction ? `Sua reação: ${activeReaction.label}. Clique para curtir.` : 'Curtir esta publicação'}
          >
            {activeReaction ? <activeReaction.Icon size={17} aria-hidden="true" /> : <ThumbsUp size={17} aria-hidden="true" />}
            <span>Curtir</span>
          </button>
          <Popover open={reactionPickerOpen} onOpenChange={setReactionPickerOpen}>
            <PopoverTrigger asChild>
              <button type="button" disabled={reacting} className="jrh-like-picker-trigger" aria-label="Escolher reação" title="Escolher reação">
                <ChevronDown size={16} aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={8} className="jrh-reaction-picker">
              <p className="jrh-reaction-picker-title">Escolha sua reação</p>
              <div className="jrh-reaction-options">
                {REACTIONS.map(reaction => (
                  <button
                    key={reaction.key}
                    type="button"
                    onClick={() => handleReaction(reaction.key)}
                    disabled={reacting}
                    aria-pressed={activeReaction?.key === reaction.key}
                    className={cn('jrh-reaction-option', activeReaction?.key === reaction.key && 'is-selected')}
                  >
                    <reaction.Icon size={20} className={reaction.color} aria-hidden="true" />
                    <span>{reaction.label}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <button
          onClick={() => setShowComments(v => !v)}
          type="button"
          aria-expanded={showComments}
          className="jrh-comment-action"
        >
          <MessageCircle size={17} aria-hidden="true" />
          <span>Comentar</span>
        </button>
      </div>

      {showComments && (
        <div className="border-t border-slate-50 px-4 pb-4 pt-3 space-y-3">
          {post.comments.map((c: JRHComment) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <img
                src={avatar(c.users?.name || 'U', c.users?.photo_url)}
                alt={c.users?.name || ''}
                className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5"
              />
              <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2">
                <p className="text-sm font-semibold text-slate-700">{c.users?.name}</p>
                <p className="text-sm text-slate-600 mt-0.5 whitespace-pre-wrap">{c.content}</p>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              placeholder="Adicionar comentário..."
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
              className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
            />
            <button
              onClick={handleComment}
              disabled={submittingComment || !commentText.trim()}
              className="px-3 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0"
            >
              {submittingComment ? '...' : 'Enviar'}
            </button>
          </div>
        </div>
      )}

      {showViewers && (
        <ViewersModal postId={post.id} viewCount={post.view_count} onClose={() => setShowViewers(false)} />
      )}

      {editing && (
        <EditPostModal post={post} onClose={() => setEditing(false)} onUpdated={() => { onReload(); setEditing(false); }} />
      )}
      {lightboxImage && <ImageLightbox src={lightboxImage} alt={post.title || 'Imagem'} onClose={() => setLightboxImage(null)} />}
    </article>
  );
}

// ─── Birthday widget ─────────────────────────────────────────────────────────
function BirthdayWidget({ birthdays }: { birthdays: BirthdayUser[] }) {
  if (birthdays.length === 0) return null;
  const todayDay = new Date().getDate();

  return (
    <section className="jrh-side-card">
      <div className="jrh-side-card-heading">
        <div className="jrh-side-icon"><Cake size={19} aria-hidden="true" /></div>
        <div>
          <h2>Aniversariantes do mês</h2>
          <p>Gente que faz a NEX acontecer</p>
        </div>
      </div>
      <div className="jrh-birthday-list">
        {birthdays.map(user => {
          const isToday = user.birth_day === todayDay;
          return (
            <div
              key={user.id}
              className={cn('jrh-birthday', isToday && 'is-today')}
            >
              <img
                src={avatar(user.name, user.photo_url, 'e11d48')}
                alt={user.name}
                className="jrh-birthday-avatar"
              />
              <div className="flex-1 min-w-0">
                <p className="jrh-birthday-name">
                  {user.name}
                </p>
                <p className="jrh-birthday-meta">
                  {user.department_name || 'NexTelecom'}
                </p>
              </div>
              <span className="jrh-birthday-date">{isToday ? 'Hoje 🎉' : `Dia ${user.birth_day}`}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function JRHPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<JRHPost[]>([]);
  const [isHR, setIsHR] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeFilter, setActiveFilter] = useState<CategoryKey | 'all'>('all');
  const [feriasFilter, setFeriasFilter] = useState<FeriasFilter>('all');
  const [search, setSearch] = useState('');
  const [birthdays, setBirthdays] = useState<BirthdayUser[]>([]);
  const viewedRef = useRef<Set<string>>(new Set());

  async function loadPosts() {
    const data = await listJRHPosts().catch(() => []);
    setPosts(data);
    for (const p of data) {
      if (!viewedRef.current.has(p.id)) {
        viewedRef.current.add(p.id);
        recordPostView(p.id).catch(() => {});
      }
    }
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadPosts(),
      checkIsHR().then(setIsHR).catch(() => {}),
      getMonthBirthdays().then(setBirthdays).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const query = search.trim().toLocaleLowerCase('pt-BR');
  const filteredPosts = posts.filter(post => {
    if (activeFilter !== 'all' && post.category !== activeFilter) return false;
    if (activeFilter === 'ferias' && feriasFilter !== 'all') {
      const badge = getFeriasBadge(post.expires_at);
      if (feriasFilter === 'vencido' && badge !== 'vencido') return false;
      if (feriasFilter === 'a_vencer' && badge !== 'a_vencer') return false;
    }
    if (query && ![post.title, post.content, post.users?.name, getCategoryMeta(post.category)?.label]
      .some(value => value?.toLocaleLowerCase('pt-BR').includes(query))) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-4 border-rose-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="jrh-page">
      <div className="jrh-content-grid">
        <main className="jrh-main">
          <section className="jrh-filter-section" aria-label="Filtrar publicações por categoria">
            <div className="jrh-section-heading">
              <div>
                <p className="jrh-section-kicker">Mural</p>
                <h1>Publicações</h1>
              </div>
              <div className="jrh-heading-actions">
                <span className="jrh-result-count">{filteredPosts.length} {filteredPosts.length === 1 ? 'publicação' : 'publicações'}</span>
                {isHR && (
                  <button type="button" onClick={() => setCreating(true)} className="jrh-create-button">
                    <Plus size={18} aria-hidden="true" />
                    Nova publicação
                  </button>
                )}
              </div>
            </div>
            <label className="jrh-search">
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">Pesquisar no Conexão RH</span>
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar comunicados, assuntos e pessoas" type="search" />
            </label>

            {/* Category filters */}
            <div className="jrh-filters">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                aria-pressed={activeFilter === 'all'}
                className={cn('jrh-filter', activeFilter === 'all' && 'is-active')}
              >
                Todos
              </button>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => { setActiveFilter(cat.key); setFeriasFilter('all'); }}
                  aria-pressed={activeFilter === cat.key}
                  className={cn('jrh-filter', activeFilter === cat.key && 'is-active')}
                >
                  <span aria-hidden="true">{cat.emoji}</span> {cat.label}
                </button>
              ))}
            </div>

            {/* Férias concessivo filters */}
            {activeFilter === 'ferias' && (
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <span className="text-xs text-slate-400 font-medium mr-1">Concessivo:</span>
                {([
                  { key: 'all', label: 'Todas' },
                  { key: 'vencido', label: 'Vencido (concessivo)' },
                  { key: 'a_vencer', label: 'A Vencer (60 dias)' },
                ] as const).map(f => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFeriasFilter(f.key)}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border font-medium transition-colors',
                      feriasFilter === f.key
                        ? f.key === 'vencido' ? 'bg-red-100 text-red-700 border-red-200'
                          : f.key === 'a_vencer' ? 'bg-orange-100 text-orange-700 border-orange-200'
                          : 'bg-sky-100 text-sky-700 border-sky-200'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </section>

          {filteredPosts.length === 0 && (
            <div className="jrh-empty text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-4">
                <Megaphone size={32} className="text-rose-400" />
              </div>
              <p className="text-slate-700 font-semibold">
                {search ? 'Nenhum resultado para esta busca'
                  : feriasFilter === 'vencido' ? 'Nenhuma férias com concessivo vencido'
                  : feriasFilter === 'a_vencer' ? 'Nenhuma férias a vencer nos próximos 60 dias'
                  : activeFilter === 'all' ? 'Nenhuma publicação ainda'
                  : `Nenhuma publicação em "${getCategoryMeta(activeFilter)?.label}"`}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {search ? 'Tente outro termo ou veja todas as categorias.' : isHR ? 'Clique em "Nova publicação" para começar.' : 'O RH ainda não publicou nada nesta categoria.'}
              </p>
              {(search || activeFilter !== 'all' || feriasFilter !== 'all') && (
                <button type="button" className="jrh-reset-button" onClick={() => { setSearch(''); setActiveFilter('all'); setFeriasFilter('all'); }}>Limpar filtros</button>
              )}
            </div>
          )}

          <div className="jrh-post-list">
            {filteredPosts.map(post => (
              <JRHPostCard
                key={post.id}
                post={post}
                isHR={isHR}
                currentUserId={user?.id || ''}
                onReload={loadPosts}
              />
            ))}
          </div>

          {creating && (
            <CreatePostModal
              onClose={() => setCreating(false)}
              onCreated={loadPosts}
            />
          )}
        </main>

        <aside className="jrh-sidebar" aria-label="Informações da comunidade">
          <section className="jrh-side-card jrh-about">
            <div className="jrh-side-card-heading">
              <div className="jrh-side-icon"><Megaphone size={19} aria-hidden="true" /></div>
              <div>
                <h2>Sobre este espaço</h2>
                <p>Conexão RH</p>
              </div>
            </div>
            <p className="jrh-about-text">Acompanhe comunicados, campanhas, ações e conteúdos para o dia a dia da nossa equipe.</p>
            <div className="jrh-about-note">Explore as publicações por assunto ou pesquise diretamente no mural.</div>
          </section>
          <section className="jrh-side-card jrh-topics" aria-label="Categorias do mural">
            <p className="jrh-side-eyebrow">Explore o mural</p>
            <h2>Assuntos da equipe</h2>
            <div className="jrh-topic-list">
              {CATEGORIES.map(category => (
                <button key={category.key} type="button" onClick={() => { setActiveFilter(category.key); setFeriasFilter('all'); document.querySelector('.jrh-filter-section')?.scrollIntoView({ behavior: 'smooth' }); }} aria-pressed={activeFilter === category.key} className={cn('jrh-topic', activeFilter === category.key && 'is-active')}>
                  <category.icon size={17} aria-hidden="true" />
                  <span>{category.label}</span>
                  <strong>{posts.filter(post => post.category === category.key).length}</strong>
                </button>
              ))}
            </div>
          </section>
          <BirthdayWidget birthdays={birthdays} />
        </aside>
      </div>
    </div>
  );
}
