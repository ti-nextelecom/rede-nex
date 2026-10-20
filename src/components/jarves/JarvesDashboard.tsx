import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Send, ChevronDown, ListTodo, FolderKanban, Calendar, Plus, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import './jarves.css';

interface TaskLike {
  deadline?: string | null;
  status?: string;
}

interface ProjectLike {
  name?: string;
  status?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  userId: string;
  firstName: string;
  tasks: TaskLike[];
  projects: ProjectLike[];
}

const quickActions = [
  { label: 'Minhas tarefas', prompt: 'Liste minhas tarefas mais urgentes com status e prazos.', icon: ListTodo },
  { label: 'Abrir projetos', prompt: 'Qual o status atual dos projetos em andamento?', icon: FolderKanban },
  { label: 'O que está atrasado?', prompt: 'O que está atrasado ou vencendo em breve?', icon: Calendar },
  { label: 'Criar tarefa', prompt: 'Quero criar uma nova tarefa.', icon: Plus },
];

function renderMd(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+?)`/g, '<code>$1</code>')
    .replace(/^( {0,8})[*\-] (.+)$/gm, (_, sp, content) => {
      const level = Math.floor(sp.length / 2);
      return `<span style="display:block;padding-left:${level * 16 + 12}px;margin:2px 0">• ${content}</span>`;
    })
    .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

function stripMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*([^*\n]+?)\*/g, '$1')
    .replace(/`([^`]+?)`/g, '$1')
    .replace(/^[ \t]*[-*] /gm, '')
    .replace(/<[^>]+>/g, '');
}

function tts(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(stripMd(text));
  utter.lang = 'pt-BR';
  utter.rate = 1.1;
  utter.pitch = 0.75;
  const doSpeak = () => {
    const voices = window.speechSynthesis.getVoices();
    const ptVoices = voices.filter(v => v.lang.startsWith('pt'));
    const male = ptVoices.find(v => /daniel|lucas|carlos|male|masc|wavenet-b|wavenet-d|standard-b|standard-d|-[BD]$/i.test(v.name));
    const chosen = male || ptVoices[0];
    if (chosen) utter.voice = chosen;
    window.speechSynthesis.speak(utter);
  };
  if (window.speechSynthesis.getVoices().length > 0) doSpeak();
  else window.speechSynthesis.addEventListener('voiceschanged', doSpeak, { once: true });
}

function stopTts() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

// Detecção de suporte a SpeechRecognition
const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    : null;

