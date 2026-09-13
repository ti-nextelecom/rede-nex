import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Bell, BookOpen, Building2, Calendar, ExternalLink, Heart,
  Image as ImageIcon, Megaphone, MessageCircle, Newspaper,
  Pencil, Plus, Send, Sparkles, Trash2, TrendingUp, Users, Video, X,
} from 'lucide-react';
import { commentPost, createPost, deleteComment, deletePost, getFeedPosts, reactToComment, reactToPost, updateComment, updatePost, voteOnPoll } from '../lib/appApi';
import { apiGet } from '../lib/apiClient';
import { useAuth } from '../lib/auth';
import { getGamificationProfile, getRanking, type GamificationProfile } from '../lib/gamificationApi';
import { Textarea } from '../components/ui/textarea';
import type { Post } from '../types';
import { cn } from '../lib/utils';
import { StoriesBar } from '../components/stories/StoriesBar';

const REACTIONS = [
  { key: 'like', emoji: '👍', label: 'Curtir' },
  { key: 'love', emoji: '❤️', label: 'Amei' },
  { key: 'celebrate', emoji: '🎉', label: 'Parabéns' },
  { key: 'insightful', emoji: '💡', label: 'Perspicaz' },
] as const;

type ReactionKey = typeof REACTIONS[number]['key'];

