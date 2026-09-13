import { useEffect, useRef, useState } from 'react';
import {
  Cake, CalendarHeart, Eye, Film, Heart, Image as ImageIcon,
  Lightbulb, Megaphone, MessageCircle, PartyPopper, Plus,
  ThumbsUp, X, BookOpen, ClipboardList,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/utils';
import {
  addComment, checkIsHR, createJRHPost, getMonthBirthdays, getPostViews, listJRHPosts, uploadJRHFile,
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
] as const;

type CategoryKey = typeof CATEGORIES[number]['key'];

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

// ─── Viewers modal ───────────────────────────────────────────────────────────
function ViewersModal({ postId, viewCount, onClose }: { postId: string; viewCount: number; onClose: () => void }) {
  const [viewers, setViewers] = useState<JRHViewer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPostViews(postId).then(setViewers).catch(() => {}).finally(() => setLoading(false));
  }, [postId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
            <Eye size={15} className="text-blue-500" />
            Visualizações ({viewCount})
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={15} className="text-slate-500" />
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            </div>
          ) : viewers.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Nenhuma visualização registrada</p>
          ) : viewers.map(v => (
            <div key={v.user_id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
              <img src={avatar(v.name, v.photo_url)} alt={v.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
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
function CreatePostModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<CategoryKey | ''>('');
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-start justify-center bg-black/50 pt-4 px-4 pb-20 sm:p-4 sm:pt-20" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[calc(100vh-6rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
          {/* Category selector */}
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
            className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 font-medium transition-all"
          />
          <textarea
            placeholder="Conteúdo da publicação..."
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={4}
            className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 resize-none transition-all"
          />

          {/* Image upload */}
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

          {/* Video upload */}
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
  const catMeta = getCategoryMeta(post.category);

  const reactionCounts: Record<string, number> = {};
  for (const like of post.likes) {
    reactionCounts[like.reaction] = (reactionCounts[like.reaction] ?? 0) + 1;
  }

  async function handleReaction(key: string) {
    await toggleReaction(post.id, key).catch(() => {});
    onReload();
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

  const totalReactions = post.likes.length;

  return (
    <div className={cn(
      'bg-white rounded-2xl shadow-sm border border-slate-100 mb-4 overflow-hidden',
      post.pinned && 'ring-2 ring-orange-400/40'
    )}>
      {/* Pinned badge */}
      {post.pinned && (
        <div className="px-4 pt-3 pb-0">
          <span className="text-[11px] font-semibold text-orange-500 uppercase tracking-wide">📌 Fixado</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <img
          src={avatar(post.users?.name || 'RH', post.users?.photo_url, 'e11d48')}
          alt={post.users?.name || 'RH'}
          className="w-10 h-10 rounded-full object-cover ring-2 ring-rose-100 flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-900 leading-tight">{post.users?.name || 'Conexão RH'}</p>
          <p className="text-xs text-slate-400 mt-0.5">{post.users?.department_name || 'Recursos Humanos'} · {timeAgo(post.created_at)}</p>
        </div>
        {/* View count */}
        <div className="flex items-center gap-1 text-slate-400 flex-shrink-0">
          <Eye size={13} />
          <span className="text-xs">{post.view_count}</span>
          {isHR && post.view_count > 0 && (
            <button
              onClick={() => setShowViewers(true)}
              className="ml-0.5 text-xs text-blue-400 hover:text-blue-600 hover:underline transition-colors"
            >
              ver
            </button>
          )}
        </div>
      </div>

      {/* Category badge */}
      {catMeta && (
        <div className="px-4 pb-2">
          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', catMeta.color)}>
            <span>{catMeta.emoji}</span>
            {catMeta.label}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="px-4 pb-3">
        {post.title && <h3 className="font-bold text-slate-900 text-base mb-2 leading-snug">{post.title}</h3>}
        {cleanContent(post.content) && (
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{cleanContent(post.content)}</p>
        )}
      </div>

      {/* Image */}
      {post.image_url && (
        <div className="px-4 pb-3">
          <img
            src={post.image_url}
            alt={post.title || 'Imagem'}
            className="w-full rounded-xl object-cover max-h-80"
          />
        </div>
      )}

      {/* Video */}
      {post.video_url && (
        <div className="px-4 pb-3">
          <video src={post.video_url} controls className="w-full rounded-xl max-h-72" />
        </div>
      )}

      {/* Reaction summary row */}
      {(totalReactions > 0 || post.comments.length > 0) && (
        <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
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
                onClick={() => setShowComments(v => !v)}
                className="text-xs text-slate-400 hover:text-blue-500 transition-colors"
              >
                {post.comments.length} {post.comments.length === 1 ? 'comentário' : 'comentários'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="px-3 pb-3 flex items-center gap-0.5 border-t border-slate-50 pt-2 overflow-x-auto">
        {REACTIONS.map(r => {
          const myReaction = post.likes.find(l => l.user_id === currentUserId && l.reaction === r.key);
          return (
            <button
              key={r.key}
              onClick={() => handleReaction(r.key)}
              title={r.label}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 flex-shrink-0',
                myReaction ? r.activeBg : cn('text-slate-500', r.hoverClass)
              )}
            >
              <r.Icon size={13} />
              <span className="hidden sm:inline">{r.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setShowComments(v => !v)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all active:scale-95 ml-auto flex-shrink-0"
        >
          <MessageCircle size={13} />
          <span className="hidden sm:inline">Comentar</span>
        </button>
      </div>

      {/* Comments section */}
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
                <p className="text-xs font-semibold text-slate-700">{c.users?.name}</p>
                <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap">{c.content}</p>
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
    </div>
  );
}

// ─── Birthday widget ─────────────────────────────────────────────────────────
function BirthdayWidget({ birthdays }: { birthdays: BirthdayUser[] }) {
  if (birthdays.length === 0) return null;
  const todayDay = new Date().getDate();

  return (
    <div className="social-panel mt-3">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Cake size={12} className="text-pink-500" />
        Aniversariantes do Mês
      </h3>
      <div className="space-y-1.5">
        {birthdays.map(user => {
          const isToday = user.birth_day === todayDay;
          return (
            <div
              key={user.id}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-xl transition-colors',
                isToday ? 'bg-pink-50 ring-1 ring-pink-200' : 'hover:bg-slate-50'
              )}
            >
              <img
                src={avatar(user.name, user.photo_url, 'e11d48')}
                alt={user.name}
                className="w-7 h-7 rounded-full object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-semibold truncate', isToday ? 'text-pink-700' : 'text-slate-700')}>
                  {isToday ? '🎂 ' : ''}{user.name}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {user.department_name || 'NexTelecom'} · dia {user.birth_day}
                </p>
              </div>
              {isToday && <span className="flex-shrink-0 text-sm">🎉</span>}
            </div>
          );
        })}
      </div>
    </div>
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

  const filteredPosts = activeFilter === 'all'
    ? posts
    : posts.filter(p => p.category === activeFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-4 border-rose-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="social-feed-shell">
      {/* Left panel */}
      <aside className="social-left-panel">
        <div className="social-profile-card">
          <div className="social-profile-cover flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #e11d48 0%, #be185d 100%)' }}>
            <Megaphone size={28} className="text-white drop-shadow" />
          </div>
          <div className="px-4 pb-4">
            <h2 className="mt-3 text-sm font-black text-slate-900">Conexão RH</h2>
            <p className="text-xs text-slate-500">Informação que aproxima.</p>
            <p className="mt-2 text-xs text-slate-400">{posts.length} publicação{posts.length !== 1 ? 'ões' : ''}</p>
          </div>
        </div>

        {/* Category nav in left panel */}
        <div className="social-panel mt-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Categorias</h3>
          <div className="space-y-0.5">
            <button
              onClick={() => setActiveFilter('all')}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors text-left',
                activeFilter === 'all' ? 'bg-rose-100 text-rose-700' : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              <span>🗂️</span> Todos
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setActiveFilter(cat.key)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors text-left',
                  activeFilter === cat.key ? `${cat.color}` : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                <span>{cat.emoji}</span>
                <span className="truncate">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="min-w-0 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 shadow-md shadow-rose-200">
              <Megaphone size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Conexão RH</h1>
              <p className="text-xs text-slate-500">Informação que aproxima. Pessoas que fazem a diferença.</p>
            </div>
          </div>
          {isHR && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white text-sm font-semibold rounded-xl hover:bg-rose-700 transition-colors shadow-sm active:scale-95"
            >
              <Plus size={15} />
              Nova publicação
            </button>
          )}
        </div>

        {/* Category filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setActiveFilter('all')}
            className={cn(
              'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
              activeFilter === 'all'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-600'
            )}
          >
            🗂️ Todos
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveFilter(cat.key)}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                activeFilter === cat.key
                  ? `${cat.color} shadow-sm ring-2 ${cat.ring}`
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
              )}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {filteredPosts.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-4">
              <Megaphone size={32} className="text-rose-400" />
            </div>
            <p className="text-slate-700 font-semibold">
              {activeFilter === 'all' ? 'Nenhuma publicação ainda' : `Nenhuma publicação em "${getCategoryMeta(activeFilter)?.label}"`}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {isHR ? 'Clique em "Nova publicação" para começar.' : 'O RH ainda não publicou nada nesta categoria.'}
            </p>
          </div>
        )}

        {/* Posts */}
        {filteredPosts.map(post => (
          <JRHPostCard
            key={post.id}
            post={post}
            isHR={isHR}
            currentUserId={user?.id || ''}
            onReload={loadPosts}
          />
        ))}

        {creating && (
          <CreatePostModal
            onClose={() => setCreating(false)}
            onCreated={loadPosts}
          />
        )}
      </main>

      {/* Right panel */}
      <aside className="social-right-panel">
        <div className="social-panel">
          <h3 className="text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
            <Megaphone size={14} className="text-rose-500" />
            Sobre Conexão RH
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed mb-3">
            Informação que aproxima. Pessoas que fazem a diferença.
          </p>
          <div className="space-y-1.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setActiveFilter(cat.key)}
                className={cn(
                  'w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium transition-colors text-left',
                  activeFilter === cat.key ? `${cat.color}` : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                <span className="text-sm">{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
          {posts.length > 0 && (
            <p className="mt-3 text-xs text-slate-400 font-medium border-t border-slate-100 pt-3">{posts.length} publicação{posts.length !== 1 ? 'ões' : ''}</p>
          )}
        </div>

        <BirthdayWidget birthdays={birthdays} />
      </aside>
    </div>
  );
}