export default function JarvesDashboard({ userId: _userId, firstName, tasks, projects: _projects }: Props) {
  const overdueCount = tasks.filter(t => {
    if (!t.deadline || t.status === 'done' || t.status === 'cancelled') return false;
    return new Date(t.deadline) < new Date();
  }).length;

  const welcomeText = overdueCount > 0
    ? `Olá, ${firstName}! 👋 Percebi que você tem **${overdueCount} tarefa${overdueCount > 1 ? 's' : ''} vencida${overdueCount > 1 ? 's' : ''}**. Posso te ajudar a organizar as prioridades?`
    : `Olá, ${firstName}! 👋 Sou o Jarves, seu assistente pessoal. Como posso te ajudar hoje?`;

  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: welcomeText }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(overdueCount > 0);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, expanded]);

  // Limpar TTS ao desmontar
  useEffect(() => () => { stopTts(); }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setExpanded(true);

    try {
      const allMessages = [...messages, userMsg];
      const res = await fetch('/api/jarves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages.map(m => ({ role: m.role, content: m.content })) }),
      });
      const data: { reply?: string; error?: string } = await res.json();
      const reply = data.reply || (res.ok ? 'Desculpe, não consegui processar.' : `Erro ${res.status}.`);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      // Falar resposta se voz ativa
      setVoiceEnabled(prev => { if (prev) tts(reply); return prev; });
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro de conexão. Tente novamente.' }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const startListening = () => {
    if (!SpeechRecognitionAPI || listening) return;
    stopTts();
    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event: any) => {
      const transcript: string = event.results[0][0].transcript;
      if (transcript.trim()) {
        setInput(transcript);
        void sendMessage(transcript);
      }
    };
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const toggleVoice = () => {
    setVoiceEnabled(prev => {
      if (prev) stopTts();
      return !prev;
    });
  };

  const speakMessage = (content: string) => {
    tts(content);
  };

  return (
    <section className="jarves-panel" aria-label="Jarves — Assistente pessoal de IA">
      <div
        className="jarves-header"
        onClick={() => setExpanded(e => !e)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpanded(v => !v); }}
      >
        <span className="jarves-brand">
          <Bot size={18} aria-hidden />
          <strong>Jarves</strong>
          <small>Assistente pessoal de IA</small>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Toggle voz — não propaga clique para o header */}
          <button
            type="button"
            title={voiceEnabled ? 'Desativar voz' : 'Ativar voz'}
            aria-label={voiceEnabled ? 'Desativar voz do Jarves' : 'Ativar voz do Jarves'}
            onClick={e => { e.stopPropagation(); toggleVoice(); }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              color: voiceEnabled ? 'var(--jarves-accent, #f97316)' : 'currentColor',
              opacity: voiceEnabled ? 1 : 0.75,
            }}
          >
            {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <span className="jarves-toggle" aria-hidden>
            <ChevronDown size={16} className={`jarves-toggle-icon${expanded ? ' is-open' : ''}`} />
          </span>
        </span>
      </div>

      {!expanded && (
        <div className="jarves-preview">
          <p dangerouslySetInnerHTML={{ __html: renderMd(messages[0]?.content ?? '') }} />
          <div className="jarves-quick-actions">
            {quickActions.slice(0, 3).map(a => (
              <button
                key={a.label}
                type="button"
                className="jarves-quick-btn"
                onClick={() => { setExpanded(true); void sendMessage(a.prompt); }}
                disabled={loading}
              >
                <a.icon size={12} aria-hidden /> {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {expanded && (
        <>
          <div className="jarves-messages" ref={scrollRef} role="log" aria-live="polite" aria-label="Conversa com Jarves">
            {messages.map((m, i) => (
              <div key={i} className={`jarves-message is-${m.role}`}>
                {m.role === 'assistant' && (
                  <span className="jarves-avatar" aria-hidden>
                    <Bot size={14} />
                  </span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    className="jarves-bubble"
                    dangerouslySetInnerHTML={{ __html: renderMd(m.content) }}
                  />
                  {m.role === 'assistant' && (
                    <button
                      type="button"
                      title="Ouvir resposta"
                      onClick={() => speakMessage(m.content)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        marginTop: '2px',
                        color: 'var(--jarves-accent, #f97316)',
                        opacity: 0.6,
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <Volume2 size={10} /> ouvir
                    </button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="jarves-message is-assistant" aria-label="Jarves está digitando">
                <span className="jarves-avatar" aria-hidden><Bot size={14} /></span>
                <div className="jarves-bubble jarves-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
          </div>

          <div className="jarves-quick-actions">
            {quickActions.map(a => (
              <button
                key={a.label}
                type="button"
                className="jarves-quick-btn"
                onClick={() => void sendMessage(a.prompt)}
                disabled={loading}
              >
                <a.icon size={12} aria-hidden /> {a.label}
              </button>
            ))}
          </div>

          <form className="jarves-input-row" onSubmit={handleSubmit}>
            <input
              className="jarves-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={listening ? 'Ouvindo...' : 'Pergunte ao Jarves ou use o microfone…'}
              disabled={loading || listening}
              autoComplete="off"
              aria-label="Mensagem para Jarves"
            />
            {SpeechRecognitionAPI && (
              <button
                type="button"
                className="jarves-send"
                onClick={listening ? stopListening : startListening}
                disabled={loading}
                aria-label={listening ? 'Parar gravação' : 'Falar para o Jarves'}
                title={listening ? 'Parar gravação' : 'Falar para o Jarves'}
                style={{
                  background: listening ? 'var(--jarves-accent, #f97316)' : undefined,
                  color: listening ? 'white' : undefined,
                }}
              >
                {listening ? <MicOff size={16} aria-hidden /> : <Mic size={16} aria-hidden />}
              </button>
            )}
            <button
              type="submit"
              className="jarves-send"
              disabled={!input.trim() || loading || listening}
              aria-label="Enviar mensagem"
            >
              <Send size={15} aria-hidden />
            </button>
          </form>
        </>
      )}
    </section>
  );
}
