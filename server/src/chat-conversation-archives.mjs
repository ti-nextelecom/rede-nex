export function conversationArchives(query) {
  return {
    async set(userId, conversationId, archived) {
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuid.test(userId) || !uuid.test(conversationId)) return false;
      const member = await query('SELECT 1 FROM chat_participants WHERE user_id=$1 AND conversation_id=$2', [userId, conversationId]);
      if (!member.rowCount) return false;
      if (archived) {
        await query(`INSERT INTO chat_conversation_archives(user_id,conversation_id)
          SELECT user_id,conversation_id FROM chat_participants WHERE user_id=$1 AND conversation_id=$2
          ON CONFLICT(user_id,conversation_id) DO NOTHING`, [userId, conversationId]);
      } else {
        await query('DELETE FROM chat_conversation_archives WHERE user_id=$1 AND conversation_id=$2', [userId, conversationId]);
      }
      return true;
    },
  };
}
