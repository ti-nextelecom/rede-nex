import { scheduleChatNotificationSound } from '../../shared/chatNotificationSound.mjs';
let stop: (() => void) | undefined;
export function notificationSoundEnabled(userId: string) {
  try { const saved = localStorage.getItem(`nex:notification-sound:${userId}`); return saved === null ? localStorage.getItem('chat_sound_enabled') !== 'false' : saved !== 'off'; } catch { return true; }
}
export function setNotificationSound(userId: string, enabled: boolean) {
  try { localStorage.setItem(`nex:notification-sound:${userId}`, enabled ? 'on' : 'off'); } catch { /* Session control remains available. */ }
  if (!enabled) stopNotificationSound();
}
export function stopNotificationSound() { stop?.(); stop = undefined; }
export function playNotificationSound(userId?: string) {
  if (stop || (userId && !notificationSoundEnabled(userId))) return;
  try {
    const audio = new window.Audio('/assets/sounds/notification.mp3');
    audio.volume = 0.5;
    stop = () => { audio.pause(); audio.currentTime = 0; stop = undefined; };
    audio.onended = () => { stop = undefined; };
    audio.onerror = () => {
      stop = undefined;
      // fallback: oscillator sintético
      const Audio = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Audio) return;
      try {
        const context = new Audio();
        stop = scheduleChatNotificationSound(context, () => { stop = undefined; });
        if (context.state === 'suspended') void context.resume().catch(stopNotificationSound);
      } catch { stopNotificationSound(); }
    };
    void audio.play().catch(() => { stop = undefined; });
  } catch { stopNotificationSound(); }
}
