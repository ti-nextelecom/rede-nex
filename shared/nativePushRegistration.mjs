import {chatMessageLink} from './chatMessageLinks.mjs';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const internal=value=>typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//')&&!/[\\\u0000-\u001f]/.test(value)?value:null;
export function nativePushLink(value) {
  if(typeof value==='string'){
    try{const url=new URL(value);if(url.protocol!=='rede-nex:')return null;if(url.hostname==='open')return internal(url.searchParams.get('link'));
      const cid=url.pathname.slice(1);if(url.hostname==='chat'&&uuid(cid))return chatMessageLink(cid,uuid(url.searchParams.get('mensagem'))?url.searchParams.get('mensagem'):undefined,url.searchParams.get('mencao')==='1');
    }catch{return null;}return null;
  }
  if(internal(value?.link))return value.link;
  return uuid(value?.conversationId)?chatMessageLink(value.conversationId,uuid(value.messageId)?value.messageId:undefined,value.mention==='true'||value.mention==='1'):null;
}
// Native ports are injected so registration races, retries and cleanup can be tested.
export function startNativePushRegistration({push,app,saveToken,navigate,onError=()=>{},onDenied=()=>{},onSaved=()=>{},timers=globalThis}) {
  let stopped=false,token=null,timer=null,saving=false,retryCount=0,registering=false;
  const handles=[];
  const keep=async promise=>{const handle=await promise;if(stopped)await handle.remove();else handles.push(handle);};
  const go=value=>{const path=nativePushLink(value);if(!stopped&&path)navigate(path);};
  const save=async()=>{
    if(stopped||!token||saving)return;saving=true;if(timer)timers.clearTimeout(timer);timer=null;const captured=token;
    try{await saveToken(captured);retryCount=0;if(!stopped)onSaved();}
    catch{if(!stopped){onError('save');timer=timers.setTimeout(()=>{timer=null;void save();},Math.min(60000,1000*2**Math.min(retryCount++,6)));}}
    finally{saving=false;if(!stopped&&token!==captured)void save();}
  };
  const register=async()=>{
    if(stopped||registering)return;registering=true;
    try{let permission=await push.checkPermissions();if(permission.receive==='prompt'||permission.receive==='prompt-with-rationale')permission=await push.requestPermissions();
      if(stopped)return;if(permission.receive!=='granted'){onDenied();return;}
      await push.createChannel({id:'rede-nex-chat',name:'Mensagens',description:'Mensagens e avisos da Rede NEX',importance:5,visibility:1});
      if(!stopped)await push.register();
    }catch{if(!stopped)onError('registration');}finally{registering=false;}
  };
  const ready=(async()=>{
    try{
      await Promise.all([
        keep(push.addListener('registration',event=>{if(stopped)return;token=event.value;void save();})),
        keep(push.addListener('registrationError',()=>{if(!stopped)onError('registration');})),
        keep(push.addListener('pushNotificationActionPerformed',event=>go(event.notification?.data))),
        keep(app.addListener('appUrlOpen',event=>go(event.url))),
        keep(app.addListener('appStateChange',event=>{if(event.isActive&&!stopped)void register();})),
      ]);
      if(stopped)return;const launch=await app.getLaunchUrl();if(launch?.url)go(launch.url);await register();
    }catch{if(!stopped)onError('initialization');}
  })();
  return {ready,retry:()=>{if(timer)timers.clearTimeout(timer);timer=null;return register();},stop:()=>{stopped=true;if(timer)timers.clearTimeout(timer);for(const handle of handles)void handle.remove().catch(()=>{});handles.length=0;}};
}
