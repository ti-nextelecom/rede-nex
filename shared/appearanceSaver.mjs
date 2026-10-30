// Serialize writes: an older response cannot undo a newer selection.
export function createAppearanceSaver({ save, onStatus, onSaved, delay = 600 }) {
  let stopped = false, busy = false, timer, desired, revision = 0, confirmedRevision = 0, running = Promise.resolve();
  function flush() {
    clearTimeout(timer);
    if (stopped || !desired || revision === confirmedRevision) return Promise.resolve();
    if (busy) return running;
    busy = true;
    const version = revision, value = desired;
    onStatus('saving');
    running = (async () => {
      try {
        const result = await save(value);
        confirmedRevision = version;
        if (!stopped) { onSaved(result); onStatus(version === revision ? 'saved' : 'pending'); }
      } catch (error) {
        if (!stopped) onStatus('error', error);
      } finally {
        busy = false;
        if (!stopped && version !== revision) await flush();
      }
    })();
    return running;
  }
  return {
    stage(value) { if (stopped) return; desired = value; revision++; onStatus('pending'); clearTimeout(timer); timer = setTimeout(() => void flush(), delay); },
    flush,
    stop() { stopped = true; clearTimeout(timer); },
  };
}
