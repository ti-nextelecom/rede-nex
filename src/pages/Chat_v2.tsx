import {
  ChangeEvent, FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Bell, BellOff, BookOpen, Camera, Check, CheckCheck, ChevronLeft, Crown, Eye, FileText, History, Image,
  Mic, MicOff, MessageCircle, Moon, MoreVertical, Palette, Paperclip, Pencil, Phone, Pin, Plus, Reply, Search, Send,
  Settings, Shield, Smile, Sticker, Sun, Trash2, UserMinus, UserPlus, Users, Video, X,
} from 'lucide-react';
import {
  addParticipantsToGroup, createConversation, deleteChatMessage, editChatMessage, getConversations,
  getGroupParticipants, getMessageHistory, getMessageReaders, getMessages, getNotes, markConversationRead,
  pinChatConversation, pinChatMessage, removeParticipantFromGroup, saveNotes, sendChatMessage,
  toggleMuteConversation, updateConversationSettings, updateParticipantRole, uploadChatMedia,
  uploadConversationAvatar,
  type ChatConversation, type ChatMessage, type GroupParticipant, type MessageEdit, type MessageReader,
} from '../lib/chatApi';
import { getUsers } from '../lib/appApi';
import { apiGet, apiPatch, apiPut } from '../lib/apiClient';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/utils';
import { callStore } from '../lib/callStore';
import type { CallState } from '../hooks/useVoiceCall';
import { getRanking } from '../lib/gamificationApi';
import type { User } from '../types';
import type { RankingEntry } from '../lib/gamificationApi';

interface IncomingToast { id: string; title: string; body: string; conversationId: string; }

/* ── Theme ──────────────────────────────────────────────────────────────── */
interface ChatTheme {
  bubbleColor: string;
  bgColor: string;
  bgImage: string;
  textColor: string;
}
const DEFAULT_THEME: ChatTheme = {
  bubbleColor: '#005c4b',
  bgColor: '#eef2f5',
  bgImage: '',
  textColor: '#ffffff',
};
function loadTheme(): ChatTheme {
  try { return { ...DEFAULT_THEME, ...JSON.parse(localStorage.getItem('chat_theme') || '{}') }; } catch { return DEFAULT_THEME; }
}
function saveTheme(t: ChatTheme) {
  localStorage.setItem('chat_theme', JSON.stringify(t));
  apiPut('/users/me/chat-theme', t).catch(() => {});
}

/* ── Stickers & Emojis ──────────────────────────────────────────────────── */
const EMOJIS = [
  '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
  '😘','😗','😚','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤔','🤨','😐','😑','😶',
  '😏','😒','🙄','😬','😌','😔','😪','😴','😷','🤒','🤢','🤧','😵','🤯','😎','🤓',
  '🥳','😕','😟','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','😈','💀',
  '👋','🤚','✋','🤙','👍','👎','✊','👊','💪','🤲','🙏','❤️','🧡','💛','💚','💙',
  '💜','🖤','💔','💯','🔥','⭐','✨','🌟','🏆','🎉','🎊','🎁','🎈','🌹','🌻','🌷',
  '😺','😸','😹','😻','🐶','🐱','🐭','🐹','🐸','🦊','🐻','🐼','🐨','🦁','🐯','🐮',
  '🍕','🍔','🍟','🌮','🌯','🍣','🍜','🍝','🍩','🍪','🎂','🍰','☕','🧃','🍺','🥂',
];
const STICKERS = [
  { label: 'Amei!', emoji: '🥰' }, { label: 'Ótimo!', emoji: '🤩' },
  { label: 'Parabéns!', emoji: '🎉' }, { label: 'Força!', emoji: '💪' },
  { label: 'OK!', emoji: '👍' }, { label: 'Não!', emoji: '👎' },
  { label: 'Atenção!', emoji: '🚨' }, { label: 'Check!', emoji: '✅' },
  { label: 'Foguete!', emoji: '🚀' }, { label: 'Café!', emoji: '☕' },
  { label: 'Urgente!', emoji: '⚡' }, { label: 'Haha!', emoji: '😂' },
];

/* ── Helpers ────────────────────────────────────────────────────────────── */
function timeLabel(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function fullDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
function presenceLabel(user: User) {
  if (user.online) return 'Online';
  const s = user.seconds_since_seen;
  if (!s) return 'Nunca acessou';
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} min atrás`;
  if (s < 86400) return `${Math.floor(s / 3600)}h atrás`;
  return `${Math.floor(s / 86400)}d atrás`;
}
function convPresenceLabel(conv: ChatConversation): string {
  if (conv.type !== 'direct' || !conv.other_participant) return '';
  const op = conv.other_participant;
  if (op.online) return 'Online';
  if (!op.last_seen_at) return 'Nunca acessou';
  const diff = Math.floor((Date.now() - new Date(op.last_seen_at).getTime()) / 1000);
  if (diff < 120) return 'Visto há pouco';
  if (diff < 3600) return `Visto há ${Math.floor(diff / 60)} min`;
  const d = new Date(op.last_seen_at);
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (diff < 86400) return `Visto às ${hm}`;
  return `Visto ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${hm}`;
}
function playNotificationSound() {
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  const ctx = new Ctor();
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + 0.24);
  setTimeout(() => ctx.close(), 350);
}

/* ── ConvAvatar ─────────────────────────────────────────────────────────── */
function ConvAvatar({ conv, usersById }: { conv: ChatConversation; usersById: Map<string, User> }) {
  const online = conv.type === 'direct' && conv.other_participant?.online === true;
  const dot = online ? <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" /> : null;
  const fallbackAvatar = (n: string, size = 44) => `https://ui-avatars.com/api/?name=${encodeURIComponent(n)}&size=${size}&background=ff7a00&color=fff`;
  const onErr = (n: string, size = 44) => (e: React.SyntheticEvent<HTMLImageElement>) => { (e.currentTarget).src = fallbackAvatar(n, size); };
  if (conv.type === 'group') {
    if (conv.avatar_url) return <div className="relative flex-shrink-0"><img src={conv.avatar_url} alt={conv.name} className="h-11 w-11 rounded-full object-cover" onError={onErr(conv.name || 'G')} />{dot}</div>;
    return <div className="relative flex-shrink-0"><div className="h-11 w-11 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><Users size={18} /></div>{dot}</div>;
  }
  const u = usersById.get(conv.other_participant?.id || '');
  const photoUrl = u?.photo_url || conv.other_participant?.photo_url;
  const name = conv.name || '?';
  const img = photoUrl
    ? <img src={photoUrl} alt={name} className="h-11 w-11 rounded-full object-cover" onError={onErr(name)} />
    : <img src={fallbackAvatar(name)} alt={name} className="h-11 w-11 rounded-full object-cover" />;
  return <div className="relative flex-shrink-0">{img}{dot}</div>;
}

/* ── ReadTick ───────────────────────────────────────────────────────────── */
function ReadTick({ mine, seen }: { mine: boolean; seen: boolean }) {
  if (!mine) return null;
  return seen
    ? <CheckCheck size={12} className="text-sky-300" />
    : <Check size={12} className="text-white/50" />;
}

interface MsgBubbleProps {
  message: ChatMessage;
  mine: boolean;
  isGroup?: boolean;
  lastReadAt?: string;
  onEdit?: (msg: ChatMessage) => void;
  onDelete?: (msg: ChatMessage) => void;
  onReply?: (msg: ChatMessage) => void;
  onPin?: (msg: ChatMessage) => void;
  onImageClick?: (src: string) => void;
  theme: ChatTheme;
  darkMode?: boolean;
  isPinned?: boolean;
}

