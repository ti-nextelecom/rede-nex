export function mergeChatMessages(previous, latest) {
  const map = new Map(previous.map(message => [message.id, message]));
  let changed = false;
  for (const message of latest) {
    const old = map.get(message.id);
    if (old && JSON.stringify(old) === JSON.stringify(message)) continue;
    map.set(message.id, message); changed = true;
  }
  if (!changed) return previous;
  return [...map.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at) || a.id.localeCompare(b.id));
}

export function chatScrollAction({ initial, following, ownMessage, prepending }) {
  if (prepending) return 'preserve';
  return initial || following || ownMessage ? 'bottom' : 'none';
}

export function reuseChatSnapshot(previous, latest) {
  const byId = new Map(previous.map(row => [row.id, row]));
  const next = latest.map(row => { const old = byId.get(row.id); return old && JSON.stringify(old) === JSON.stringify(row) ? old : row; });
  return next.length === previous.length && next.every((row, index) => row === previous[index]) ? previous : next;
}
