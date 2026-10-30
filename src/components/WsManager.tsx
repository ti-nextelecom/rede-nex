import { useEffect,useRef } from 'react';
import { useAuth } from '../lib/auth';
import { wsEventBus } from '../lib/wsEventBus';
import { startRealtimeConnection } from '../../shared/realtimeConnection.mjs';
import { syncDesktopNotifications } from '../lib/browserNotifications';

function getWsUrl() {
  const p = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${p}//${window.location.host}/ws`;
}

export function WsManager() {
  const { user } = useAuth();
  const activeConversation=useRef<string|null>(null);
  useEffect(()=>{
    const unsubscribe=wsEventBus.subscribe(event=>{if(event.type==='conversation:active')activeConversation.current=typeof event.conversationId==='string'?event.conversationId:null;});
    const onWorker=(event:MessageEvent)=>{
      if(event.data?.type==='NEX_READING_CONVERSATION') event.ports[0]?.postMessage({reading:
        Boolean(user && location.pathname==='/bate-papo' && !document.hidden && document.hasFocus() && activeConversation.current===event.data.conversationId)});
    };
    navigator.serviceWorker?.addEventListener('message',onWorker);
    return()=>{unsubscribe();navigator.serviceWorker?.removeEventListener('message',onWorker);};
  },[user?.id]);

  useEffect(() => {
    if (!user) return;
    void syncDesktopNotifications(user.id).catch(()=>undefined);
    return startRealtimeConnection({
      url: getWsUrl(),
      onSocket: socket => { wsEventBus._ws = socket; },
      onMessage: message => wsEventBus.emit(message),
    });
  }, [user?.id]);

  return null;
}