function MessageBubble({ message, mine, isGroup, lastReadAt, onEdit, onDelete, onReply, onPin, onImageClick, theme, darkMode, isPinned }: MsgBubbleProps) {
  const canEdit = mine && !!onEdit && (Date.now() - new Date(message.created_at).getTime()) < 30 * 60 * 1000;
  const canDelete = mine && !!onDelete && (Date.now() - new Date(message.created_at).getTime()) < 30 * 60 * 1000;
  const [showTooltip, setShowTooltip] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [history, setHistory] = useState<MessageEdit[]>([]);
  const [readers, setReaders] = useState<MessageReader[] | null>(null);
  const [loadingReaders, setLoadingReaders] = useState(false);
  const historyBtnRef = useRef<HTMLButtonElement | null>(null);
  const [historyBtnRect, setHistoryBtnRect] = useState<DOMRect | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const [swipeDx, setSwipeDx] = useState(0);

  function handleTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; }
  function handleTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - touchStartX.current;
    if (dx < 0 && Math.abs(dx) < 90) setSwipeDx(dx);
  }
  function handleTouchEnd() { if (swipeDx < -50 && onReply) onReply(message); setSwipeDx(0); }

  useEffect(() => {
    if (!showMenu) return;
    function close(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showMenu]);

  async function handleViewReaders() {
    if (readers !== null) { setReaders(null); return; }
    setLoadingReaders(true);
    try { const data = await getMessageReaders(message.conversation_id, message.id); setReaders(data); }
    catch {} finally { setLoadingReaders(false); }
  }
  const seen = mine && !!lastReadAt && new Date(lastReadAt) >= new Date(message.created_at);
  const content = message.content ?? '';

  async function loadHistory() {
    if (showHistory) { setShowHistory(false); return; }
    setHistoryBtnRect(historyBtnRef.current?.getBoundingClientRect() ?? null);
    try { const h = await getMessageHistory(message.conversation_id, message.id); setHistory(h); }
    catch { setHistory([]); }
    setShowHistory(true);
  }

  const bubbleBg = mine ? theme.bubbleColor : (darkMode ? '#202c33' : '#ffffff');
  const bubbleText = mine ? theme.textColor : (darkMode ? '#e9edef' : '#374151');

  if (message.is_deleted) {
    return (
      <div className="relative group max-w-[85%]" style={swipeStyle}>
        <div className={cn('rounded-2xl px-4 py-3 shadow-sm', mine ? 'rounded-tr-sm' : 'rounded-tl-sm')} style={{ background: bubbleBg }}>
          {!mine && isGroup && <p className="mb-1 text-sm font-bold text-slate-500 whitespace-nowrap">{message.sender?.name || 'Usuário'}</p>}
          <p className="text-sm italic" style={{ color: mine ? `${theme.textColor}70` : '#9ca3af' }}>🚫 Mensagem apagada</p>
          {timestamp}
        </div>
      </div>
    );
  }

  const menu = showMenu && (
    <div ref={menuRef} className={`absolute z-40 ${mine ? 'right-8' : 'left-8'} bottom-full mb-1 rounded-xl border border-slate-200 bg-white shadow-xl py-1 min-w-[148px]`}>
      {onReply && <button onClick={() => { onReply(message); setShowMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"><Reply size={14} className="text-blue-500" /> Responder</button>}
      {canEdit && <button onClick={() => { onEdit!(message); setShowMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"><Pencil size={14} className="text-orange-500" /> Editar</button>}
      {canDelete && <button onClick={() => { onDelete!(message); setShowMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 size={14} /> Excluir</button>}
      {onPin && <button onClick={() => { onPin(message); setShowMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"><Pin size={14} className={isPinned ? 'text-orange-500' : 'text-slate-400'} /> {isPinned ? 'Desafixar' : 'Fixar'}</button>}
    </div>
  );

  const replyPreview = message.reply_to && (
    <div className={`mb-1.5 rounded-lg border-l-2 px-2 py-1.5 ${mine ? 'border-white/40 bg-black/10' : 'border-orange-300 bg-orange-50'}`}>
      <p className="text-[11px] font-bold" style={{ color: mine ? `${theme.textColor}bb` : '#f97316' }}>{message.reply_to.sender?.name || 'Usuário'}</p>
      <p className="text-xs truncate" style={{ color: mine ? `${theme.textColor}99` : '#6b7280' }}>
        {message.reply_to.content?.startsWith('[IMAGE]') ? '📷 Foto'
          : message.reply_to.content?.startsWith('[VIDEO]') ? '🎬 Vídeo'
          : message.reply_to.content?.startsWith('[AUDIO_MSG]') ? '🎤 Áudio'
          : message.reply_to.content?.slice(0, 60) ?? ''}
      </p>
    </div>
  );

  const readersPopup = readers !== null && mine && isGroup && (
    <div className={cn('absolute z-30 bottom-full mb-1 rounded-xl border border-slate-200 bg-white shadow-xl p-3 min-w-[180px]', mine ? 'right-0' : 'left-0')}>
      <p className="text-xs font-bold text-slate-700 mb-2">Visualizaram {readers.length > 0 ? `(${readers.length})` : ''}</p>
      {readers.length === 0 && <p className="text-xs text-slate-400">Ninguém ainda</p>}
      {readers.map(r => (
        <div key={r.id} className="flex items-center gap-2 mb-1.5">
          <img src={r.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.name)}&size=24&background=ff7a00&color=fff`} alt={r.name} className="h-6 w-6 rounded-full object-cover" onError={e => { (e.currentTarget).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(r.name)}&size=24&background=ff7a00&color=fff`; }} />
          <span className="text-xs text-slate-600 truncate">{r.name}</span>
        </div>
      ))}
      <button onClick={() => setReaders(null)} className="absolute top-1 right-2 text-slate-400 hover:text-slate-700"><X size={11} /></button>
    </div>
  );

  const timestamp = (
    <div className="mt-1 flex items-center gap-1 justify-end text-[10px]" style={{ color: mine ? `${theme.textColor}99` : '#9ca3af' }}>
      <button onClick={() => setShowTooltip(v => !v)} className="hover:underline">{timeLabel(message.created_at)}</button>
      {message.edited_at && (
        <button ref={historyBtnRef} onClick={loadHistory} title="Ver histórico" className="hover:opacity-80"><Pencil size={9} /></button>
      )}
      {mine && isGroup && (
        <button onClick={handleViewReaders} title="Ver quem visualizou" className="hover:opacity-80 ml-0.5">
          {loadingReaders ? '...' : <Eye size={9} />}
        </button>
      )}
      <ReadTick mine={mine} seen={seen} />
    </div>
  );

  const tooltip = showTooltip && (
    <div className={cn('absolute z-30 bottom-full mb-1 rounded-xl border border-slate-200 bg-white shadow-xl p-3 text-xs text-slate-700 whitespace-nowrap min-w-[200px]', mine ? 'right-0' : 'left-0')}>
      <p>📤 Enviado: {fullDateTime(message.created_at)}</p>
      {lastReadAt && seen && <p>👁️ Visto: {fullDateTime(lastReadAt)}</p>}
      {message.edited_at && <p>✏️ Editado: {fullDateTime(message.edited_at)}</p>}
      <button onClick={() => setShowTooltip(false)} className="absolute top-1 right-2 text-slate-400 hover:text-slate-700"><X size={11} /></button>
    </div>
  );

  const editHistory = showHistory && historyBtnRect && createPortal(
    <div style={{ position: 'fixed', bottom: window.innerHeight - historyBtnRect.top + 8, ...(mine ? { right: window.innerWidth - historyBtnRect.right } : { left: historyBtnRect.left }), zIndex: 9999, minWidth: 240, maxWidth: 320 }}
      className="rounded-xl border border-slate-200 bg-white shadow-xl p-3">
      <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1"><History size={11} /> Histórico de edições</p>
      {history.map((h, i) => (
        <div key={i} className="mb-2 border-l-2 border-slate-200 pl-2">
          <p className="text-[10px] text-slate-400">{fullDateTime(h.edited_at)}</p>
          <p className="text-xs text-slate-600">{h.content}</p>
        </div>
      ))}
      {!history.length && <p className="text-xs text-slate-400">Sem histórico</p>}
      <button onClick={() => setShowHistory(false)} className="absolute top-1 right-2 text-slate-400 hover:text-slate-700"><X size={11} /></button>
    </div>,
    document.body
  );

  const menuBtn = (
    <button onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
      className="absolute -top-2 opacity-0 group-hover:opacity-100 h-7 w-7 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-slate-800 transition-opacity"
      style={mine ? { right: 4 } : { left: 4 }}>
      <MoreVertical size={13} />
    </button>
  );

  const swipeStyle = { transform: `translateX(${swipeDx}px)`, transition: swipeDx === 0 ? 'transform 0.2s' : 'none' };

  if (content.startsWith('[AUDIO_MSG]')) {
    return (
      <div className="relative group max-w-[85%]" style={swipeStyle} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <div className={cn('rounded-2xl px-4 py-3 shadow-sm', mine ? 'rounded-tr-sm' : 'rounded-tl-sm')} style={{ background: bubbleBg }}>
          {!mine && <p className="mb-1 text-sm font-bold text-slate-500 whitespace-nowrap">{message.sender?.name || 'Usuário'}</p>}
          {replyPreview}
          <audio controls src={content.slice(11)} className="w-full max-w-[360px] h-12" preload="none" style={{ minWidth: 280 }} />
          {timestamp}
        </div>
        {menuBtn}{menu}{tooltip}{editHistory}{readersPopup}
      </div>
    );
  }

  if (content.startsWith('[DOC|')) {
    const end = content.indexOf(']');
    const fileName = end > 5 ? content.slice(5, end) : 'Documento';
    const src = end >= 0 ? content.slice(end + 1) : content;
    const ext = fileName.split('.').pop()?.toUpperCase() || 'DOC';
    return (
      <div className="relative group max-w-[85%]" style={swipeStyle} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <div className={cn('rounded-2xl px-4 py-3 shadow-sm', mine ? 'rounded-tr-sm' : 'rounded-tl-sm')} style={{ background: bubbleBg }}>
          {!mine && <p className="mb-1 text-sm font-bold text-slate-500 whitespace-nowrap">{message.sender?.name || 'Usuário'}</p>}
          {replyPreview}
          <a href={src} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0"><FileText size={20} className="text-orange-500" /></div>
            <div className="min-w-0"><p className="text-sm font-semibold text-slate-800 truncate max-w-[220px]">{fileName}</p><p className="text-xs text-orange-500 font-bold">{ext}</p></div>
          </a>
          {timestamp}
        </div>
        {menuBtn}{menu}{tooltip}{editHistory}{readersPopup}
      </div>
    );
  }

  if (content.startsWith('[STICKER]')) {
    return (
      <div className="relative group" style={swipeStyle} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <div className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
          {replyPreview}
          <span className="text-5xl leading-none">{content.slice(9)}</span>
          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
            {timeLabel(message.created_at)}<ReadTick mine={mine} seen={seen} />
          </div>
        </div>
        {menuBtn}{menu}{tooltip}{editHistory}
      </div>
    );
  }

  if (content.startsWith('[IMAGE]')) {
    const rawSrc = content.slice(7);
    const nlIdx = rawSrc.indexOf('\n');
    const src = nlIdx >= 0 ? rawSrc.slice(0, nlIdx) : rawSrc;
    const caption = nlIdx >= 0 ? rawSrc.slice(nlIdx + 1) : '';
    return (
      <div className="relative group" style={swipeStyle} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <div className={cn('max-w-[420px] rounded-2xl overflow-hidden shadow-sm', mine ? 'rounded-tr-sm' : 'rounded-tl-sm')} style={{ background: bubbleBg }}>
          {!mine && <p className="px-3 pt-2 text-sm font-bold text-slate-500 whitespace-nowrap">{message.sender?.name || 'Usuário'}</p>}
          {replyPreview && <div className="px-3 pt-2">{replyPreview}</div>}
          <img src={src} alt="foto" className="w-full max-h-80 object-cover cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => onImageClick ? onImageClick(src) : window.open(src, '_blank')} />
          {caption && <p className="px-3 py-2 text-sm" style={{ color: bubbleText }}>{caption}</p>}
          {timestamp}
        </div>
        {menuBtn}{menu}{tooltip}{editHistory}
      </div>
    );
  }

  if (content.startsWith('[VIDEO]')) {
    const rawSrc = content.slice(7);
    const nlIdx = rawSrc.indexOf('\n');
    const src = nlIdx >= 0 ? rawSrc.slice(0, nlIdx) : rawSrc;
    const caption = nlIdx >= 0 ? rawSrc.slice(nlIdx + 1) : '';
    return (
      <div className="relative group" style={swipeStyle} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <div className={cn('max-w-[300px] rounded-2xl overflow-hidden shadow-sm', mine ? 'rounded-tr-sm' : 'rounded-tl-sm')} style={{ background: bubbleBg }}>
          {!mine && <p className="px-3 pt-2 text-xs font-bold text-slate-500 whitespace-nowrap">{message.sender?.name || 'Usuário'}</p>}
          {replyPreview && <div className="px-3 pt-2">{replyPreview}</div>}
          <video controls src={src} className="w-full max-h-48 object-cover" preload="none" />
          {caption && <p className="px-3 py-2 text-sm" style={{ color: bubbleText }}>{caption}</p>}
          {timestamp}
        </div>
        {menuBtn}{menu}{tooltip}{editHistory}
      </div>
    );
  }

  return (
    <div className="relative group" style={{ maxWidth: '75%', ...swipeStyle }} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div className={cn('rounded-2xl px-5 py-3 shadow-sm', mine ? 'rounded-tr-sm' : 'rounded-tl-sm')}
        style={{ background: bubbleBg, color: bubbleText, minWidth: 80 }}>
        {!mine && <p className="mb-1 text-sm font-bold text-slate-500 whitespace-nowrap">{message.sender?.name || 'Usuário'}</p>}
        {replyPreview}
        <p className="whitespace-pre-wrap text-[17px] leading-relaxed break-words">{content}</p>
        {timestamp}
      </div>
      {menuBtn}{menu}{tooltip}{editHistory}{readersPopup}
    </div>
  );
}

/* ── GroupSettings ──────────────────────────────────────────────────────── */
function GroupSettings({
  conv, users, myId, onClose, onUpdate,
}: { conv: ChatConversation; users: User[]; myId: string; onClose: () => void; onUpdate: (c: ChatConversation) => void }) {
  const [participants, setParticipants] = useState<GroupParticipant[]>([]);
  const [groupName, setGroupName] = useState(conv.name || '');
  const [broadcastMode, setBroadcastMode] = useState(conv.broadcast_mode || false);
  const [addSearch, setAddSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(conv.avatar_url || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const isOwner = conv.my_role === 'owner';
  const isAdmin = conv.my_role === 'owner' || conv.my_role === 'admin';

  async function handleAvatarUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploadingAvatar(true);
    try {
      const url = await uploadConversationAvatar(conv.id, file);
      setAvatarUrl(url);
      onUpdate({ ...conv, avatar_url: url });
    } catch { alert('Erro ao enviar imagem do grupo. Tente novamente.'); } finally { setUploadingAvatar(false); }
  }

  useEffect(() => { getGroupParticipants(conv.id).then(setParticipants).catch(() => {}); }, [conv.id]);

  async function saveSettings() {
    setSaving(true);
    try { const u = await updateConversationSettings(conv.id, { name: groupName, broadcast_mode: broadcastMode }); if (u) onUpdate(u); } finally { setSaving(false); }
  }

  async function promoteUser(userId: string, role: 'admin' | 'member') {
    const r = await updateParticipantRole(conv.id, userId, role);
    if (r) setParticipants(r);
  }

  async function removeUser(userId: string) {
    if (!confirm('Remover participante?')) return;
    await removeParticipantFromGroup(conv.id, userId);
    setParticipants(p => p.filter(x => x.id !== userId));
  }

  const notInGroup = users.filter(u => !participants.some(p => p.id === u.id));
  const filtered = addSearch ? notInGroup.filter(u => u.name.toLowerCase().includes(addSearch.toLowerCase())) : notInGroup;

  async function addUser(userId: string) {
    await addParticipantsToGroup(conv.id, [userId]);
    const updated = await getGroupParticipants(conv.id);
    setParticipants(updated);
    setAddSearch('');
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto h-full w-80 bg-white shadow-2xl flex flex-col">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <Settings size={17} className="text-orange-500" />
          <h2 className="text-sm font-bold text-slate-900 flex-1">Configurações do Grupo</h2>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {isAdmin && (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="relative"
                title="Alterar foto do grupo"
              >
                {avatarUrl
                  ? <img src={avatarUrl} alt="Foto do grupo" className="h-20 w-20 rounded-full object-cover ring-2 ring-slate-200" />
                  : <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><Users size={28} /></div>
                }
                <div className="absolute bottom-0 right-0 h-7 w-7 bg-orange-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                  {uploadingAvatar ? <span className="text-white text-[9px] font-bold">...</span> : <Camera size={13} className="text-white" />}
                </div>
              </button>
              <p className="text-xs text-slate-500">Clique para alterar a foto</p>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
          )}
          {isAdmin && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Nome do grupo</p>
              <input value={groupName} onChange={e => setGroupName(e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-400" />
            </div>
          )}
          {isAdmin && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Permissão</p>
              <div className="space-y-2">
                {[{ value: false, label: 'Aberto', desc: 'Todos podem enviar', icon: Users }, { value: true, label: 'Informativo', desc: 'Só admins enviam', icon: Shield }].map(opt => (
                  <button key={String(opt.value)} onClick={() => setBroadcastMode(opt.value)}
                    className={cn('w-full flex items-start gap-3 rounded-xl border p-3 text-left', broadcastMode === opt.value ? 'border-orange-400 bg-orange-50' : 'border-slate-200 hover:bg-slate-50')}>
                    <opt.icon size={16} className={broadcastMode === opt.value ? 'text-orange-500 mt-0.5' : 'text-slate-400 mt-0.5'} />
                    <div>
                      <p className={cn('text-sm font-semibold', broadcastMode === opt.value ? 'text-orange-700' : 'text-slate-700')}>{opt.label}</p>
                      <p className="text-xs text-slate-500">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {isAdmin && <button onClick={saveSettings} disabled={saving} className="w-full h-10 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button>}
          {isAdmin && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Adicionar participantes</p>
              <input value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder="Buscar..." className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-400 mb-2" />
              {addSearch && filtered.slice(0, 5).map(u => (
                <button key={u.id} onClick={() => addUser(u.id)} className="w-full flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-orange-50 text-left">
                  <img src={u.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&size=32&background=ff7a00&color=fff`} alt={u.name} className="h-8 w-8 rounded-full object-cover" />
                  <p className="text-sm font-semibold text-slate-700 truncate flex-1">{u.name}</p>
                  <UserPlus size={14} className="text-orange-500" />
                </button>
              ))}
            </div>
          )}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Participantes ({participants.length})</p>
            {participants.map(p => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 group">
                <div className="relative flex-shrink-0">
                  <img src={p.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&size=36&background=ff7a00&color=fff`} alt={p.name} className="h-9 w-9 rounded-full object-cover" />
                  {p.online && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-700 truncate">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.role === 'owner' ? '👑 Dono' : p.role === 'admin' ? '🛡️ Admin' : 'Membro'}</p>
                </div>
                {isOwner && p.id !== myId && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    {p.role === 'member'
                      ? <button onClick={() => promoteUser(p.id, 'admin')} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-orange-500"><Crown size={13} /></button>
                      : p.role === 'admin'
                      ? <button onClick={() => promoteUser(p.id, 'member')} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600"><Shield size={13} /></button>
                      : null}
                    <button onClick={() => removeUser(p.id)} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500"><UserMinus size={13} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── ThemePanel ─────────────────────────────────────────────────────────── */
function ThemePanel({ theme, onChange, onClose }: { theme: ChatTheme; onChange: (t: ChatTheme) => void; onClose: () => void }) {
  const BUBBLE_PRESETS = ['#005c4b', '#1d4ed8', '#7c3aed', '#be185d', '#b45309', '#1f2937'];
  const BG_PRESETS = ['#eef2f5', '#f0fdf4', '#fef3c7', '#fdf2f8', '#eff6ff', '#1a1a2e'];
  const BG_IMAGES = [
    '',
    'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=60',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=60',
    'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&q=60',
    'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800&q=60',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=60',
  ];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState('');

  function set(key: keyof ChatTheme, value: string) {
    const next = { ...theme, [key]: value };
    onChange(next);
    saveTheme(next);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Imagem muito grande. Máx: 5 MB.');
      return;
    }
    setUploadError('');
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      try {
        set('bgImage', dataUrl);
      } catch {
        setUploadError('Erro ao salvar. Tente uma imagem menor.');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  const isCustomUpload = theme.bgImage && !BG_IMAGES.includes(theme.bgImage);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto h-full w-72 bg-white shadow-2xl flex flex-col">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <Palette size={17} className="text-orange-500" />
          <h2 className="text-sm font-bold text-slate-900 flex-1">Personalizar Chat</h2>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Cor das suas mensagens</p>
            <div className="flex flex-wrap gap-2">
              {BUBBLE_PRESETS.map(c => (
                <button key={c} onClick={() => set('bubbleColor', c)}
                  className={cn('h-8 w-8 rounded-full border-2 transition-transform hover:scale-110', theme.bubbleColor === c ? 'border-orange-500 scale-110' : 'border-transparent')}
                  style={{ background: c }} />
              ))}
              <input type="color" value={theme.bubbleColor} onChange={e => set('bubbleColor', e.target.value)} className="h-8 w-8 rounded-full cursor-pointer border border-slate-200" title="Cor personalizada" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <p className="text-xs text-slate-500">Cor do texto:</p>
              {['#ffffff', '#1f2937', '#fbbf24'].map(c => (
                <button key={c} onClick={() => set('textColor', c)}
                  className={cn('h-6 w-6 rounded-full border-2', theme.textColor === c ? 'border-orange-500' : 'border-slate-200')}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Cor do fundo</p>
            <div className="flex flex-wrap gap-2">
              {BG_PRESETS.map(c => (
                <button key={c} onClick={() => set('bgColor', c)}
                  className={cn('h-8 w-8 rounded-lg border-2 transition-transform hover:scale-110', theme.bgColor === c ? 'border-orange-500 scale-110' : 'border-slate-200')}
                  style={{ background: c }} />
              ))}
              <input type="color" value={theme.bgColor} onChange={e => set('bgColor', e.target.value)} className="h-8 w-8 rounded-lg cursor-pointer border border-slate-200" title="Cor personalizada" />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Imagem de fundo</p>
            <div className="grid grid-cols-2 gap-2">
              {BG_IMAGES.map((img, i) => (
                <button key={i} onClick={() => set('bgImage', img)}
                  className={cn('h-16 rounded-lg border-2 overflow-hidden', theme.bgImage === img ? 'border-orange-500' : 'border-slate-200')}>
                  {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-slate-100 flex items-center justify-center text-xs text-slate-500">Sem imagem</div>}
                </button>
              ))}
            </div>

            {/* Upload personalizado */}
            <div className="mt-3">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'w-full h-10 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 text-sm font-medium transition-colors',
                  isCustomUpload ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-slate-300 text-slate-500 hover:border-orange-300 hover:text-orange-500 hover:bg-orange-50/50',
                )}>
                <Image size={15} />
                {isCustomUpload ? 'Trocar minha foto' : 'Carregar do dispositivo'}
              </button>
              {isCustomUpload && (
                <div className="mt-2 relative h-20 rounded-lg overflow-hidden border-2 border-orange-400">
                  <img src={theme.bgImage} alt="Fundo personalizado" className="h-full w-full object-cover" />
                  <button
                    onClick={() => set('bgImage', '')}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80">
                    <X size={11} />
                  </button>
                </div>
              )}
              {uploadError && <p className="mt-1 text-xs text-red-500">{uploadError}</p>}
              <p className="mt-1 text-[10px] text-slate-400">JPG, PNG, GIF, WebP — máx. 5 MB</p>
            </div>
          </div>

          <button onClick={() => { onChange(DEFAULT_THEME); saveTheme(DEFAULT_THEME); }} className="w-full h-9 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
            Restaurar padrão
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── UserProfileModal ───────────────────────────────────────────────────── */
function UserProfileModal({ profileUser, conversations, onClose, onChat }: {
  profileUser: User;
  conversations: ChatConversation[];
  onClose: () => void;
  onChat: (u: User) => void;
}) {
  const [medias, setMedias] = useState<string[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const directConv = useMemo(() =>
    conversations.find(c =>
      c.type === 'direct' && (
        c.other_participant?.id === profileUser.id ||
        c.other_participant?.name === profileUser.name ||
        c.name === profileUser.name
      )
    ),
    [conversations, profileUser.id, profileUser.name]
  );

  useEffect(() => {
    if (!directConv) return;
    getMessages(directConv.id).then(({ messages: msgs }) => {
      setMedias(
        msgs
          .filter(m => m.content?.startsWith('[IMAGE]'))
          .map(m => m.content.slice(7))
          .slice(-9)
          .reverse()
      );
    }).catch(() => {});
  }, [directConv?.id]);

  // Rendered via portal to escape any overflow:hidden ancestor
  const modal = (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50"
      style={{ backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-[480px] max-w-[92vw] rounded-2xl bg-white shadow-2xl overflow-hidden"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cover */}
        <div
          className="relative h-36 flex-shrink-0"
          style={{
            background: profileUser.cover_url
              ? `url(${profileUser.cover_url}) center/cover`
              : 'linear-gradient(135deg, #0057b8, #003d8f)',
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition-colors"
          >
            <X size={14} />
          </button>
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
            <div className="relative">
              <img
                src={profileUser.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileUser.name)}&size=96&background=ff7a00&color=fff`}
                alt={profileUser.name}
                className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-lg"
                onError={e => { (e.currentTarget).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profileUser.name)}&size=96&background=ff7a00&color=fff`; }}
              />
              <span className={cn('absolute bottom-1 right-1 h-5 w-5 rounded-full border-2 border-white', profileUser.online ? 'bg-emerald-500' : 'bg-slate-300')} />
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="pt-14 pb-4 px-6 text-center">
          <h3 className="text-xl font-bold text-slate-900">{profileUser.name}</h3>
          {profileUser.position && (
            <p className="text-sm font-semibold mt-0.5" style={{ color: '#0057b8' }}>{profileUser.position}</p>
          )}
          {profileUser.department_name && (
            <p className="text-xs text-slate-500 mt-0.5">{profileUser.department_name}</p>
          )}
          <p className={cn('text-xs mt-1 font-medium', profileUser.online ? 'text-emerald-600' : 'text-slate-400')}>
            {profileUser.online ? '● Online agora' : presenceLabel(profileUser)}
          </p>
        </div>

        {/* Details */}
        <div className="border-t border-slate-100 px-6 py-4 space-y-3">
          {profileUser.bio && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Bio</p>
              <p className="text-sm text-slate-700 leading-5">{profileUser.bio}</p>
            </div>
          )}
          {profileUser.email && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-16">E-mail</span>
              <span className="truncate">{profileUser.email}</span>
            </div>
          )}
          {profileUser.phone && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-16">Telefone</span>
              <span>{profileUser.phone}</span>
            </div>
          )}
        </div>

        {/* Action */}
        <div className="px-6 pb-4">
          <button
            onClick={() => { onChat(profileUser); onClose(); }}
            className="w-full h-11 rounded-xl bg-orange-500 text-sm font-semibold text-white hover:bg-orange-600 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <MessageCircle size={16} />
            Enviar mensagem
          </button>
        </div>

        {/* Media */}
        {medias.length > 0 && (
          <div className="border-t border-slate-100 px-6 pb-5">
            <p className="text-xs font-bold text-slate-600 py-3 flex items-center gap-1.5">
              <Image size={13} />
              Mídias compartilhadas ({medias.length})
            </p>
            <div className="grid grid-cols-4 gap-2">
              {medias.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setLightboxSrc(src)}
                  className="aspect-square overflow-hidden rounded-lg bg-slate-100 hover:opacity-80 transition-opacity"
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
        {directConv && medias.length === 0 && (
          <div className="border-t border-slate-100 px-6 pb-5 pt-3">
            <p className="text-xs text-slate-400 text-center">Nenhuma imagem compartilhada ainda.</p>
          </div>
        )}
      </div>

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center bg-black/90"
          onClick={() => setLightboxSrc(null)}
        >
          <img
            src={lightboxSrc}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>
      )}
    </div>
  );

  return createPortal(modal, document.body);
}

/* ── Main Chat ──────────────────────────────────────────────────────────── */
export function Chat() {
  const { user } = useAuth();

  const [callState, setCallStateLocal] = useState<CallState>(() => callStore.getState());
  useEffect(() => callStore.subscribe(setCallStateLocal), []);

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [messageText, setMessageText] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionParticipants, setMentionParticipants] = useState<import('../lib/chatApi').GroupParticipant[]>([]);
  const [conversationSearch, setConversationSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [showMsgSearch, setShowMsgSearch] = useState(false);

  // Group creation
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupPhoto, setGroupPhoto] = useState<File | null>(null);
  const [groupPhotoPreview, setGroupPhotoPreview] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const groupPhotoRef = useRef<HTMLInputElement>(null);

  // Notifications
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [browserNotifications, setBrowserNotifications] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  );
  const [toast, setToast] = useState<IncomingToast | null>(null);

  // Panels
  const [showEmoji, setShowEmoji] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showTheme, setShowTheme] = useState(false);

  // Mobile navigation (list ↔ messages)
  const [mobileView, setMobileView] = useState<'list' | 'messages'>('list');
  const [mobileUsersOpen, setMobileUsersOpen] = useState(false);

  // Theme — loaded from localStorage for immediate display, synced from API on mount
  const [theme, setTheme] = useState<ChatTheme>(loadTheme);
  const [darkMode, setDarkMode] = useState(() => user?.dark_mode ?? (localStorage.getItem('chat_dark_mode') === '1'));

  useEffect(() => {
    apiGet<{ data: ChatTheme | null }>('/users/me/chat-theme').then(res => {
      if (res.data) {
        const merged = { ...DEFAULT_THEME, ...res.data };
        setTheme(merged);
        localStorage.setItem('chat_theme', JSON.stringify(merged));
      }
    }).catch(() => {});
  }, []);
  function toggleDark() {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('chat_dark_mode', next ? '1' : '0');
    apiPatch('/users/me/dark-mode', { dark_mode: next }).catch(() => {});
  }

  // User profile modal
  const [profileUser, setProfileUser] = useState<User | null>(null);

  // Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  // File attachment preview
  const [pendingFile, setPendingFile] = useState<{ src: string; type: 'image' | 'video' | 'document'; raw: File } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editing
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState('');

  // Lightbox
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Reply, caption, notes
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [pendingCaption, setPendingCaption] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [notesContent, setNotesContent] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  const selectedConversation = conversations.find(c => c.id === selectedId);

  const usersById = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach(u => map.set(u.id, u));
    return map;
  }, [users]);

  const [rankByUserId, setRankByUserId] = useState<Map<string, RankingEntry>>(new Map());
  useEffect(() => {
    getRanking().then(data => {
      const map = new Map<string, RankingEntry>();
      data.ranking.forEach(r => map.set(r.id, r));
      setRankByUserId(map);
    }).catch(() => {});
  }, []);

  const loadConversations = useCallback(async () => {
    const next = await getConversations();
    setConversations(next);
    if (!selectedId && next[0]) setSelectedId(next[0].id);
    return next;
  }, [selectedId]);

  const loadMessages = useCallback(async (conversationId: string, notify = false) => {
    const { messages: next, hasMore } = await getMessages(conversationId);
    const previousIds = knownMessageIdsRef.current;
    const incoming = next.filter(m => !previousIds.has(m.id) && m.sender_id !== user?.id);
    knownMessageIdsRef.current = new Set(next.map(m => m.id));
    setMessages(next);
    setHasMoreMessages(hasMore);
    const convIsMuted = conversationId ? mutedConvIds.has(conversationId) : false;
    if (notify && incoming.length && !firstLoadRef.current && !convIsMuted) {
      const last = incoming[incoming.length - 1];
      const title = last.sender?.name || selectedConversation?.name || 'Nova mensagem';
      if (soundEnabled) playNotificationSound();
      const body = last.content?.startsWith('[AUDIO_MSG]') ? '🎤 Áudio'
        : last.content?.startsWith('[STICKER]') ? '🎭 Figurinha'
        : last.content?.startsWith('[IMAGE]') ? '📷 Foto'
        : last.content?.startsWith('[VIDEO]') ? '🎬 Vídeo'
        : last.content ?? '';
      setToast({ id: last.id, title, body, conversationId });
      setTimeout(() => setToast(cur => cur?.id === last.id ? null : cur), 6000);
      if (browserNotifications && document.hidden) new Notification(title, { body: body.slice(0, 80) });
    }
    firstLoadRef.current = false;
  }, [browserNotifications, selectedConversation?.name, soundEnabled, user?.id]);

  const loadOlderMessages = useCallback(async () => {
    if (!selectedId || loadingOlder || !hasMoreMessages) return;
    const oldest = messages[0];
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const { messages: older, hasMore } = await getMessages(selectedId, oldest.id);
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const fresh = older.filter(m => !existingIds.has(m.id));
        return [...fresh, ...prev];
      });
      setHasMoreMessages(hasMore);
    } finally {
      setLoadingOlder(false);
    }
  }, [selectedId, loadingOlder, hasMoreMessages, messages]);

  useEffect(() => {
    loadConversations();
    getUsers().then(setUsers).catch(() => {});
    const iv = setInterval(() => getUsers().then(setUsers).catch(() => {}), 30000);
    return () => clearInterval(iv);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) return;
    firstLoadRef.current = true;
    knownMessageIdsRef.current = new Set();
    setHasMoreMessages(false);
    loadMessages(selectedId, false);
    markConversationRead(selectedId).catch(() => {});
    const iv = setInterval(() => { loadMessages(selectedId, true); loadConversations(); }, 3500);
    return () => clearInterval(iv);
  }, [loadConversations, loadMessages, selectedId]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
        mediaRecorderRef.current = null;
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const isNearBottomRef = useRef(true);
  useEffect(() => {
    const c = messagesContainerRef.current;
    if (!c) return;
    function onScroll() {
      isNearBottomRef.current = c.scrollHeight - c.scrollTop - c.clientHeight < 150;
    }
    c.addEventListener('scroll', onScroll, { passive: true });
    return () => c.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const c = messagesContainerRef.current;
    if (!c) return;
    if (isNearBottomRef.current) c.scrollTop = c.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    const c = messagesContainerRef.current;
    if (c) { c.scrollTop = c.scrollHeight; isNearBottomRef.current = true; }
  }, [selectedId]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-emoji-panel]') && !t.closest('[data-emoji-btn]')) setShowEmoji(false);
      if (!t.closest('[data-sticker-panel]') && !t.closest('[data-sticker-btn]')) setShowStickers(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  async function requestBrowserNotifications() {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setBrowserNotifications(result === 'granted');
  }

  async function sendText(text: string) {
    if (!selectedId || !text.trim()) return;
    await sendChatMessage(selectedId, text.trim().slice(0, 8000), replyingTo?.id);
    setReplyingTo(null);
    await Promise.all([loadMessages(selectedId), loadConversations()]);
  }

  async function handleSend(e?: FormEvent) {
    e?.preventDefault();
    if (pendingFile) {
      if (!selectedId) return;
      const prefix = pendingFile.type === 'image' ? '[IMAGE]' : pendingFile.type === 'video' ? '[VIDEO]' : `[DOC|${pendingFile.raw.name}]`;
      try {
        const url = await uploadChatMedia(pendingFile.raw);
        await sendChatMessage(selectedId, `${prefix}${url}${pendingCaption ? '\n' + pendingCaption : ''}`, replyingTo?.id);
        setPendingCaption('');
        setReplyingTo(null);
      } catch {
        alert('Erro ao enviar arquivo. Tente novamente.');
      }
      await Promise.all([loadMessages(selectedId), loadConversations()]);
      setPendingFile(null);
      return;
    }
    await sendText(messageText);
    setMessageText('');
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : 'document';
    const src = type !== 'document' ? URL.createObjectURL(file) : '';
    setPendingFile({ src, type, raw: file });
    e.target.value = '';
  }

  function handlePaste(e: React.ClipboardEvent) {
    if (!selectedId) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const named = new File([file], `paste-${Date.now()}.png`, { type: file.type });
        setPendingFile({ src: URL.createObjectURL(named), type: 'image', raw: named });
        break;
      }
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
        .find(t => MediaRecorder.isTypeSupported(t)) || '';
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (!selectedId) return;
        const actualMime = (mr.mimeType || 'audio/webm').split(';')[0];
        const ext = actualMime.includes('ogg') ? 'ogg' : actualMime.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(audioChunksRef.current, { type: actualMime });
        try {
          const file = new File([blob], `audio.${ext}`, { type: actualMime });
          const url = await uploadChatMedia(file);
          await sendChatMessage(selectedId, `[AUDIO_MSG]${url}`);
          await Promise.all([loadMessages(selectedId), loadConversations()]);
        } catch { alert('Erro ao enviar áudio. Tente novamente.'); }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true); setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch { alert('Microfone não disponível ou permissão negada.'); }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    setRecordingSeconds(0);
  }

  function handleGroupPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setGroupPhoto(file); setGroupPhotoPreview(URL.createObjectURL(file));
    e.target.value = '';
  }

  async function handleCreateGroup(e: FormEvent) {
    e.preventDefault();
    if (!groupName.trim()) return;
    const conversation = await createConversation({ name: groupName.trim(), type: 'group', participant_ids: selectedUsers });
    if (groupPhoto) { try { await uploadConversationAvatar(conversation.id, groupPhoto); } catch {} }
    setGroupName(''); setSelectedUsers([]); setGroupPhoto(null); setGroupPhotoPreview(''); setNewGroupOpen(false);
    await loadConversations();
    setSelectedId(conversation.id);
  }

  function openProfileFromConv(conv: ChatConversation) {
    if (conv.type !== 'direct' || !conv.other_participant) return;
    const found = users.find(u => u.id === conv.other_participant!.id || u.name === conv.other_participant!.name);
    if (found) { setProfileUser(found); return; }
    // Fallback: build minimal User from other_participant data
    const op = conv.other_participant;
    setProfileUser({
      id: op.id, name: op.name, email: '',
      photo_url: op.photo_url, online: op.online,
      status: 'active', created_at: '', updated_at: '',
    } as User);
  }

  async function openDirectChat(targetUser: User) {
    if (targetUser.id === user?.id) return;
    const conv = await createConversation({ type: 'direct', participant_ids: [targetUser.id] });
    await loadConversations();
    setSelectedId(conv.id);
  }

  function handleConvUpdate(updated: ChatConversation) {
    setConversations(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
  }

  async function handleToggleMute(convId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const isMuted = await toggleMuteConversation(convId);
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, is_muted: isMuted } : c));
  }

  async function handleEditSave() {
    if (!editingMsg || !selectedId || !editText.trim()) return;
    try {
      const updated = await editChatMessage(selectedId, editingMsg.id, editText.trim());
      setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, content: updated.content, edited_at: updated.edited_at } : m));
    } catch {}
    setEditingMsg(null); setEditText('');
  }

  async function handleDeleteMessage(msg: ChatMessage) {
    if (!selectedId) return;
    if (!confirm('Excluir esta mensagem? Esta ação não pode ser desfeita.')) return;
    try { await deleteChatMessage(selectedId, msg.id); setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_deleted: true, content: 'Mensagem apagada' } : m)); } catch {}
  }

  async function handlePinMessage(msg: ChatMessage) {
    if (!selectedId || !selectedConversation) return;
    const isPinned = selectedConversation.pinned_message?.id === msg.id;
    try {
      const updated = await pinChatMessage(selectedId, isPinned ? null : msg.id);
      if (updated) setConversations(prev => prev.map(c => c.id === selectedId ? { ...c, pinned_message: updated.pinned_message } : c));
    } catch {}
  }

  async function handlePinConversation(convId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await pinChatConversation(convId);
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, is_pinned: !c.is_pinned } : c));
    } catch {}
  }

  async function handleOpenNotes() {
    if (!selectedId) return;
    if (!showNotes) { try { const n = await getNotes(selectedId); setNotesContent(n?.content ?? ''); } catch {} }
    setShowNotes(v => !v);
  }

  async function handleSaveNotes() {
    if (!selectedId || notesSaving) return;
    setNotesSaving(true);
    try { await saveNotes(selectedId, notesContent); } catch {} finally { setNotesSaving(false); }
  }

  // Muted conversation ids
  const mutedConvIds = useMemo(() => new Set(conversations.filter(c => c.is_muted).map(c => c.id)), [conversations]);

  // Unread counts by user ID (for right panel badges)
  const unreadByUserId = useMemo(() => {
    const map = new Map<string, number>();
    conversations.forEach(c => {
      if (c.type === 'direct' && c.other_participant && c.unread_count > 0) {
        map.set(c.other_participant.id, c.unread_count);
      }
    });
    return map;
  }, [conversations]);

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    const q = conversationSearch.trim().toLowerCase();
    const base = !q ? conversations : conversations.filter(c => c.name?.toLowerCase().includes(q) || c.last_message?.content.toLowerCase().includes(q));
    return [...base].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));
  }, [conversations, conversationSearch]);

  // Filtered messages (search)
  const displayedMessages = useMemo(() => {
    if (!messageSearch.trim()) return messages;
    const q = messageSearch.toLowerCase();
    return messages.filter(m => m.content.toLowerCase().includes(q));
  }, [messages, messageSearch]);

  // Right panel users split
  const { onlineUsers, offlineUsers } = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const all = users.filter(u => u.id !== user?.id).filter(u => !q || u.name.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
    return { onlineUsers: all.filter(u => u.online), offlineUsers: all.filter(u => !u.online) };
  }, [users, user?.id, userSearch]);

  const canSend = !selectedConversation?.broadcast_mode || ['owner', 'admin'].includes(selectedConversation?.my_role || '');

  return (
    <div
      className={cn('chat-shell flex overflow-hidden z-10 fixed left-0 right-0 top-14 bottom-20 lg:relative lg:inset-auto lg:-mx-6 lg:-my-6 lg:rounded-2xl lg:border-2 lg:border-slate-200/70 lg:shadow-2xl', darkMode ? 'bg-[#111b21] chat-dark' : 'bg-slate-50')}
      style={{ minHeight: 480 }}
    >
      {/* Lightbox */}
      {lightboxSrc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
          onClick={() => setLightboxSrc(null)}>
          <button onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 z-10">
            <X size={20} />
          </button>
          <img src={lightboxSrc} alt="foto"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Toast */}
      {toast && (
        <button onClick={() => { setSelectedId(toast.conversationId); setToast(null); }}
          className="fixed bottom-5 right-5 z-[80] w-80 rounded-xl border border-orange-200 bg-white p-4 text-left shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-600"><MessageCircle size={18} /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">{toast.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{toast.body}</p>
            </div>
            <button onClick={e => { e.stopPropagation(); setToast(null); }} className="flex-shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600 transition-colors"><X size={15} /></button>
          </div>
        </button>
      )}

      {/* ── Left: Conversations ── */}
      <aside className={cn(
        cn('overflow-hidden border-r flex flex-col flex-shrink-0', darkMode ? 'bg-[#111b21] border-[#2a3942]' : 'bg-slate-50 border-slate-200'),
        'w-full md:w-[260px]',
        mobileView === 'messages' ? 'hidden md:flex' : 'flex'
      )}>
        <div className="border-b border-slate-100 p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={cn("text-lg font-bold", darkMode ? "text-[#e9edef]" : "text-slate-900")}>Bate-papo</h1>
              <p className={cn("text-xs", darkMode ? "text-[#8696a0]" : "text-slate-600")}>Mensagens, diretas e grupos</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={toggleDark} className={cn('h-9 w-9 rounded-lg flex items-center justify-center transition-colors', darkMode ? 'bg-slate-700 text-yellow-300 hover:bg-slate-600' : 'text-slate-500 hover:bg-slate-100')} title={darkMode ? 'Modo claro' : 'Modo noturno'}>
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button onClick={() => setShowTheme(v => !v)} className={cn('h-9 w-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100', showTheme && 'bg-orange-50 text-orange-600')} title="Personalizar"><Palette size={16} /></button>
              <button onClick={() => setNewGroupOpen(v => !v)} className="h-9 w-9 rounded-lg bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600" title="Criar grupo"><Plus size={17} /></button>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => setSoundEnabled(v => !v)}
              className={cn('flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold', soundEnabled ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-600')}>
              {soundEnabled ? <Bell size={13} /> : <BellOff size={13} />} Som
            </button>
            <button onClick={requestBrowserNotifications}
              className={cn('flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold', browserNotifications ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600')}>
              <Check size={13} /> Notif.
            </button>
          </div>
          <div className="relative mt-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={conversationSearch} onChange={e => setConversationSearch(e.target.value)} placeholder="Buscar conversas..." className={cn("h-9 w-full rounded-lg border pl-9 pr-3 text-sm outline-none focus:border-orange-400", darkMode ? "bg-[#2a3942] border-[#3b4a54] text-[#e9edef] placeholder:text-[#8696a0]" : "border-slate-200 bg-white")} />
          </div>
        </div>

        {/* New group form */}
        {newGroupOpen && (
          <form onSubmit={handleCreateGroup} className="border-b border-slate-100 bg-orange-50/50 p-4 flex-shrink-0 space-y-3">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => groupPhotoRef.current?.click()} className="relative h-12 w-12 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 hover:opacity-80">
                {groupPhotoPreview ? <img src={groupPhotoPreview} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-slate-500"><Camera size={18} /></div>}
              </button>
              <input ref={groupPhotoRef} type="file" accept="image/*" className="hidden" onChange={handleGroupPhoto} />
              <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Nome do grupo" className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-400" />
            </div>
            <p className="text-xs text-slate-600">{selectedUsers.length} participante(s) selecionado(s)</p>
            <button disabled={!groupName.trim()} className="h-9 w-full rounded-lg bg-orange-500 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">Criar grupo</button>
          </form>
        )}

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length ? filteredConversations.map(conv => (
            <div key={conv.id} className={cn('group w-full border-b flex items-center gap-3 transition-colors', darkMode ? 'border-[#2a3942] hover:bg-[#1f2c34]' : 'border-slate-50 hover:bg-slate-50', selectedId === conv.id && (darkMode ? 'bg-[#2a3942]' : 'bg-orange-50'))}>
              {/* Avatar: click → profile (direct) or select (group) */}
              <button
                onClick={() => {
                  if (conv.type === 'direct') openProfileFromConv(conv);
                  else { setSelectedId(conv.id); setMobileView('messages'); }
                }}
                className="pl-4 py-3 flex-shrink-0 hover:opacity-80 transition-opacity"
                title={conv.type === 'direct' ? 'Ver perfil' : undefined}
              >
                <ConvAvatar conv={conv} usersById={usersById} />
              </button>
              {/* Body: click → select conversation */}
              <button onClick={() => { setSelectedId(conv.id); setMobileView('messages'); setMentionQuery(null); setMentionParticipants([]); }} className="min-w-0 flex-1 text-left pr-2 py-3">
                <div className="flex items-center gap-1.5">
                  <p className={cn("truncate text-[15px] font-bold", darkMode ? "text-[#e9edef]" : "text-slate-800")}>{conv.name || 'Conversa direta'}</p>
                  {conv.is_pinned && <Pin size={10} className="text-orange-400 flex-shrink-0" />}
                  {conv.unread_count > 0 && !conv.is_muted && <span className="flex-shrink-0 min-w-[20px] text-center rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white leading-tight">{conv.unread_count}</span>}
                  {conv.is_muted && <BellOff size={11} className="text-slate-400 flex-shrink-0" />}
                </div>
                {conv.type === 'direct' ? (
                  <p className={cn('truncate text-xs font-medium', conv.other_participant?.online ? 'text-emerald-600' : 'text-slate-500')}>
                    {convPresenceLabel(conv)}
                  </p>
                ) : (
                  <p className="truncate text-xs text-slate-600">
                    {conv.last_message?.content?.startsWith('[AUDIO_MSG]') ? '🎤 Áudio'
                      : conv.last_message?.content?.startsWith('[STICKER]') ? '🎭 Figurinha'
                      : conv.last_message?.content?.startsWith('[IMAGE]') ? '📷 Foto'
                      : conv.last_message?.content?.startsWith('[VIDEO]') ? '🎬 Vídeo'
                      : conv.last_message?.content || `${conv.participant_count} participante(s)`}
                  </p>
                )}
              </button>
              <button
                onClick={e => handlePinConversation(conv.id, e)}
                title={conv.is_pinned ? 'Desafixar conversa' : 'Fixar conversa'}
                className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Pin size={14} className={conv.is_pinned ? 'text-orange-500' : ''} />
              </button>
              <button
                onClick={e => handleToggleMute(conv.id, e)}
                title={conv.is_muted ? 'Reativar notificações' : 'Silenciar'}
                className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-orange-500 mr-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {conv.is_muted ? <Bell size={14} /> : <BellOff size={14} />}
              </button>
            </div>
          )) : (
            <div className={cn("p-8 text-center text-sm", darkMode ? "text-[#8696a0]" : "text-slate-600")}>Nenhuma conversa criada.</div>
          )}
        </div>
      </aside>

      {/* ── Center: Messages ── */}
      <main className={cn(
        cn('min-w-0 overflow-hidden flex-col flex-1 lg:rounded-r-2xl', darkMode ? 'bg-[#0d1418]' : 'bg-white'),
        mobileView === 'list' ? 'hidden md:flex' : 'flex'
      )}>
        {selectedConversation ? (
          <>
            {/* Header */}
            <div className={cn("flex items-center gap-2 border-b px-3 md:px-5 py-3 flex-shrink-0", darkMode ? "border-[#2a3942] bg-[#202c33]" : "border-slate-100 bg-white")}>
              <button className="md:hidden h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 flex-shrink-0"
                onClick={() => setMobileView('list')}>
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => openProfileFromConv(selectedConversation)}
                className={cn('flex-shrink-0', selectedConversation.type === 'direct' ? 'hover:opacity-80 transition-opacity cursor-pointer' : 'cursor-default')}
                title={selectedConversation.type === 'direct' ? 'Ver perfil' : undefined}
              >
                <ConvAvatar conv={selectedConversation} usersById={usersById} />
              </button>
              <div className="min-w-0 flex-1">
                <button
                  onClick={() => openProfileFromConv(selectedConversation)}
                  className={cn('truncate text-base font-bold block w-full text-left', darkMode ? 'text-[#e9edef]' : 'text-slate-900', selectedConversation.type === 'direct' && 'hover:text-[#0057b8] transition-colors')}
                  disabled={selectedConversation.type !== 'direct'}
                >
                  {selectedConversation.name || 'Conversa direta'}
                </button>
                {selectedConversation.type === 'group' ? (
                  <p className="text-xs text-slate-600">
                    {selectedConversation.participant_count} participante(s){selectedConversation.broadcast_mode && ' · 📢 Informativo'}
                  </p>
                ) : (
                  <p className={cn('text-xs font-medium', selectedConversation.other_participant?.online ? 'text-emerald-600' : 'text-slate-500')}>
                    {convPresenceLabel(selectedConversation) || 'Conversa direta'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {selectedConversation.type === 'direct' && selectedConversation.other_participant && (
                  <>
                    <button
                      onClick={() => {
                        const p = selectedConversation.other_participant!;
                        callStore.startCall({ id: p.id, name: p.name || selectedConversation.name || 'Contato', photo_url: p.photo_url }, 'audio');
                      }}
                      disabled={callState !== 'idle'}
                      title="Ligação de voz"
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Phone size={15} />
                    </button>
                    <button
                      onClick={() => {
                        const p = selectedConversation.other_participant!;
                        callStore.startCall({ id: p.id, name: p.name || selectedConversation.name || 'Contato', photo_url: p.photo_url }, 'video');
                      }}
                      disabled={callState !== 'idle'}
                      title="Chamada de vídeo"
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Video size={15} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setMobileUsersOpen(v => !v)}
                  title="Usuários"
                  className={cn('md:hidden h-8 w-8 flex items-center justify-center rounded-lg transition-colors', mobileUsersOpen ? 'bg-orange-50 text-orange-600' : 'text-slate-500 hover:bg-slate-100')}
                >
                  <Users size={15} />
                </button>
                <button onClick={() => setShowMsgSearch(v => !v)}
                  className={cn('h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100', showMsgSearch && 'bg-orange-50 text-orange-600')}>
                  <Search size={15} />
                </button>
                <button onClick={handleOpenNotes} title="Anotações"
                  className={cn('h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100', showNotes && 'bg-orange-50 text-orange-600')}>
                  <BookOpen size={15} />
                </button>
                {selectedConversation.type === 'group' && (
                  <button onClick={() => setShowGroupSettings(v => !v)}
                    className={cn('h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100', showGroupSettings && 'bg-orange-100 text-orange-600')}>
                    <Settings size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Message search bar */}
            {showMsgSearch && (
              <div className="border-b border-slate-100 px-4 py-2 bg-slate-50 flex-shrink-0">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input autoFocus value={messageSearch} onChange={e => setMessageSearch(e.target.value)}
                    placeholder="Buscar mensagens..." className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-orange-400" />
                  {messageSearch && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{displayedMessages.length} resultado(s)</span>}
                </div>
              </div>
            )}

            {/* Pinned message */}
            {selectedConversation.pinned_message && (
              <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 flex-shrink-0 flex items-center gap-2">
                <Pin size={13} className="text-amber-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Mensagem fixada</p>
                  <p className="text-xs text-slate-700 truncate">
                    {selectedConversation.pinned_message.content?.startsWith('[IMAGE]') ? '📷 Foto'
                      : selectedConversation.pinned_message.content?.startsWith('[VIDEO]') ? '🎬 Vídeo'
                      : selectedConversation.pinned_message.content?.startsWith('[AUDIO_MSG]') ? '🎤 Áudio'
                      : selectedConversation.pinned_message.content?.slice(0, 80) ?? ''}
                  </p>
                </div>
                <button onClick={() => handlePinMessage({ id: selectedConversation.pinned_message!.id, content: selectedConversation.pinned_message!.content, sender: selectedConversation.pinned_message!.sender as any, conversation_id: selectedId!, created_at: '', updated_at: '' })} className="text-slate-400 hover:text-slate-700 flex-shrink-0"><X size={13} /></button>
              </div>
            )}

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 space-y-3 overflow-y-auto px-8 py-5" onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={e => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file && selectedId) { const type = file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : 'document'; setPendingFile({ src: type !== 'document' ? URL.createObjectURL(file) : '', type, raw: file }); } }} style={{
              background: theme.bgImage
                ? `url(${theme.bgImage}) center/cover`
                : (darkMode && theme.bgColor === DEFAULT_THEME.bgColor ? '#0d1418' : theme.bgColor),
            }}>
              {hasMoreMessages && (
                <div className="flex justify-center pt-1 pb-2">
                  <button
                    onClick={loadOlderMessages}
                    disabled={loadingOlder}
                    className="text-xs text-slate-500 hover:text-slate-700 bg-white/80 hover:bg-white border border-slate-200 rounded-full px-4 py-1.5 shadow-sm transition-all disabled:opacity-50"
                  >
                    {loadingOlder ? 'Carregando...' : 'Carregar mensagens anteriores'}
                  </button>
                </div>
              )}
              {displayedMessages.length ? displayedMessages.map(message => {
                const mine = message.sender_id === user?.id;
                const lastReadAt = selectedConversation?.other_participant?.last_read_at;
                return (
                  <div key={message.id} className={cn('flex gap-2', mine && 'justify-end')}>
                    {!mine && (
                      <button
                        onClick={() => {
                          const sender = users.find(u => u.id === message.sender_id);
                          if (sender) { setProfileUser(sender); return; }
                          if (message.sender) {
                            const s = message.sender;
                            setProfileUser({ id: s.id ?? message.sender_id, name: s.name, email: '', photo_url: s.photo_url, online: false, status: 'active', created_at: '', updated_at: '' } as User);
                          }
                        }}
                        className="flex-shrink-0 hover:opacity-80 transition-opacity"
                        title={rankByUserId.get(message.sender_id ?? '')?.rank?.name}
                      >
                        {(() => {
                          const senderId = message.sender_id ?? '';
                          const rankEntry = rankByUserId.get(senderId);
                          const rankColor = rankEntry?.rank?.color;
                          const avatarSrc = (message.sender_id ? usersById.get(message.sender_id)?.photo_url : undefined) || message.sender?.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(message.sender?.name || 'N')}&size=36&background=0057b8&color=fff`;
                          return rankColor ? (
                            <div className="relative">
                              <div className="rounded-full p-0.5" style={{ background: `linear-gradient(135deg, ${rankColor}, ${rankColor}77)` }}>
                                <img src={avatarSrc} alt={message.sender?.name || ''} className="h-8 w-8 rounded-full object-cover ring-1 ring-white" />
                              </div>
                              <span className="absolute -bottom-0.5 -right-0.5 text-[10px] leading-none">{rankEntry?.rank?.emoji}</span>
                            </div>
                          ) : (
                            <img src={avatarSrc} alt={message.sender?.name || ''} className="h-9 w-9 rounded-full object-cover" />
                          );
                        })()}
                      </button>
                    )}
                    <MessageBubble
                      message={message} mine={mine} lastReadAt={lastReadAt} theme={theme} darkMode={darkMode}
                      isGroup={selectedConversation?.type === 'group'}
                      onImageClick={setLightboxSrc}
                      onEdit={mine ? (msg) => { setEditingMsg(msg); setEditText(msg.content); } : undefined}
                      onDelete={mine ? handleDeleteMessage : undefined}
                      onReply={setReplyingTo}
                      onPin={handlePinMessage}
                      isPinned={selectedConversation?.pinned_message?.id === message.id}
                    />
                  </div>
                );
              }) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-600 bg-white/60 rounded-xl p-4">
                  {messageSearch ? 'Nenhuma mensagem encontrada.' : 'Nenhuma mensagem ainda.'}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply bar */}
            {replyingTo && (
              <div className="border-t border-blue-100 bg-blue-50 px-4 py-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Reply size={13} className="text-blue-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-blue-700">{replyingTo.sender?.name || 'Você'}</p>
                    <p className="text-xs text-slate-600 truncate">
                      {replyingTo.content?.startsWith('[IMAGE]') ? '📷 Foto'
                        : replyingTo.content?.startsWith('[VIDEO]') ? '🎬 Vídeo'
                        : replyingTo.content?.startsWith('[AUDIO_MSG]') ? '🎤 Áudio'
                        : replyingTo.content?.slice(0, 80) ?? ''}
                    </p>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-slate-700"><X size={14} /></button>
                </div>
              </div>
            )}

            {/* Edit message bar */}
            {editingMsg && (
              <div className="border-t border-orange-200 bg-orange-50 px-4 py-2 flex-shrink-0">
                <div className="flex items-center gap-2 mb-1">
                  <Pencil size={13} className="text-orange-500" />
                  <p className="text-xs font-semibold text-orange-700">Editando mensagem</p>
                  <button onClick={() => { setEditingMsg(null); setEditText(''); }} className="ml-auto text-orange-400 hover:text-orange-700"><X size={14} /></button>
                </div>
                <div className="flex gap-2">
                  <input value={editText} onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleEditSave(); if (e.key === 'Escape') { setEditingMsg(null); setEditText(''); } }}
                    autoFocus className="flex-1 h-9 rounded-lg border border-orange-200 bg-white px-3 text-sm outline-none focus:border-orange-400" />
                  <button onClick={handleEditSave} disabled={!editText.trim()} className="h-9 px-4 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-40">Salvar</button>
                </div>
              </div>
            )}

            {/* File preview */}
            {pendingFile && (
              <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 flex-shrink-0 flex items-center gap-3">
                {pendingFile.type === 'image'
                  ? <img src={pendingFile.src} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  : pendingFile.type === 'video'
                    ? <video src={pendingFile.src} className="h-16 w-16 rounded-lg object-cover" />
                    : <div className="h-16 w-16 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center"><FileText size={28} className="text-orange-400" /></div>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">{pendingFile.raw.name}</p>
                  <p className="text-xs text-slate-500">{(pendingFile.raw.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <input value={pendingCaption} onChange={e => setPendingCaption(e.target.value)} placeholder="Adicionar legenda..." className="h-8 flex-1 min-w-0 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-400" />
                <button onClick={() => { setPendingFile(null); setPendingCaption(''); }} className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200"><X size={14} /></button>
                <button onClick={() => handleSend()} className="h-9 px-4 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 flex-shrink-0">Enviar</button>
              </div>
            )}

            {/* Broadcast notice */}
            {!canSend && (
              <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 flex-shrink-0 flex items-center gap-2 text-sm text-slate-500">
                <Shield size={15} className="text-slate-400" />
                Apenas administradores podem enviar mensagens neste grupo.
              </div>
            )}

            {/* Input bar */}
            {canSend && !pendingFile && (
              <div className="chat-input-bar border-t border-slate-100 bg-white p-3 flex-shrink-0">
                {isRecording && (
                  <div className="mb-2 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm font-semibold text-red-700">Gravando... {recordingSeconds}s</span>
                    <button onClick={stopRecording} className="ml-auto h-8 px-3 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600">Enviar</button>
                    <button onClick={() => { mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop()); mediaRecorderRef.current = null; setIsRecording(false); if (recordingTimerRef.current) clearInterval(recordingTimerRef.current); }} className="h-8 px-3 rounded-lg border border-red-200 text-red-600 text-xs font-bold">Cancelar</button>
                  </div>
                )}
                <form onSubmit={handleSend} className="relative flex items-center gap-2">
                  {/* Emoji */}
                  <div className="relative">
                    <button type="button" data-emoji-btn onClick={() => { setShowEmoji(v => !v); setShowStickers(false); }}
                      className="h-10 w-10 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-orange-500" title="Emojis">
                      <Smile size={19} />
                    </button>
                    {showEmoji && (
                      <div data-emoji-panel className="absolute bottom-14 left-0 z-30 w-72 rounded-xl border border-slate-200 bg-white shadow-2xl p-3">
                        <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                          {EMOJIS.map(e => (
                            <button key={e} type="button" onClick={() => { setMessageText(p => p + e); setShowEmoji(false); }}
                              className="h-9 w-9 flex items-center justify-center text-xl rounded-lg hover:bg-slate-100">{e}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stickers */}
                  <div className="relative">
                    <button type="button" data-sticker-btn onClick={() => { setShowStickers(v => !v); setShowEmoji(false); }}
                      className="h-10 w-10 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-orange-500" title="Figurinhas">
                      <Sticker size={19} />
                    </button>
                    {showStickers && (
                      <div data-sticker-panel className="absolute bottom-14 left-0 z-30 w-64 rounded-xl border border-slate-200 bg-white shadow-2xl p-3">
                        <p className="text-xs font-bold text-slate-600 mb-2">Figurinhas</p>
                        <div className="grid grid-cols-4 gap-2">
                          {STICKERS.map(s => (
                            <button key={s.emoji} type="button" onClick={async () => { setShowStickers(false); if (!selectedId) return; await sendChatMessage(selectedId, `[STICKER]${s.emoji}`); await Promise.all([loadMessages(selectedId), loadConversations()]); }}
                              className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-orange-50">
                              <span className="text-3xl">{s.emoji}</span>
                              <span className="text-[9px] text-slate-600 font-medium">{s.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* File attachment */}
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="h-10 w-10 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-orange-500" title="Enviar arquivo">
                    <Paperclip size={19} />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt" className="hidden" onChange={handleFileSelect} />

                  {mentionQuery !== null && mentionParticipants.length > 0 && (
                    <div className="absolute bottom-14 left-12 z-30 w-56 rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Mencionar</p>
                      {mentionParticipants.filter(p => p.name.toLowerCase().includes((mentionQuery || '').toLowerCase())).slice(0, 6).map(p => (
                        <button key={p.id} type="button"
                          onMouseDown={e => {
                            e.preventDefault();
                            setMessageText(prev => {
                              const at = prev.lastIndexOf('@');
                              return at >= 0 ? prev.slice(0, at) + '@' + p.name + ' ' : prev + '@' + p.name + ' ';
                            });
                            setMentionQuery(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-orange-50 text-left">
                          <img src={p.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&size=28&background=ff7a00&color=fff`} alt={p.name} className="h-7 w-7 rounded-full object-cover" />
                          <span className="text-sm font-semibold text-slate-700 truncate">{p.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <input value={messageText} onChange={e => {
                    setMessageText(e.target.value);
                    const val = e.target.value;
                    const atIdx = val.lastIndexOf('@');
                    if (atIdx >= 0 && (atIdx === 0 || val[atIdx - 1] === ' ') && selectedConversation?.type === 'group') {
                      setMentionQuery(val.slice(atIdx + 1));
                      if (mentionParticipants.length === 0) {
                        getGroupParticipants(selectedConversation.id).then(setMentionParticipants).catch(() => {});
                      }
                    } else {
                      setMentionQuery(null);
                    }
                  }} onKeyDown={e => { if (e.key === 'Escape') setMentionQuery(null); handleKey(e); }}
                    onPaste={handlePaste}
                    placeholder="Digite uma mensagem... (Ctrl+V para colar imagem)" disabled={isRecording}
                    className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-400"
                    style={darkMode ? { backgroundColor: '#2a3942', borderColor: '#3b4a54', color: '#e9edef' } : {}} />

                  {/* Audio */}
                  <button type="button" onClick={isRecording ? stopRecording : startRecording}
                    className={cn('h-10 w-10 flex items-center justify-center rounded-lg transition-colors',
                      isRecording ? 'bg-red-500 text-white hover:bg-red-600' : 'text-slate-500 hover:bg-slate-100 hover:text-orange-500')}>
                    {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>

                  {/* Send */}
                  <button type="submit" disabled={!messageText.trim() || isRecording}
                    className="h-10 rounded-lg bg-orange-500 px-4 text-white hover:bg-orange-600 disabled:opacity-40">
                    <Send size={16} />
                  </button>
                </form>
              </div>
            )}
          </>
        ) : (
          <div className="chat-empty-state flex flex-1 flex-col items-center justify-center text-center text-slate-600">
            <MessageCircle size={44} className="mb-3 text-slate-300" />
            <p className="font-semibold">Crie ou selecione uma conversa</p>
            <p className="text-sm text-slate-500">Clique em um usuário para abrir uma conversa direta.</p>
          </div>
        )}
      </main>

      {/* ── Right: Online users panel — overlay on mobile, inline on desktop ── */}
      {mobileUsersOpen && (
        <div
          className="md:hidden absolute inset-0 z-40 bg-black/20"
          onClick={() => setMobileUsersOpen(false)}
        />
      )}
      <aside className={cn(
        'chat-users-drawer flex-col overflow-hidden border-l border-slate-200 bg-slate-50',
        mobileUsersOpen
          ? 'flex absolute inset-y-0 right-0 z-50 w-[260px] shadow-2xl'
          : 'hidden md:flex md:min-w-0 md:w-[220px] md:flex-shrink-0'
      )}>
        <div className="border-b border-slate-100 p-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-orange-500" />
            <h2 className="text-sm font-bold text-slate-900">Usuários</h2>
            <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{onlineUsers.length} online</span>
            <button
              className="md:hidden h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              onClick={() => setMobileUsersOpen(false)}
            >
              <X size={15} />
            </button>
          </div>
          <div className="relative mt-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Buscar para conversar..." className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-orange-400" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Online now */}
          {onlineUsers.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> Online agora
                </p>
              </div>
              {onlineUsers.map(item => {
                const selected = selectedUsers.includes(item.id);
                const unread = unreadByUserId.get(item.id) ?? 0;
                return (
                  <div key={item.id} className={cn('group px-3 py-2.5 border-b border-slate-50 hover:bg-slate-50 flex items-center gap-2.5 transition-colors', selected && 'bg-orange-50')}>
                    <button onClick={() => setProfileUser(item)} className="relative flex-shrink-0 hover:opacity-80 transition-opacity">
                      <img src={item.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&size=40&background=ff7a00&color=fff`} alt={item.name} className="h-10 w-10 rounded-full object-cover" />
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                    </button>
                    <button onClick={() => setProfileUser(item)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-[15px] font-semibold text-slate-800">{item.name}</p>
                        {unread > 0 && <span className="flex-shrink-0 min-w-[18px] text-center rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-tight">{unread}</span>}
                      </div>
                      <p className="truncate text-xs text-emerald-600">Online</p>
                    </button>
                    <button onClick={() => { setNewGroupOpen(true); setSelectedUsers(prev => selected ? prev.filter(id => id !== item.id) : [...prev, item.id]); }}
                      className={cn('flex h-6 w-6 items-center justify-center rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity', selected ? 'bg-orange-100 text-orange-700' : 'border border-slate-200 text-slate-500')}>
                      {selected ? <Check size={12} /> : <Plus size={12} />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Offline / last seen */}
          {offlineUsers.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Visto por último</p>
              </div>
              {offlineUsers.map(item => {
                const selected = selectedUsers.includes(item.id);
                const unread = unreadByUserId.get(item.id) ?? 0;
                return (
                  <div key={item.id} className={cn('group px-3 py-2.5 border-b border-slate-50 hover:bg-slate-50 flex items-center gap-2.5 transition-colors', selected && 'bg-orange-50')}>
                    <button onClick={() => setProfileUser(item)} className="relative flex-shrink-0 hover:opacity-80 transition-opacity">
                      <img src={item.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&size=40&background=ff7a00&color=fff`} alt={item.name} className="h-10 w-10 rounded-full object-cover" />
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-slate-300" />
                    </button>
                    <button onClick={() => setProfileUser(item)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-[15px] font-semibold text-slate-800">{item.name}</p>
                        {unread > 0 && <span className="flex-shrink-0 min-w-[18px] text-center rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-tight">{unread}</span>}
                      </div>
                      <p className="truncate text-xs text-slate-500">{presenceLabel(item)}</p>
                    </button>
                    <button onClick={() => { setNewGroupOpen(true); setSelectedUsers(prev => selected ? prev.filter(id => id !== item.id) : [...prev, item.id]); }}
                      className={cn('flex h-6 w-6 items-center justify-center rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity', selected ? 'bg-orange-100 text-orange-700' : 'border border-slate-200 text-slate-500')}>
                      {selected ? <Check size={12} /> : <Plus size={12} />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Group settings panel */}
      {showGroupSettings && selectedConversation?.type === 'group' && user && (
        <GroupSettings conv={selectedConversation} users={users} myId={user.id} onClose={() => setShowGroupSettings(false)} onUpdate={handleConvUpdate} />
      )}

      {/* Theme panel */}
      {showTheme && <ThemePanel theme={theme} onChange={setTheme} onClose={() => setShowTheme(false)} />}

      {/* Notes panel */}
      {showNotes && selectedConversation && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowNotes(false)} />
          <div className="relative ml-auto h-full w-80 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <BookOpen size={17} className="text-orange-500" />
              <h2 className="text-sm font-bold text-slate-900 flex-1">Anotações — {selectedConversation.name}</h2>
              <button onClick={handleSaveNotes} disabled={notesSaving} className="h-8 px-3 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 disabled:opacity-50">{notesSaving ? '...' : 'Salvar'}</button>
              <button onClick={() => setShowNotes(false)} className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={15} /></button>
            </div>
            <textarea
              value={notesContent}
              onChange={e => setNotesContent(e.target.value)}
              placeholder="Escreva suas anotações sobre esta conversa..."
              className="flex-1 resize-none p-5 text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      )}

      {/* User profile modal */}
      {profileUser && (
        <UserProfileModal
          profileUser={profileUser}
          conversations={conversations}
          onClose={() => setProfileUser(null)}
          onChat={openDirectChat}
        />
      )}
    </div>
  );
}

