import { isChatReaction } from '../../shared/chatReactions.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(statusCode,message)=>Object.assign(new Error(message),{statusCode});
export async function attachChatReactions(query,messages,userId) {
    if(!messages.length)return messages;
    const rows=(await query(`SELECT r.message_id,r.emoji,count(*)::int count,bool_or(r.user_id=$2) mine,
      json_agg(json_build_object('id',u.id,'name',u.name) ORDER BY u.name,u.id) users
      FROM chat_message_reactions r JOIN users u ON u.id=r.user_id
      JOIN chat_messages m ON m.id=r.message_id AND m.conversation_id=r.conversation_id AND m.is_deleted=false
      WHERE r.message_id=ANY($1::uuid[]) GROUP BY r.message_id,r.emoji ORDER BY r.emoji`,[messages.map(message=>message.id),userId])).rows;
    const byMessage=new Map();
    for(const {message_id,...reaction} of rows){if(!byMessage.has(message_id))byMessage.set(message_id,[]);byMessage.get(message_id).push(reaction);}
    return messages.map(message=>({...message,reactions:byMessage.get(message.id) || []}));
  }
export function chatReactions(pool) {
  const attach=attachChatReactions;
  async function access(query,userId,conversationId,messageId,lock=false) {
    if(!uuid.test(conversationId) || !uuid.test(messageId))throw fail(400,'Identificador de mensagem inválido');
    const row=(await query(`SELECT m.id FROM chat_messages m
      JOIN chat_participants cp ON cp.conversation_id=m.conversation_id AND cp.user_id=$3
      JOIN users u ON u.id=cp.user_id AND u.status='active'
      WHERE m.id=$2 AND m.conversation_id=$1 AND m.is_deleted=false
      ${lock?'FOR UPDATE OF m FOR SHARE OF cp':''}`,[conversationId,messageId,userId])).rows[0];
    if(!row)throw fail(404,'Mensagem indisponível nesta conversa');
  }
  async function list(userId,conversationId,messageId){
    const query=pool.query.bind(pool);await access(query,userId,conversationId,messageId);
    return (await attach(query,[{id:messageId}],userId))[0].reactions;
  }
  async function set(userId,conversationId,messageId,emoji){
    if(emoji!==null && !isChatReaction(emoji))throw fail(400,'Selecione uma reação válida');
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const query=client.query.bind(client);await access(query,userId,conversationId,messageId,true);
      if(emoji===null)await query('DELETE FROM chat_message_reactions WHERE message_id=$1 AND user_id=$2',[messageId,userId]);
      else await query(`INSERT INTO chat_message_reactions(message_id,conversation_id,user_id,emoji) VALUES($1,$2,$3,$4)
        ON CONFLICT(message_id,user_id) DO UPDATE SET emoji=excluded.emoji`,[messageId,conversationId,userId,emoji]);
      const result=(await attach(query,[{id:messageId}],userId))[0].reactions;
      await query('COMMIT');return result;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  return {attach,list,set};
}
