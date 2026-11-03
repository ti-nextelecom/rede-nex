import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Plus, Send, Mic, MicOff, Volume2, VolumeX, MessageSquare, Keyboard } from 'lucide-react';
import type { buildWorkBriefing } from '../../shared/personalWork.mjs';
import { initAudioContext } from '../hooks/useAudioContext';
import { useJarvisSpeech, type JarvisVoiceState } from '../hooks/useJarvisSpeech';
import { JarvisVoiceVisual } from './JarvisVoiceVisual';
import { LinkText } from './LinkText';
import './dashboard-copilot.css';

interface ChatMessage { id: number; role: 'user' | 'assistant'; content: string }

const welcome: ChatMessage = {
  id: 0,
  role: 'assistant',
  content: 'Olá! Sou o Jarvis, seu assistente pessoal. Como posso ajudar?'
};

const suggestions = ['Minhas tarefas vencidas', 'Abrir projetos', 'O que está atrasado?', 'Criar tarefa'];

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    : null;

export function DashboardCopilotChat({ briefing: _briefing, autoStartConversation, autoStartListening, onNavigate, userName, onVoiceStateChange}: {
  briefing?: ReturnType<typeof buildWorkBriefing>;
  autoStartConversation?: boolean;
  autoStartListening?: boolean;
  onNavigate?: () => void;
  userName?: string;
  onVoiceStateChange?: (state: JarvisVoiceState) => void;
}) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === 'undefined' || !userName) return [welcome];
    try {
      const stored = localStorage.getItem(`nex:jarvis-dash:v1:${encodeURIComponent(userName)}`);
      if (stored) { const parsed = JSON.parse(stored); if (Array.isArray(parsed) && parsed.length > 0) return parsed; }
    } catch {}
    return [welcome];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [listening, setListening] = useState(false);
  const [conversationMode, setConversationMode] = useState(false);
  const nextId = useRef(1);
  const historyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const { speechState, speak, stopSpeech, resumeSpeech } = useJarvisSpeech();
  const voiceState: JarvisVoiceState = listening ? 'listening' : speechState !== 'idle' ? speechState : loading ? 'thinking' : 'idle';
  useEffect(() => { onVoiceStateChange?.(voiceState); }, [voiceState, onVoiceStateChange]);
  const convModeRef = useRef(false);
  useEffect(() => {
    if (!userName || messages.length <= 1) return;
    try { localStorage.setItem(`nex:jarvis-dash:v1:${encodeURIComponent(userName)}`, JSON.stringify(messages.slice(-80))); } catch {}
  }, [messages, userName]);
  const voiceEnabledRef = useRef(true);
  const inputId = useId();
  const lastMessageId = messages[messages.length - 1]?.id;

  useEffect(() => {
    const history = historyRef.current;
    if (history) history.scrollTop = history.scrollHeight;
  }, [lastMessageId, loading]);

  useEffect(() => () => {
    if (recognitionRef.current) { recognitionRef.current.onend = null; recognitionRef.current.abort(); }
  }, []);

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
          void sendInternal(greeting + "! Cumprimente o usuário pelo nome " + (userName || "usuário") + ". Uma frase curta — sem perguntas, sem briefing.", true, false);
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function unlockAudio() {
    if (voiceEnabledRef.current) { try { initAudioContext(); } catch { /* HTMLAudio fallback. */ } }
  }

  async function sendInternal(question: string, isVoice = false, showQuestion = true) {
    const text = question.trim().slice(0, 2000);
    if (!text || loading) return;
    const userMsg: ChatMessage = { id: nextId.current++, role: 'user', content: text };
    if(showQuestion)setMessages(curr => [...curr, userMsg].slice(-81));
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
      // Always speak Jarvis response when voice is enabled (default: true)
      if (voiceEnabledRef.current) {
        await speak(reply);
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

  function submit(event: FormEvent) { event.preventDefault(); unlockAudio(); void sendInternal(input); }

  function toggleVoice() {
    if (voiceEnabled) stopSpeech();
    voiceEnabledRef.current = !voiceEnabled;
    setVoiceEnabled(!voiceEnabled);
  }

  function enterConversationMode() {
    unlockAudio();
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
    recognition.continuous = true;
    let finalTranscript = '';
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    recognition.onstart = () => setListening(true);
    recognition.onerror = () => { if (silenceTimer) clearTimeout(silenceTimer); setListening(false); finalTranscript = ''; setInput(''); };
    recognition.onresult = (event: any) => {
      let full = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) { full += event.results[i][0].transcript; }
        else { interim += event.results[i][0].transcript; }
      }
      finalTranscript = full;
      setInput(full + interim);
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => { recognition.stop(); }, 1500);
    };
    recognition.onend = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
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

  return <section data-voice-state={voiceState} className="dashboard-copilot-chat" aria-labelledby={`${inputId}-title`}>
    <div className="dashboard-copilot-toolbar">
      <div>
        <Bot size={18} />
        <span>
          <h3 id={`${inputId}-title`}>Jarvis</h3>
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
          title={voiceEnabled ? 'Silenciar Jarvis' : 'Ativar voz do Jarvis'}
          aria-label={voiceEnabled ? 'Silenciar Jarvis' : 'Ativar voz do Jarvis'}
          aria-pressed={voiceEnabled}
          onClick={toggleVoice}
        >
          {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        <button
          type="button"
          className="dashboard-copilot-nova-btn"
          aria-label="Nova conversa com Jarvis"
          title="Nova conversa"
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

    <div className="jarvis-playback-row"><JarvisVoiceVisual state={voiceState} compact />{speechState === 'blocked' && <button type="button" onClick={() => void resumeSpeech()}>Reproduzir ?udio</button>}{['speaking', 'preparing', 'blocked'].includes(speechState) && <button type="button" onClick={stopSpeech} aria-label="Parar fala do Jarvis">Parar fala</button>}</div>
    <div ref={historyRef} className="dashboard-copilot-history" role="log" aria-label="Conversa com Jarvis" aria-live="polite" aria-relevant="additions" tabIndex={0}>
      {messages.map(message => (
        <article key={message.id} className={`dashboard-copilot-message is-${message.role}`} aria-label={message.role === 'user' ? 'Sua mensagem' : 'Resposta do Jarvis'}>
          <div>
            <small>{message.role === 'user' ? 'Você' : 'Jarvis'}</small>
            <p><LinkText text={message.content} /></p>
            {message.role === 'assistant' && message.id > 0 && (
              <button
                type="button"
                className="dashboard-copilot-listen-btn"
                title="Ouvir resposta"
                aria-label="Ouvir resposta"
                onClick={() => { unlockAudio(); void speak(message.content); }}
              >
                <Volume2 size={11} /> ouvir
              </button>
            )}
          </div>
        </article>
      ))}
      {loading && (
        <article className="dashboard-copilot-message is-assistant" aria-label="Jarvis está processando">
          <div><small>Jarvis</small><p>Processando…</p></div>
        </article>
      )}
    </div>

    {!conversationMode && (
      <div className="dashboard-copilot-suggestions" aria-label="Sugestões">
        {suggestions.map(q => (
          <button type="button" key={q} disabled={loading} onClick={() => { unlockAudio(); void sendInternal(q); }}>{q}</button>
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
        <label className="sr-only" htmlFor={inputId}>Mensagem para o Jarvis</label>
        <textarea
          ref={inputRef}
          id={inputId}
          rows={2}
          maxLength={2000}
          value={input}
          disabled={loading || listening}
          onChange={e => setInput(e.target.value)}
          placeholder={listening ? 'Ouvindo…' : 'Pergunte ao Jarvis…'}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
        />
        {SpeechRecognitionAPI && (
          <button
            type="button"
            className={`dashboard-copilot-mic-btn${listening ? ' is-listening' : ''}`}
            onClick={listening ? stopListening : startListening}
            disabled={loading}
            aria-label={listening ? 'Parar gravação' : 'Falar para o Jarvis'}
            title={listening ? 'Parar gravação' : 'Falar para o Jarvis'}
          >
            {listening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        )}
        <button type="submit" disabled={!input.trim() || loading || listening} aria-label="Enviar mensagem ao Jarvis">
          <Send size={21} />
        </button>
      </form>
    )}

    <p className="dashboard-copilot-privacy">Jarvis acessa seus dados em tempo real.</p>
  </section>;
}
