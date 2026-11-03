export const JARVIS_CONVERSATION_ID = 'jarvis';

const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 200;

/** One owner per store. Draft tokens prevent a late send from clearing newer text. */
export function createChatDraftStore({ ownerId, storage }) {
  const key = ownerId ? `nex:chat-drafts:v1:${encodeURIComponent(ownerId)}` : null;
  let drafts = Object.create(null);
  const listeners = new Set();
  let timer;
  let dirty = false;
  try {
    const saved = key && JSON.parse(storage?.getItem(key) || 'null');
    if (saved?.version === 1 && saved.ownerId === ownerId && saved.drafts && typeof saved.drafts === 'object') {
      for (const [id, text] of Object.entries(saved.drafts)) {
        if (validId(id) && typeof text === 'string' && text.length <= 32000 && text.length) drafts[id] = Object.freeze({ text });
      }
    }
  } catch { /* Unavailable or invalid storage must not block composing. */ }

  function flush() {
    clearTimeout(timer);
    if (!dirty) return;
    dirty = false;
    try {
      if (key) {
        const texts = Object.fromEntries(Object.entries(drafts).map(([id, draft]) => [id, draft.text]));
        if (Object.keys(texts).length) storage?.setItem(key, JSON.stringify({ version: 1, ownerId, drafts: texts }));
        else storage?.removeItem(key);
      }
    } catch { /* Keep this session's drafts if storage is full or disabled. */ }
  }
  function publish(next) {
    drafts = next; dirty = true;
    clearTimeout(timer); timer = setTimeout(flush, 250);
    for (const listener of listeners) listener();
  }

  return {
    flush,
    getSnapshot: () => drafts,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    capture: id => drafts[id],
    set(id, value) {
      if (!validId(id)) return;
      const previous = drafts[id]?.text || '';
      const text = typeof value === 'function' ? value(previous) : value;
      if (typeof text !== 'string' || text === previous) return;
      const next = Object.assign(Object.create(null), drafts);
      if (text) next[id] = Object.freeze({ text });
      else delete next[id];
      publish(next);
    },
    clearIfUnchanged(id, token) {
      if (!token || drafts[id] !== token) return false;
      const next = Object.assign(Object.create(null), drafts);
      delete next[id];
      publish(next);
      flush();
      return true;
    },
  };
}
