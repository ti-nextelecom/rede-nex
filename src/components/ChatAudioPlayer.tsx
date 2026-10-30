import { useRef, useState } from 'react';
import { Pause, Play, Volume2 } from 'lucide-react';
const clock = (value: number) => Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '0:00';
export function ChatAudioPlayer({ src }: { src: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState('');
  async function toggle() {
    const element = audio.current;
    if (!element) return;
    if (!element.paused) { element.pause(); return; }
    try { setError(''); await element.play(); } catch { setError('Não foi possível reproduzir este áudio. Tente novamente.'); }
  }
  return <div className="chat-audio-player">
    <audio ref={audio} src={src} preload="metadata" onLoadedMetadata={event => setDuration(event.currentTarget.duration)} onDurationChange={event => setDuration(event.currentTarget.duration)} onTimeUpdate={event => setTime(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => { setPlaying(false); setError('Áudio indisponível.'); }} />
    <button type="button" className="chat-audio-play" aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'} onClick={() => void toggle()}>{playing ? <Pause size={20} /> : <Play size={20} />}</button>
    <div className="chat-audio-track"><input type="range" aria-label="Posição do áudio" min={0} max={Number.isFinite(duration) && duration > 0 ? duration : Math.max(time, 1)} step={0.1} value={time} onChange={event => { if (audio.current) audio.current.currentTime = Number(event.target.value); setTime(Number(event.target.value)); }} /><span>{clock(time)} / {clock(duration)}</span></div>
    <button type="button" className="chat-audio-speed" aria-label={`Velocidade do áudio: ${speed} vezes`} onClick={() => { const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1; setSpeed(next); if (audio.current) audio.current.playbackRate = next; }}>{speed}×</button><Volume2 size={16} aria-hidden="true" />
    {error && <p role="alert">{error}</p>}
  </div>;
}
