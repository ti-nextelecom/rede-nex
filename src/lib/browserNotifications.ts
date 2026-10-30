import { apiDelete,apiGet,apiPost } from './apiClient';
export const desktopSupported=()=>window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
export async function bindNotificationUser(userId:string|null) {
  const registration=await navigator.serviceWorker.ready;
  if(!registration.active) throw new Error('Atualize a página para ativar as notificações');
  await new Promise<void>((resolve,reject)=>{
    const channel=new MessageChannel();
    const timer=setTimeout(()=>reject(new Error('O serviço de notificações não respondeu. Atualize a página.')),5000);
    channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();event.data?.ok ? resolve() : reject(new Error('Falha ao vincular notificações'));};
    registration.active!.postMessage({type:'NEX_NOTIFICATION_USER',userId},[channel.port2]);
  });
}
export async function enableDesktopNotifications(userId:string) {
  if(!desktopSupported()) throw new Error('Use HTTPS e um navegador com suporte a notificações');
  if(await Notification.requestPermission()!=='granted') throw new Error('Permita notificações nas configurações deste site no navegador');
  const {data:config}=await apiGet<{data:{enabled:boolean;publicKey:string|null}}>('/notifications/push/config');
  if(!config.enabled || !config.publicKey) throw new Error('Web Push ainda não configurado na VM');
  const registration=await navigator.serviceWorker.ready;
  const base64=config.publicKey.replace(/-/g,'+').replace(/_/g,'/');
  const key=Uint8Array.from(atob(base64+'='.repeat((4-base64.length%4)%4)),c=>c.charCodeAt(0));
  const sub=await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  await bindNotificationUser(userId);
  try {await apiPost('/notifications/push/subscription',sub.toJSON());}
  catch(error) {await sub.unsubscribe();await bindNotificationUser(null);throw error;}
  window.dispatchEvent(new Event('nex-desktop-notifications'));
}
export async function disableDesktopNotifications() {
  if(!('serviceWorker' in navigator)) return;
  const registration=await navigator.serviceWorker.getRegistration();
  if(registration?.active) await bindNotificationUser(null);
  const subscription=await registration?.pushManager?.getSubscription();
  await subscription?.unsubscribe();
  await apiDelete('/notifications/push/subscription').catch(()=>undefined);
  window.dispatchEvent(new Event('nex-desktop-notifications'));
}
export async function syncDesktopNotifications(userId:string) {
  if(!desktopSupported()) return false;
  const registration=await navigator.serviceWorker.ready;
  const sub=await registration.pushManager.getSubscription();
  if(!sub || Notification.permission!=='granted') return false;
  await bindNotificationUser(userId);
  await apiPost('/notifications/push/subscription',sub.toJSON());
  return true;
}
