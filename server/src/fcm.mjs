import {androidAvatarUrl} from '../../shared/androidNotificationAvatar.mjs';
﻿import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chatNotificationTarget} from '../../shared/chatMessageLinks.mjs';
const legacy=fileURLToPath(new URL('../firebase-service-account.json',import.meta.url));
export function androidPushConfiguration(env=process.env) {
  const path=env.FIREBASE_SERVICE_ACCOUNT_PATH||env.GOOGLE_APPLICATION_CREDENTIALS||legacy;
  return {path:resolve(path),configured:existsSync(path)||env.FIREBASE_USE_ADC==='true',projectId:env.FIREBASE_PROJECT_ID||undefined};
}
let messaging;
async function sendAndroidMessage(message) {
  if(!messaging){
    const [{getApps,initializeApp,cert,applicationDefault},{getMessaging}]=await Promise.all([import('firebase-admin/app'),import('firebase-admin/messaging')]);
    const config=androidPushConfiguration();
    if(!config.configured)throw Error('FCM_NOT_CONFIGURED');
    const app=getApps().find(app=>app.name==='rede-nex-android')||initializeApp({credential:existsSync(config.path)?cert(JSON.parse(readFileSync(config.path,'utf8'))):applicationDefault(),...(config.projectId?{projectId:config.projectId}:{})},'rede-nex-android');
    messaging=getMessaging(app);
  }
  return messaging.send(message);
}
export function validateDeviceToken(value) {
  if(typeof value!=='string'||value.length<20||value.length>4096||/[\s\u0000-\u001f\u007f]/.test(value))throw Object.assign(Error('Token de notificacao invalido'),{statusCode:400});
  return value;
}
export async function saveAndroidToken(pool,user,input) {
  const token=validateDeviceToken(input?.token);
  const saved=await pool.query(`INSERT INTO device_fcm_tokens(user_id,session_id,token)
    SELECT $1,$2,$3 FROM user_sessions s WHERE s.id=$2 AND s.user_id=$1 AND s.revoked_at IS NULL AND s.expires_at>now()
    ON CONFLICT(token) DO UPDATE SET user_id=EXCLUDED.user_id,session_id=EXCLUDED.session_id,updated_at=now() RETURNING user_id`,[user.id,user.session_id,token]);
  if(!saved.rowCount)throw Object.assign(Error('Entre novamente para ativar notificacoes'),{statusCode:401});
}
export async function dispatchAndroidPushBatch(pool,send=sendAndroidMessage) {
  const client=await pool.connect();let deliveries;
  try {await client.query('BEGIN');deliveries=(await client.query(`WITH claimed AS (SELECT id FROM android_push_deliveries WHERE next_attempt_at<=now() ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT 10)
    UPDATE android_push_deliveries d SET attempts=d.attempts+1,next_attempt_at=now()+interval '2 minutes' FROM claimed WHERE d.id=claimed.id RETURNING d.*`)).rows;await client.query('COMMIT');}
  catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  for(const delivery of deliveries){
    const data=(await pool.query(`SELECT d.token,d.user_id,n.title,n.message,n.link,n.type,n.read,n.actor_photo_url,s.revoked_at,s.expires_at,u.status
      FROM device_fcm_tokens d JOIN notifications n ON n.id=$2 AND n.user_id=d.user_id
      JOIN user_sessions s ON s.id=d.session_id AND s.user_id=d.user_id JOIN users u ON u.id=d.user_id WHERE d.token=$1`,[delivery.device_token,delivery.notification_id])).rows[0];
    const remove=()=>pool.query('DELETE FROM android_push_deliveries WHERE id=$1',[delivery.id]);
    if(!data||data.read||data.status!=='active'||data.revoked_at||new Date(data.expires_at)<=new Date()||delivery.attempts>5||Date.now()-new Date(delivery.created_at).getTime()>86400000){await remove();continue;}
    const target=chatNotificationTarget(data.link);
    if(target){const member=(await pool.query('SELECT is_muted FROM chat_participants WHERE conversation_id=$1 AND user_id=$2',[target.conversationId,data.user_id])).rows[0];if(!member||(data.type==='chat'&&member.is_muted)){await remove();continue;}}
    let convType='direct',convName='';if(target?.conversationId){const cr=(await pool.query('SELECT type,name FROM chat_conversations WHERE id=$1',[target.conversationId])).rows[0];if(cr){convType=cr.type||'direct';convName=cr.name||'';}}
    try{
      await send({token:data.token,data:{notificationId:String(delivery.notification_id),title:String(data.title||'Rede NEX').slice(0,100),body:String(data.message||'Nova notificacao').slice(0,350),link:data.link||'/',senderAvatar:androidAvatarUrl(data.actor_photo_url),senderName:String(data.actor_name||''),...(target?{conversationId:target.conversationId,...(target.messageId?{messageId:target.messageId}:{}),mention:String(target.mention),isGroup:convType==='group'?'true':'false',...(convName?{conversationName:String(convName)}:{})}:{})},android:{priority:'high',ttl:3600000,restrictedPackageName:'br.com.nextelecom.redenex'}});
      await remove();
    }catch(error){if(['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(error.code))await pool.query('DELETE FROM device_fcm_tokens WHERE token=$1',[data.token]);else console.error('[AndroidPush] Entrega pendente; verifique a configuracao Firebase e conectividade');}
  }
  await pool.query("DELETE FROM android_push_deliveries WHERE created_at<now()-interval '1 day'");return deliveries.length;
}
export function startAndroidPushWorker(pool) {
  if(!androidPushConfiguration().configured){console.warn('[AndroidPush] Configure FIREBASE_SERVICE_ACCOUNT_PATH ou GOOGLE_APPLICATION_CREDENTIALS para ativar entregas Android');return()=>{};}
  let stopped=false,busy=false;
  const tick=async()=>{if(stopped||busy)return;busy=true;try{await dispatchAndroidPushBatch(pool);}catch{console.error('[AndroidPush] Falha ao processar fila');}finally{busy=false;}};
  const timer=setInterval(tick,3000);timer.unref();void tick();return()=>{stopped=true;clearInterval(timer);};
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url&&process.argv[2]==='--check') {
  await import('./env.js');
  const config=androidPushConfiguration();
  let valid=config.configured,projectId=config.projectId||null;
  if(existsSync(config.path)){try{const account=JSON.parse(readFileSync(config.path,'utf8'));valid=Boolean(account.project_id&&account.client_email&&account.private_key);projectId=account.project_id||null;if(config.projectId&&config.projectId!==projectId)valid=false;}catch{valid=false;}}
  console.log(JSON.stringify({configured:config.configured,credentialStructureValid:valid,projectId,usesADC:!existsSync(config.path)&&config.configured},null,2));
  if(!valid){console.error('Configure a conta de servico do mesmo projeto Firebase do APK no ambiente privado da API.');process.exitCode=1;}
}
