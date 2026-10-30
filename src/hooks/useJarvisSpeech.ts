import { useCallback, useEffect, useRef, useState } from 'react';
import { getAudioContext } from './useAudioContext';

export type SpeechState = 'idle' | 'preparing' | 'speaking' | 'blocked' | 'error';
export type JarvisVoiceState = SpeechState | 'listening' | 'thinking';

// Playback owns the visual state. A request/decoded buffer alone is not speech.
// Tokens + abort prevent cancelled or older TTS responses from starting later.
export function useJarvisSpeech() {
  const [speechState, setSpeechState] = useState<SpeechState>('idle');
  const generation = useRef(0);
  const alive = useRef(true);
  const request = useRef<AbortController | null>(null);
  const active = useRef<{ source?: AudioBufferSourceNode; audio?: HTMLAudioElement; url?: string }>({});
  const release = useCallback(() => {
    const current = active.current;
    active.current = {};
    if (current.source) {
      current.source.onended = null;
      try { current.source.stop(); } catch { /* Already ended. */ }
      current.source.disconnect();
    }
    if (current.audio) {
      current.audio.onplaying = current.audio.onended = current.audio.onerror = current.audio.onpause = null;
      current.audio.pause(); current.audio.removeAttribute('src'); current.audio.load();
    }
    if (current.url) URL.revokeObjectURL(current.url);
  }, []);
  const stopSpeech = useCallback(() => {
    generation.current++;
    request.current?.abort(); request.current = null;
    release();
    if (alive.current) setSpeechState('idle');
  }, [release]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; stopSpeech(); }; }, [stopSpeech]);

  const resumeSpeech = useCallback(async () => {
    const audio = active.current.audio;
    if (!audio) return;
    try { await audio.play(); } catch { if (alive.current) setSpeechState('blocked'); }
  }, []);

  const speak = useCallback(async (text: string) => {
    stopSpeech();
    const token = generation.current;
    const valid = () => alive.current && generation.current === token;
    const finish = (state: SpeechState = 'idle') => { if (valid()) { release(); setSpeechState(state); } };
    const clean = text.replace(/\*\*?([^*]+)\*\*?/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/<[^>]+>/g, '').slice(0, 1000);
    if (!clean.trim()) return;
    setSpeechState('preparing');
    const controller = new AbortController(); request.current = controller;
    try {
      const res = await fetch('/api/tts', { method: 'POST', credentials: 'include', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: clean }) });
      if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
      const bytes = await res.arrayBuffer();
      if (!valid()) return;
      const context = getAudioContext();
      if (context) {
        const decoded = await context.decodeAudioData(bytes);
        if (!valid()) return;
        if (context.state === 'suspended') await context.resume();
        if (!valid()) return;
        if (context.state !== 'running') { finish('error'); return; }
        const source = context.createBufferSource(); source.buffer = decoded;
        source.connect(context.destination); active.current = { source };
        source.onended = () => finish();
        source.start(); setSpeechState('speaking');
      } else {
        const url = URL.createObjectURL(new Blob([bytes], { type: res.headers.get('content-type') || 'audio/mpeg' }));
        const audio = new Audio(url); active.current = { audio, url };
        audio.onplaying = () => { if (valid()) setSpeechState('speaking'); };
        audio.onpause = () => { if (valid()) setSpeechState('idle'); };
        audio.onended = () => finish(); audio.onerror = () => finish('error');
        try { await audio.play(); } catch { if (valid()) setSpeechState('blocked'); }
      }
    } catch (error) {
      if (valid() && !(error instanceof DOMException && error.name === 'AbortError')) finish('error');
    } finally { if (valid()) request.current = null; }
  }, [release, stopSpeech]);
  return { speechState, speak, stopSpeech, resumeSpeech };
}
