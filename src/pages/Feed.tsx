import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, BookOpen, Building2, Calendar, ChevronDown, ExternalLink, Heart,
  Image as ImageIcon, Megaphone, MessageCircle, Newspaper,
  Pencil, Plus, Search, Send, Sparkles, Trash2, TrendingUp, Users, Video, X,
} from 'lucide-react';
import { commentPost, createPost, deleteComment, deletePost, getFeedPosts, reactToComment, reactToPost, updateComment, updatePost, voteOnPoll } from '../lib/appApi';
import { apiGet } from '../lib/apiClient';
import { useAuth } from '../lib/auth';
import { getGamificationProfile, getRanking, type GamificationProfile } from '../lib/gamificationApi';
import { Textarea } from '../components/ui/textarea';
import type { Post } from '../types';
import { cn } from '../lib/utils';
import { StoriesBar } from '../components/stories/StoriesBar';
import { ImageLightbox } from '../components/ui/ImageLightbox';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import './feed.css';

const REACTIONS = [
  { key: 'like', emoji: '👍', label: 'Curtir' },
  { key: 'love', emoji: '❤️', label: 'Amei' },
  { key: 'celebrate', emoji: '🎉', label: 'Parabéns' },
  { key: 'insightful', emoji: '💡', label: 'Perspicaz' },
] as const;

type ReactionKey = typeof REACTIONS[number]['key'];

const TYPE_CONFIG: Record<string, { label: string; badgeClass: string; icon: typeof Megaphone; bar: string }> = {
  announcement: { label: 'Comunicado', badgeClass: 'bg-blue-100 text-blue-700', icon: Megaphone, bar: '#0057b8' },
  alert: { label: 'Aviso importante', badgeClass: 'bg-red-100 text-red-700', icon: AlertTriangle, bar: '#dc2626' },
  update: { label: 'Atualização', badgeClass: 'bg-emerald-100 text-emerald-700', icon: TrendingUp, bar: '#16a34a' },
  event: { label: 'Evento', badgeClass: 'bg-purple-100 text-purple-700', icon: Calendar, bar: '#7c3aed' },
  message: { label: 'Publicação', badgeClass: 'bg-slate-100 text-slate-600', icon: MessageCircle, bar: '#64748b' },
  poll: { label: 'Enquete', badgeClass: 'bg-amber-100 text-amber-700', icon: Users, bar: '#d97706' },
  wiki_update: { label: 'Wiki', badgeClass: 'bg-indigo-100 text-indigo-700', icon: BookOpen, bar: '#4f46e5' },
};

interface WikiFeedItem {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  was_edited: boolean;
  users: { id: string; name: string; photo_url?: string | null; position?: string } | null;
  categories: { id: string; name: string; color?: string | null } | null;
  _kind: 'wiki';
}

async function getWikiActivity(): Promise<WikiFeedItem[]> {
  try {
    const res = await apiGet<{ data?: WikiFeedItem[] }>('/wiki/activity');
    return (res.data ?? []).map(item => ({ ...item, _kind: 'wiki' as const }));
  } catch {
    return [];
  }
}

