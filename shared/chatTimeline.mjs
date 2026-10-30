export function mergeChatMessages(previous, latest) {
  const map = new Map(previous.map(message => [message.id, message]));
  for (const message of latest) map.set(message.id, message);
  return [...map.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at) || a.id.localeCompare(b.id));
}

export function chatScrollAction({ initial, following, ownMessage, prepending }) {
  if (prepending) return 'preserve';
  return initial || following || ownMessage ? 'bottom' : 'none';
}
