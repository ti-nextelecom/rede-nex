export async function markChatRead(query, userId, conversationId, publish) {
  const result = await query('UPDATE chat_participants SET last_read_at=now() WHERE conversation_id=$1 AND user_id=$2 RETURNING last_read_at', [conversationId, userId]);
  if (!result.rows.length) return false;
  const participants = await query('SELECT user_id FROM chat_participants WHERE conversation_id=$1 AND user_id<>$2', [conversationId, userId]);
  const event = { type: 'message:read', conversationId, readBy: userId, lastReadAt: result.rows[0].last_read_at };
  for (const participant of participants.rows) publish(participant.user_id, event);
  return true;
}
