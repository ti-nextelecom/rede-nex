// Module-level singleton — one AudioContext shared across all Jarves instances.
// Must be initialized from a user-gesture handler (FAB click) to unlock autoplay.
let _ctx: AudioContext | null = null;

/** Call inside a click/touch handler to unlock browser autoplay policy. */
export function initAudioContext(): AudioContext {
  if (!_ctx || _ctx.state === 'closed') {
    _ctx = new AudioContext();
  }
  if (_ctx.state === 'suspended') {
    void _ctx.resume();
  }
  return _ctx;
}

/** Returns the singleton AudioContext, or null if not yet initialized. */
export function getAudioContext(): AudioContext | null {
  return _ctx && _ctx.state !== 'closed' ? _ctx : null;
}
