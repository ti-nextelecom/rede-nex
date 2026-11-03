const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });
export async function insertChatMessage(query, { userId, conversationId, content, attachmentUrl = null, replyToId = null, clientMessageId = null }) {
  if (clientMessageId !== null && (typeof clientMessageId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientMessageId))) throw fail(400, 'Identificação de envio inválida.');
  const { rows } = await query(`WITH inserted AS (
    INSERT INTO chat_messages(conversation_id,sender_id,content,attachment_url,reply_to_id,client_message_id)
    VALUES($1,$2,$3,$4,$5,$6)
    ON CONFLICT(sender_id,client_message_id) WHERE client_message_id IS NOT NULL DO NOTHING RETURNING *
  ), touched AS (UPDATE chat_conversations SET updated_at=now() WHERE id=$1 AND EXISTS(SELECT 1 FROM inserted)) SELECT * FROM inserted`, [conversationId, userId, content, attachmentUrl, replyToId, clientMessageId]);
  if (rows[0]) return { message: rows[0], inserted: true };
  const message = (await query('SELECT * FROM chat_messages WHERE sender_id=$1 AND client_message_id=$2', [userId, clientMessageId])).rows[0];
  if (!message || message.conversation_id !== conversationId || message.content !== content || (message.attachment_url || null) !== attachmentUrl || (message.reply_to_id || null) !== replyToId) throw fail(409, 'Este envio já foi utilizado para outra mensagem.');
  return { message, inserted: false };
}
