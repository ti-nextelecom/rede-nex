import { JARVIS_CONVERSATION_ID } from './chatDrafts.mjs';

/** Existing authenticated Jarvis API, with owner-scoped history and a single in-flight turn. */
export function createJarvisConversation({ ownerId, storage, drafts, request }) {
  const key = ownerId ? `nex:jarvis-history:v1:${encodeURIComponent(ownerId)}` : null;
  let messages = [];
  try {
    const saved = key && JSON.parse(storage?.getItem(key) || 'null');
    if (saved?.version === 1 && saved.ownerId === ownerId && Array.isArray(saved.messages)) {
      messages = saved.messages.filter(message => message && ['user', 'assistant'].includes(message.role)
        && typeof message.id === 'string' && typeof message.content === 'string' && message.content.length <= 16000).slice(-80);
    }
  } catch { /* Start a fresh history if browser storage is unavailable. */ }
  let state = { messages, pending: null, error: '' };
  let ordinal = 0;
  const listeners = new Set();
  const emit = patch => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  const message = (role, content) => ({ id: `${Date.now()}-${++ordinal}-${role}`, role, content });
  return {
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async send() {
      const token = drafts.capture(JARVIS_CONVERSATION_ID);
      const text = token?.text.trim().slice(0, 2000);
      if (!ownerId || !text || state.pending) return false;
      const question = message('user', text);
      const history = state.messages;
      emit({ pending: question, error: '' });
      try {
        const result = await request([...history.slice(-19), question].map(({ role, content }) => ({ role, content })));
        if (typeof result?.reply !== 'string' || !result.reply.trim()) throw new Error('O Jarvis não retornou uma resposta. Tente novamente.');
        const next = [...history, question, message('assistant', result.reply)].slice(-80);
        try { if (key) storage?.setItem(key, JSON.stringify({ version: 1, ownerId, messages: next })); } catch { /* History remains available during this session. */ }
        drafts.clearIfUnchanged(JARVIS_CONVERSATION_ID, token);
        emit({ messages: next, pending: null, error: '' });
        return true;
      } catch (error) {
        emit({ pending: null, error: error instanceof Error ? error.message : 'Não foi possível falar com o Jarvis. Tente novamente.' });
        return false;
      }
    },
  };
}
