import {
  ChangeEvent, CSSProperties, FormEvent, Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { dayKey } from '../../shared/personalWork.mjs';
import { chatScrollAction, mergeChatMessages } from '../../shared/chatTimeline.mjs';
import { createChatRequestGuard } from '../../shared/chatRequestGuard.mjs';
import { JARVIS_CONVERSATION_ID } from '../../shared/chatDrafts.mjs';
import { getChatWorkspace } from '../lib/chatWorkspace';
import { JarvisChatThread } from '../components/JarvisChatThread';
import { scheduleChatNotificationSound } from '../../shared/chatNotificationSound.mjs';
import { buildMentionMatcher, type MentionMatcher } from '../../shared/chatMentions.mjs';
import { wsEventBus } from '../lib/wsEventBus';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import {
  AlarmClock, Archive, Bell, Bot, BellOff, BookOpen, Camera, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronsDown, ChevronUp, Crown, Eye, FileText, History, Image,
  Mic, MicOff, MessageCircle, MoreVertical, Palette, Paperclip, Pencil, Phone, Pin, Play, Plus, Reply, Search, Send,
  CornerUpRight, Settings, Shield, Smile, Sticker, Trash2, Type, UserMinus, UserPlus, Users, Video, X,
} from 'lucide-react';
import {
  addParticipantsToGroup, setConversationArchived, createConversation, deleteChatMessage, editChatMessage, getConversations,
  getGroupParticipants, getMessageHistory, getMessageReaders, getMessages, getNotes, getSelfConversation, markConversationRead,
  pinChatConversation, pinChatMessage, removeParticipantFromGroup, saveNotes, sendChatMessage,
  toggleMuteConversation, updateConversationSettings, updateParticipantRole, uploadChatMedia,
  uploadConversationAvatar,
  type ChatConversation, type ChatMessage, type GroupParticipant, type MessageEdit, type MessageReader,
} from '../lib/chatApi';
import { getUsers } from '../lib/appApi';
import { accessibleInk } from '../../shared/appearance.mjs';
import { useAppearance } from '../lib/appearance';
import { AppearanceDialog } from '../components/AppearanceSettings';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/utils';
import { callStore } from '../lib/callStore';
import type { CallState } from '../hooks/useVoiceCall';
import { AchievementAvatar } from '../components/AchievementAvatar';
import type { User } from '../types';
import { StoriesBar } from '../components/stories/StoriesBar';
import { LinkText } from '../components/LinkText';
import { ChatAttentionDialog } from '../components/ChatAttentionDialog';
import { ChatMessageReactions } from '../components/ChatMessageReactions';
import { getChatReactions,setChatReaction } from '../lib/chatApi';
import { enableDesktopNotifications,syncDesktopNotifications } from '../lib/browserNotifications';
import { getChatMessageContext } from '../lib/chatApi';
import './chat.css';
import './chat-next.css';
import { useDarkMode } from '../lib/useDarkMode';

interface IncomingToast { id: string; title: string; body: string; conversationId: string; }

/* ── Theme ──────────────────────────────────────────────────────────────── */
interface ChatTheme {
  bubbleColor: string;
  bgColor: string;
  bgImage: string;
  textColor: string;
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
function conversationTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  if (dayKey(value) === dayKey(today.toISOString())) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  today.setDate(today.getDate() - 1);
  if (dayKey(value) === dayKey(today.toISOString())) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
function conversationPreview(conv: ChatConversation, myId?: string): string {
  const message = conv.last_message;
  if (!message) return conv.type === 'group' ? `${conv.participant_count} participantes` : convPresenceLabel(conv) || 'Inicie uma conversa';
  const content = message.content || '';
  const preview = content.startsWith('[AUDIO_MSG]') ? '🎤 Áudio'
    : content.startsWith('[STICKER]') ? '🎭 Figurinha'
    : content.startsWith('[IMAGE]') ? '📷 Foto'
    : content.startsWith('[VIDEO]') ? '🎬 Vídeo'
    : content.startsWith('[DOC]') || content.startsWith('[FILE]') ? '📎 Arquivo'
    : content;
  const sender = message.sender?.id === myId ? 'Você' : conv.type === 'group' ? message.sender?.name?.split(' ')[0] : '';
  return `${sender ? `${sender}: ` : ''}${preview}`;
}
let stopCurrentNotificationSound:(()=>void)|null=null;
function stopNotificationSound(){stopCurrentNotificationSound?.();}
function playNotificationSound() {
  if(stopCurrentNotificationSound)return;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  try{
    const ctx = new Ctor();
    stopCurrentNotificationSound=scheduleChatNotificationSound(ctx,()=>{stopCurrentNotificationSound=null;});
    if(ctx.state==='suspended')void ctx.resume().catch(stopNotificationSound);
  }catch{stopNotificationSound();}
}

/* ── ConvAvatar ─────────────────────────────────────────────────────────── */
function ConvAvatar({ conv, usersById }: { conv: ChatConversation; usersById: Map<string, User> }) {
  const { user: currentUser } = useAuth();
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
  const img = <AchievementAvatar userId={conv.other_participant?.id || currentUser?.id} name={name} photo={photoUrl || (conv.other_participant ? undefined : currentUser?.photo_url)} size={44} />;
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
  onForward?: (msg: ChatMessage) => void;
  onReact?: (emoji:string|null)=>Promise<void>;
  onPin?: (msg: ChatMessage) => void;
  onImageClick?: (src: string) => void;
  mentionMatcher?: MentionMatcher;
  onMention?: (userId:string)=>void;
  theme: ChatTheme;
  isPinned?: boolean;
  isSelfConversation?: boolean;
}

function MessageBubble({ message, mine, isGroup, lastReadAt, onEdit, onDelete, onReply, onForward, onReact, onPin, onImageClick, mentionMatcher, onMention, theme, isPinned, isSelfConversation }: MsgBubbleProps) {
  const age = Date.now() - new Date(message.created_at).getTime();
  const canEdit = mine && !!onEdit && (isSelfConversation || age < 30 * 60 * 1000);
  const canDelete = mine && !!onDelete && (isSelfConversation || age < 30 * 60 * 1000);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [history, setHistory] = useState<MessageEdit[]>([]);
  const [readers, setReaders] = useState<MessageReader[] | null>(null);
  const [loadingReaders, setLoadingReaders] = useState(false);
  const historyBtnRef = useRef<HTMLButtonElement | null>(null);
  const [historyBtnRect, setHistoryBtnRect] = useState<DOMRect | null>(null);
  const touchStartX = useRef(0);
  const [swipeDx, setSwipeDx] = useState(0);

  function handleTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; }
  function handleTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - touchStartX.current;
    if (dx < 0 && Math.abs(dx) < 90) setSwipeDx(dx);
  }
  function handleTouchEnd() { if (swipeDx < -50 && onReply) onReply(message); setSwipeDx(0); }

  async function handleViewReaders() {
    if (readers !== null) { setReaders(null); return; }
    setLoadingReaders(true);
    try { const data = await getMessageReaders(message.conversation_id, message.id); setReaders(data); }
    catch {} finally { setLoadingReaders(false); }
  }
  const seen = mine && !!lastReadAt && new Date(lastReadAt) >= new Date(message.created_at);
  const content = message.content ?? '';
  const fwdMatch = content.match(/^\[FWD:(.+?)\]\n/);
  const fwdFrom = fwdMatch ? fwdMatch[1] : null;
  const displayContent = fwdFrom ? content.slice(fwdMatch![0].length) : content;
  const fwdHeader = fwdFrom ? <p className="text-[11px] text-indigo-400 italic mb-1 flex items-center gap-1"><CornerUpRight size={11}/> Encaminhado de {fwdFrom}</p> : null;
  const { palette: appearance } = useAppearance();
  const bubbleBg = mine ? theme.bubbleColor : appearance.chat.incoming;
  const bubbleText = mine ? theme.textColor : appearance.chat.incomingText;
  const bubbleStyle = { background: bubbleBg, color: bubbleText, '--nex-message-link': accessibleInk('#2563eb', bubbleBg) } as React.CSSProperties;

  if (message.is_deleted) {
    return (
      <div className={`relative group max-w-[75%] ${mine ? 'ml-auto' : ''}`}>
        <div className={cn('rounded-2xl px-3 py-2 shadow-sm', mine ? 'rounded-tr-sm' : 'rounded-tl-sm')} style={bubbleStyle}>
          <p className="text-sm italic" style={{ color: bubbleText }}>🚫 Mensagem apagada</p>
          <p className="text-[10px] mt-0.5 text-right" style={{ color: bubbleText }}>{new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>
    );
  }

  async function loadHistory() {
    if (showHistory) { setShowHistory(false); return; }
    setHistoryBtnRect(historyBtnRef.current?.getBoundingClientRect() ?? null);
    try { const h = await getMessageHistory(message.conversation_id, message.id); setHistory(h); }
    catch { setHistory([]); }
    setShowHistory(true);
  }


  const menu = (
    <div className="chat-message-actions">
      {onReply && <button onClick={() => { onReply(message); setShowMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"><Reply size={14} className="text-blue-500" /> Responder</button>}
      {onForward && !message.is_deleted && <button onClick={() => { onForward(message); setShowMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"><CornerUpRight size={14} className="text-indigo-500" /> Encaminhar</button>}
      {canEdit && <button onClick={() => { onEdit!(message); setShowMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"><Pencil size={14} className="text-orange-500" /> Editar</button>}
      {canDelete && <button onClick={() => { onDelete!(message); setShowMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 size={14} /> Excluir</button>}
      {onPin && <button onClick={() => { onPin(message); setShowMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"><Pin size={14} className={isPinned ? 'text-orange-500' : 'text-slate-400'} /> {isPinned ? 'Desafixar' : 'Fixar'}</button>}
    </div>
  );

  const replyPreview = message.reply_to && (
    <div className={`mb-1.5 rounded-lg border-l-2 px-2 py-1.5 ${mine ? 'border-white/40 bg-black/10' : 'border-orange-300 bg-orange-50'}`}>
      <p className="text-[11px] font-bold" style={{ color: bubbleText }}>{message.reply_to.sender?.name || 'Usuário'}</p>
      <p className="text-xs truncate" style={{ color: bubbleText }}>
        {message.reply_to.content?.startsWith('[IMAGE]') ? '📷 Foto'
          : message.reply_to.content?.startsWith('[VIDEO]') ? '🎬 Vídeo'
          : message.reply_to.content?.startsWith('[AUDIO_MSG]') ? '🎤 Áudio'
          : <LinkText text={message.reply_to.content || ''} mentionMatcher={mentionMatcher} onMention={onMention}/>}
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
    <><div className="chat-message-metadata mt-1 flex items-center gap-1 justify-end text-[10px]" style={{ color: bubbleText }}>
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
    </div>{onReact && <ChatMessageReactions reactions={message.reactions || []} mine={mine} onReact={onReact}/>}</>
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
      className="chat-history-popover rounded-xl border border-slate-200 bg-white shadow-xl p-3">
      <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1"><History size={11} /> Histórico de edições</p>
      {history.map((h, i) => (
        <div key={i} className="mb-2 border-l-2 border-slate-200 pl-2">
          <p className="text-[10px] text-slate-400">{fullDateTime(h.edited_at)}</p>
          <p className="text-xs text-slate-600"><LinkText text={h.content} mentionMatcher={mentionMatcher} onMention={onMention}/></p>
        </div>
      ))}
      {!history.length && <p className="text-xs text-slate-400">Sem histórico</p>}
      <button onClick={() => setShowHistory(false)} className="absolute top-1 right-2 text-slate-400 hover:text-slate-700"><X size={11} /></button>
    </div>,
    document.body
  );

  const menuBtn = (
    <Popover open={showMenu} onOpenChange={setShowMenu}>
    <PopoverTrigger asChild>
    <button onClick={e => e.stopPropagation()} aria-label="Opções da mensagem" aria-expanded={showMenu}
      className="absolute -top-2 opacity-0 group-hover:opacity-100 h-7 w-7 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-slate-800 transition-opacity"
      style={mine ? { left: -38, top: 6 } : { right: -38, top: 6 }}>
      <MoreVertical size={13} />
    </button>
    </PopoverTrigger>
    <PopoverContent align={mine ? 'end' : 'start'} side="top" sideOffset={8} collisionPadding={12} className="chat-message-menu w-52 rounded-xl border-slate-700 bg-[#192437] p-1.5 text-slate-100">{menu}</PopoverContent>
    </Popover>
  );

  const swipeStyle = { transform: `translateX(${swipeDx}px)`, transition: swipeDx === 0 ? 'transform 0.2s' : 'none' };

  if (displayContent.startsWith('[AUDIO_MSG]')) {
    return (
      <div className="relative group max-w-[85%]" style={swipeStyle} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <div className={cn('rounded-2xl px-4 py-3 shadow-sm', mine ? 'rounded-tr-sm' : 'rounded-tl-sm')} style={bubbleStyle}>
          {!mine && <p className="chat-message-author mb-1 text-sm font-bold text-slate-500 whitespace-nowrap">{message.sender?.name || 'Usuário'}</p>}
          {fwdHeader}
          {replyPreview}
          <audio controls src={displayContent.slice(11)} className="w-full h-14" preload="none" style={{ minWidth: 0, maxWidth: '100%' }} />
          {timestamp}
        </div>
        {menuBtn}{tooltip}{editHistory}{readersPopup}
      </div>
    );
  }

  if (displayContent.startsWith('[DOC|')) {
    const end = displayContent.indexOf(']');
    const fileName = end > 5 ? displayContent.slice(5, end) : 'Documento';
    const src = end >= 0 ? displayContent.slice(end + 1) : displayContent;
    const ext = fileName.split('.').pop()?.toUpperCase() || 'DOC';
    return (
      <div className="relative group max-w-[85%]" style={swipeStyle} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <div className={cn('rounded-2xl px-4 py-3 shadow-sm', mine ? 'rounded-tr-sm' : 'rounded-tl-sm')} style={bubbleStyle}>
          {!mine && <p className="chat-message-author mb-1 text-sm font-bold text-slate-500 whitespace-nowrap">{message.sender?.name || 'Usuário'}</p>}
          {fwdHeader}
          {replyPreview}
          <a href={src} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0"><FileText size={20} className="text-orange-500" /></div>
            <div className="min-w-0"><p className="text-sm font-semibold text-slate-800 truncate max-w-[220px]">{fileName}</p><p className="text-xs text-orange-500 font-bold">{ext}</p></div>
          </a>
          {timestamp}
        </div>
        {menuBtn}{tooltip}{editHistory}{readersPopup}
      </div>
    );
  }

  if (displayContent.startsWith('[STICKER]')) {
    return (
      <div className="relative group" style={swipeStyle} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <div className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
          {fwdHeader}
          {replyPreview}
          <span className="text-5xl leading-none">{displayContent.slice(9)}</span>
          {timestamp}
        </div>
        {menuBtn}{tooltip}{editHistory}
      </div>
    );
  }

  if (displayContent.startsWith('[IMAGE]')) {
    const rawSrc = displayContent.slice(7);
    const nlIdx = rawSrc.indexOf('\n');
    const src = nlIdx >= 0 ? rawSrc.slice(0, nlIdx) : rawSrc;
    const caption = nlIdx >= 0 ? rawSrc.slice(nlIdx + 1) : '';
    return (
      <div className="relative group" style={swipeStyle} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <div className={cn('max-w-[420px] rounded-2xl overflow-hidden shadow-sm', mine ? 'rounded-tr-sm' : 'rounded-tl-sm')} style={bubbleStyle}>
          {!mine && <p className="chat-message-author px-3 pt-2 text-sm font-bold text-slate-500 whitespace-nowrap">{message.sender?.name || 'Usuário'}</p>}
          {fwdHeader && <div className="px-3 pt-1">{fwdHeader}</div>}
          {replyPreview && <div className="px-3 pt-2">{replyPreview}</div>}
          <img src={src} alt="foto" className="w-full max-h-80 object-cover cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => onImageClick ? onImageClick(src) : window.open(src, '_blank', 'noopener,noreferrer')} />
          {caption && <p className="px-3 py-2 text-sm" style={{ color: bubbleText }}><LinkText text={caption} mentionMatcher={mentionMatcher} onMention={onMention}/></p>}
          {timestamp}
        </div>
        {menuBtn}{tooltip}{editHistory}
      </div>
    );
  }

  if (displayContent.startsWith('[VIDEO]')) {
    const rawSrc = displayContent.slice(7);
    const nlIdx = rawSrc.indexOf('\n');
    const src = nlIdx >= 0 ? rawSrc.slice(0, nlIdx) : rawSrc;
    const caption = nlIdx >= 0 ? rawSrc.slice(nlIdx + 1) : '';
    return (
      <div className="relative group" style={swipeStyle} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <div className={cn('max-w-[300px] rounded-2xl overflow-hidden shadow-sm', mine ? 'rounded-tr-sm' : 'rounded-tl-sm')} style={bubbleStyle}>
          {!mine && <p className="chat-message-author px-3 pt-2 text-xs font-bold text-slate-500 whitespace-nowrap">{message.sender?.name || 'Usuário'}</p>}
          {fwdHeader && <div className="px-3 pt-1">{fwdHeader}</div>}
          {replyPreview && <div className="px-3 pt-2">{replyPreview}</div>}
          <video controls src={src} className="w-full max-h-48 object-cover" preload="none" />
          {caption && <p className="px-3 py-2 text-sm" style={{ color: bubbleText }}><LinkText text={caption} mentionMatcher={mentionMatcher} onMention={onMention}/></p>}
          {timestamp}
        </div>
        {menuBtn}{tooltip}{editHistory}
      </div>
    );
  }

  return (
    <div className="relative group" style={{ maxWidth: '75%', ...swipeStyle }} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div className={cn('rounded-2xl px-5 py-3 shadow-sm', mine ? 'rounded-tr-sm' : 'rounded-tl-sm')}
        style={{ ...bubbleStyle, minWidth: 80 }}>
        {!mine && <p className="chat-message-author mb-1 text-sm font-bold text-slate-500 whitespace-nowrap">{message.sender?.name || 'Usuário'}</p>}
        {fwdHeader}
        {replyPreview}
        <p className="chat-message-text whitespace-pre-wrap break-words"><LinkText text={displayContent} mentionMatcher={mentionMatcher} onMention={onMention}/></p>
        {timestamp}
      </div>
      {menuBtn}{tooltip}{editHistory}{readersPopup}
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
    <div className="chat-settings-overlay fixed inset-0 z-50 flex">
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
                  <AchievementAvatar userId={u.id} name={u.name} photo={u.photo_url} size={32} />
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
                  <AchievementAvatar userId={p.id} name={p.name} photo={p.photo_url} size={36} />
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
        className="chat-profile-dialog relative w-[480px] max-w-[92vw] rounded-2xl bg-white shadow-2xl overflow-hidden"
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
              <AchievementAvatar userId={profileUser.id} name={profileUser.name} photo={profileUser.photo_url} size={96} />
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
  const [fontScale,setFontScale]=useState(110);
  useEffect(()=>{
    let scale=110;
    if(user?.id)try{
      const stored=localStorage.getItem(`rede-nex:chat-font:${user.id}`);
      const parsed=stored===null?110:Number(stored);
      if(Number.isFinite(parsed))scale=Math.max(80,Math.min(160,Math.round(parsed/10)*10));
    }catch{/* The control still works when browser storage is unavailable. */}
    setFontScale(scale);
  },[user?.id]);
  function changeFontScale(value:number){
    const scale=Math.max(80,Math.min(160,value));
    setFontScale(scale);
    if(user?.id)try{localStorage.setItem(`rede-nex:chat-font:${user.id}`,String(scale));}catch{/* Keep the current session preference. */}
  }
  const [chatParams, setChatParams] = useSearchParams();
  const requestedConversation = chatParams.get('conversa');
  const requestedMessage=chatParams.get('mensagem');
  const [showAttention,setShowAttention]=useState(false);
  const [attentionMessage,setAttentionMessage]=useState<ChatMessage|null>(null);
  const [attentionFeedback,setAttentionFeedback]=useState('');
  const [sidebarMenuOpen,setSidebarMenuOpen]=useState(false);
  const [openConvActionsId,setOpenConvActionsId]=useState<string|null>(null);
  const conversationActionsLock=useRef(new Set<string>());
  const [conversationActionsBusy,setConversationActionsBusy]=useState<Set<string>>(new Set());
  const focusedMessage=useRef('');
  useEffect(()=>{if(user?.id)void syncDesktopNotifications(user.id).then(setBrowserNotifications).catch(()=>undefined);},[user?.id]);

  const [callState, setCallStateLocal] = useState<CallState>(() => callStore.getState());
  useEffect(() => callStore.subscribe(setCallStateLocal), []);

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  // The URL is the only selection state; async list refreshes never change it.
  const selectedId=requestedConversation;
  const selectedJarvis = selectedId === JARVIS_CONVERSATION_ID;
  const workspace = getChatWorkspace(user?.id || null);
  const drafts = useSyncExternalStore(workspace.drafts.subscribe, workspace.drafts.getSnapshot);
  const jarvisState = useSyncExternalStore(workspace.jarvis.subscribe, workspace.jarvis.getSnapshot);
  const messageText = selectedId ? drafts[selectedId]?.text || '' : '';
  const setMessageText = useCallback((value: string | ((previous: string) => string)) => {
    if (selectedId) workspace.drafts.set(selectedId, value);
  }, [workspace, selectedId]);
  const sendingConversations = useRef(new Set<string>());
  const [sendFailure, setSendFailure] = useState<{ conversationId: string; message: string } | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const composerFocusRequested = useRef(true);
  const [composerFocusToken, setComposerFocusToken] = useState(0);
  const currentConversation=useRef<string|null>(selectedId);
  const [conversationRequests]=useState(()=>createChatRequestGuard(selectedId));
  const autoSelectFirst=useRef(!selectedId);
  const conversationsRequest=useRef(0),conversationsApplied=useRef(0);
  useEffect(()=>{setShowAttention(false);setAttentionMessage(null);},[selectedId]);
  useEffect(()=>{
    if(!showAttention || attentionMessage)return;
    const cancel=(event:KeyboardEvent)=>{if(event.key==='Escape')setShowAttention(false);};
    window.addEventListener('keydown',cancel);
    return ()=>window.removeEventListener('keydown',cancel);
  },[showAttention,attentionMessage]);
  const setSelectedId=useCallback((id:string|null)=>{
    composerFocusRequested.current = !!id;
    setComposerFocusToken(value => value + 1);
    setPeopleOpen(false);
    autoSelectFirst.current=false;
    currentConversation.current=id;
    conversationRequests.select(id);
    setChatParams(params=>{const next=new URLSearchParams(params);if(id)next.set('conversa',id);else next.delete('conversa');next.delete('mensagem');next.delete('atencao');return next;},{replace:true});
  },[setChatParams,conversationRequests]);
  const selectConversationRef=useRef(setSelectedId);
  useLayoutEffect(()=>{
    selectConversationRef.current=setSelectedId;
    currentConversation.current=selectedId;
    conversationRequests.select(selectedId);
    if(selectedId)autoSelectFirst.current=false;
  },[selectedId,setSelectedId,conversationRequests]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionParticipants, setMentionParticipants] = useState<import('../lib/chatApi').GroupParticipant[]>([]);
  const [conversationSearch, setConversationSearch] = useState('');
  const [conversationFilter, setConversationFilter] = useState<'all' | 'unread' | 'groups' | 'agents' | 'pinned' | 'muted' | 'archived'>('all');
  const [userSearch, setUserSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const [archiveFeedback, setArchiveFeedback] = useState('');
  const archiveBusyRef = useRef(false);
  useEffect(()=>{
    if(!archiveFeedback)return;
    const timeout=window.setTimeout(()=>setArchiveFeedback(''),4500);
    return ()=>window.clearTimeout(timeout);
  },[archiveFeedback]);

  // Group creation
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupPhoto, setGroupPhoto] = useState<File | null>(null);
  const [groupPhotoPreview, setGroupPhotoPreview] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const groupPhotoRef = useRef<HTMLInputElement>(null);
  const [groupBroadcast, setGroupBroadcast] = useState(false);
  const [groupUserSearch, setGroupUserSearch] = useState('');

  // Forward
  const [forwardingMsg, setForwardingMsg] = useState<ChatMessage | null>(null);
  const [forwardSearch, setForwardSearch] = useState('');
  const [forwardingSending, setForwardingSending] = useState(false);

  // Notifications
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('chat_sound_enabled') !== 'false');
  useEffect(()=>{ localStorage.setItem('chat_sound_enabled', String(soundEnabled)); if(!soundEnabled)stopNotificationSound();},[soundEnabled]);
  useEffect(()=>()=>stopNotificationSound(),[]);
  const [browserNotifications, setBrowserNotifications] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  );
  const [toast, setToast] = useState<IncomingToast | null>(null);

  // Typing indicator — keyed by convId → userId
  const [typingByConv, setTypingByConv] = useState<Map<string, Map<string, { name: string; ts: number; isRecording?: boolean }>>>(new Map());
  const typingLastSentRef = useRef<number>(0);
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Mention keyboard navigation
  const [mentionIndex, setMentionIndex] = useState(0);

  // Audio waveform
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [waveformBars, setWaveformBars] = useState<number[]>([]);
  const cancelRecordingRef = useRef(false);

  // Panels
  const [showEmoji, setShowEmoji] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showTheme, setShowTheme] = useState(false);

  // Mobile navigation (list ↔ messages)
  const [mobileView, setMobileView] = useState<'list' | 'messages'>('list');
  const [peopleOpen, setPeopleOpen] = useState(false);
  const peoplePanelRef = useRef<HTMLElement>(null);
  const peopleSearchRef = useRef<HTMLInputElement>(null);
  const peopleTriggerRef = useRef<HTMLButtonElement | null>(null);
  const togglePeople = (event: React.MouseEvent<HTMLButtonElement>) => {
    peopleTriggerRef.current = event.currentTarget;
    setPeopleOpen(value => !value);
  };
  const closePeople = (restoreFocus = false) => {
    setPeopleOpen(false);
    if (restoreFocus && peopleTriggerRef.current?.isConnected) peopleTriggerRef.current.focus({ preventScroll: true });
  };
  useLayoutEffect(() => {
    if (peopleOpen) peopleSearchRef.current?.focus({ preventScroll: true });
  }, [peopleOpen]);
  useEffect(() => {
    if (!peopleOpen) return;
    const outside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || peoplePanelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[data-chat-people-toggle]')) return;
      setPeopleOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setPeopleOpen(false);
      if (peopleTriggerRef.current?.isConnected) peopleTriggerRef.current.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape); };
  }, [peopleOpen]);

  const { palette: appearance } = useAppearance();
  const theme: ChatTheme = { bubbleColor: appearance.chat.outgoing, bgColor: appearance.chat.background, bgImage: appearance.chat.wallpaper, textColor: appearance.chat.outgoingText };
  const { dark: darkMode } = useDarkMode();

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
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showInputTools, setShowInputTools] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderText, setReminderText] = useState('');
  const [reminderDateTime, setReminderDateTime] = useState('');
  const [reminders, setReminders] = useState<{id:string;convId:string;convName:string;text:string;triggerAt:number}[]>([]);
  const [activeReminder, setActiveReminder] = useState<{text:string;convName:string}|null>(null);
  const reminderTimeoutsRef = useRef<Map<string,ReturnType<typeof setTimeout>>>(new Map());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);
  const atBottomRef = useRef(true);
  const initialScrollRef = useRef(true);
  const prependScrollRef = useRef<{ top: number; height: number } | null>(null);
  const lastMessageRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.style.height = 'auto';
    composer.style.height = Math.min(composer.scrollHeight, 120) + 'px';
  }, [selectedId]);

  const selectedConversation = conversations.find(c => c.id === selectedId);
  const selectedMuted = !!selectedConversation?.is_muted;
  useEffect(() => {
    wsEventBus.emit({ type: 'conversation:active', conversationId: selectedJarvis ? null : selectedId });
    return () => wsEventBus.emit({ type: 'conversation:active', conversationId: null });
  }, [selectedId, selectedJarvis]);

  const usersById = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach(u => map.set(u.id, u));
    return map;
  }, [users]);
  const mentionMatcher=useMemo(()=>buildMentionMatcher(users),[users]);
  const openMentionProfile=useCallback((userId:string)=>{
    const mentionedUser=usersById.get(userId);
    if(mentionedUser)setProfileUser(mentionedUser);
  },[usersById]);

  useEffect(() => {
    const stored = localStorage.getItem('chat_reminders');
    if (!stored) return;
    try {
      const loaded: {id:string;convId:string;convName:string;text:string;triggerAt:number}[] = JSON.parse(stored);
      const now = Date.now();
      const valid = loaded.filter(r => r.triggerAt > now);
      setReminders(valid);
      if (valid.length !== loaded.length) localStorage.setItem('chat_reminders', JSON.stringify(valid));
      valid.forEach(r => {
        const timeout = setTimeout(() => {
          setActiveReminder({ text: r.text, convName: r.convName });
          setReminders(prev => { const next = prev.filter(x => x.id !== r.id); localStorage.setItem('chat_reminders', JSON.stringify(next)); return next; });
          reminderTimeoutsRef.current.delete(r.id);
        }, r.triggerAt - now);
        reminderTimeoutsRef.current.set(r.id, timeout);
      });
    } catch {}
    return () => { reminderTimeoutsRef.current.forEach(t => clearTimeout(t)); };
  }, []);

  const loadConversations = useCallback(async () => {
    const request=++conversationsRequest.current;
    const next = await getConversations();
    if(request<conversationsApplied.current)return next;
    conversationsApplied.current=request;
    setConversations(next);
    const firstActive = next.find(c => !c.is_archived);
    if (autoSelectFirst.current && !currentConversation.current && firstActive) selectConversationRef.current(firstActive.id);
    return next;
  }, []);

  const loadMessages = useCallback(async (conversationId: string, notify = false) => {
    if(conversationId === JARVIS_CONVERSATION_ID || currentConversation.current!==conversationId)return;
    const request=conversationRequests.capture(conversationId);
    const result = await getMessages(conversationId).catch(() => {
      if (conversationRequests.accept(request)) { setMessagesLoading(false); setMessagesError('Não foi possível atualizar as mensagens.'); }
      return null;
    });
    if (!result || !conversationRequests.accept(request)) return;
    const { messages: next, hasMore } = result;
    setMessagesLoading(false); setMessagesError('');
    const previousIds = knownMessageIdsRef.current;
    const incoming = next.filter(m => !previousIds.has(m.id) && m.sender_id !== user?.id);
    knownMessageIdsRef.current = new Set(next.map(m => m.id));
    setMessages(previous => mergeChatMessages(previous.filter(message=>message.conversation_id===conversationId), next.filter(message=>message.conversation_id===conversationId)));
    setHasMoreMessages(hasMore);
    const convIsMuted = selectedMuted;
    if (notify && incoming.length && !firstLoadRef.current && !convIsMuted && (document.hidden || !document.hasFocus())) {
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
      // Desktop delivery is centralized in Web Push for every module.
    }
    firstLoadRef.current = false;
  }, [browserNotifications, selectedConversation?.name, soundEnabled, user?.id, selectedMuted,conversationRequests]);

  const loadOlderMessages = useCallback(async () => {
    if (!selectedId || loadingOlder || !hasMoreMessages) return;
    const oldest = messages[0];
    if (!oldest) return;
    const request=conversationRequests.capture(selectedId,'older');
    setLoadingOlder(true);
    try {
      const { messages: older, hasMore } = await getMessages(selectedId, oldest.id);
      if (!conversationRequests.accept(request)) return;
      const container = messagesContainerRef.current;
      if (container) prependScrollRef.current = { top: container.scrollTop, height: container.scrollHeight };
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const fresh = older.filter(m => !existingIds.has(m.id));
        return [...fresh, ...prev];
      });
      setHasMoreMessages(hasMore);
    } finally {
      if(conversationRequests.isCurrent(request))setLoadingOlder(false);
    }
  }, [selectedId, loadingOlder, hasMoreMessages, messages,conversationRequests]);

  useEffect(() => {
    void loadConversations().catch(()=>undefined);
    getUsers().then(setUsers).catch(() => {});
    const iv = setInterval(() => getUsers().then(setUsers).catch(() => {}), 30000);
    return () => clearInterval(iv);
  }, [loadConversations]);

  const loadersRef = useRef({ loadMessages, loadConversations });
  loadersRef.current = { loadMessages, loadConversations };
  useEffect(()=>wsEventBus.subscribe(event=>{
    if(event.type!=='message:reaction' || typeof event.conversationId!=='string' || typeof event.messageId!=='string' || event.conversationId!==currentConversation.current)return;
    const conversationId=event.conversationId,messageId=event.messageId;
    const request=conversationRequests.capture(conversationId,`reaction:${messageId}`);
    void getChatReactions(conversationId,messageId).then(reactions=>{
      if(conversationRequests.accept(request))setMessages(previous=>previous.map(message=>message.id===messageId?{...message,reactions}:message));
    }).catch(()=>undefined);
  }),[conversationRequests]);
  useEffect(()=>wsEventBus.subscribe(event=>{
    if(event.type!=='chat:typing')return;
    const convId=event.conversationId as string;
    const fromId=event.from as string;
    const name=(event.name as string)||'Alguém';
    const isRec=!!(event.isRecording);
    if(fromId===user?.id)return;
    setTypingByConv(prev=>{
      const m=new Map(prev);
      const inner=new Map(m.get(convId)||[]);
      inner.set(fromId,{name,ts:Date.now(),isRecording:isRec});
      m.set(convId,inner);
      return m;
    });
    const timerKey=`${convId}:${fromId}`;
    const existing=typingTimersRef.current.get(timerKey);
    if(existing)clearTimeout(existing);
    const timer=setTimeout(()=>{
      setTypingByConv(prev=>{
        const m=new Map(prev);
        const inner=new Map(m.get(convId)||[]);
        inner.delete(fromId);
        if(inner.size===0)m.delete(convId);else m.set(convId,inner);
        return m;
      });
      typingTimersRef.current.delete(timerKey);
    },3500);
    typingTimersRef.current.set(timerKey,timer);
  }),[user?.id]);
  useEffect(()=>{setMentionIndex(0);},[mentionQuery]);
  useLayoutEffect(() => {
    firstLoadRef.current = true;
    knownMessageIdsRef.current = new Set();
    setHasMoreMessages(false);
    setLoadingOlder(false);
    setReplyingTo(null);setEditingMsg(null);setEditText('');
    setMentionQuery(null);setMentionParticipants([]);
    setShowGroupSettings(false);setShowNotes(false);setNotesContent('');
    setMessages([]);setMessagesError('');setMessagesLoading(!!selectedId && selectedId !== JARVIS_CONVERSATION_ID);
    setSendFailure(null);
    setMessageSearch('');setShowMsgSearch(false);
    setShowEmoji(false);setShowStickers(false);
    if (!selectedId) return;
    if (selectedId === JARVIS_CONVERSATION_ID) {
      setMobileView('messages');
      const interval = setInterval(() => { void loadersRef.current.loadConversations().catch(() => undefined); }, 3500);
      return () => clearInterval(interval);
    }
    composerFocusRequested.current = true;
    setMobileView('messages');
    loadersRef.current.loadMessages(selectedId, false);
    markConversationRead(selectedId).catch(() => {});
    const iv = setInterval(() => { void loadersRef.current.loadMessages(selectedId, true); void loadersRef.current.loadConversations().catch(()=>undefined); }, 3500);
    return () => clearInterval(iv);
  }, [selectedId]);

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

  useLayoutEffect(() => {
    initialScrollRef.current = true;
    atBottomRef.current = true;
    lastMessageRef.current = null;
    prependScrollRef.current = null;
    setShowScrollBtn(false);
  }, [selectedId]);

  useLayoutEffect(() => {
    const c = messagesContainerRef.current;
    if (!c || messagesLoading || messages.some(m => m.conversation_id !== selectedId)) return;
    const last = messages[messages.length - 1];
    const ownMessage = !!last && last.id !== lastMessageRef.current && last.sender_id === user?.id;
    const action = chatScrollAction({ initial: initialScrollRef.current, following: atBottomRef.current, ownMessage, prepending: !!prependScrollRef.current });
    if (action === 'preserve' && prependScrollRef.current) c.scrollTop = prependScrollRef.current.top + c.scrollHeight - prependScrollRef.current.height;
    else if (action === 'bottom') { c.scrollTop = c.scrollHeight; atBottomRef.current = true; setShowScrollBtn(false); }
    prependScrollRef.current = null;
    initialScrollRef.current = false;
    lastMessageRef.current = last?.id ?? null;
  }, [messages, messagesLoading, selectedId, user?.id, mobileView, messageSearch]);

  useEffect(()=>{
    if(!selectedId || selectedId === JARVIS_CONVERSATION_ID || !requestedMessage || (requestedConversation && selectedId!==requestedConversation) || messagesLoading) return;
    let alive=true;
    const request=conversationRequests.capture(selectedId,'context');
    void getChatMessageContext(selectedId,requestedMessage).then(rows=>{
      if(alive && conversationRequests.accept(request))setMessages(previous=>mergeChatMessages(previous,rows.filter(message=>message.conversation_id===selectedId)));
    }).catch(()=>{if(alive && conversationRequests.isCurrent(request))setAttentionFeedback('A mensagem solicitada não está mais disponível.');});
    return()=>{alive=false;};
  },[selectedId,requestedMessage,requestedConversation,messagesLoading,conversationRequests]);

  useLayoutEffect(()=>{
    if(!requestedMessage || messagesLoading || (requestedConversation && selectedId!==requestedConversation) || focusedMessage.current===`${selectedId}:${requestedMessage}`)return;
    const target=document.getElementById(`chat-message-${requestedMessage}`);
    if(!target)return;
    target.scrollIntoView({block:'center'});atBottomRef.current=false;
    focusedMessage.current=`${selectedId}:${requestedMessage}`;setShowScrollBtn(true);
  },[messages,requestedMessage,requestedConversation,selectedId,messagesLoading]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    // Images can change row height after the request finishes. Follow only if
    // the user was already at the bottom; never pull them away from history.
    const observer = new ResizeObserver(() => { if (atBottomRef.current) container.scrollTop = container.scrollHeight; });
    observer.observe(container);
    container.querySelectorAll('.chat-message-row').forEach(row => observer.observe(row));
    return () => observer.disconnect();
  }, [messages, mobileView]);

  async function handleArchiveConversation(conversation: ChatConversation) {
    if (archiveBusyRef.current || conversationActionsLock.current.has(conversation.id)) return;
    archiveBusyRef.current = true;
    conversationActionsLock.current.add(conversation.id);setConversationActionsBusy(new Set(conversationActionsLock.current));
    setArchiveError(''); setArchiveFeedback('');
    try {
      const archived = !conversation.is_archived;
      await setConversationArchived(conversation.id, archived);
      setConversations(previous => previous.map(c => c.id === conversation.id ? { ...c, is_archived: archived } : c));
      setArchiveFeedback(archived ? 'Conversa movida para Arquivadas.' : 'Conversa de volta à lista principal.');
      if (archived && currentConversation.current === conversation.id) { setSelectedId(null); setMobileView('list'); }
      if (!archived) setConversationFilter('all');
    } catch { setArchiveError('Não foi possível atualizar a conversa. Confira se a API e a migração desta versão estão atualizadas.'); }
    finally { archiveBusyRef.current = false; conversationActionsLock.current.delete(conversation.id);setConversationActionsBusy(new Set(conversationActionsLock.current)); }
  }

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
    if(!user)return;
    try{await enableDesktopNotifications(user.id);setBrowserNotifications(true);setAttentionFeedback('Notificações do computador ativadas.');}
    catch(error){setAttentionFeedback(error instanceof Error?error.message:'Não foi possível ativar as notificações');}
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
    const conversationId = selectedId;
    if (!conversationId || selectedJarvis || !messageText.trim()) return;
    const lockKey = user?.id + ':' + conversationId;
    if (sendingConversations.current.has(lockKey)) return;
    const draft = workspace.drafts.capture(conversationId);
    sendingConversations.current.add(lockKey);
    setSendFailure(null);
    try {
      await sendChatMessage(conversationId, messageText.trim().slice(0, 8000), replyingTo?.id);
      workspace.drafts.clearIfUnchanged(conversationId, draft);
      if (currentConversation.current === conversationId) setReplyingTo(null);
      // A refresh failure must not turn an acknowledged send into a duplicate retry.
      await Promise.allSettled([loadMessages(conversationId), loadConversations()]);
    } catch (error) {
      setSendFailure({ conversationId, message: error instanceof Error ? error.message : 'Não foi possível enviar. Seu rascunho foi mantido.' });
    } finally {
      sendingConversations.current.delete(lockKey);
    }
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
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;
        e.preventDefault();
        setPendingFile({ src: URL.createObjectURL(file), type: 'image', raw: file });
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
        if (cancelRecordingRef.current) { cancelRecordingRef.current = false; return; }
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
      if (selectedId) wsEventBus.send({ type: 'chat:typing', conversationId: selectedId, isRecording: true });
      recordingTimerRef.current = window.setInterval(() => setRecordingSeconds(s => s + 1), 1000);
      try {
        const actx = new AudioContext();
        const src = actx.createMediaStreamSource(stream);
        const analyser = actx.createAnalyser();
        analyser.fftSize = 64;
        src.connect(analyser);
        analyserRef.current = analyser;
        audioCtxRef.current = actx;
        const drawWave = () => {
          if (!analyserRef.current) return;
          const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(buf);
          setWaveformBars(Array.from(buf.slice(0, 20)));
          animFrameRef.current = requestAnimationFrame(drawWave);
        };
        drawWave();
      } catch {}
    } catch { alert('Microfone não disponível ou permissão negada.'); }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    setRecordingSeconds(0);
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    analyserRef.current = null;
    setWaveformBars([]);
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
    if (groupBroadcast) { try { await updateConversationSettings(conversation.id, { broadcast_mode: true }); } catch {} }
    setGroupName(''); setSelectedUsers([]); setGroupPhoto(null); setGroupPhotoPreview(''); setGroupBroadcast(false); setGroupUserSearch(''); setNewGroupOpen(false);
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
    if(conversationActionsLock.current.has(convId))return;
    conversationActionsLock.current.add(convId);setConversationActionsBusy(new Set(conversationActionsLock.current));
    setArchiveError('');
    try {
      const isMuted = await toggleMuteConversation(convId);
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, is_muted: isMuted } : c));
    } catch(error) {setArchiveError(error instanceof Error?error.message:'Não foi possível alterar o som da conversa.');}
    finally {conversationActionsLock.current.delete(convId);setConversationActionsBusy(new Set(conversationActionsLock.current));}
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
    if (!confirm('Apagar esta mensagem? Ela ficará como "Mensagem apagada".')) return;
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
    if(conversationActionsLock.current.has(convId))return;
    conversationActionsLock.current.add(convId);setConversationActionsBusy(new Set(conversationActionsLock.current));
    setArchiveError('');
    try {
      const isPinned=await pinChatConversation(convId);
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, is_pinned: isPinned } : c));
    } catch(error) {setArchiveError(error instanceof Error?error.message:'Não foi possível fixar a conversa.');}
    finally {conversationActionsLock.current.delete(convId);setConversationActionsBusy(new Set(conversationActionsLock.current));}
  }

  async function handleOpenMyNotes() {
    try {
      const conv = await getSelfConversation();
      setSelectedId(conv.id);
      setMobileView('messages');
      setConversations(prev => {
        if (prev.some(c => c.id === conv.id)) return prev;
        return [conv, ...prev];
      });
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

  function handleSaveReminder() {
    if (!reminderText.trim() || !reminderDateTime || !selectedId) return;
    const triggerAt = new Date(reminderDateTime).getTime();
    if (isNaN(triggerAt) || triggerAt <= Date.now()) return;
    const id = crypto.randomUUID();
    const convName = selectedConversation?.name || selectedConversation?.other_participant?.name || 'Conversa';
    const reminder = { id, convId: selectedId, convName, text: reminderText.trim(), triggerAt };
    const updated = [...reminders, reminder];
    setReminders(updated);
    localStorage.setItem('chat_reminders', JSON.stringify(updated));
    const timeout = setTimeout(() => {
      setActiveReminder({ text: reminder.text, convName: reminder.convName });
      setReminders(prev => { const next = prev.filter(r => r.id !== id); localStorage.setItem('chat_reminders', JSON.stringify(next)); return next; });
      reminderTimeoutsRef.current.delete(id);
    }, triggerAt - Date.now());
    reminderTimeoutsRef.current.set(id, timeout);
    setReminderText(''); setReminderDateTime(''); setShowReminderModal(false);
  }

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
    const base = conversations.filter(c => {
      if (conversationFilter === 'archived' ? !c.is_archived : c.is_archived) return false;
      const matchesFilter = conversationFilter === 'all' || conversationFilter === 'archived'
        || (conversationFilter === 'unread' && c.unread_count > 0)
        || (conversationFilter === 'groups' && c.type === 'group')
        || (conversationFilter === 'agents' && c.type === 'direct' && !!c.other_participant)
        || (conversationFilter === 'pinned' && c.is_pinned)
        || (conversationFilter === 'muted' && c.is_muted);
      return matchesFilter && (!q || `${c.name || ''} ${c.other_participant?.name || ''} ${c.last_message?.content || ''}`.toLowerCase().includes(q));
    });
    const activity = (conversation: ChatConversation) => Date.parse(conversation.last_message?.created_at || conversation.created_at) || 0;
    return [...base].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) || activity(b) - activity(a));
  }, [conversations, conversationSearch, conversationFilter]);

  const showJarvisConversation = conversationFilter === 'all' && (!conversationSearch.trim() ||
    `jarvis assistente pessoal ${drafts[JARVIS_CONVERSATION_ID]?.text || ''}`.toLowerCase().includes(conversationSearch.trim().toLowerCase()));

  // Filtered messages (search)
  const displayedMessages = useMemo(() => {
    const currentMessages=messages.filter(message=>message.conversation_id===selectedId);
    if (!messageSearch.trim()) return currentMessages;
    const q = messageSearch.toLowerCase();
    return currentMessages.filter(m => m.content?.toLowerCase().includes(q));
  }, [messages, messageSearch,selectedId]);

  // Right panel users split
  const { onlineUsers, offlineUsers } = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const all = users.filter(u => u.id !== user?.id).filter(u => !q || u.name.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
    return { onlineUsers: all.filter(u => u.online), offlineUsers: all.filter(u => !u.online) };
  }, [users, user?.id, userSearch]);

  const canSend = !selectedConversation?.broadcast_mode || ['owner', 'admin'].includes(selectedConversation?.my_role || '');
  useLayoutEffect(() => {
    if (!composerFocusRequested.current || !selectedId || selectedConversation?.id !== selectedId || mobileView !== 'messages' || !canSend || isRecording || pendingFile || editingMsg || showTheme || newGroupOpen || profileUser || showGroupSettings || showNotes || showReminderModal || peopleOpen) return;
    const composer = composerRef.current;
    if (!composer || composer.disabled) return;
    composer.focus({ preventScroll: true });
    composerFocusRequested.current = false;
  }, [selectedId, selectedConversation?.id, composerFocusToken, mobileView, canSend, isRecording, pendingFile, editingMsg, showTheme, newGroupOpen, profileUser, showGroupSettings, showNotes, showReminderModal, peopleOpen]);


  return (
    <div
      className={cn('chat-shell flex overflow-hidden', darkMode ? 'bg-[hsl(var(--card))] chat-dark' : 'bg-slate-50')}
      data-mobile-view={mobileView}
      style={{'--chat-message-font-size':`${14*fontScale/100}px`} as CSSProperties}
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

      {showAttention && attentionMessage && selectedConversation && <ChatAttentionDialog key={`${selectedConversation.id}:${attentionMessage.id}`} conversationId={selectedConversation.id} name={selectedConversation.name || 'Conversa'} group={selectedConversation.type==='group'} message={messages.find(item=>item.id===attentionMessage.id) || attentionMessage} onClose={()=>setAttentionMessage(null)} onSent={count=>{setShowAttention(false);setAttentionMessage(null);setAttentionFeedback(`Atenção solicitada para ${count} participante(s).`);}}/>}
      {attentionFeedback && <div className='chat-attention-feedback' role='status'>{attentionFeedback}<button onClick={()=>setAttentionFeedback('')} aria-label='Fechar aviso'><X size={18}/></button></div>}
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
            <X size={15} className="text-slate-500" />
          </div>
        </button>
      )}

      {/* ── Left: Conversations ── */}
      <aside className={cn(
        cn('chat-conversations overflow-hidden border-r flex flex-col flex-shrink-0', darkMode ? 'bg-[hsl(var(--card))] border-[hsl(var(--muted))]' : 'bg-slate-50 border-slate-200'),
        'w-full md:w-[260px]',
        mobileView === 'messages' ? 'hidden md:flex' : 'flex'
      )}>
        <div className="chat-list-heading border-b border-slate-100 p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={cn("text-lg font-bold", darkMode ? "text-[hsl(var(--foreground))]" : "text-slate-900")}>Conversas</h1>
            </div>
            <div className="chat-list-actions flex items-center gap-1">
              <button type="button" onClick={togglePeople} data-chat-people-toggle aria-haspopup="dialog" aria-controls="chat-people-panel" aria-expanded={peopleOpen} className="chat-icon-button" title="Encontrar pessoas" aria-label="Encontrar pessoas"><UserPlus size={22} /></button>
              <button type="button" onClick={handleOpenMyNotes} className="chat-icon-button" title="Minhas notas" aria-label="Minhas notas"><BookOpen size={20} /></button>
              <button onClick={() => setNewGroupOpen(v => !v)} className="chat-icon-button" title="Criar grupo" aria-label="Criar grupo"><Plus size={20} /></button>
              <Popover open={sidebarMenuOpen} onOpenChange={setSidebarMenuOpen}>
                <PopoverTrigger asChild><button className='chat-icon-button' title='Opções do chat' aria-label='Opções do chat'><MoreVertical size={20}/></button></PopoverTrigger>
                <PopoverContent align='end' sideOffset={8} className='chat-sidebar-options'>
                  <p>Preferências do chat</p>
                  <button onClick={()=>setSoundEnabled(value=>!value)} aria-pressed={soundEnabled}>{soundEnabled?<Bell size={18}/>:<BellOff size={18}/>}<span>Som das mensagens</span><small>{soundEnabled?'Ativado':'Desativado'}</small></button>
                  <button type='button' onClick={playNotificationSound} disabled={!soundEnabled} aria-label='Testar som de mensagem'><Play size={18}/><span>Testar som</span><small>Quatro toques</small></button>
                  <button onClick={requestBrowserNotifications}><Bell size={18}/><span>Notificações do computador</span><small>{browserNotifications?'Ativadas':'Ativar'}</small></button>
                  <button onClick={()=>{setSidebarMenuOpen(false);setShowTheme(true);}}><Palette size={18}/><span>Personalizar chat</span></button>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="chat-conversation-search relative mt-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={conversationSearch} onChange={e => setConversationSearch(e.target.value)} placeholder="Buscar conversas..." aria-label="Buscar conversas" className={cn("h-9 w-full rounded-lg border pl-9 pr-3 text-sm outline-none focus:border-orange-400", darkMode ? "bg-[hsl(var(--muted))] border-[hsl(var(--border))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]" : "border-slate-200 bg-white")} />
          </div>
          <div className="chat-conversation-filters" aria-label="Filtrar conversas">
            {([{ id: 'all', label: 'Todas' }, { id: 'unread', label: 'Não lidas' }, { id: 'groups', label: 'Grupos' }, { id: 'agents', label: 'Agentes' }, { id: 'pinned', label: 'Fixadas' }, { id: 'muted', label: 'Silenciadas' }, { id: 'archived', label: 'Arquivadas' }] as const).map(filter => (
              <button key={filter.id} type="button" aria-pressed={conversationFilter === filter.id} onClick={() => setConversationFilter(filter.id)}>{filter.label}</button>
            ))}
          </div>
          {archiveError && <p role='alert' className='chat-archive-notice is-error'>{archiveError}</p>}
          {archiveFeedback && <p role='status' className='chat-archive-notice'>{archiveFeedback}</p>}
        </div>

        {/* New group modal */}
        {newGroupOpen && createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={e => { if (e.target === e.currentTarget) { setNewGroupOpen(false); setGroupName(''); setGroupPhoto(null); setGroupPhotoPreview(''); setSelectedUsers([]); setGroupBroadcast(false); setGroupUserSearch(''); } }}>
            <div className={cn('w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh]', darkMode ? 'bg-[hsl(var(--card))]' : 'bg-white')}>
              <div className={cn('flex items-center justify-between px-5 py-4 border-b flex-shrink-0', darkMode ? 'border-[hsl(var(--muted))]' : 'border-slate-100')}>
                <span className={cn('text-base font-semibold', darkMode ? 'text-[hsl(var(--foreground))]' : 'text-slate-800')}>Novo grupo</span>
                <button type="button" onClick={() => { setNewGroupOpen(false); setGroupName(''); setGroupPhoto(null); setGroupPhotoPreview(''); setSelectedUsers([]); setGroupBroadcast(false); setGroupUserSearch(''); }} className={cn('h-8 w-8 rounded-full flex items-center justify-center transition-colors', darkMode ? 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600')}>
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleCreateGroup} className="flex flex-col flex-1 overflow-hidden">
                <div className="px-5 pt-5 pb-4 flex items-center gap-4 flex-shrink-0">
                  <button type="button" onClick={() => groupPhotoRef.current?.click()} className="relative h-16 w-16 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 hover:opacity-80 transition-opacity">
                    {groupPhotoPreview ? <img src={groupPhotoPreview} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-slate-500"><Camera size={22} /></div>}
                  </button>
                  <input ref={groupPhotoRef} type="file" accept="image/*" className="hidden" onChange={handleGroupPhoto} />
                  <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Nome do grupo" autoFocus className={cn('h-10 flex-1 rounded-lg border px-3 text-sm outline-none focus:border-orange-400', darkMode ? 'bg-[hsl(var(--muted))] border-[hsl(var(--border))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]' : 'border-slate-200')} />
                </div>
                <div className={cn('mx-5 mb-4 rounded-xl border p-3 flex items-center gap-3 flex-shrink-0', darkMode ? 'border-[hsl(var(--muted))] bg-[hsl(var(--muted))]/50' : 'border-slate-100 bg-slate-50')}>
                  <div className="flex-1">
                    <p className={cn('text-sm font-medium', darkMode ? 'text-[hsl(var(--foreground))]' : 'text-slate-700')}>Grupo informativo</p>
                    <p className={cn('text-xs mt-0.5', darkMode ? 'text-[hsl(var(--muted-foreground))]' : 'text-slate-500')}>Apenas admins podem enviar mensagens</p>
                  </div>
                  <button type="button" onClick={() => setGroupBroadcast(v => !v)} className={cn('relative h-6 w-11 rounded-full transition-colors flex-shrink-0', groupBroadcast ? 'bg-orange-500' : (darkMode ? 'bg-[hsl(var(--border))]' : 'bg-slate-200'))}>
                    <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', groupBroadcast ? 'translate-x-5' : 'translate-x-0.5')} />
                  </button>
                </div>
                <div className={cn('mx-5 mb-2 text-xs font-semibold uppercase tracking-wide flex-shrink-0', darkMode ? 'text-[hsl(var(--muted-foreground))]' : 'text-slate-500')}>
                  Participantes{selectedUsers.length > 0 && <span className="normal-case font-normal"> ({selectedUsers.length} selecionados)</span>}
                </div>
                <div className="px-5 mb-2 relative flex-shrink-0">
                  <Search size={14} className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input value={groupUserSearch} onChange={e => setGroupUserSearch(e.target.value)} placeholder="Buscar participantes..." className={cn('h-9 w-full rounded-lg border pl-9 pr-3 text-sm outline-none focus:border-orange-400', darkMode ? 'bg-[hsl(var(--muted))] border-[hsl(var(--border))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]' : 'border-slate-200')} />
                </div>
                <div className="overflow-y-auto px-5 pb-2 flex-1" style={{ minHeight: '160px' }}>
                  {users.filter(u => u.id !== user?.id).filter(u => {
                    if (!groupUserSearch.trim()) return true;
                    const q = groupUserSearch.toLowerCase();
                    return u.name.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
                  }).map(u => {
                    const sel = selectedUsers.includes(u.id);
                    return (
                      <button key={u.id} type="button" onClick={() => setSelectedUsers(v => sel ? v.filter(id => id !== u.id) : [...v, u.id])} className={cn('w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-colors', sel ? (darkMode ? 'bg-orange-500/20' : 'bg-orange-50') : (darkMode ? 'hover:bg-[hsl(var(--muted))]' : 'hover:bg-slate-50'))}>
                        <div className="relative h-9 w-9 flex-shrink-0">
                          {u.photo_url ? <img src={u.photo_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-sm font-semibold">{u.name.charAt(0).toUpperCase()}</div>}
                          {u.online && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm font-medium truncate', darkMode ? 'text-[hsl(var(--foreground))]' : 'text-slate-800')}>{u.name}</p>
                          {u.position && <p className={cn('text-xs truncate', darkMode ? 'text-[hsl(var(--muted-foreground))]' : 'text-slate-500')}>{u.position}</p>}
                        </div>
                        <div className={cn('h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors', sel ? 'border-orange-500 bg-orange-500' : (darkMode ? 'border-[hsl(var(--border))]' : 'border-slate-300'))}>
                          {sel && <Check size={11} className="text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className={cn('px-5 py-4 border-t flex-shrink-0', darkMode ? 'border-[hsl(var(--muted))]' : 'border-slate-100')}>
                  <button type="submit" disabled={!groupName.trim()} className="h-10 w-full rounded-xl bg-orange-500 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors">
                    Criar grupo{selectedUsers.length > 0 ? ` com ${selectedUsers.length} participante${selectedUsers.length > 1 ? 's' : ''}` : ''}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        <div className="chat-stories"><StoriesBar /></div>
        <div className="chat-conversation-list flex-1 overflow-y-auto">

          {showJarvisConversation && <div className={cn('chat-conversation-row', selectedJarvis && 'is-jarvis-selected')}>
            <button type="button" className="chat-jarvis-conversation" aria-current={selectedJarvis ? 'true' : undefined} onClick={() => { setSelectedId(JARVIS_CONVERSATION_ID); setMobileView('messages'); }}>
              <span className="chat-jarvis-avatar"><Bot size={24} /></span>
              <span className="chat-jarvis-summary"><span className="chat-conversation-name">Jarvis</span>
                <span className="chat-conversation-preview truncate">{drafts[JARVIS_CONVERSATION_ID]?.text
                  ? <><span className="chat-draft-label">Rascunho: </span>{drafts[JARVIS_CONVERSATION_ID].text}</>
                  : jarvisState.pending ? 'Jarvis está respondendo…' : jarvisState.messages.at(-1)?.content || 'Converse com seu assistente pessoal'}</span>
              </span>
            </button>
          </div>}
          {filteredConversations.length || showJarvisConversation ? filteredConversations.map(conv => (
            <div key={conv.id} className={cn(
              'chat-conversation-row group relative w-full border-b flex items-center gap-3 transition-colors',
              darkMode ? 'border-[hsl(var(--muted))] hover:bg-[hsl(var(--card))]' : 'border-slate-50 hover:bg-slate-50',
              conv.unread_count > 0 && 'has-unread',
              selectedId === conv.id && (darkMode ? 'bg-[hsl(var(--muted))]' : 'bg-orange-50'),
            )}>
              {/* Avatar: click → profile (direct) or select (group) */}
              <button
                onClick={() => {
                  if (conv.type === 'direct') openProfileFromConv(conv);
                  else { setSelectedId(conv.id); setMobileView('messages'); }
                }}
                className="chat-conversation-avatar pl-4 py-3 flex-shrink-0 hover:opacity-80 transition-opacity"
                title={conv.type === 'direct' ? 'Ver perfil' : undefined}
              >
                <ConvAvatar conv={conv} usersById={usersById} />
              </button>
              {/* Body: click → select conversation */}
              <button onClick={() => { setSelectedId(conv.id); setMobileView('messages'); setMentionQuery(null); setMentionParticipants([]); }} className="chat-conversation-body min-w-0 flex-1 text-left pr-2 py-3" aria-current={selectedId === conv.id ? 'true' : undefined} title={conv.name || 'Minhas notas'}>
                <div className="chat-conversation-summary flex items-center gap-1.5">
                  <p className={cn("chat-conversation-name min-w-0 whitespace-normal break-words text-[15px] font-bold leading-5", darkMode ? "text-[hsl(var(--foreground))]" : "text-slate-800")}>{conv.type === 'direct' && !conv.other_participant ? 'Minhas notas' : (conv.name || 'Conversa direta')}</p>
                  {conv.last_message?.created_at && <time className='chat-conversation-time' dateTime={conv.last_message.created_at}>{conversationTime(conv.last_message.created_at)}</time>}
                </div>
                <div className='chat-conversation-bottom'>
                  <p className='chat-conversation-preview truncate'>{(()=>{const ct=typingByConv.get(conv.id);if(ct&&ct.size>0){const us=Array.from(ct.values());const rec=us.some(u=>u.isRecording);return <span className="text-orange-500 italic">{rec?'🎤 Gravando áudio...':`${us.map(u=>u.name).join(', ')} ${us.length===1?'está':'estão'} digitando...`}</span>;}return drafts[conv.id]?.text?<><span className='chat-draft-label'>Rascunho: </span>{drafts[conv.id].text}</>:conversationPreview(conv,user?.id);})()}</p>
                  {conv.is_pinned && <Pin size={12} className='text-orange-400 flex-shrink-0' aria-label='Conversa fixada'/>}
                  {conv.is_muted && <BellOff size={12} className='text-slate-400 flex-shrink-0' aria-label='Conversa silenciada'/>}
                  {conv.unread_count > 0 && <span className={cn('chat-conversation-unread',conv.is_muted && 'is-muted')} aria-label={`${conv.unread_count} mensagens não lidas`}>{conv.unread_count>99?'99+':conv.unread_count}</span>}
                </div>
              </button>
              <Popover open={openConvActionsId===conv.id} onOpenChange={open=>setOpenConvActionsId(open?conv.id:null)}>
                <PopoverTrigger asChild>
                  <button type='button' className='chat-conversation-more' title='Opções da conversa' aria-label={`Opções da conversa ${conv.name || 'Minhas notas'}`} disabled={conversationActionsBusy.has(conv.id)}><MoreVertical size={18}/></button>
                </PopoverTrigger>
                <PopoverContent align='end' sideOffset={6} collisionPadding={12} className='chat-conversation-options' aria-label={`Ações da conversa ${conv.name || 'Minhas notas'}`}>
                  <button type='button' disabled={conversationActionsBusy.has(conv.id)} onClick={event=>{setOpenConvActionsId(null);void handlePinConversation(conv.id,event);}}><Pin size={17}/><span>{conv.is_pinned?'Desafixar conversa':'Fixar conversa'}</span></button>
                  <button type='button' disabled={conversationActionsBusy.has(conv.id)} onClick={event=>{setOpenConvActionsId(null);void handleToggleMute(conv.id,event);}}>{conv.is_muted?<Bell size={17}/>:<BellOff size={17}/>}<span>{conv.is_muted?'Reativar notificações':'Silenciar conversa'}</span></button>
                  <button type='button' disabled={conversationActionsBusy.has(conv.id)} onClick={()=>{setOpenConvActionsId(null);void handleArchiveConversation(conv);}}><Archive size={17}/><span>{conv.is_archived?'Desarquivar conversa':'Arquivar conversa'}</span></button>
                </PopoverContent>
              </Popover>
            </div>
          )) : (
            <div className="chat-list-empty"><Search size={28} /><strong>Nenhuma conversa encontrada</strong><p>{conversationSearch || conversationFilter !== 'all' ? 'Ajuste a busca ou os filtros.' : 'Encontre uma pessoa da equipe para começar.'}</p>{(conversationSearch || conversationFilter !== 'all') && <button type="button" onClick={() => { setConversationSearch(''); setConversationFilter('all'); }}>Limpar filtros</button>}</div>
          )}
        </div>
      </aside>

      {/* ── Center: Messages ── */}
      <main className={cn(
        cn('chat-message-pane min-w-0 overflow-hidden flex-col flex-1 lg:rounded-r-2xl', darkMode ? 'bg-[hsl(var(--background))]' : 'bg-white'),
        mobileView === 'list' ? 'hidden md:flex' : 'flex'
      )}>
        {selectedJarvis && user ? <JarvisChatThread key={user.id} userId={user.id} onBack={() => setMobileView('list')} /> : selectedConversation ? (
          <>
            {/* Header */}
            <div className={cn("chat-thread-header flex items-center gap-2 border-b px-3 md:px-5 py-3 flex-shrink-0", darkMode ? "border-[hsl(var(--muted))] bg-[hsl(var(--card))]" : "border-slate-100 bg-white")}>
              <button className="md:hidden h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 flex-shrink-0"
                onClick={() => setMobileView('list')} aria-label="Voltar às conversas">
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => openProfileFromConv(selectedConversation)}
                className={cn('flex-shrink-0', selectedConversation.type === 'direct' ? 'hover:opacity-80 transition-opacity cursor-pointer' : 'cursor-default')}
                title={selectedConversation.type === 'direct' ? 'Ver perfil' : undefined}
              >
                <ConvAvatar conv={selectedConversation} usersById={usersById} />
              </button>
              <div className="chat-thread-identity min-w-0 flex-1">
                <button
                  onClick={() => openProfileFromConv(selectedConversation)}
                  className={cn('truncate text-base font-bold block w-full text-left', darkMode ? 'text-[hsl(var(--foreground))]' : 'text-slate-900', selectedConversation.type === 'direct' && 'hover:text-[#0057b8] transition-colors')}
                  disabled={selectedConversation.type !== 'direct'}
                >
                  {selectedConversation.type === 'direct' && !selectedConversation.other_participant ? 'Minhas notas' : selectedConversation.name || 'Conversa direta'}
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
              <div className="chat-thread-actions flex items-center gap-1 flex-shrink-0">
                <Popover>
                  <PopoverTrigger asChild><button type='button' className='chat-icon-button' title='Tamanho da fonte' aria-label='Tamanho da fonte'><Type size={20}/></button></PopoverTrigger>
                  <PopoverContent align='end' sideOffset={8} className='chat-font-options'>
                    <p>Fonte das mensagens</p>
                    <div className='chat-font-controls'>
                      <button type='button' aria-label='Diminuir fonte' disabled={fontScale<=80} onClick={()=>changeFontScale(fontScale-10)}>A−</button>
                      <output aria-live='polite' aria-label='Tamanho atual da fonte'>{fontScale}%</output>
                      <button type='button' aria-label='Aumentar fonte' disabled={fontScale>=160} onClick={()=>changeFontScale(fontScale+10)}>A+</button>
                    </div>
                    <button type='button' className='chat-font-reset' onClick={()=>changeFontScale(110)}>Restaurar padrão (110%)</button>
                  </PopoverContent>
                </Popover>
                <button type='button' aria-label={selectedConversation.is_pinned?'Desafixar conversa':'Fixar conversa'} title={selectedConversation.is_pinned?'Desafixar conversa':'Fixar conversa'} aria-pressed={!!selectedConversation.is_pinned} disabled={conversationActionsBusy.has(selectedConversation.id)} onClick={event=>void handlePinConversation(selectedConversation.id,event)} className='chat-icon-button'><Pin size={20}/></button>
                <button type='button' aria-label={selectedConversation.is_muted?'Reativar notificações':'Silenciar conversa'} title={selectedConversation.is_muted?'Reativar notificações':'Silenciar conversa'} aria-pressed={!!selectedConversation.is_muted} disabled={conversationActionsBusy.has(selectedConversation.id)} onClick={event=>void handleToggleMute(selectedConversation.id,event)} className='chat-icon-button'><BellOff size={20}/></button>
                <button aria-label='Chamar atenção' aria-pressed={showAttention} title='Chamar atenção para uma mensagem' className='chat-icon-button chat-attention-trigger' disabled={!canSend} onClick={()=>{setShowAttention(value=>!value);setAttentionMessage(null);}}><Bell size={22}/></button>
                <button aria-label={selectedConversation.is_archived ? 'Desarquivar conversa' : 'Arquivar conversa'} title={selectedConversation.is_archived ? 'Desarquivar conversa' : 'Arquivar conversa'} disabled={conversationActionsBusy.has(selectedConversation.id)} onClick={() => void handleArchiveConversation(selectedConversation)} className='chat-icon-button'><Archive size={22} /></button>
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
                  onClick={togglePeople}
                  data-chat-people-toggle title={peopleOpen ? "Ocultar pessoas" : "Mostrar pessoas"}
                  aria-label="Mostrar pessoas" aria-haspopup="dialog" aria-controls="chat-people-panel" aria-expanded={peopleOpen}
                  className={cn('chat-show-people h-8 w-8 flex items-center justify-center rounded-lg transition-colors', peopleOpen ? 'bg-orange-50 text-orange-600' : 'text-slate-500 hover:bg-slate-100')}
                >
                  <Users size={15} />
                </button>
                <button onClick={() => setShowMsgSearch(v => !v)} title="Buscar nesta conversa" aria-label="Buscar nesta conversa" aria-expanded={showMsgSearch}
                  className={cn('h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100', showMsgSearch && 'bg-orange-50 text-orange-600')}>
                  <Search size={15} />
                </button>
                <button onClick={handleOpenNotes} title="Anotações"
                  className={cn('h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100', showNotes && 'bg-orange-50 text-orange-600')}>
                  <BookOpen size={15} />
                </button>
                {selectedConversation.type === 'group' && (
                  <button onClick={() => setShowGroupSettings(v => !v)} title="Configurações do grupo" aria-label="Configurações do grupo"
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
              <div className="chat-pinned-message flex-shrink-0 flex items-center gap-3" aria-label="Mensagem fixada">
                <Pin size={16} className="flex-shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="chat-pinned-label">Mensagem fixada</p>
                  <p className="chat-pinned-preview truncate">
                    {selectedConversation.pinned_message.content?.startsWith('[IMAGE]') ? '📷 Foto'
                      : selectedConversation.pinned_message.content?.startsWith('[VIDEO]') ? '🎬 Vídeo'
                      : selectedConversation.pinned_message.content?.startsWith('[AUDIO_MSG]') ? '🎤 Áudio'
                      : <LinkText text={selectedConversation.pinned_message.content || ''} mentionMatcher={mentionMatcher} onMention={openMentionProfile}/>}
                  </p>
                </div>
                <button type="button" aria-label="Desafixar mensagem" title="Desafixar mensagem" onClick={() => handlePinMessage({ id: selectedConversation.pinned_message!.id, content: selectedConversation.pinned_message!.content, sender: selectedConversation.pinned_message!.sender as any, conversation_id: selectedId!, created_at: '', updated_at: '' })} className="flex-shrink-0"><X size={16} /></button>
              </div>
            )}

            {showAttention && <div className='chat-attention-selection' role='status'><Bell size={20}/><span>Selecione a mensagem na conversa para chamar atenção.</span><button onClick={()=>{setShowAttention(false);setAttentionMessage(null);}}>Cancelar</button></div>}
            {/* Messages */}
            <div ref={messagesContainerRef} className={cn('chat-message-history flex-1 space-y-3 overflow-y-auto px-8 py-5', isDragging && 'is-dragging',showAttention && 'is-selecting-attention')} data-custom-wallpaper={!!theme.bgImage} aria-label="Mensagens da conversa" onScroll={e => { const c = e.currentTarget; const atBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 120; atBottomRef.current = atBottom; setShowScrollBtn(!atBottom); }} onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={e => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file && selectedId) { const type = file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : 'document'; setPendingFile({ src: type !== 'document' ? URL.createObjectURL(file) : '', type, raw: file }); } }} style={{
              backgroundColor: theme.bgColor,
              backgroundImage: theme.bgImage ? `url(${theme.bgImage})` : undefined,
              backgroundPosition: theme.bgImage ? 'center' : undefined,
              backgroundSize: theme.bgImage ? 'cover' : undefined,
            }}>
              {messagesError && <div role="alert" className="chat-load-error">{messagesError} <button onClick={() => selectedId && void loadMessages(selectedId)}>Tentar novamente</button></div>}
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
              {displayedMessages.length ? displayedMessages.map((message, index) => {
                const mine = message.sender_id === user?.id;
                const previous = displayedMessages[index - 1];
                const newDay = !previous || dayKey(previous.created_at) !== dayKey(message.created_at);
                const continuation = !newDay && previous?.sender_id === message.sender_id
                  && new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() < 5 * 60_000;
                const lastReadAt = selectedConversation?.other_participant?.last_read_at;
                return (
                  <Fragment key={message.id}>
                  {newDay && <div className="chat-day-divider"><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</time></div>}
                  <div id={`chat-message-${message.id}`} data-conversation-id={message.conversation_id} className={cn('chat-message-row flex gap-2', mine && 'justify-end', continuation && 'is-continuation',requestedMessage===message.id && 'chat-message-attention')}>
                    {showAttention && !message.is_deleted && <button type='button' className='chat-attention-pick' aria-label={`Chamar atenção para a mensagem de ${message.sender?.name || 'participante'}: ${message.content.startsWith('[')?'Mídia ou arquivo':message.content.slice(0,100)}`} onClick={()=>setAttentionMessage(message)}><span><Bell size={16}/>Selecionar mensagem</span></button>}
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
                        aria-label={`Ver perfil de ${message.sender?.name || "usuário"}`}
                      >
                        <AchievementAvatar userId={message.sender_id} name={message.sender?.name || 'Usuário'}
                          photo={usersById.get(message.sender_id || '')?.photo_url || message.sender?.photo_url} size={36} />
                      </button>
                    )}
                    <MessageBubble
                      message={message} mine={mine} lastReadAt={lastReadAt} theme={theme}
                      isGroup={selectedConversation?.type === 'group'}
                      isSelfConversation={selectedConversation?.type === 'direct' && !selectedConversation?.other_participant}
                      mentionMatcher={mentionMatcher} onMention={openMentionProfile}
                      onImageClick={setLightboxSrc}
                      onEdit={mine ? (msg) => { setEditingMsg(msg); setEditText(msg.content); } : undefined}
                      onDelete={mine ? handleDeleteMessage : undefined}
                      onReply={setReplyingTo}
                      onForward={(msg) => { setForwardingMsg(msg); setForwardSearch(''); }}
                      onReact={async emoji=>{
                        const reactions=await setChatReaction(message.conversation_id,message.id,emoji);
                        if(currentConversation.current===message.conversation_id)setMessages(previous=>previous.map(item=>item.id===message.id?{...item,reactions}:item));
                      }}
                      onPin={handlePinMessage}
                      isPinned={selectedConversation?.pinned_message?.id === message.id}
                    />
                  </div>
                  </Fragment>
                );
              }) : (
                <div className='chat-thread-status' role='status' aria-live='polite'>
                  {messagesLoading ? 'Carregando mensagens…' : messageSearch ? 'Nenhuma mensagem encontrada.' : messagesError ? 'Mensagens indisponíveis no momento.' : 'Nenhuma mensagem ainda.'}
                </div>
              )}
              {showScrollBtn && (
                <div className="sticky bottom-4 z-20 flex justify-end pointer-events-none">
                  <button
                    onClick={() => { const c = messagesContainerRef.current; atBottomRef.current = true; if (c) c.scrollTop = c.scrollHeight; setShowScrollBtn(false); }}
                    className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg hover:bg-orange-600 transition-colors"
                    title="Ir para o final"
                  >
                    <ChevronsDown size={18} />
                  </button>
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

            {/* Media send modal */}
            {pendingFile && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-4"
                onClick={e => { if (e.target === e.currentTarget) { setPendingFile(null); setPendingCaption(''); } }}>
                <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-800">
                    <p className="text-sm font-semibold text-white">Enviar arquivo</p>
                    <button onClick={() => { setPendingFile(null); setPendingCaption(''); }}
                      className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-slate-600 text-slate-300">
                      <X size={15} />
                    </button>
                  </div>
                  {/* Preview */}
                  <div className="bg-slate-900 flex items-center justify-center p-3 min-h-[280px] max-h-[65vh] overflow-hidden">
                    {pendingFile.type === 'image'
                      ? <img src={pendingFile.src} alt="" className="max-h-[50vh] max-w-full object-contain rounded-lg" />
                      : pendingFile.type === 'video'
                        ? <video src={pendingFile.src} controls className="max-h-[50vh] max-w-full rounded-lg" />
                        : <div className="flex flex-col items-center gap-3 py-8">
                            <FileText size={52} className="text-orange-400" />
                            <p className="text-sm text-slate-300 text-center px-4 break-all">{pendingFile.raw.name}</p>
                          </div>}
                  </div>
                  {/* Footer */}
                  <div className="p-3 bg-slate-800">
                    <p className="text-[10px] text-slate-400 mb-1.5 px-1">{pendingFile.raw.name} · {(pendingFile.raw.size / 1024 / 1024).toFixed(1)} MB</p>
                    <div className="flex gap-2">
                      <input value={pendingCaption} onChange={e => setPendingCaption(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } if (e.key === 'Escape') { setPendingFile(null); setPendingCaption(''); } }}
                        placeholder="Adicionar legenda..." autoFocus
                        className="flex-1 h-10 rounded-xl bg-slate-700 border border-slate-600 text-white placeholder-slate-400 px-3 text-sm outline-none focus:border-orange-400" />
                      <button onClick={() => handleSend()}
                        className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-600 text-white">
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                </div>
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
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                    <div className="flex items-end gap-[2px] flex-1 min-w-0 h-8">
                      {(waveformBars.length > 0 ? waveformBars : Array.from({length:20},()=>20)).map((v,i)=>(
                        <span key={i} className="flex-1 rounded-sm bg-red-500 transition-all duration-75"
                          style={{height:`${Math.max(4,(v/255)*100)}%`,opacity:waveformBars.length>0?1:0.3}} />
                      ))}
                    </div>
                    <span className="text-sm font-semibold text-red-700 flex-shrink-0">{recordingSeconds}s</span>
                    <button onClick={stopRecording} className="ml-2 h-8 px-3 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600 flex-shrink-0">Enviar</button>
                    <button onClick={() => { cancelRecordingRef.current = true; mediaRecorderRef.current?.stop(); mediaRecorderRef.current = null; setIsRecording(false); if (recordingTimerRef.current) clearInterval(recordingTimerRef.current); if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; } if (audioCtxRef.current) { audioCtxRef.current.close().catch(()=>{}); audioCtxRef.current = null; } analyserRef.current = null; setWaveformBars([]); }} className="h-8 px-3 rounded-lg border border-red-200 text-red-600 text-xs font-bold flex-shrink-0">Cancelar</button>
                  </div>
                )}
                {(()=>{const ct=selectedId?typingByConv.get(selectedId):null;if(!ct||ct.size===0)return null;const us=Array.from(ct.values());return(<div className="px-1 pb-1 flex items-center gap-1.5 text-xs text-slate-400 italic"><span className="flex gap-[3px] items-end"><span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{animationDelay:'0ms'}}/><span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{animationDelay:'150ms'}}/><span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{animationDelay:'300ms'}}/></span>{us.map(u=>u.name).join(', ')} {us.length===1?'está':'estão'} digitando...</div>);})()}
                {sendFailure?.conversationId === selectedId && <p role="alert" className="chat-send-error">{sendFailure.message}</p>}
                <form onSubmit={handleSend} className="chat-composer-form relative flex items-center gap-2">
                  {/* Mobile toggle — shows/hides tool buttons */}
                  <button type="button"
                    className="chat-tools-toggle flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-orange-500"
                    onClick={() => setShowInputTools(v => !v)} title="Ferramentas" aria-label="Ferramentas da mensagem" aria-expanded={showInputTools}>
                    {showInputTools ? <ChevronDown size={19} /> : <ChevronUp size={19} />}
                  </button>
                  {/* Tools (always visible desktop, toggle mobile) */}
                  <div className={cn('chat-composer-tools items-center gap-2', showInputTools && 'is-open')}>
                  {/* Emoji */}
                  <div className="relative">
                    <button type="button" data-emoji-btn onClick={() => { setShowEmoji(v => !v); setShowStickers(false); }}
                      className="h-10 w-10 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-orange-500" title="Emojis">
                      <Smile size={19} />
                    </button>
                    {showEmoji && (
                      <div data-emoji-panel className="chat-emoji-panel absolute bottom-14 left-0 z-30 w-72 rounded-xl border border-slate-200 bg-white shadow-2xl p-3">
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
                      <div data-sticker-panel className="chat-sticker-panel absolute bottom-14 left-0 z-30 w-64 rounded-xl border border-slate-200 bg-white shadow-2xl p-3">
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

                  {/* Reminder */}
                  <button type="button" onClick={() => setShowReminderModal(true)}
                    className="h-10 w-10 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-orange-500" title="Criar lembrete">
                    <AlarmClock size={19} />
                  </button>
                  </div>{/* end tools */}

                  {mentionQuery !== null && mentionParticipants.length > 0 && (() => {
                    const mShowTodos = 'todos'.startsWith((mentionQuery || '').toLowerCase());
                    const mFiltered = mentionParticipants.filter(p => p.name.toLowerCase().includes((mentionQuery || '').toLowerCase())).slice(0, 6);
                    return (
                      <div className="absolute bottom-14 left-12 z-30 w-56 rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
                        <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Mencionar</p>
                        {mShowTodos && (
                          <button type="button"
                            onMouseDown={e => {
                              e.preventDefault();
                              setMessageText(prev => { const at = prev.lastIndexOf('@'); return at >= 0 ? prev.slice(0, at) + '@todos ' : prev + '@todos '; });
                              setMentionQuery(null);
                            }}
                            className={cn('w-full flex items-center gap-2 px-3 py-2 text-left border-b border-slate-100', mentionIndex === 0 ? 'bg-orange-100' : 'hover:bg-orange-50')}>
                            <Users size={16} className="text-orange-500 flex-shrink-0" />
                            <span className="text-sm font-semibold text-slate-700">@todos</span>
                            <span className="text-xs text-slate-400 ml-auto">{mentionParticipants.length}</span>
                          </button>
                        )}
                        {mFiltered.map((p, pIdx) => {
                          const absIdx = mShowTodos ? pIdx + 1 : pIdx;
                          return (
                            <button key={p.id} type="button"
                              onMouseDown={e => {
                                e.preventDefault();
                                setMessageText(prev => { const at = prev.lastIndexOf('@'); return at >= 0 ? prev.slice(0, at) + '@' + p.name + ' ' : prev + '@' + p.name + ' '; });
                                setMentionQuery(null);
                              }}
                              className={cn('w-full flex items-center gap-2 px-3 py-2 text-left', mentionIndex === absIdx ? 'bg-orange-100' : 'hover:bg-orange-50')}>
                              <AchievementAvatar userId={p.id} name={p.name} photo={p.photo_url} size={36} />
                              <span className="text-sm font-semibold text-slate-700 truncate">{p.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                  <textarea ref={composerRef} value={messageText} onChange={e => {
                    setMessageText(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    const c = messagesContainerRef.current;
                    if (c && atBottomRef.current) c.scrollTop = c.scrollHeight;
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
                    if (selectedId && val.trim().length > 0) {
                      const now = Date.now();
                      if (now - typingLastSentRef.current > 2000) {
                        typingLastSentRef.current = now;
                        wsEventBus.send({ type: 'chat:typing', conversationId: selectedId });
                      }
                    }
                  }} onKeyDown={e => {
                    if (mentionQuery !== null) {
                      const mfK = mentionParticipants.filter(p => p.name.toLowerCase().includes((mentionQuery || '').toLowerCase())).slice(0, 6);
                      const msTK = 'todos'.startsWith((mentionQuery || '').toLowerCase());
                      const totalK = (msTK ? 1 : 0) + mfK.length;
                      if (e.key === 'ArrowDown' && totalK > 0) { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, totalK - 1)); return; }
                      if (e.key === 'ArrowUp' && totalK > 0) { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return; }
                      if (e.key === 'Enter' && !e.shiftKey && totalK > 0) {
                        e.preventDefault();
                        const idx = mentionIndex;
                        if (msTK && idx === 0) {
                          setMessageText(prev => { const at = prev.lastIndexOf('@'); return at >= 0 ? prev.slice(0, at) + '@todos ' : prev + '@todos '; });
                        } else {
                          const p = mfK[msTK ? idx - 1 : idx];
                          if (p) setMessageText(prev => { const at = prev.lastIndexOf('@'); return at >= 0 ? prev.slice(0, at) + '@' + p.name + ' ' : prev + '@' + p.name + ' '; });
                        }
                        setMentionQuery(null);
                        return;
                      }
                    }
                    if (e.key === 'Escape') setMentionQuery(null);
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void handleSend(); }
                  }} onPaste={handlePaste}
                    placeholder="Mensagem…" aria-label="Escreva uma mensagem" disabled={isRecording}
                    rows={1} maxLength={8000}
                    className="flex-1 min-h-[40px] max-h-[120px] rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-orange-400 resize-none overflow-y-auto leading-5 align-middle"
                    style={darkMode ? { backgroundColor: '#2a3942', borderColor: '#3b4a54', color: '#e9edef' } : {}} />

                  {/* Audio */}
                  <button type="button" onClick={isRecording ? stopRecording : startRecording} title={isRecording ? 'Enviar gravação' : 'Gravar áudio'} aria-label={isRecording ? 'Enviar gravação' : 'Gravar áudio'}
                    className={cn('h-10 w-10 flex items-center justify-center rounded-lg transition-colors',
                      isRecording ? 'bg-red-500 text-white hover:bg-red-600' : 'text-slate-500 hover:bg-slate-100 hover:text-orange-500')}>
                    {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>

                  {/* Send */}
                  <button type="submit" disabled={!messageText.trim() || isRecording} title="Enviar mensagem" aria-label="Enviar mensagem"
                    className="chat-send-button h-10 rounded-lg bg-orange-500 px-4 text-white hover:bg-orange-600 disabled:opacity-40">
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

      {/* People float above the workspace without taking a conversation column. */}
      {peopleOpen && <aside ref={peoplePanelRef} id="chat-people-panel" role="dialog" aria-modal="false"
        className="chat-users-drawer chat-users-floating flex-col overflow-hidden border border-slate-200 bg-slate-50"
        aria-label="Pessoas da equipe">
        <div className="border-b border-slate-100 p-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-orange-500" />
            <h2 className="text-sm font-bold text-slate-900">Pessoas</h2>
            <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{onlineUsers.length} online</span>
            <button
              className="chat-people-close h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Fechar pessoas"
              onClick={() => closePeople(true)}
            >
              <X size={15} />
            </button>
          </div>
          <div className="relative mt-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input ref={peopleSearchRef} value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Encontrar uma pessoa…" aria-label="Encontrar uma pessoa" className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-orange-400" />
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
                    <button onClick={() => { setPeopleOpen(false); setProfileUser(item); }} className="relative flex-shrink-0 hover:opacity-80 transition-opacity">
                      <AchievementAvatar userId={item.id} name={item.name} photo={item.photo_url} size={40} />
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                    </button>
                    <button onClick={() => { setPeopleOpen(false); setProfileUser(item); }} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-1.5">
                        <p className="min-w-0 whitespace-normal break-words text-[15px] font-semibold leading-5 text-slate-800">{item.name}</p>
                        {unread > 0 && <span className="flex-shrink-0 min-w-[18px] text-center rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-tight">{unread}</span>}
                      </div>
                      <p className="truncate text-xs text-emerald-600">Online</p>
                    </button>
                    <button onClick={() => { setPeopleOpen(false); setNewGroupOpen(true); setSelectedUsers(prev => selected ? prev.filter(id => id !== item.id) : [...prev, item.id]); }}
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
            <div className={cn(onlineUsers.length > 0 && 'mt-4 border-t border-slate-200 pt-2')}>
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Visto por último</p>
              </div>
              {offlineUsers.map(item => {
                const selected = selectedUsers.includes(item.id);
                const unread = unreadByUserId.get(item.id) ?? 0;
                return (
                  <div key={item.id} className={cn('group px-3 py-2.5 border-b border-slate-50 hover:bg-slate-50 flex items-center gap-2.5 transition-colors', selected && 'bg-orange-50')}>
                    <button onClick={() => { setPeopleOpen(false); setProfileUser(item); }} className="relative flex-shrink-0 hover:opacity-80 transition-opacity">
                      <AchievementAvatar userId={item.id} name={item.name} photo={item.photo_url} size={40} />
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-slate-300" />
                    </button>
                    <button onClick={() => { setPeopleOpen(false); setProfileUser(item); }} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-1.5">
                        <p className="min-w-0 whitespace-normal break-words text-[15px] font-semibold leading-5 text-slate-800">{item.name}</p>
                        {unread > 0 && <span className="flex-shrink-0 min-w-[18px] text-center rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-tight">{unread}</span>}
                      </div>
                      <p className="truncate text-xs text-slate-500">{presenceLabel(item)}</p>
                    </button>
                    <button onClick={() => { setPeopleOpen(false); setNewGroupOpen(true); setSelectedUsers(prev => selected ? prev.filter(id => id !== item.id) : [...prev, item.id]); }}
                      className={cn('flex h-6 w-6 items-center justify-center rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity', selected ? 'bg-orange-100 text-orange-700' : 'border border-slate-200 text-slate-500')}>
                      {selected ? <Check size={12} /> : <Plus size={12} />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>}

      {/* Group settings panel */}
      {showGroupSettings && selectedConversation?.type === 'group' && user && (
        <GroupSettings conv={selectedConversation} users={users} myId={user.id} onClose={() => setShowGroupSettings(false)} onUpdate={handleConvUpdate} />
      )}

      {/* Theme panel */}
      {showTheme && <AppearanceDialog onClose={() => setShowTheme(false)} />}

      {/* Notes panel */}
      {showNotes && selectedConversation && (
        <div className="chat-settings-overlay fixed inset-0 z-50 flex">
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

      {/* Reminder modal */}
      {showReminderModal && selectedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e => { if (e.target === e.currentTarget) setShowReminderModal(false); }}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2"><AlarmClock size={16} className="text-orange-500" /> Novo lembrete</h3>
              <button onClick={() => setShowReminderModal(false)}><X size={18} className="text-slate-400 hover:text-slate-700" /></button>
            </div>
            <input type="text" value={reminderText} onChange={e => setReminderText(e.target.value)}
              placeholder="O que devo lembrar?" autoFocus
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-orange-400 mb-3" />
            <input type="datetime-local" value={reminderDateTime} onChange={e => setReminderDateTime(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-orange-400 mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setShowReminderModal(false)} className="flex-1 h-9 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={handleSaveReminder} disabled={!reminderText.trim() || !reminderDateTime} className="flex-1 h-9 rounded-lg bg-orange-500 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Active reminder alert */}
      {activeReminder && (
        <div className="fixed bottom-6 right-6 z-50 w-80 rounded-2xl bg-white border border-orange-200 shadow-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 flex-shrink-0 rounded-full bg-orange-100 flex items-center justify-center">
              <AlarmClock size={18} className="text-orange-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-orange-600 mb-0.5">Lembrete — {activeReminder.convName}</p>
              <p className="text-sm text-slate-700">{activeReminder.text}</p>
            </div>
            <button onClick={() => setActiveReminder(null)}><X size={16} className="text-slate-400 hover:text-slate-700" /></button>
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

      {/* Forward message modal */}
      {forwardingMsg && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setForwardingMsg(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[70vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">Encaminhar mensagem</h3>
              <button onClick={() => setForwardingMsg(null)} className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={18}/></button>
            </div>
            <div className="px-3 py-2 border-b border-slate-100">
              <input
                autoFocus
                type="text"
                placeholder="Buscar conversa..."
                value={forwardSearch}
                onChange={e => setForwardSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {conversations
                .filter(c => {
                  const name = c.type === 'direct' && !c.other_participant ? 'Minhas notas' : (c.name || '');
                  return name.toLowerCase().includes(forwardSearch.toLowerCase());
                })
                .map(c => {
                  const name = c.type === 'direct' && !c.other_participant ? 'Minhas notas' : (c.name || 'Conversa direta');
                  return (
                    <button
                      key={c.id}
                      disabled={forwardingSending}
                      onClick={async () => {
                        setForwardingSending(true);
                        try {
                          const senderName = forwardingMsg.sender?.name || 'Alguém';
                          const originalContent = forwardingMsg.content ?? '';
                          const fwdPrefix = originalContent.match(/^\[FWD:(.+?)\]\n/) ? '' : `[FWD:${senderName}]\n`;
                          const content = fwdPrefix + originalContent;
                          await sendChatMessage(c.id, content);
                          await loadConversations();
                          setForwardingMsg(null);
                        } catch { alert('Erro ao encaminhar. Tente novamente.'); }
                        finally { setForwardingSending(false); }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-orange-50 disabled:opacity-50"
                    >
                      <span className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-600 flex-shrink-0">{name.charAt(0).toUpperCase()}</span>
                      <span className="text-sm font-medium text-slate-800 truncate">{name}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

