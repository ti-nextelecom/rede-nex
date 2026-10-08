import { FormEvent, useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send, Sparkles, User } from 'lucide-react';
import { apiPost } from '../lib/apiClient';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Como funciona a Wiki?',
  'Como criar uma tarefa nova?',
  'Como ganho pontos XP?',
  'Como crio um grupo no chat?',
  'Minha internet está lenta, o que fazer?',
  'O que é fibra óptica e como funciona?',
  'Como melhorar o sinal do Wi-Fi em casa?',
  'Qual a diferença entre 2.4 GHz e 5 GHz?',
  'O que é CGNAT e por que não tenho IP fixo?',
  'Como funciona a portabilidade de número?',
  'O que é VoIP e como usar telefonia IP?',
  'Como fazer um diagnóstico de lentidão?',
];


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

export function CopilotoPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Olá! Sou o Copiloto da Rede Nex 👋\n\nPosso ajudar você a navegar pela plataforma, tirar dúvidas sobre funcionalidades e direcionar para os responsáveis certos.\n\nComo posso ajudar?',
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.reply || 'Desculpe, não consegui processar sua mensagem.',
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '⚠️ Copiloto temporariamente indisponível. O token de acesso à IA ainda não foi configurado. Entre em contato com o time de TI para ativação.',
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
    <div className="flex flex-col h-[calc(100vh-8.5rem)] lg:h-[calc(100vh-3.5rem)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-sm">
          <Sparkles size={18} className="text-white" />
        </div>
        <div>
          <h1 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Copiloto</h1>
          <p className="text-xs text-slate-500">Assistente IA da Rede Nex</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-full">
          <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold">Beta</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 bg-slate-50 dark:bg-slate-900/50">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${msg.role === 'assistant' ? 'bg-gradient-to-br from-orange-400 to-orange-600' : 'bg-slate-700'}`}>
              {msg.role === 'assistant'
                ? <Bot size={15} className="text-white" />
                : <User size={15} className="text-white" />}
            </div>
            <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${msg.role === 'assistant' ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-tl-sm' : 'bg-orange-500 text-white rounded-tr-sm'}`}>
              {msg.role === 'assistant'
                ? <div className="max-w-none text-slate-900 dark:text-slate-50" dangerouslySetInnerHTML={{ __html: renderMd(msg.content) }} />
                : msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-sm">
              <Bot size={15} className="text-white" />
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <Loader2 size={16} className="text-orange-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 1 && (
        <div className="px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700">
          <p className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wide">Sugestões</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-xs px-3 h-7 rounded-full border border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 hover:bg-orange-100 transition-colors font-medium"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Pergunte algo sobre a Rede Nex..."
          disabled={loading}
          className="flex-1 h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="h-10 w-10 flex items-center justify-center rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
}