const TYPE_CONFIG: Record<string, { label: string; badgeClass: string; icon: typeof Bell; bar: string }> = {
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

function WikiFeedCard({ item, onNavigate }: { item: WikiFeedItem; onNavigate: () => void }) {
  const author = item.users;
  const categoryColor = item.categories?.color || '#4f46e5';
  const avatarUrl = author?.photo_url || (author?.name
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(author.name)}&size=56&background=4f46e5&color=fff`
    : `https://ui-avatars.com/api/?name=W&size=56&background=4f46e5&color=fff`
  );
  const verb = item.was_edited ? 'atualizou' : 'publicou';
  const preview = (item.content || '').replace(/[#*_~`>[\]]/g, '').slice(0, 180).trim();

  return (
    <article className="social-post">
      <div className="social-post-bar" style={{ backgroundColor: '#4f46e5' }} />
      <div className="p-5 md:p-6">
        <header className="mb-4 flex items-start gap-4">
          <div className="relative flex-shrink-0">
            <img src={avatarUrl} alt={author?.name || 'Wiki'} className="h-14 w-14 rounded-full object-cover ring-2 ring-white" />
            <span className="social-author-type" style={{ color: '#4f46e5' }}>
              <BookOpen size={12} />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-black text-slate-900">{author?.name || 'Equipe'}</h2>
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-indigo-100 text-indigo-700">Wiki</span>
              {item.categories?.name && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: categoryColor, backgroundColor: `${categoryColor}18` }}>
                  {item.categories.name}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {verb} um artigo na Wiki
              <span className="mx-1.5">·</span>
              {smartDate(item.updated_at)}
            </p>
          </div>
        </header>
        <h3 className="mb-2 text-lg font-black leading-snug text-slate-900">{item.title}</h3>
        {preview && <p className="text-sm leading-6 text-slate-600 line-clamp-3">{preview}…</p>}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <button
            onClick={onNavigate}
            className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 h-8 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
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
  { key: 'announcement', label: 'Comunicados', icon: Megaphone },
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
    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full shadow-lg px-2 py-1.5 absolute bottom-full left-0 mb-2 z-20">
      {REACTIONS.map(r => (
        <button
          key={r.key}
          title={r.label}
          onClick={() => onPick(r.key)}
          className="text-xl hover:scale-125 transition-transform p-0.5 rounded-full hover:bg-slate-100"
        >
          {r.emoji}
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
  const { counts, myReaction, total } = reactionSummary(reactions, currentUserId);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowPicker(true);
  };
  const handleMouseLeave = () => {
    timerRef.current = setTimeout(() => setShowPicker(false), 200);
  };

  const topReactions = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="relative" ref={wrapRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {showPicker && <ReactionPicker onPick={(key) => { onReact(key); setShowPicker(false); }} />}
      <button
        onClick={() => { onReact((myReaction as ReactionKey) || 'like'); setShowPicker(false); }}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors select-none',
          size === 'sm' ? 'h-7' : 'h-8',
          myReaction
            ? 'border-orange-200 bg-orange-50 text-orange-700'
            : 'border-slate-200 text-slate-500 hover:border-orange-200 hover:text-orange-600 bg-white'
        )}
      >
        {myReaction
          ? REACTIONS.find(r => r.key === myReaction)?.emoji || '👍'
          : <Heart size={size === 'sm' ? 12 : 14} />
        }
        {topReactions.length > 0 && (
          <span className="flex items-center gap-0.5">
            {topReactions.map(([key]) => (
              <span key={key}>{REACTIONS.find(r => r.key === key)?.emoji}</span>
            ))}
            <span className="ml-0.5">{total}</span>
          </span>
        )}
        {total === 0 && <span>Reagir</span>}
      </button>
    </div>
  );
}

function MediaDisplay({ imageUrl, videoUrl }: { imageUrl?: string; videoUrl?: string }) {
  if (!imageUrl && !videoUrl) return null;
  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-slate-100">
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Mídia"
          className="w-full max-h-[500px] object-contain bg-slate-50"
          loading="lazy"
        />
      )}
      {videoUrl && (
        <video
          src={videoUrl}
          controls
          className="w-full max-h-[400px] bg-black"
          preload="metadata"
        />
      )}
    </div>
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

  async function handleReact(reaction: ReactionKey) {
    try {
      const result = await reactToComment(postId, comment.id, reaction);
      if (result.post) onReacted(result.post);
    } catch {}
  }

  async function handleEditSave() {
    if (!editText.trim() || saving) return;
    setSaving(true);
    try {
      const updated = await updateComment(postId, comment.id, editText.trim());
      onCommentUpdated(updated);
      setEditMode(false);
    } catch {} finally { setSaving(false); }
  }

  async function handleDelete() {
    try {
      await deleteComment(postId, comment.id);
      onCommentDeleted(comment.id, postId);
    } catch {}
  }

  return (
    <div className="flex items-start gap-2.5 group">
      <img
        src={userAvatar(author?.name, author?.photo_url, 32)}
        alt={author?.name || 'Usuário'}
        className="h-8 w-8 rounded-full object-cover ring-1 ring-white flex-shrink-0 mt-0.5"
      />
      <div className="flex-1 min-w-0">
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
            <div className="rounded-2xl bg-slate-50 px-3.5 py-2.5">
              <p className="text-xs font-bold text-slate-800">{author?.name || 'Usuário'}</p>
              <p className="mt-0.5 text-sm text-slate-700 leading-relaxed">{comment.content}</p>
            </div>
            <div className="mt-1 flex items-center gap-3 pl-1">
              <span className="text-[11px] text-slate-400">{smartDate(comment.created_at)}</span>
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
  const pollVotes: { user_id: string; option_index: number }[] = ((post as unknown) as Record<string, { user_id: string; option_index: number }[]>).poll_votes || [];
  const myVoteInit = pollVotes.find(v => v.user_id === currentUserId)?.option_index ?? null;
  const [votedOption, setVotedOption] = useState<number | null>(myVoteInit);
  let pollData: { question: string; options: string[] } | null = null;
  if (post.type === 'poll') { try { pollData = JSON.parse(post.content) as { question: string; options: string[] }; } catch {} }

  async function handlePostReact(reaction: ReactionKey) {
    try {
      const result = await reactToPost(post.id, reaction);
      if (result.post) onReacted(result.post);
    } catch {}
  }

  async function handlePostEditSave() {
    if (!editText.trim() || saving) return;
    setSaving(true);
    try {
      const updated = await updatePost(post.id, editText.trim());
      onPostUpdated(updated);
      setEditMode(false);
    } catch {} finally { setSaving(false); }
  }

  async function handleVote(optionIndex: number) {
    if (votedOption === optionIndex) return;
    try {
      const updated = await voteOnPoll(post.id, optionIndex);
      setVotedOption(optionIndex);
      if (updated) onReacted(updated);
    } catch {}
  }

  async function handlePostDelete() {
    try {
      await deletePost(post.id);
      onPostDeleted(post.id);
    } catch {}
  }

  function handleCommentUpdated(updated: Post) { onPostUpdated(updated); }
  function handleCommentDeleted(_commentId: string, _postId: string) {
    onPostUpdated({ ...post, comments: (post.comments || []).filter(c => c.id !== _commentId) });
  }

  return (
    <article className="social-post">
      <div className="social-post-bar" style={{ backgroundColor: config.bar }} />
      <div className="p-5 md:p-6">
        <header className="mb-4 flex items-start gap-4">
          <div className="relative flex-shrink-0">
            <img
              src={userAvatar(author?.name, author?.photo_url, 56)}
              alt={author?.name || 'Rede Nex'}
              className="h-14 w-14 rounded-full object-cover ring-2 ring-white"
            />
            <span className="social-author-type" style={{ color: config.bar }}>
              <TypeIcon size={12} />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-black text-slate-900">{author?.name || 'Rede Nex'}</h2>
              <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-bold', config.badgeClass)}>
                {config.label}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {[author?.position, (author as { departments?: { name: string } } | undefined)?.departments?.name].filter(Boolean).join(' · ') || 'Rede Nex'}
              <span className="mx-1.5">·</span>
              {smartDate(post.created_at)}
            </p>
          </div>
          {isOwner && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => { setEditText(post.content); setEditMode(v => !v); }} className={cn('h-8 w-8 flex items-center justify-center rounded-lg transition-colors', editMode ? 'bg-orange-50 text-orange-600' : 'text-slate-400 hover:bg-slate-100 hover:text-blue-600')} title="Editar">
                <Pencil size={14} />
              </button>
              <button onClick={handlePostDelete} className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Apagar publicação">
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </header>

        {post.title && <h3 className="mb-2 text-lg font-black leading-snug text-slate-900">{post.title}</h3>}
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
          <p className="whitespace-pre-wrap text-base leading-7 text-slate-700">{post.content}</p>
        )}

        <MediaDisplay imageUrl={post.image_url} videoUrl={post.video_url} />

        <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
          <ReactionBar
            reactions={likes}
            currentUserId={currentUserId}
            onReact={handlePostReact}
          />
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 px-2.5 text-xs font-semibold text-slate-500 bg-white">
            <MessageCircle size={13} />
            {comments.length} {comments.length === 1 ? 'comentário' : 'comentários'}
          </span>
        </div>

        <div className="mt-4 space-y-3">
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
                value={commentDraft}
                onChange={event => onCommentChange(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    onComment();
                  }
                }}
                placeholder="Escreva um comentário..."
                className="h-9 flex-1 bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400"
              />
              <button
                onClick={onComment}
                disabled={!commentDraft.trim()}
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
  const [publishing, setPublishing] = useState(false);
  const [filter, setFilter] = useState('all');
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

    if (filter !== 'wiki_update') {
      posts
        .filter(post => filter === 'all' || post.type === filter)
        .forEach(post => entries.push({ _kind: 'post', _date: post.created_at, post }));
    }

    if (filter === 'all' || filter === 'wiki_update') {
      wikiActivity.forEach(item => entries.push({ _kind: 'wiki', _date: item.updated_at, item }));
    }

    return entries.sort((a, b) => new Date(b._date).getTime() - new Date(a._date).getTime());
  }, [filter, posts, wikiActivity]);

  const stats = {
    posts: posts.length,
    wiki: wikiActivity.length,
    authors: new Set(posts.map(p => p.author_id).filter(Boolean)).size,
    pinned: posts.filter(p => p.pinned).length,
  };

  const myAvatar = userAvatar(user?.name, user?.photo_url, 44);

  return (
    <div className="social-feed-shell">
      <aside className="social-left-panel">
        <div className="social-profile-card">
          <div className="social-profile-cover relative overflow-hidden">
            {user?.cover_url && (
              <img src={user.cover_url} alt="Capa" className="absolute inset-0 h-full w-full object-cover" />
            )}
          </div>
          <div className="px-4 pb-4">
            <img src={myAvatar} alt={user?.name || 'Usuário'} className="-mt-6 h-12 w-12 rounded-full object-cover ring-4 ring-white relative z-10" />
            <h2 className="mt-2 text-sm font-black text-slate-900">{user?.name || 'Usuário'}</h2>
            <p className="text-xs text-slate-500">{user?.position || user?.role_name || 'Colaborador'}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Building2 size={13} />
              {user?.departments?.name || user?.department_name || 'Rede Nex'}
            </p>
            {gamification && (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold" style={{ color: gamification.rank.color }}>
                    {gamification.rank.emoji} {gamification.rank.name}
                  </span>
                  {myRankPosition != null && (
                    <span className="font-semibold text-slate-400">#{myRankPosition} Ranking</span>
                  )}
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${gamification.progress_pct}%`,
                      background: `linear-gradient(90deg, ${gamification.rank.color}, ${gamification.next_rank?.color ?? gamification.rank.color})`,
                    }}
                  />
                </div>
                {gamification.next_rank && (
                  <p className="text-[10px] text-slate-400">{gamification.xp_to_next.toLocaleString()} XP para {gamification.next_rank.name}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="min-w-0 space-y-5">
        <section className="social-hero">
          <div>
            <h1 className="flex items-center gap-3">
              <img src="/assets/images/logo_nex.png" alt="Rede Nex" className="h-10 w-10 object-contain drop-shadow-md rounded-lg" />
              Rede Nex
            </h1>
            <p>Comunicados, avisos e atualizações reais da operação.</p>
          </div>
          <div className="social-hero-metrics">
            <span><strong>{stats.posts}</strong> Publicações</span>
            <span><strong>{stats.wiki}</strong> Atualizações Wiki</span>
            <span><strong>{stats.pinned}</strong> Fixadas</span>
          </div>
        </section>



        <StoriesBar />
        <form onSubmit={submitPost} className="social-composer">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img src={myAvatar} alt={user?.name || 'Usuário'} className="h-11 w-11 rounded-full object-cover" />
              <div>
                <p className="text-sm font-bold text-slate-900">{user?.name || 'Usuário'}</p>
                <p className="text-xs text-slate-500">{TYPE_CONFIG[composeType]?.label}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
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

            <div className="flex items-center justify-between">
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

        <div className="space-y-5">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={i} />)
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
              <p>Quando uma publicação for criada, ela aparecerá aqui.</p>
            </div>
          )}
        </div>
      </main>

      <aside className="social-right-panel">
        <section className="social-panel">
          <div className="mb-4 flex items-center gap-2">
            <Bell size={16} className="text-orange-500" />
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">Resumo</h2>
          </div>
          <div className="space-y-2">
            {Object.entries(TYPE_CONFIG).filter(([key]) => !['alert', 'update'].includes(key)).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setFilter(filter === key ? 'all' : key)}
                className={cn('social-type-row', filter === key && 'social-type-row-active')}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: config.bar }} />
                <config.icon size={14} style={{ color: config.bar }} />
                <span>{config.label}</span>
                <span className="ml-auto text-xs text-slate-500">{posts.filter(p => p.type === key).length}</span>
              </button>
            ))}
          </div>
        </section>

      </aside>
    </div>
  );
}
