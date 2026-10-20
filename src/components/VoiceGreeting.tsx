import { useEffect } from 'react';
import { useAuth } from '../lib/auth';

function stripMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*([^*\n]+?)\*/g, '$1')
    .replace(/`([^`]+?)`/g, '$1')
    .replace(/^[ \t]*[-*] /gm, ' ')
    .replace(/<[^>]+>/g, '');
}

async function speakElevenLabs(text: string): Promise<boolean> {
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 1000) }),
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

function speakFallback(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text.slice(0, 1000));
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

export function VoiceGreeting() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.name) return;
    const key = `nexVoiceGreeted_${new Date().toDateString()}_${user.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');

    const firstName = user.name.split(' ')[0];
    const h = new Date().getHours();
    const period = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        const res = await fetch('/api/jarves', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{
              role: 'user',
              content: `${period}, ${firstName}! Faça um briefing rápido do meu dia: minhas pendências, o que preciso entregar hoje, pontos de atenção importantes. Seja breve e objetivo. Ao final, pergunte o que desejo fazer.`,
            }],
          }),
        });
        if (cancelled) return;
        const data: { reply?: string } = await res.json();
        const text = data.reply
          ? stripMd(data.reply)
          : `${period}, ${firstName}! Sistemas online. O que você deseja fazer hoje?`;
        const ok = await speakElevenLabs(text);
        if (!ok) speakFallback(text);
      } catch {
        if (cancelled) return;
        const fallback = `${period}, ${firstName}! Sistemas online. O que você deseja fazer?`;
        const ok = await speakElevenLabs(fallback);
        if (!ok) speakFallback(fallback);
      }
    }, 1500);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [user?.id]);

  return null;
}
