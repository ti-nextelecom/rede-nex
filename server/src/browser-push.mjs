import webpush from 'web-push';
import { readFileSync,writeFileSync,mkdirSync,chmodSync } from 'node:fs';
import { resolve,dirname } from 'node:path';

export const pushKeysPath=()=>resolve(process.env.REDE_NEX_PUSH_KEYS_FILE || '.runtime/web-push.json');
export function setupPushKeys() {
  const file=pushKeysPath();
  mkdirSync(dirname(file),{recursive:true,mode:0o700});
  try { writeFileSync(file,JSON.stringify(webpush.generateVAPIDKeys())+'\n',{flag:'wx',mode:0o600}); }
  catch(error) { if(error.code!=='EEXIST') throw error; }
  chmodSync(file,0o600);
  const keys=JSON.parse(readFileSync(file,'utf8'));
  if(!keys.publicKey || !keys.privateKey) throw new Error('Arquivo VAPID inválido');
  return keys;
}
export function pushConfiguration() {
  try {
    const keys=JSON.parse(readFileSync(pushKeysPath(),'utf8'));
    const subject=process.env.WEB_PUSH_SUBJECT || process.env.CORS_ORIGINS?.split(',').map(s=>s.trim()).find(s=>s.startsWith('https://'));
    if(!keys.publicKey || !keys.privateKey || !subject) return null;
    return { ...keys,subject };
  } catch { return null; }
}
export function validatePushSubscription(input) {
  let endpoint;
  try { endpoint=new URL(input?.endpoint); } catch { throw Object.assign(new Error('Assinatura inválida'),{statusCode:400}); }
  // An authenticated client must never turn the delivery worker into an SSRF proxy.
  const host=endpoint.hostname.toLowerCase();
  const allowed=host==='fcm.googleapis.com' || host==='updates.push.services.mozilla.com' || host.endsWith('.notify.windows.com') || host==='web.push.apple.com';
  const keys=input?.keys;
  if(!allowed || endpoint.protocol!=='https:' || endpoint.username || endpoint.password || endpoint.port || endpoint.hash
    || input.endpoint.length>2048 || !/^[A-Za-z0-9_-]{87}$/.test(keys?.p256dh || '') || !/^[A-Za-z0-9_-]{22}$/.test(keys?.auth || '')) {
    throw Object.assign(new Error('Serviço ou chaves de push inválidos'),{statusCode:400});
  }
  return {endpoint:endpoint.href,p256dh:keys.p256dh,auth:keys.auth};
}
export async function savePushSubscription(pool,user,input) {
  const sub=validatePushSubscription(input);
  await pool.query(`INSERT INTO browser_push_subscriptions(user_id,session_id,endpoint,p256dh,auth)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT(endpoint) DO UPDATE SET user_id=$1,session_id=$2,p256dh=$4,auth=$5,updated_at=now()`,
    [user.id,user.session_id,sub.endpoint,sub.p256dh,sub.auth]);
}
export async function dispatchPushBatch(pool,config,send=webpush.sendNotification.bind(webpush)) {
  const client=await pool.connect();
  let rows;
  try {
    await client.query('BEGIN');
    rows=(await client.query(`WITH claimed AS (SELECT id FROM browser_push_deliveries WHERE next_attempt_at<=now()
      ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT 10)
      UPDATE browser_push_deliveries d SET attempts=d.attempts+1,next_attempt_at=now()+interval '2 minutes'
      FROM claimed WHERE d.id=claimed.id RETURNING d.*`)).rows;
    await client.query('COMMIT');
  } catch(error) {await client.query('ROLLBACK');throw error;} finally {client.release();}
  for(const delivery of rows) {
    const data=(await pool.query(`SELECT s.*,n.title,n.message,n.link,n.type,n.read,n.actor_name,n.actor_photo_url,us.revoked_at,us.expires_at,u.status
      FROM browser_push_subscriptions s JOIN notifications n ON n.id=$2 AND n.user_id=s.user_id
      JOIN user_sessions us ON us.id=s.session_id AND us.user_id=s.user_id JOIN users u ON u.id=s.user_id WHERE s.id=$1`,[delivery.subscription_id,delivery.notification_id])).rows[0];
    const remove=()=>pool.query('DELETE FROM browser_push_deliveries WHERE id=$1',[delivery.id]);
    if(!data || data.read || data.status!=='active' || data.revoked_at || new Date(data.expires_at)<=new Date()
      || delivery.attempts>5 || Date.now()-new Date(delivery.created_at).getTime()>24*60*60*1000) {await remove();continue;}
    // Respect normal chat mute. Attention requests are deliberately distinct and explicit.
    if(data.type==='chat') {
      const id=new URL(data.link || '/', 'https://local.invalid').searchParams.get('conversa');
      if(id) {
        const member=(await pool.query('SELECT is_muted FROM chat_participants WHERE conversation_id=$1 AND user_id=$2',[id,data.user_id])).rows[0];
        if(!member || member.is_muted) {await remove();continue;}
      }
    }
    try {
      await send({endpoint:data.endpoint,keys:{p256dh:data.p256dh,auth:data.auth}},JSON.stringify({
        id:delivery.notification_id,userId:data.user_id,title:data.title,body:(data.message || '').slice(0,500),link:data.link || '/',attention:data.link?.includes('atencao=') || false,
        conversationId:(data.type==='chat' || data.link?.includes('atencao='))?new URL(data.link || '/', 'https://local.invalid').searchParams.get('conversa'):null,
        actorName:data.actor_name || null, actorPhotoUrl:data.actor_photo_url || null
      }),{vapidDetails:{subject:config.subject,publicKey:config.publicKey,privateKey:config.privateKey},TTL:3600,timeout:10000});
      await remove();
    } catch(error) {
      if([404,410].includes(error.statusCode)) await pool.query('DELETE FROM browser_push_subscriptions WHERE id=$1',[delivery.subscription_id]);
      else if(error.statusCode && error.statusCode>=400 && error.statusCode<500 && error.statusCode!==429) await remove();
      // Transient failures remain in the durable outbox. Never log endpoint/keys/content.
    }
  }
  await pool.query("DELETE FROM browser_push_deliveries WHERE created_at<now()-interval '1 day'");
  return rows.length;
}
export function startPushWorker(pool) {
  const config=pushConfiguration();
  if(!config) return ()=>{};
  let busy=false;
  const tick=async()=>{if(busy)return;busy=true;try{await dispatchPushBatch(pool,config);}catch{console.error('[Push] Falha ao processar fila');}finally{busy=false;}};
  const timer=setInterval(tick,3000);timer.unref();void tick();
  return ()=>clearInterval(timer);
}
