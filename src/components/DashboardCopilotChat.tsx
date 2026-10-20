import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Plus, Send, Mic, MicOff, Volume2, VolumeX, MessageSquare, Keyboard } from 'lucide-react';
import type { buildWorkBriefing } from '../../shared/personalWork.mjs';
import { getAudioContext } from '../hooks/useAudioContext';
import './dashboard-copilot.css';

interface ChatMessage { id: number; role: 'user' | 'assistant'; content: string }

const welcome: ChatMessage = {
  id: 0,
  role: 'assistant',
  content: 'Olá! Sou o Jarves, seu assistente pessoal. Como posso ajudar?'
};

const suggestions = ['Minhas tarefas vencidas', 'Abrir projetos', 'O que está atrasado?', 'Criar tarefa'];

function stripMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*([^*\n]+?)\*/g, '$1')
    .replace(/`([^`]+?)`/g, '$1')
    .replace(/^[ \t]*[-*] /gm, '')
    .replace(/<[^>]+>/g, '');
}

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    : null;

export function DashboardCopilotChat({ briefing: _briefing, autoStartConversation, autoStartListening, onNavigate, userName}: {
  briefing?: ReturnType<typeof buildWorkBriefing>;
  autoStartConversation?: boolean;
  autoStartListening?: boolean;
  onNavigate?: () => void;
  userName?: string;
}) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([welcome]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [listening, setListening] = useState(false);
  const [conversationMode, setConversationMode] = useState(false);
  const nextId = useRef(1);
  const historyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const currentAudio = useRef<HTMLAudioElement | AudioBufferSourceNode | null>(null);
  const autoListenRef = useRef(false);
  const convModeRef = useRef(false);
  const voiceEnabledRef = useRef(true);
  const inputId = useId();
  const lastMessageId = messages[messages.length - 1]?.id;

  useEffect(() => {
    const history = historyRef.current;
    if (history) history.scrollTop = history.scrollHeight;
  }, [lastMessageId, loading]);

  useEffect(() => () => { stopSpeech(); }, []);

  // Keep voiceEnabledRef in sync so speak() can read it synchronously
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);

  useEffect(() => {
    if (!autoStartConversation) return;
    setConversationMode(true);
    convModeRef.current = true;
    if (autoStartListening) {
      // Mobile: skip briefing, start mic immediately
      const timer = setTimeout(() => startListening(), 400);
      return () => clearTimeout(timer);
    } else {
      // Desktop: greet once per browser session based on BRT time
      const timer = setTimeout(() => {
        if (!sessionStorage.getItem('jarves_greeted')) {
          sessionStorage.setItem('jarves_greeted', '1');
          const brt = ((new Date().getUTCHours() - 3) + 24) % 24;
          const greeting = brt < 12 ? 'Bom dia' : brt < 18 ? 'Boa tarde' : 'Boa noite';
          void sendInternal(greeting + "! Cumprimente o usuário pelo nome " + (userName || "usuário") + ". Uma frase curta — sem perguntas, sem briefing.", true);
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function stopSpeech() {
    const a = currentAudio.current;
    if (a) {
      if (typeof (a as AudioBufferSourceNode).stop === 'function') {
        try { (a as AudioBufferSourceNode).stop(); } catch {}
      } else {
        (a as HTMLAudioElement).pause();
      }
      currentAudio.current = null;
    }
    autoListenRef.current = false;
  }

  async function speak(text: string, autoListen = false) {
    stopSpeech();
    const clean = stripMd(text).slice(0, 1000);
    autoListenRef.current = autoListen;
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: clean }),
      });
      if (!res.ok) {
        console.warn('[Jarves TTS] HTTP', res.status);
        throw new Error(`HTTP ${res.status}`);
      }
      const arrayBuf = await res.arrayBuffer();

      const ctx = getAudioContext();
      if (ctx && ctx.state !== 'closed') {
        // AudioContext initialized on FAB click (user gesture) — autoplay always allowed
        const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
        const source = ctx.createBufferSource();
        source.buffer = decoded;
        source.connect(ctx.destination);
        source.onended = () => {
          currentAudio.current = null;
          if (autoListenRef.current) { autoListenRef.current = false; startListening(); }
        };
        source.start(0);
        currentAudio.current = source;
      } else {
        // Fallback: HTMLAudioElement
        const blob = new Blob([arrayBuf], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.preload = 'auto';
        currentAudio.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          if (currentAudio.current === audio) currentAudio.current = null;
          if (autoListenRef.current) { autoListenRef.current = false; startListening(); }
        };
        try {
          await audio.play();
        } catch {
          console.warn('[Jarves TTS] autoplay blocked — queued for next gesture');
          const playOnGesture = () => { audio.play().catch(() => {}); };
          document.addEventListener('touchstart', playOnGesture, { once: true, passive: true });
          document.addEventListener('click', playOnGesture, { once: true });
        }
      }
    } catch (err) {
      console.warn('[Jarves TTS] error:', err);
      if (autoListenRef.current) { autoListenRef.current = false; startListening(); }
    }
  }

  async function sendInternal(question: string, isVoice = false) {
    const text = question.trim().slice(0, 2000);
    if (!text || loading) return;
    const userMsg: ChatMessage = { id: nextId.current++, role: 'user', content: text };
    setMessages(curr => [...curr, userMsg].slice(-81));
    setInput('');
    setLoading(true);
    try {
      const history = [...messages, userMsg];
      const res = await fetch('/api/jarves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
          voice_mode: isVoice || convModeRef.current,
        }),
      });
      const data: { reply?: string; navigate_to?: string } = await res.json();
      const reply = data.reply || (res.ok ? 'Não consegui processar.' : `Erro ${res.status}.`);
      setMessages(curr => [...curr, { id: nextId.current++, role: 'assistant', content: reply }]);
      // Always speak Jarves response when voice is enabled (default: true)
      if (voiceEnabledRef.current) {
        await speak(reply, false);
      }
      if (data.navigate_to) {
        setTimeout(() => {
          navigate(data.navigate_to!);
          onNavigate?.();
        }, 400);
      }
    } catch {
      setMessages(curr => [...curr, { id: nextId.current++, role: 'assistant', content: 'Erro de conexão. Tente novamente.' }]);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) { event.preventDefault(); void sendInternal(input); }

  function toggleVoice() {
    setVoiceEnabled(prev => { if (prev) stopSpeech(); return !prev; });
  }

  function enterConversationMode() {
    setConversationMode(true);
    convModeRef.current = true;
    if (messages.length <= 1) {
      void sendInternal('Bom dia! Faça um briefing rápido do meu dia: pendências urgentes e pontos de atenção. Máximo 3 frases.', true);
    } else {
      setTimeout(() => startListening(), 300);
    }
  }

  function exitConversationMode() {
    stopSpeech();
    stopListening();
    setConversationMode(false);
    convModeRef.current = false;
  }

  function startListening() {
    if (!SpeechRecognitionAPI || listening) return;
    stopSpeech();
    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;
    recognition.lang = 'pt-BR';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    let finalTranscript = '';
    recognition.onstart = () => setListening(true);
    recognition.onerror = () => { setListening(false); finalTranscript = ''; setInput(''); };
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInput(finalTranscript + interim);
    };
    recognition.onend = () => {
      setListening(false);
      const text = finalTranscript.trim();
      finalTranscript = '';
      setInput('');
      if (text) void sendInternal(text, true);
    };
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  return <section className="dashboard-copilot-chat" aria-labelledby={`${inputId}-title`}>
    <div className="dashboard-copilot-toolbar">
      <div>
        <Bot size={18} />
        <span>
          <h3 id={`${inputId}-title`}>Jarves</h3>
          <small>{conversationMode ? 'Modo conversa ativo' : 'Assistente pessoal de IA'}</small>
        </span>
      </div>
      <div className="dashboard-copilot-toolbar-right">
        {SpeechRecognitionAPI && (
          <button
            type="button"
            className={`dashboard-copilot-convo-btn${conversationMode ? ' is-active' : ''}`}
            title={conversationMode ? 'Encerrar modo conversa' : 'Modo conversa (voz)'}
            aria-label={conversationMode ? 'Encerrar modo conversa' : 'Modo conversa'}
            onClick={conversationMode ? exitConversationMode : enterConversationMode}
          >
            <MessageSquare size={16} />
          </button>
        )}
        <button
          type="button"
          className={`dashboard-copilot-voice-btn${voiceEnabled ? ' is-active' : ''}`}
          title={voiceEnabled ? 'Silenciar Jarves' : 'Ativar voz do Jarves'}
          aria-label={voiceEnabled ? 'Silenciar Jarves' : 'Ativar voz do Jarves'}
          onClick={toggleVoice}
        >
          {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        <button
          type="button"
          className="dashboard-copilot-nova-btn"
          onClick={() => {
            setMessages([welcome]); setInput(''); setLoading(false);
            stopSpeech(); stopListening();
            setConversationMode(false); convModeRef.current = false;
            inputRef.current?.focus();
          }}
        >
          <Plus size={16} /><span>Nova conversa</span>
        </button>
      </div>
    </div>

    <div ref={historyRef} className="dashboard-copilot-history" role="log" aria-label="Conversa com Jarves" aria-live="polite" aria-relevant="additions" tabIndex={0}>
      {messages.map(message => (
        <article key={message.id} className={`dashboard-copilot-message is-${message.role}`} aria-label={message.role === 'user' ? 'Sua mensagem' : 'Resposta do Jarves'}>
          <div>
            <small>{message.role === 'user' ? 'Você' : 'Jarves'}</small>
            <p>{message.content}</p>
            {message.role === 'assistant' && message.id > 0 && (
              <button
                type="button"
                className="dashboard-copilot-listen-btn"
                title="Ouvir resposta"
                aria-label="Ouvir resposta"
                onClick={() => void speak(message.content)}
              >
                <Volume2 size={11} /> ouvir
              </button>
            )}
          </div>
        </article>
      ))}
      {loading && (
        <article className="dashboard-copilot-message is-assistant" aria-label="Jarves está processando">
          <div><small>Jarves</small><p>Processando…</p></div>
        </article>
      )}
    </div>

    {!conversationMode && (
      <div className="dashboard-copilot-suggestions" aria-label="Sugestões">
        {suggestions.map(q => (
          <button type="button" key={q} disabled={loading} onClick={() => void sendInternal(q)}>{q}</button>
        ))}
      </div>
    )}

    {conversationMode ? (
      <div className="dashboard-copilot-convo-bar">
        {loading ? (
          <div className="dashboard-copilot-convo-status">Processando…</div>
        ) : listening ? (
          <button type="button" className="dashboard-copilot-convo-mic is-listening" onClick={stopListening} aria-label="Parar">
            <MicOff size={22} /><span>Ouvindo…</span>
          </button>
        ) : (
          <div className="dashboard-copilot-convo-actions">
            <button type="button" className="dashboard-copilot-convo-mic" onClick={startListening} disabled={loading} aria-label="Falar">
              <Mic size={22} /><span>Toque para falar</span>
            </button>
            <button type="button" className="dashboard-copilot-convo-type" onClick={() => setConversationMode(false)} aria-label="Digitar">
              <Keyboard size={22} /><span>Toque para digitar</span>
            </button>
          </div>
        )}
      </div>
    ) : (
      <form className="dashboard-copilot-compose" onSubmit={submit}>
        <label className="sr-only" htmlFor={inputId}>Mensagem para o Jarves</label>
        <textarea
          ref={inputRef}
          id={inputId}
          rows={2}
          maxLength={2000}
          value={input}
          disabled={loading || listening}
          onChange={e => setInput(e.target.value)}
          placeholder={listening ? 'Ouvindo…' : 'Pergunte ao Jarves…'}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
        />
        {SpeechRecognitionAPI && (
          <button
            type="button"
            className={`dashboard-copilot-mic-btn${listening ? ' is-listening' : ''}`}
            onClick={listening ? stopListening : startListening}
            disabled={loading}
            aria-label={listening ? 'Parar gravação' : 'Falar para o Jarves'}
            title={listening ? 'Parar gravação' : 'Falar para o Jarves'}
          >
            {listening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        )}
        <button type="submit" disabled={!input.trim() || loading || listening} aria-label="Enviar mensagem ao Jarves">
          <Send size={21} />
        </button>
      </form>
    )}

    <p className="dashboard-copilot-privacy">Jarves acessa seus dados em tempo real.</p>
  </section>;
}