function wikiPlainText(content: string): string {
  const source = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?\s*>/gi, ' ');
  const plain = new DOMParser().parseFromString(source, 'text/html').body.textContent || '';
  return plain
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#$*_~`>]/g, ' ')
    .replace(/\[|\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wikiExcerpt(content: string): string {
  const normalized = wikiPlainText(content);
  if (/^(Header Your content here|Title Some text here)$/i.test(normalized)) return '';
  return normalized.length > 175 ? `${normalized.slice(0, 175).trimEnd()}…` : normalized;
}

function WikiFeedCard({ item, onNavigate }: { item: WikiFeedItem; onNavigate: () => void }) {
  const author = item.users;
  const categoryColor = item.categories?.color || '#4f46e5';
  const avatarUrl = author?.photo_url || (author?.name
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(author.name)}&size=56&background=4f46e5&color=fff`
    : `https://ui-avatars.com/api/?name=W&size=56&background=4f46e5&color=fff`
  );
  const verb = item.was_edited ? 'atualizou' : 'publicou';
  const preview = wikiExcerpt(item.content || '');

  return (
    <article className="social-post feed-card feed-wiki-card">
      <div className="social-post-bar" style={{ backgroundColor: '#4f46e5' }} />
      <div className="feed-card-body">
        <header className="feed-card-header mb-4 flex items-start gap-4">
          <div className="relative flex-shrink-0">
            <img src={avatarUrl} alt={author?.name || 'Wiki'} className="feed-avatar rounded-full object-cover" />
            <span className="social-author-type" style={{ color: '#4f46e5' }}>
              <BookOpen size={12} />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="feed-author-name truncate text-slate-900">{author?.name || 'Equipe'}</h2>
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-indigo-100 text-indigo-700">Wiki</span>
              {item.categories?.name && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: categoryColor, backgroundColor: `${categoryColor}18` }}>
                  {item.categories.name}
                </span>
              )}
            </div>
            <p className="feed-post-meta mt-0.5 text-sm text-slate-500">
              {verb} um artigo na Wiki
              <span className="mx-1.5">·</span>
              {smartDate(item.updated_at)}
            </p>
          </div>
        </header>
        <h3 className="feed-post-title mb-2 text-slate-900">{item.title}</h3>
        {preview && <p className="feed-post-content text-slate-600 line-clamp-3">{preview}</p>}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <button
            onClick={onNavigate}
            className="feed-wiki-link inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 h-8 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            <ExternalLink size={12} />
            Ver na Wiki
          </button>
        </div>
      </div>
    </article>
  );
}

const COMPOSE_TYPES = [
  { key: 'message', label: 'Publicação' },
  { key: 'announcement', label: 'Comunicado' },
  { key: 'event', label: 'Evento' },
  { key: 'poll', label: 'Enquete' },
] as const;

const FILTERS = [
  { key: 'all', label: 'Todos', icon: Sparkles },
  { key: 'message', label: 'Publicações', icon: MessageCircle },
  { key: 'announcement', label: 'Comunicados', icon: Megaphone },
  { key: 'alert', label: 'Avisos', icon: AlertTriangle },
  { key: 'update', label: 'Atualizações', icon: TrendingUp },
  { key: 'poll', label: 'Enquetes', icon: Users },
  { key: 'event', label: 'Eventos', icon: Calendar },
  { key: 'wiki_update', label: 'Wiki', icon: BookOpen },
];

