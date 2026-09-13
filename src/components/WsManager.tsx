import { useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { wsEventBus } from '../lib/wsEventBus';

function getWsUrl() {
  const p = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${p}//${window.location.host}/ws`;
}

export function WsManager() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let ws: WebSocket | null = null;
    let destroyed = false;
    let pingTimer: ReturnType<typeof setInterval>;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      if (destroyed) return;
      try {
        ws = new WebSocket(getWsUrl());
        wsEventBus._ws = ws;
      } catch {
        reconnectTimer = setTimeout(connect, 5000);
        return;
      }

      ws.onopen = () => {
        pingTimer = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30_000);
      };

      ws.onmessage = (e: MessageEvent) => {
        try { wsEventBus.emit(JSON.parse(e.data as string)); } catch {}
      };

      ws.onerror = () => {};
      ws.onclose = () => {
        clearInterval(pingTimer);
        wsEventBus._ws = null;
        if (!destroyed) reconnectTimer = setTimeout(connect, 5000);
      };
    }

    connect();
    return () => {
      destroyed = true;
      clearTimeout(reconnectTimer);
      clearInterval(pingTimer);
      ws?.close();
      wsEventBus._ws = null;
    };
  }, [user?.id]);

  return null;
}
