import { useState } from 'react';
import { Bot, X } from 'lucide-react';
import { DashboardCopilotChat } from '../DashboardCopilotChat';
import { useAuth } from '../../lib/auth';
import { initAudioContext } from '../../hooks/useAudioContext';


export function JarvesWidget() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  function handleNavigate() {
    setOpen(false);
  }

  return <>
    {open && (
      <div
        className="jarves-widget-overlay"
        onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
      >
        <div className="jarves-widget-panel">
          <DashboardCopilotChat
            autoStartConversation
            autoStartListening={false}
            userName={user?.name ?? undefined}
            onNavigate={handleNavigate}
          />
        </div>
      </div>
    )}
    <button
      type="button"
      className={`jarves-widget-fab${open ? ' is-open' : ''}`}
      onClick={() => {
        if (!open) {
          try { initAudioContext(); } catch {}
        }
        setOpen(p => !p);
      }}
      aria-label={open ? 'Fechar Jarves' : 'Abrir Jarves — Assistente pessoal'}
      title="Jarves — Assistente pessoal"
    >
      {open ? <X size={22} /> : <Bot size={22} />}
    </button>
  </>;
}
