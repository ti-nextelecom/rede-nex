import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { wsEventBus } from '../lib/wsEventBus';

interface MsgNotif {
  id: string;
  senderName: string;
  senderPhoto?: string;
  preview: string;
  conversationId?: string;
}

function avatarUrl(name: string, photo?: string) {
  return photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=56&background=0057b8&color=fff`;
}

export function GlobalNotifications() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  useEffect(() => { locationRef.current = location; }, [location]);

  const [msgs, setMsgs] = useState<MsgNotif[]>([]);

  useEffect(() => {
    return wsEventBus.subscribe((msg) => {
      const inChat = locationRef.current.pathname === '/bate-papo';

      if (msg.type === 'message:incoming' && !inChat) {
        const id = Math.random().toString(36).slice(2);
        const notif: MsgNotif = {
          id,
          senderName: String(msg.senderName || 'Alguém'),
          senderPhoto: msg.senderPhoto as string | undefined,
          preview: String(msg.preview || '').slice(0, 80),
          conversationId: msg.conversationId as string | undefined,
        };
        setMsgs(prev => [notif, ...prev].slice(0, 3));
        setTimeout(() => setMsgs(prev => prev.filter(n => n.id !== id)), 5000);
      }
    });
  }, []);

  if (msgs.length === 0) return null;

  return (
    <div className="global-msg-stack">
      {msgs.map(n => (
        <div
          key={n.id}
          className="global-msg-card"
          onClick={() => {
            setMsgs(prev => prev.filter(m => m.id !== n.id));
            navigate('/bate-papo');
          }}
        >
          <img
            src={avatarUrl(n.senderName, n.senderPhoto)}
            alt={n.senderName}
            className="h-9 w-9 rounded-full object-cover flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 truncate">{n.senderName}</p>
            <p className="text-xs text-slate-500 truncate mt-0.5">{n.preview}</p>
          </div>
          <button
            onClick={e => { e.stopPropagation(); setMsgs(prev => prev.filter(m => m.id !== n.id)); }}
            className="flex-shrink-0 text-slate-400 hover:text-slate-600"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
