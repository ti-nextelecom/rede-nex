import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type CSSProperties, type FormEvent } from 'react';
import { Bot, ChevronLeft, Send } from 'lucide-react';
import { JARVIS_CONVERSATION_ID } from '../../shared/chatDrafts.mjs';
import { getChatWorkspace } from '../lib/chatWorkspace';
import { useAppearance } from '../lib/appearance';
import { LinkText } from './LinkText';
import './jarvis-chat-thread.css';

const suggestions = ['Minhas tarefas vencidas', 'O que tenho para hoje?', 'Me ajude a organizar minhas prioridades'];

export function JarvisChatThread({ userId, onBack }: { userId: string; onBack(): void }) {
  const { drafts, jarvis } = getChatWorkspace(userId);
  const draftState = useSyncExternalStore(drafts.subscribe, drafts.getSnapshot);
  const state = useSyncExternalStore(jarvis.subscribe, jarvis.getSnapshot);
  const input = draftState[JARVIS_CONVERSATION_ID]?.text || '';
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const { palette } = useAppearance();
  const busy = !!state.pending;
  useLayoutEffect(() => { inputRef.current?.focus({ preventScroll: true }); }, [userId]);
  useEffect(() => {
    if (following.current && historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [state.messages, state.pending]);
  useEffect(() => {
    if (!busy && document.activeElement === document.body) inputRef.current?.focus({ preventScroll: true });
  }, [busy]);

  function send(event?: FormEvent) {
    event?.preventDefault();
    following.current = true;
    void jarvis.send();
  }
  const messages = state.pending ? [...state.messages, state.pending] : state.messages;
  const historyStyle = {
    backgroundColor: palette.chat.background,
    backgroundImage: palette.chat.wallpaper ? `url(${JSON.stringify(palette.chat.wallpaper)})` : undefined,
  } as CSSProperties;
  return <section className="jarvis-chat-thread" aria-label="Conversa com Jarvis">
    <header className="chat-thread-header jarvis-chat-header">
      <button type="button" className="chat-icon-button md:hidden" onClick={onBack} aria-label="Voltar às conversas"><ChevronLeft size={20} /></button>
      <span className="chat-jarvis-avatar"><Bot size={24} /></span>
      <div><h2>Jarvis</h2><p>Seu assistente pessoal</p></div>
    </header>
    <div className="chat-message-history jarvis-chat-history" ref={historyRef} style={historyStyle} role="log" aria-label="Mensagens com Jarvis" aria-live="polite" aria-relevant="additions" onScroll={event => {
      const element = event.currentTarget;
      following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
    }}>
      <article className="jarvis-chat-bubble is-assistant"><small>Jarvis</small><p>Olá! Posso ajudar com suas tarefas, projetos e o dia a dia na Rede NEX. Como posso ajudar?</p></article>
      {messages.map(message => <article key={message.id} className={`jarvis-chat-bubble is-${message.role}`}>
        <small>{message.role === 'user' ? 'Você' : 'Jarvis'}</small><p><LinkText text={message.content} /></p>
      </article>)}
      {busy && <p className="jarvis-chat-thinking" role="status">Jarvis está respondendo…</p>}
    </div>
    {state.error && <div className="jarvis-chat-error" role="alert">{state.error}<button type="button" disabled={!input.trim() || busy} onClick={() => send()}>Tentar novamente</button></div>}
    {!messages.length && <div className="jarvis-chat-suggestions">{suggestions.map(text => <button key={text} type="button" onClick={() => { drafts.set(JARVIS_CONVERSATION_ID, text); inputRef.current?.focus(); }}>{text}</button>)}</div>}
    <form className="jarvis-chat-compose" onSubmit={send}>
      <textarea ref={inputRef} aria-label="Mensagem para Jarvis" placeholder="Mensagem para o Jarvis…" rows={2} maxLength={2000} value={input} disabled={busy}
        onChange={event => drafts.set(JARVIS_CONVERSATION_ID, event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} />
      <button type="submit" className="chat-send-button" disabled={!input.trim() || busy} aria-label="Enviar mensagem ao Jarvis"><Send size={19} /></button>
    </form>
  </section>;
}
