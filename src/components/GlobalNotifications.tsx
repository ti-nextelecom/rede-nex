import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, FolderKanban, ListTodo, MessageCircle, X } from 'lucide-react';
import { getConversations } from '../lib/chatApi';
import { getNotifications, markNotificationRead } from '../lib/notificationsApi';
import { useAuth } from '../lib/auth';
import { wsEventBus } from '../lib/wsEventBus';
import './global-notifications.css';

interface Popup {
  id: string; kind: 'chat' | 'task' | 'project'; title: string; actor: string;
  photo?: string; preview: string; link: string; count: number; notificationId?: string;
}
function preview(text: string) {
  if (text.startsWith('[IMAGE]')) return 'Enviou uma foto';
  if (text.startsWith('[AUDIO_MSG]')) return 'Enviou um áudio';
  if (text.startsWith('[VIDEO]')) return 'Enviou um vídeo';
  if (text.startsWith('[DOC|')) return 'Enviou um documento';
  if (text.startsWith('[STICKER]')) return 'Enviou uma figurinha';
  return text.slice(0, 160);
}

export function GlobalNotifications() {
  const { user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const location = useLocation();
  const route = useRef(location.pathname);
  const activeConversation = useRef<string | null>(null);
  const [popups, setPopups] = useState<Popup[]>([]);
  useEffect(() => { route.current = location.pathname; }, [location.pathname]);

  useEffect(() => {
    setPopups([]);
    if (!userId) return;
    let alive = true, busy = false;
    let chatReady = false, notificationsReady = false;
    let lastMessages = new Map<string, string>();
    const knownNotifications = new Set<string>();
    const show = (popup: Popup) => {
      if (alive) setPopups(current => [popup, ...current.filter(item => item.id !== popup.id)].slice(0, 3));
    };
    async function poll() {
      if (busy || !alive) return;
      busy = true;
      const [chats, notifications] = await Promise.allSettled([getConversations(), getNotifications()]);
      if (!alive) return;
      if (chats.status === 'fulfilled') {
        for (const conversation of chats.value) {
          const last = conversation.last_message;
          const current = route.current === '/bate-papo' && activeConversation.current === conversation.id;
          if (chatReady && last && lastMessages.get(conversation.id) !== last.id
            && conversation.unread_count > 0 && !conversation.is_muted && last.sender?.id !== userId && !current) {
            show({ id: `chat:${conversation.id}`, kind: 'chat',
              title: conversation.type === 'group' ? conversation.name || 'Conversa em grupo' : last.sender?.name || conversation.name || 'Nova mensagem',
              actor: last.sender?.name || 'Colaborador', photo: last.sender?.photo_url || conversation.other_participant?.photo_url,
              preview: preview(last.content || ''), count: conversation.unread_count,
              link: `/bate-papo?conversa=${encodeURIComponent(conversation.id)}` });
          }
          if (current || conversation.is_muted || !conversation.unread_count) setPopups(items => items.filter(item => item.id !== `chat:${conversation.id}`));
        }
        lastMessages = new Map(chats.value.map(conversation => [conversation.id, conversation.last_message?.id || '']));
        chatReady = true;
      }
      if (notifications.status === 'fulfilled') {
        for (const item of [...notifications.value].reverse()) {
          const kind = item.type === 'task' || item.link?.startsWith('/tarefas') ? 'task'
            : item.type === 'project' || item.link?.startsWith('/projetos') ? 'project' : null;
          if (notificationsReady && kind && !item.read && !knownNotifications.has(item.id)) {
            const safeLink = item.link?.startsWith('/') && !item.link.startsWith('//') && !item.link.includes('\\') ? item.link : kind === 'task' ? '/tarefas' : '/projetos';
            show({ id: item.id, notificationId: item.id, kind, title: item.title, actor: item.actor_name || 'REDE NEX',
              photo: item.actor_photo_url, preview: item.message || 'Uma atualização envolve você.', link: safeLink, count: 1 });
          }
          if (item.read) setPopups(items => items.filter(popup => popup.notificationId !== item.id));
          knownNotifications.add(item.id);
        }
        // Keep bounded memory; currently returned records have precedence.
        if (knownNotifications.size > 500) { knownNotifications.clear(); notifications.value.forEach(item => knownNotifications.add(item.id)); }
        notificationsReady = true;
      }
      busy = false;
    }
    const unsubscribe = wsEventBus.subscribe(event => {
      if (event.type === 'conversation:active') {
        activeConversation.current = typeof event.conversationId === 'string' ? event.conversationId : null;
        if (activeConversation.current) setPopups(items => items.filter(item => item.id !== `chat:${activeConversation.current}`));
      }
      // Poll authoritative data for mute settings and unread counts. The same
      // message arriving through WS and polling produces only ONE popup.
      if (event.type === 'message:incoming' || event.type === 'notification:new') void poll();
    });
    const onFocus = () => void poll();
    window.addEventListener('focus', onFocus);
    const interval = window.setInterval(() => { if (!document.hidden) void poll(); }, 8000);
    void poll();
    return () => { alive = false; unsubscribe(); window.clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [userId]);

  function open(item: Popup) {
    setPopups(items => items.filter(popup => popup.id !== item.id));
    if (item.notificationId) void markNotificationRead(item.notificationId).catch(() => undefined);
    navigate(item.link);
  }

  if (!popups.length) return null;
  return <aside className="nex-popup-stack" aria-label="Novas mensagens e atualizações" aria-live="polite" aria-relevant="additions">
    {popups.map(item => {
      const Icon = item.kind === 'chat' ? MessageCircle : item.kind === 'project' ? FolderKanban : ListTodo;
      return <article key={item.id} className={`nex-popup is-${item.kind}`}>
        <button className="nex-popup-open" onClick={() => open(item)} aria-label={`Abrir ${item.title}, ${item.count} notificação(ões)`}>
          <span className="nex-popup-avatar">{item.photo ? <img src={item.photo} alt="" /> : <span>{item.actor.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('')}</span>}<i><Icon size={13} /></i>{item.count > 1 && <b>{item.count > 99 ? '99+' : item.count}</b>}</span>
          <span className="nex-popup-copy"><small>{item.kind === 'chat' ? 'Nova mensagem' : item.kind === 'project' ? 'Projeto • envolve você' : 'Tarefa • envolve você'}</small><strong>{item.title}</strong><span>{item.preview}</span><em>{item.kind !== 'chat' && `${item.actor} • `}Abrir <ArrowUpRight size={12} /></em></span>
        </button>
        <button className="nex-popup-close" onClick={() => setPopups(items => items.filter(popup => popup.id !== item.id))} aria-label={`Dispensar aviso: ${item.title}`}><X size={17} /></button>
      </article>;
    })}
  </aside>;
}
