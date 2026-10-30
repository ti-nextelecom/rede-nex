const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (statusCode,message) => Object.assign(new Error(message),{statusCode});

/** The conversation lock makes the cooldown atomic, including across API workers. */
export async function requestChatAttention(pool,actor,conversationId,input={}) {
  if (!uuid.test(conversationId) || (input.message_id && !uuid.test(input.message_id))) throw fail(400,'Identificador inválido');
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const conversation=(await client.query(`SELECT c.*,cp.role FROM chat_conversations c
      JOIN chat_participants cp ON cp.conversation_id=c.id AND cp.user_id=$2
      WHERE c.id=$1 FOR UPDATE OF c`,[conversationId,actor.id])).rows[0];
    if (!conversation) throw fail(403,'Você não participa desta conversa');
    if (conversation.broadcast_mode && !['owner','admin'].includes(conversation.role)) throw fail(403,'Somente administradores podem chamar atenção neste grupo informativo');
    const recent=(await client.query(`SELECT id FROM chat_attention_requests WHERE conversation_id=$1 AND actor_id=$2
      AND created_at>now()-interval '60 seconds' LIMIT 1`,[conversationId,actor.id])).rows[0];
    if (recent) throw fail(429,'Aguarde um minuto antes de chamar atenção novamente nesta conversa');
    const message=(await client.query(`SELECT id FROM chat_messages WHERE conversation_id=$1 AND is_deleted=false
      AND ($2::uuid IS NULL OR id=$2) ORDER BY created_at DESC,id DESC LIMIT 1`,[conversationId,input.message_id || null])).rows[0];
    if (!message) throw fail(400,'Envie ou selecione uma mensagem antes de chamar atenção');
    const recipients=(await client.query(`SELECT cp.user_id FROM chat_participants cp JOIN users u ON u.id=cp.user_id
      WHERE cp.conversation_id=$1 AND cp.user_id<>$2 AND u.status='active'`,[conversationId,actor.id])).rows;
    if (!recipients.length) throw fail(400,'Não há outros participantes ativos nesta conversa');
    const request=(await client.query(`INSERT INTO chat_attention_requests(conversation_id,actor_id,message_id)
      VALUES($1,$2,$3) RETURNING id`,[conversationId,actor.id,message.id])).rows[0];
    const link=`/bate-papo?conversa=${conversationId}&mensagem=${message.id}&atencao=${request.id}`;
    const notifications=(await client.query(`INSERT INTO notifications(user_id,title,message,type,link,actor_name,actor_photo_url)
      SELECT user_id,'Chamar atenção', $2,'warning',$3,$4,$5 FROM unnest($1::uuid[]) user_id RETURNING id,user_id`,
      [recipients.map(row=>row.user_id),`${actor.name} precisa da sua atenção${conversation.type==='group' ? ` em ${conversation.name || 'um grupo'}` : ' na conversa'}. Abra a mensagem para conferir.`,link,actor.name,actor.photo_url || null])).rows;
    await client.query('COMMIT');
    return {id:request.id,message_id:message.id,recipient_count:notifications.length,notifications};
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
