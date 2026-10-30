/** One account, stable client IDs and a serial queue per conversation. No automatic retry after a failure. */
export function createChatOutbox({ ownerId, storage, send }) {
  const key = ownerId ? `nex:chat-outbox:v1:${encodeURIComponent(ownerId)}` : null;
  let entries = [];
  const listeners = new Set(), running = new Set();
  try {
    const saved = key && JSON.parse(storage?.getItem(key) || 'null');
    if (saved?.ownerId === ownerId && Array.isArray(saved.entries)) entries = saved.entries.filter(entry => /^[0-9a-f-]{36}$/i.test(entry.clientId) && typeof entry.conversationId === 'string' && typeof entry.content === 'string' && entry.content.length <= 8000).slice(-100).map(entry => ({ ...entry, state: 'failed', error: 'Confira o envio ou tente novamente.' }));
  } catch { /* Queue remains usable in memory. */ }
  function publish(next) {
    entries = next;
    try { if (key) storage?.setItem(key, JSON.stringify({ ownerId, entries: entries.filter(entry => entry.state !== 'sent').slice(-100) })); } catch { /* Keep pending messages during this session. */ }
    listeners.forEach(listener => listener());
  }
  function update(id, patch) { publish(entries.map(entry => entry.clientId === id ? { ...entry, ...patch } : entry)); }
  async function drain(conversationId) {
    if (running.has(conversationId)) return;
    running.add(conversationId);
    try {
      for (;;) {
        const entry = entries.find(item => item.conversationId === conversationId && item.state === 'queued');
        if (!entry) break;
        update(entry.clientId, { state: 'sending' });
        try { const message = await send(entry); if (message.sender_id !== ownerId || message.conversation_id !== entry.conversationId || message.client_message_id !== entry.clientId) throw new Error('Resposta de outra conta ou envio'); update(entry.clientId, { state: 'sent', message, error: '' }); }
        catch { update(entry.clientId, { state: 'failed', error: 'Não foi possível confirmar o envio. Tente novamente.' }); }
      }
    } finally { running.delete(conversationId); }
  }
  return {
    getSnapshot: () => entries,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    reconcile(messages) {
      const received = new Map(messages.filter(message => message.sender_id === ownerId && message.client_message_id).map(message => [message.client_message_id, message]));
      const next = entries.filter(entry => received.get(entry.clientId)?.conversation_id !== entry.conversationId);
      if (next.length !== entries.length) publish(next);
    },
    enqueue({ conversationId, content, replyToId, replyTo }) {
      if (!ownerId || !content.trim()) return null;
      const clientId = crypto.randomUUID();
      const entry = { clientId, conversationId, content: content.trim().slice(0, 8000), replyToId, replyTo, createdAt: new Date().toISOString(), state: 'queued' };
      const completed = entries.filter(item => item.state === 'sent').slice(-100);
      publish([...entries.filter(item => item.state !== 'sent'), ...completed, entry]);
      void drain(conversationId);
      return clientId;
    },
    retry(id) { const entry = entries.find(item => item.clientId === id); if (!entry || entry.state !== 'failed') return; update(id, { state: 'queued', error: '' }); void drain(entry.conversationId); },
    discard(id) { publish(entries.filter(entry => entry.clientId !== id || entry.state !== 'failed')); },
  };
}
export function mergeChatOutbox(messages, entries, conversationId, user) {
  const ids = new Set(messages.map(message => message.id)), clients = new Set(messages.filter(message => message.sender_id === user.id).map(message => message.client_message_id).filter(Boolean));
  const pending = entries.filter(entry => entry.conversationId === conversationId && !clients.has(entry.clientId) && !ids.has(entry.message?.id)).map(entry => entry.message || {
    id: `local-${entry.clientId}`, client_message_id: entry.clientId, conversation_id: conversationId, content: entry.content, sender_id: user.id, sender: user,
    created_at: entry.createdAt, updated_at: entry.createdAt, reply_to: entry.replyTo, delivery_state: entry.state === 'failed' ? 'failed' : 'sending',
  });
  return pending.length ? [...messages, ...pending].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id)) : messages;
}
