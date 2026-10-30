import type { CSSProperties } from 'react';
import type { JarvisVoiceState } from '../hooks/useJarvisSpeech';
import './jarvis-voice.css';

const heights = [10, 18, 28, 16, 35, 22, 42, 30, 18, 38, 24, 34, 14, 23, 10];
const labels: Record<JarvisVoiceState, string> = {
  idle: 'Pronto para ajudar', preparing: 'Preparando áudio', speaking: 'Jarvis está falando',
  listening: 'Ouvindo você', thinking: 'Analisando sua pergunta', blocked: 'Áudio aguardando reprodução', error: 'Áudio indisponível',
};
export function JarvisVoiceVisual({ state, compact = false }: { state: JarvisVoiceState; compact?: boolean }) {
  return <div className={`jarvis-voice-visual${compact ? ' is-compact' : ''}`} data-voice-state={state}>
    <div className="jarvis-voice-bars" aria-hidden="true">{heights.map((height, index) => <i key={index} style={{ '--voice-height': `${height}px`, '--voice-delay': `${-index * .13}s` } as CSSProperties} />)}</div>
    <span role="status" aria-live="polite">{labels[state]}</span>
  </div>;
}
