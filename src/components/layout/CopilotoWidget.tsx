import { FormEvent, useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send, Sparkles, User, Minimize2 } from 'lucide-react';
import { apiPost } from '../../lib/apiClient';
import { useLocation } from 'react-router-dom';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const WELCOME: Message = {
  id: '0',
  role: 'assistant',
  content: 'Olá! Sou o Copiloto da Rede Nex 👋\n\nComo posso ajudar?',
};


function renderMd(text: string): string {
  let s = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // code inline
  s = s.replace(/`([^`]+)`/g, '<code style="background:rgba(249,115,22,0.15);color:#fb923c;padding:1px 5px;border-radius:3px;font-size:0.75rem;font-family:monospace;white-space:nowrap">$1</code>');
  // bold / italic
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:700">$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // headings
  s = s.replace(/^### (.+)$/gm, '<div style="font-size:0.82rem;font-weight:700;margin:10px 0 3px">$1</div>');
  s = s.replace(/^## (.+)$/gm, '<div style="font-size:0.92rem;font-weight:700;margin:12px 0 4px">$1</div>');
  s = s.replace(/^# (.+)$/gm, '<div style="font-size:1.05rem;font-weight:700;margin:14px 0 5px">$1</div>');
  // lists
  s = s.replace(/^[-*] (.+)$/gm, '<div style="margin:2px 0 2px 10px">• $1</div>');
  s = s.replace(/^(\d+)\. (.+)$/gm, '<div style="margin:2px 0 2px 10px"><span style="font-weight:600;color:#f97316;margin-right:5px">$1.</span>$2</div>');
  // hr
  s = s.replace(/^---+$/gm, '<hr style="border:0;border-top:1px solid rgba(150,150,150,0.35);margin:8px 0"/>');
  // paragraphs
  s = s.replace(/\n\n/g, '<br><br>');
  s = s.replace(/\n/g, '<br>');
  return s;
}

export function CopilotoWidget() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  if (location.pathname === '/copiloto') return null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [open, messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await apiPost<{ reply: string }>('/copiloto', {
        message: trimmed,
        history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
      });
      const reply = res.reply || 'Não consegui processar sua mensagem.';
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: reply }]);
      if (!open) setUnread(n => n + 1);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '⚠️ Copiloto temporariamente indisponível.',
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <>
      {/* Floating toggle button — desktop only */}
      <button
        onClick={() => setOpen(o => !o)}
        className="hidden md:flex fixed bottom-6 right-6 z-50 w-13 h-13 rounded-full items-center justify-center shadow-2xl hover:scale-110 transition-all duration-200"
        style={{ width: 52, height: 52, background: 'linear-gradient(135deg, #0057b8, #ff7a00)' }}
        title="Copiloto IA"
      >
        {open
          ? <Minimize2 size={20} className="text-white" />
          : <Sparkles size={20} className="text-white" />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow">
            {unread}
          </span>
        )}
      </button>

      {/* Side panel — desktop only */}
      {open && (
        <div
          className="hidden md:flex fixed bottom-20 right-4 z-40 w-[420px] h-[520px] flex-col shadow-2xl rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(180deg, #0a1628 0%, #0d1f3c 60%, #1a0a00 100%)' }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2.5 px-4 py-3 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #0057b8 0%, #003d82 100%)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div
              className="h-8 w-8 rounded-xl flex items-center justify-center shadow"
              style={{ background: 'linear-gradient(135deg, #ff7a00, #ff4500)' }}
            >
              <Sparkles size={15} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight">Copiloto</p>
              <p className="text-[10px] text-blue-200">Assistente IA · Gemini</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Minimize2 size={14} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div
                  className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 shadow"
                  style={msg.role === 'assistant'
                    ? { background: 'linear-gradient(135deg, #ff7a00, #ff4500)' }
                    : { background: 'rgba(255,255,255,0.15)' }}
                >
                  {msg.role === 'assistant'
                    ? <Bot size={12} className="text-white" />
                    : <User size={12} className="text-white" />}
                </div>
                {msg.role === 'assistant' ? (
                  <div
                    className="max-w-[78%] rounded-xl rounded-tl-sm px-3 py-2 text-xs leading-relaxed shadow-sm"
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)' }}
                    dangerouslySetInnerHTML={{ __html: renderMd(msg.content) }}
                  />
                ) : (
                  <div
                    className="max-w-[78%] rounded-xl rounded-tr-sm px-3 py-2 text-xs leading-relaxed shadow-sm"
                    style={{ background: 'linear-gradient(135deg, #ff7a00, #e06500)', color: '#fff' }}
                  >
                    {msg.content}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div
                  className="h-6 w-6 rounded-full flex items-center justify-center shadow"
                  style={{ background: 'linear-gradient(135deg, #ff7a00, #ff4500)' }}
                >
                  <Bot size={12} className="text-white" />
                </div>
                <div className="rounded-xl rounded-tl-sm px-3 py-2 shadow-sm" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Loader2 size={12} className="text-orange-400 animate-spin" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
            style={{ borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)' }}
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Pergunte algo..."
              disabled={loading}
              className="flex-1 h-8 px-3 rounded-lg text-xs outline-none transition-all disabled:opacity-50"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#e2e8f0',
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow"
              style={{ background: 'linear-gradient(135deg, #ff7a00, #e06500)' }}
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
