/** Ignore responses from a previous selection, including A -> B -> A. */
export function createChatRequestGuard(initialConversationId = null) {
  let conversationId = initialConversationId;
  let generation = 0;
  let sequence = 0;
  const applied = new Map();
  const isCurrent = request => request.conversationId === conversationId && request.generation === generation;
  return {
    select(nextId) {
      if (nextId === conversationId) return;
      conversationId = nextId;
      generation++;
      applied.clear();
    },
    capture(id, channel = 'messages') {
      return { conversationId: id, generation, sequence: ++sequence, channel };
    },
    isCurrent,
    accept(request) {
      if (!isCurrent(request) || request.sequence < (applied.get(request.channel) || 0)) return false;
      applied.set(request.channel, request.sequence);
      return true;
    },
  };
}
