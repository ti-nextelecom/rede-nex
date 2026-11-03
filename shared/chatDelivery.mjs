export function chatDelivery(conversation, myId) {
  const message = conversation.last_message;
  if (!message || message.sender?.id !== myId) return null;
  const total = message.recipient_count ?? (conversation.other_participant ? 1 : 0);
  if (!total) return null;
  const read = message.read_count ?? (Date.parse(conversation.other_participant?.last_read_at || '') >= Date.parse(message.created_at) ? 1 : 0);
  return { read: read > 0, complete: read >= total, label: read >= total ? (total > 1 ? 'Lida por todos' : 'Lida') : read > 0 ? `Lida por ${read} de ${total}` : 'Não lida' };
}

export function applyChatRead(conversations, event) {
  if (typeof event.readBy !== 'string' || !Number.isFinite(Date.parse(event.lastReadAt))) return conversations;
  let changed = false;
  const next = conversations.map(conversation => {
    if (conversation.id !== event.conversationId || conversation.other_participant?.id !== event.readBy
      || Date.parse(event.lastReadAt) <= Date.parse(conversation.other_participant.last_read_at || '1970-01-01')) return conversation;
    changed = true;
    return { ...conversation, other_participant: { ...conversation.other_participant, last_read_at: event.lastReadAt },
      last_message: conversation.last_message ? { ...conversation.last_message, read_count: Date.parse(event.lastReadAt) >= Date.parse(conversation.last_message.created_at) ? 1 : conversation.last_message.read_count } : undefined };
  });
  return changed ? next : conversations;
}
export function preserveConversationReads(previous, latest) {
  const byId = new Map(previous.map(conversation => [conversation.id, conversation]));
  return latest.map(conversation => {
    const old = byId.get(conversation.id)?.other_participant;
    const current = conversation.other_participant;
    if (!old || !current || old.id !== current.id || !(Date.parse(old.last_read_at) > Date.parse(current.last_read_at || '1970-01-01'))) return conversation;
    return applyChatRead([conversation], { conversationId: conversation.id, readBy: old.id, lastReadAt: old.last_read_at })[0];
  });
}
