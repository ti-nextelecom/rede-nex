export const CHAT_NOTIFICATION_SOUND = Object.freeze({ repeats: 4, volume: .45, interval: .6, duration: .34 });

/** Schedule all audible pulses on the audio clock, then release every node. */
export function scheduleChatNotificationSound(context, onFinished = () => {}) {
  const nodes = [];
  let stopped = false;
  let remaining = CHAT_NOTIFICATION_SOUND.repeats;
  let cleanupTimer;
  function stop() {
    if (stopped) return;
    stopped = true;
    clearTimeout(cleanupTimer);
    for (const { oscillator, gain } of nodes) {
      oscillator.onended = null;
      try { oscillator.stop(); } catch { /* The pulse may have already ended. */ }
      oscillator.disconnect(); gain.disconnect();
    }
    void context.close().catch(() => undefined);
    onFinished();
  }
  for (let index = 0; index < CHAT_NOTIFICATION_SOUND.repeats; index++) {
    const start = context.currentTime + .02 + index * CHAT_NOTIFICATION_SOUND.interval;
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(880, start);
    oscillator.frequency.exponentialRampToValueAtTime(1320, start + .09);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(CHAT_NOTIFICATION_SOUND.volume, start + .015);
    gain.gain.setValueAtTime(CHAT_NOTIFICATION_SOUND.volume, start + .1);
    gain.gain.exponentialRampToValueAtTime(.0001, start + .32);
    oscillator.connect(gain); gain.connect(context.destination);
    nodes.push({ oscillator, gain });
    oscillator.onended = () => { if (--remaining === 0) stop(); };
    oscillator.start(start); oscillator.stop(start + CHAT_NOTIFICATION_SOUND.duration);
  }
  // Also release a context whose autoplay was blocked or whose tab was suspended.
  const sequenceDuration=.02+(CHAT_NOTIFICATION_SOUND.repeats-1)*CHAT_NOTIFICATION_SOUND.interval+CHAT_NOTIFICATION_SOUND.duration;
  cleanupTimer = setTimeout(stop, Math.ceil((sequenceDuration+.4)*1000));
  return stop;
}