function smartDate(dateStr: string) {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora mesmo';
  if (mins < 60) return `${mins}m atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d atrás`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' às ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function userAvatar(name?: string, photoUrl?: string, size = 40) {
  return photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'RN')}&size=${size * 2}&background=ff7a00&color=fff`;
}

function reactionSummary(reactions: { reaction: string; user_id?: string; id?: string }[], currentUserId?: string) {
  const counts: Record<string, number> = {};
  let myReaction: string | null = null;
  for (const r of reactions) {
    counts[r.reaction] = (counts[r.reaction] || 0) + 1;
    if ('user_id' in r && r.user_id === currentUserId) myReaction = r.reaction;
  }
  return { counts, myReaction, total: reactions.length };
}

function ReactionPicker({ onPick }: { onPick: (key: ReactionKey) => void }) {
  return (
    <div className="feed-reaction-options">
      {REACTIONS.map(r => (
        <button
          key={r.key}
          type="button"
          title={r.label}
          onClick={() => onPick(r.key)}
          className="feed-reaction-option"
        >
          <span aria-hidden="true">{r.emoji}</span>
          <span>{r.label}</span>
        </button>
      ))}
    </div>
  );
}

function ReactionBar({
  reactions,
  currentUserId,
  onReact,
  size = 'md',
}: {
  reactions: { reaction: string; user_id?: string; id?: string }[];
  currentUserId?: string;
  onReact: (key: ReactionKey) => void;
  size?: 'sm' | 'md';
}) {
  const [showPicker, setShowPicker] = useState(false);
  const { myReaction, total } = reactionSummary(reactions, currentUserId);
  const selectedReaction = REACTIONS.find(reaction => reaction.key === myReaction);

  return (
    <div className={cn('feed-reaction-control', size === 'sm' && 'feed-reaction-control-sm', myReaction && 'is-active')}>
      <button
        type="button"
        onClick={() => onReact((myReaction as ReactionKey) || 'like')}
        className="feed-reaction-main"
        aria-pressed={!!myReaction}
      >
        {selectedReaction ? <span aria-hidden="true">{selectedReaction.emoji}</span> : <Heart size={size === 'sm' ? 13 : 16} aria-hidden="true" />}
        <span>{selectedReaction?.label || 'Curtir'}</span>
        {total > 0 && <span className="feed-reaction-count">{total}</span>}
      </button>
      <Popover open={showPicker} onOpenChange={setShowPicker}>
        <PopoverTrigger asChild>
          <button type="button" className="feed-reaction-trigger" aria-label="Escolher reação" title="Escolher reação">
            <ChevronDown size={size === 'sm' ? 13 : 15} aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={8} className="feed-reaction-popover">
          <p>Escolha sua reação</p>
          <ReactionPicker onPick={key => { onReact(key); setShowPicker(false); }} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function MediaDisplay({ imageUrl, videoUrl }: { imageUrl?: string; videoUrl?: string }) {
  const [lightbox, setLightbox] = useState(false);
  if (!imageUrl && !videoUrl) return null;
  return (
    <>
      <div className="feed-media mt-4 rounded-xl overflow-hidden border border-slate-100">
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Mídia"
            className="w-full max-h-[680px] object-contain bg-slate-50 cursor-pointer"
            loading="lazy"
            onClick={() => setLightbox(true)}
          />
        )}
        {videoUrl && (
          <video
            src={videoUrl}
            controls
            className="w-full max-h-[540px] bg-black"
            preload="metadata"
          />
        )}
      </div>
      {lightbox && imageUrl && <ImageLightbox src={imageUrl} alt="Mídia" onClose={() => setLightbox(false)} />}
    </>
  );
}

function CommentItem({
  comment,
  postId,
  currentUserId,
  onReacted,
  onCommentUpdated,
  onCommentDeleted,
}: {
  comment: Post['comments'] extends (infer C)[] | undefined ? C : never;
  postId: string;
  currentUserId?: string;
  onReacted: (post: Post) => void;
  onCommentUpdated: (post: Post) => void;
  onCommentDeleted: (commentId: string, postId: string) => void;
}) {
  const author = comment.users;
  const isOwner = !!currentUserId && (comment.author_id === currentUserId || comment.users?.id === currentUserId);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  async function handleReact(reaction: ReactionKey) {
    setActionError('');
    try {
      const result = await reactToComment(postId, comment.id, reaction);
      if (result.post) onReacted(result.post);
    } catch { setActionError('Não foi possível reagir ao comentário.'); }
  }

  async function handleEditSave() {
    if (!editText.trim() || saving) return;
    setSaving(true);
    setActionError('');
    try {
      const updated = await updateComment(postId, comment.id, editText.trim());
      onCommentUpdated(updated);
      setEditMode(false);
    } catch { setActionError('Não foi possível salvar o comentário.'); } finally { setSaving(false); }
  }

  async function handleDelete() {
    setActionError('');
    try {
      await deleteComment(postId, comment.id);
      onCommentDeleted(comment.id, postId);
    } catch { setActionError('Não foi possível apagar o comentário.'); }
  }

  return (
    <div className="feed-comment-item flex items-start gap-2.5 group">
      <img
        src={userAvatar(author?.name, author?.photo_url, 32)}
        alt={author?.name || 'Usuário'}
        className="h-8 w-8 rounded-full object-cover ring-1 ring-white flex-shrink-0 mt-0.5"
      />
      <div className="flex-1 min-w-0">
        {actionError && <p role="alert" className="feed-action-error">{actionError}</p>}
        {editMode ? (
          <div className="space-y-1.5">
            <input
              autoFocus
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleEditSave(); if (e.key === 'Escape') setEditMode(false); }}
              className="w-full rounded-xl border border-orange-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400"
            />
            <div className="flex gap-2">
              <button onClick={handleEditSave} disabled={saving || !editText.trim()} className="h-7 px-3 rounded-lg bg-orange-500 text-white text-xs font-semibold disabled:opacity-40">Salvar</button>
              <button onClick={() => setEditMode(false)} className="h-7 px-3 rounded-lg border border-slate-200 text-xs text-slate-600">Cancelar</button>
            </div>
          </div>
        ) : (
          <>
            <div className="feed-comment-bubble rounded-2xl bg-slate-50 px-3.5 py-2.5">
              <p className="text-sm font-bold text-slate-800">{author?.name || 'Usuário'}</p>
              <p className="mt-0.5 text-base text-slate-700 leading-relaxed">{comment.content}</p>
            </div>
            <div className="mt-1 flex items-center gap-3 pl-1">
              <span className="text-sm text-slate-400">{smartDate(comment.created_at)}</span>
              <ReactionBar reactions={comment.reactions || []} currentUserId={currentUserId} onReact={handleReact} size="sm" />
              {isOwner && (
                <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditText(comment.content); setEditMode(true); }} className="h-6 w-6 flex items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition-colors" title="Editar">
                    <Pencil size={11} />
                  </button>
                  <button onClick={handleDelete} className="h-6 w-6 flex items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Apagar">
                    <Trash2 size={11} />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SocialPost({
  post,
  currentUserId,
  currentUserAvatar,
  commentDraft,
  onCommentChange,
  onComment,
  onReacted,
  onPostUpdated,
  onPostDeleted,
}: {
  post: Post;
  currentUserId?: string;
  currentUserAvatar?: string;
  commentDraft: string;
  onCommentChange: (value: string) => void;
  onComment: () => void;
  onReacted: (post: Post) => void;
  onPostUpdated: (post: Post) => void;
  onPostDeleted: (postId: string) => void;
}) {
  const config = TYPE_CONFIG[post.type] || TYPE_CONFIG.message;
  const TypeIcon = config.icon;
  const author = post.users;
  const comments = post.comments || [];
  const likes = post.likes || [];
  const [showAllComments, setShowAllComments] = useState(false);
  const displayedComments = showAllComments ? comments : comments.slice(-3);
  const isOwner = !!currentUserId && post.author_id === currentUserId;
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const commentInputRef = useRef<HTMLInputElement>(null);
  const pollVotes: { user_id: string; option_index: number }[] = ((post as unknown) as Record<string, { user_id: string; option_index: number }[]>).poll_votes || [];
  const myVoteInit = pollVotes.find(v => v.user_id === currentUserId)?.option_index ?? null;
  const [votedOption, setVotedOption] = useState<number | null>(myVoteInit);
  let pollData: { question: string; options: string[] } | null = null;
  if (post.type === 'poll') { try { pollData = JSON.parse(post.content) as { question: string; options: string[] }; } catch { pollData = null; } }

  async function handlePostReact(reaction: ReactionKey) {
    setActionError('');
    try {
      const result = await reactToPost(post.id, reaction);
      if (result.post) onReacted(result.post);
    } catch { setActionError('Não foi possível registrar sua reação.'); }
  }

  async function handlePostEditSave() {
    if (!editText.trim() || saving) return;
    setSaving(true);
    setActionError('');
    try {
      const updated = await updatePost(post.id, editText.trim());
      onPostUpdated(updated);
      setEditMode(false);
    } catch { setActionError('Não foi possível salvar a publicação.'); } finally { setSaving(false); }
  }

  async function handleVote(optionIndex: number) {
    if (votedOption === optionIndex) return;
    setActionError('');
    try {
      const updated = await voteOnPoll(post.id, optionIndex);
      setVotedOption(optionIndex);
      if (updated) onReacted(updated);
    } catch { setActionError('Não foi possível registrar seu voto.'); }
  }

  async function handlePostDelete() {
    setActionError('');
    try {
      await deletePost(post.id);
      onPostDeleted(post.id);
    } catch { setActionError('Não foi possível apagar a publicação.'); }
  }

  function handleCommentUpdated(updated: Post) { onPostUpdated(updated); }
  function handleCommentDeleted(commentId: string) {
    onPostUpdated({ ...post, comments: (post.comments || []).filter(c => c.id !== commentId) });
  }

  return (
    <article className="social-post feed-card">
      <div className="social-post-bar" style={{ backgroundColor: config.bar }} />
      <div className="feed-card-body">
        {actionError && <p role="alert" className="feed-action-error">{actionError}</p>}
        <header className="feed-card-header mb-4 flex items-start gap-4">
          <div className="relative flex-shrink-0">
            <img
              src={userAvatar(author?.name, author?.photo_url, 56)}
              alt={author?.name || 'Rede Nex'}
              className="feed-avatar rounded-full object-cover"
            />
            <span className="social-author-type" style={{ color: config.bar }}>
              <TypeIcon size={12} />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="feed-author-name truncate text-slate-900">{author?.name || 'Rede Nex'}</h2>
              <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-bold', config.badgeClass)}>
                {config.label}
              </span>
            </div>
            <p className="feed-post-meta mt-0.5 text-sm text-slate-500">
              {[author?.position, (author as { departments?: { name: string } } | undefined)?.departments?.name].filter(Boolean).join(' · ') || 'Rede Nex'}
              <span className="mx-1.5">·</span>
              {smartDate(post.created_at)}
            </p>
          </div>
          {isOwner && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => { setEditText(post.content); setEditMode(v => !v); }} className={cn('feed-icon-button h-8 w-8 flex items-center justify-center rounded-lg transition-colors', editMode ? 'bg-orange-50 text-orange-600' : 'text-slate-400 hover:bg-slate-100 hover:text-blue-600')} title="Editar" aria-label="Editar publicação">
                <Pencil size={14} />
              </button>
              <button onClick={handlePostDelete} className="feed-icon-button h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Apagar publicação" aria-label="Apagar publicação">
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </header>

        {post.pinned && <span className="feed-pinned-label">Fixada</span>}
        {post.title && <h3 className="feed-post-title mb-2 text-slate-900">{post.title}</h3>}
        {editMode ? (
          <div className="space-y-2 mb-2">
            <textarea
              autoFocus
              value={editText}
              onChange={e => setEditText(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-orange-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 resize-none"
            />
            <div className="flex gap-2">
              <button onClick={handlePostEditSave} disabled={saving || !editText.trim()} className="h-8 px-4 rounded-lg bg-orange-500 text-white text-sm font-semibold disabled:opacity-40">Salvar</button>
              <button onClick={() => setEditMode(false)} className="h-8 px-4 rounded-lg border border-slate-200 text-sm text-slate-600">Cancelar</button>
            </div>
          </div>
        ) : post.type === 'poll' && pollData ? (
          <div className="space-y-2.5 mt-1">
            <p className="font-semibold text-slate-800 text-base">{pollData.question}</p>
            {pollData.options.map((opt, i) => {
              const count = pollVotes.filter(v => v.option_index === i).length;
              const total = Math.max(pollVotes.length, 1);
              const pct = Math.round((count / total) * 100);
              const isMyVote = votedOption === i;
              return (
                <button
                  key={i}
                  onClick={() => handleVote(i)}
                  className={cn(
                    'relative w-full rounded-xl border text-left px-4 py-2.5 text-sm font-medium transition-all overflow-hidden',
                    isMyVote ? 'border-orange-400 text-orange-700' : 'border-slate-200 text-slate-700 hover:border-orange-300'
                  )}
                >
                  <div className="absolute inset-y-0 left-0 rounded-l-xl transition-all duration-500" style={{ width: `${votedOption !== null ? pct : 0}%`, backgroundColor: isMyVote ? 'rgba(251,146,60,0.15)' : 'rgba(100,116,139,0.08)' }} />
                  <span className="relative">{opt}</span>
                  {votedOption !== null && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">{pct}%</span>}
                </button>
              );
            })}
            <p className="text-xs text-slate-400">{pollVotes.length} {pollVotes.length === 1 ? 'voto' : 'votos'}{votedOption === null ? ' · clique para votar' : ''}</p>
          </div>
        ) : (
          <p className="feed-post-content whitespace-pre-wrap text-slate-700">{post.content}</p>
        )}

        <MediaDisplay imageUrl={post.image_url} videoUrl={post.video_url} />

        <div className="feed-engagement mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
          <ReactionBar
            reactions={likes}
            currentUserId={currentUserId}
            onReact={handlePostReact}
          />
          <button type="button" onClick={() => commentInputRef.current?.focus()} className="feed-comment-action inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 px-2.5 text-xs font-semibold text-slate-500 bg-white">
            <MessageCircle size={13} />
            {comments.length} {comments.length === 1 ? 'comentário' : 'comentários'}
          </button>
        </div>

        <div className="feed-comments mt-4 space-y-3">
          {comments.length > 3 && !showAllComments && (
            <button
              onClick={() => setShowAllComments(true)}
              className="text-xs font-semibold text-orange-600 hover:text-orange-700 ml-1"
            >
              Ver todos os {comments.length} comentários
            </button>
          )}
          {displayedComments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={post.id}
              currentUserId={currentUserId}
              onReacted={onReacted}
              onCommentUpdated={handleCommentUpdated}
              onCommentDeleted={handleCommentDeleted}
            />
          ))}
          {showAllComments && comments.length > 3 && (
            <button
              onClick={() => setShowAllComments(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 ml-1"
            >
              Ocultar comentários
            </button>
          )}

          <div className="flex items-center gap-2 pt-1">
            <img
              src={currentUserAvatar || userAvatar(undefined, undefined, 32)}
              alt="Eu"
              className="h-8 w-8 rounded-full object-cover flex-shrink-0"
            />
            <div className="flex-1 flex items-center gap-1.5 bg-slate-50 rounded-full border border-slate-200 px-3 focus-within:border-orange-400 transition-colors">
              <input
                ref={commentInputRef}
                value={commentDraft}
                onChange={event => onCommentChange(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    onComment();
                  }
                }}
                placeholder="Escreva um comentário..."
                aria-label="Escreva um comentário"
                className="h-9 flex-1 bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={onComment}
                disabled={!commentDraft.trim()}
                aria-label="Enviar comentário"
                className="text-orange-500 hover:text-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-1"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function PostSkeleton() {
  return (
    <div className="social-post p-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 rounded bg-slate-200" />
          <div className="h-3 w-1/4 rounded bg-slate-100" />
        </div>
      </div>
      <div className="mt-5 space-y-2">
        <div className="h-4 rounded bg-slate-100" />
        <div className="h-4 w-4/5 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export function Feed() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [wikiActivity, setWikiActivity] = useState<WikiFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [composeText, setComposeText] = useState('');
  const [composeType, setComposeType] = useState<Post['type']>('message');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [pendingMedia, setPendingMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [gamification, setGamification] = useState<GamificationProfile | null>(null);
  const [myRankPosition, setMyRankPosition] = useState<number | null>(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    setLoadError('');
    try {
      const [feedPosts, wiki, gamif, ranking] = await Promise.all([
        getFeedPosts(),
        getWikiActivity(),
        getGamificationProfile().catch(() => null),
        getRanking().catch(() => null),
      ]);
      setPosts(feedPosts);
      setWikiActivity(wiki);
      setGamification(gamif);
      if (ranking) setMyRankPosition(ranking.my_position);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar o feed.');
    } finally {
      setLoading(false);
    }
  }

  async function loadPosts() {
    const [feedPosts, wiki] = await Promise.all([getFeedPosts(), getWikiActivity()]);
    setPosts(feedPosts);
    setWikiActivity(wiki);
  }

  function replacePost(next: Post) {
    setPosts(current => current.map(p => p.id === next.id ? next : p));
  }

  function removePost(postId: string) {
    setPosts(current => current.filter(p => p.id !== postId));
  }

  async function submitPost(e: FormEvent) {
    e.preventDefault();
    if (publishing) return;
    setPublishing(true);
    try {
      if (composeType === 'poll') {
        const validOptions = pollOptions.filter(o => o.trim());
        if (!pollQuestion.trim() || validOptions.length < 2) return;
        const pollContent = JSON.stringify({ question: pollQuestion.trim(), options: validOptions.map(o => o.trim()) });
        await createPost(pollContent, 'poll');
        setPollQuestion('');
        setPollOptions(['', '']);
      } else {
        if (!composeText.trim()) return;
        await createPost(
          composeText.trim(),
          composeType,
          pendingMedia?.type === 'image' ? pendingMedia.url : undefined,
          pendingMedia?.type === 'video' ? pendingMedia.url : undefined,
        );
        setComposeText('');
        setPendingMedia(null);
      }
      setComposeType('message');
      await loadPosts();
    } finally {
      setPublishing(false);
    }
  }

  async function submitComment(post: Post) {
    const content = commentDrafts[post.id]?.trim();
    if (!content) return;
    const next = await commentPost(post.id, content);
    replacePost(next);
    setCommentDrafts(current => ({ ...current, [post.id]: '' }));
  }

  const handleFileSelect = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
    const url = await fileToBase64(file);
    setPendingMedia({ url, type: mediaType });
    e.target.value = '';
  }, []);

  type FeedEntry =
    | { _kind: 'post'; _date: string; post: Post }
    | { _kind: 'wiki'; _date: string; item: WikiFeedItem };

  const filtered = useMemo<FeedEntry[]>(() => {
    const entries: FeedEntry[] = [];
    const query = search.trim().toLocaleLowerCase('pt-BR');

    if (filter !== 'wiki_update') {
      posts
        .filter(post => (filter === 'all' || post.type === filter) && (!query || [post.title, post.content, post.users?.name].some(value => value?.toLocaleLowerCase('pt-BR').includes(query))))
        .forEach(post => entries.push({ _kind: 'post', _date: post.created_at, post }));
    }

    if (filter === 'all' || filter === 'wiki_update') {
      wikiActivity
        .filter(item => !query || [item.title, wikiPlainText(item.content || ''), item.users?.name, item.categories?.name].some(value => value?.toLocaleLowerCase('pt-BR').includes(query)))
        .forEach(item => entries.push({ _kind: 'wiki', _date: item.updated_at, item }));
    }

    return entries.sort((a, b) => new Date(b._date).getTime() - new Date(a._date).getTime());
  }, [filter, posts, search, wikiActivity]);

  const updateCount = posts.length + wikiActivity.length;

  const myAvatar = userAvatar(user?.name, user?.photo_url, 44);

  return (
    <div className="feed-page">
      <header className="feed-heading">
        <div>
          <p className="feed-eyebrow">Comunidade NEX</p>
          <h1>Feed</h1>
          <p>Novidades, conversas e ideias da nossa equipe.</p>
        </div>
        <span className="feed-heading-count">{updateCount} atualizações</span>
      </header>
      <div className="feed-layout">
      <main className="feed-main min-w-0 space-y-5">
        <StoriesBar />
        <form onSubmit={submitPost} className="social-composer feed-composer">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img src={myAvatar} alt={user?.name || 'Usuário'} className="h-11 w-11 rounded-full object-cover" />
              <div>
                <p className="text-sm font-bold text-slate-900">{user?.name || 'Usuário'}</p>
                <p className="text-xs text-slate-500">{TYPE_CONFIG[composeType]?.label}</p>
              </div>
            </div>

            <div className="feed-compose-types flex flex-wrap items-center gap-2">
              {COMPOSE_TYPES.map(type => (
                <button
                  key={type.key}
                  type="button"
                  onClick={() => setComposeType(type.key as Post['type'])}
                  className={cn('social-compose-type', composeType === type.key && 'social-compose-type-active')}
                >
                  {type.label}
                </button>
              ))}
            </div>

            {composeType === 'poll' ? (
              <div className="space-y-2.5">
                <input
                  value={pollQuestion}
                  onChange={e => setPollQuestion(e.target.value)}
                  placeholder="Qual é a pergunta da enquete?"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none"
                />
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={opt}
                      onChange={e => setPollOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                      placeholder={`Opção ${i + 1}`}
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-orange-400 outline-none"
                    />
                    {pollOptions.length > 2 && (
                      <button type="button" onClick={() => setPollOptions(prev => prev.filter((_, j) => j !== i))} className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 5 && (
                  <button type="button" onClick={() => setPollOptions(prev => [...prev, ''])} className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700">
                    <Plus size={13} /> Adicionar opção
                  </button>
                )}
              </div>
            ) : (
              <Textarea
                value={composeText}
                onChange={e => setComposeText(e.target.value)}
                placeholder="Escreva uma publicação real para a equipe..."
                className="min-h-[110px] resize-none rounded-xl border-slate-200 text-base focus:border-orange-400 focus:ring-orange-400/30"
              />
            )}

            {pendingMedia && (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setPendingMedia(null)}
                  className="absolute top-2 right-2 z-10 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                >
                  <X size={14} />
                </button>
                {pendingMedia.type === 'image' ? (
                  <img src={pendingMedia.url} alt="Preview" className="w-full max-h-64 object-contain" />
                ) : (
                  <video src={pendingMedia.url} controls className="w-full max-h-64 bg-black" />
                )}
              </div>
            )}

            <div className="feed-compose-footer flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Adicionar foto"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 h-8 text-xs font-medium text-slate-500 hover:border-orange-300 hover:text-orange-600 transition-colors"
                >
                  <ImageIcon size={14} />
                  Foto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = 'video/*';
                      fileInputRef.current.click();
                      fileInputRef.current.accept = 'image/*,video/*';
                    }
                  }}
                  title="Adicionar vídeo"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 h-8 text-xs font-medium text-slate-500 hover:border-orange-300 hover:text-orange-600 transition-colors"
                >
                  <Video size={14} />
                  Vídeo
                </button>
              </div>
              <button type="submit" disabled={composeType === 'poll' ? (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2 || publishing) : (!composeText.trim() || publishing)} className="social-submit-button">
                <Send size={15} />
                {publishing ? 'Publicando...' : 'Publicar'}
              </button>
            </div>
          </div>
        </form>

        <section className="feed-list-heading" id="feed-activity" aria-label="Filtrar publicações">
          <div className="feed-list-title">
            <div>
              <p className="feed-eyebrow">Acompanhe</p>
              <h2>Publicações</h2>
            </div>
            <span>{filtered.length} {filtered.length === 1 ? 'item' : 'itens'}</span>
          </div>
          <label className="feed-search">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Pesquisar no feed</span>
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar publicações, pessoas e artigos" type="search" />
          </label>
          <div className="feed-filters">
            {FILTERS.map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                aria-pressed={filter === item.key}
                className={cn('feed-filter', filter === item.key && 'is-active')}
              >
                <item.icon size={15} aria-hidden="true" />
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <div className="feed-post-list space-y-5">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={i} />)
          ) : loadError ? (
            <div className="feed-load-error" role="alert">
              <AlertTriangle size={24} aria-hidden="true" />
              <p>Não foi possível carregar as publicações.</p>
              <button type="button" onClick={loadAll}>Tentar novamente</button>
            </div>
          ) : filtered.length > 0 ? (
            filtered.map(entry =>
              entry._kind === 'wiki' ? (
                <WikiFeedCard
                  key={`wiki-${entry.item.id}`}
                  item={entry.item}
                  onNavigate={() => navigate('/wiki')}
                />
              ) : (
                <SocialPost
                  key={entry.post.id}
                  post={entry.post}
                  currentUserId={user?.id}
                  currentUserAvatar={myAvatar}
                  commentDraft={commentDrafts[entry.post.id] || ''}
                  onCommentChange={v => setCommentDrafts(c => ({ ...c, [entry.post.id]: v }))}
                  onComment={() => submitComment(entry.post)}
                  onReacted={replacePost}
                  onPostUpdated={replacePost}
                  onPostDeleted={removePost}
                />
              )
            )
          ) : (
            <div className="social-empty-state">
              <Newspaper size={44} />
              <h3>Nenhuma publicação encontrada</h3>
              <p>{search ? 'Tente outra busca ou escolha uma categoria diferente.' : 'Quando uma publicação for criada, ela aparecerá aqui.'}</p>
              {(search || filter !== 'all') && <button type="button" className="feed-reset-button" onClick={() => { setSearch(''); setFilter('all'); }}>Limpar filtros</button>}
            </div>
          )}
        </div>
      </main>

      <aside className="feed-sidebar" aria-label="Resumo da comunidade">
        <section className="feed-side-card feed-profile-card">
          <div className="feed-profile-cover">
            {user?.cover_url && <img src={user.cover_url} alt="" />}
            <button type="button" className="feed-profile-cover-action" onClick={() => navigate('/perfil')}>
              <ImageIcon size={13} aria-hidden="true" /> Alterar capa
            </button>
          </div>
          <div className="feed-profile-content">
            <div className="feed-profile-top">
              <img src={myAvatar} alt={user?.name || 'Usuário'} className="feed-profile-avatar" />
              <div>
                <p className="feed-side-eyebrow">Seu espaço</p>
                <h2>{user?.name || 'Usuário'}</h2>
                <p>{user?.position || user?.role_name || 'Colaborador'}</p>
              </div>
            </div>
            <p className="feed-profile-department"><Building2 size={14} aria-hidden="true" /> {user?.departments?.name || user?.department_name || 'Rede Nex'}</p>
            {gamification && (
              <div className="feed-rank">
                <div className="feed-rank-label">
                  <span style={{ color: gamification.rank.color }}>{gamification.rank.emoji} {gamification.rank.name}</span>
                  {myRankPosition != null && <span>#{myRankPosition} no ranking</span>}
                </div>
                <div className="feed-rank-track"><div style={{ width: `${gamification.progress_pct}%`, backgroundColor: gamification.rank.color }} /></div>
                {gamification.next_rank && <p>{gamification.xp_to_next.toLocaleString()} XP para {gamification.next_rank.name}</p>}
              </div>
            )}
          </div>
        </section>
      </aside>
      </div>
    </div>
  );
}
