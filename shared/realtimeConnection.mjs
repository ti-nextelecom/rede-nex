export function realtimeRetryDelay(attempt, random = Math.random) {
  const base = Math.min(30000, 1000 * 2 ** Math.min(5, Math.max(0, attempt)));
  return Math.min(30000, Math.round(base * (0.8 + random() * 0.4)));
}

// One owner per socket. Deferred startup avoids a phantom connection in React StrictMode.
export function startRealtimeConnection({ url, onSocket, onMessage, createSocket = address => new WebSocket(address),
  schedule = setTimeout, cancel = clearTimeout, now = Date.now, random = Math.random }) {
  let stopped = false, active = null, retry = 0, reconnectTimer, heartbeatTimer;
  const clearHeartbeat = () => { cancel(heartbeatTimer); heartbeatTimer = undefined; };
  const reconnect = () => { if (!stopped) reconnectTimer = schedule(connect, realtimeRetryDelay(retry++, random)); };
  function connect() {
    if (stopped) return;
    let socket;
    try { socket = createSocket(url); } catch { reconnect(); return; }
    active = socket;
    let authenticated = false, openedAt = 0, rejected = false;
    const handshakeTimer = schedule(() => {
      if (socket.readyState < 2) socket.close(1000, 'Authentication timeout');
    }, 12000);
    const heartbeat = () => {
      if (stopped || active !== socket || socket.readyState !== 1) return;
      socket.send(JSON.stringify({ type: 'ping' }));
      heartbeatTimer = schedule(heartbeat, 25000);
    };
    socket.onopen = () => {
      if (stopped || active !== socket) { cancel(handshakeTimer); socket.close(1000); return; }
      openedAt = now();
    };
    socket.onmessage = event => {
      if (stopped || active !== socket) return;
      let message;
      try { message = JSON.parse(String(event.data)); } catch { return; }
      if (!message || typeof message !== 'object' || Array.isArray(message)) return;
      if (message.type === 'call:auth_error') {
        rejected = true; cancel(handshakeTimer);
        if (socket.readyState === 1) socket.close(1008, 'Unauthorized');
      }
      if (message.type === 'call:auth_ok' && !authenticated) {
        authenticated = true; cancel(handshakeTimer); onSocket(socket);
        heartbeatTimer = schedule(heartbeat, 25000);
      }
      onMessage(message);
    };
    socket.onerror = () => {}; // onclose is the single retry path; proxy/network errors remain observable.
    socket.onclose = event => {
      cancel(handshakeTimer);
      if (active !== socket) return;
      active = null; clearHeartbeat(); onSocket(null);
      if (stopped || rejected || event.code === 1008) return; // Re-login, not an endless failed-session loop.
      if (authenticated && now() - openedAt >= 30000) retry = 0;
      reconnect();
    };
  }
  reconnectTimer = schedule(connect, 0);
  return () => {
    stopped = true; cancel(reconnectTimer); clearHeartbeat();
    const socket = active; active = null;
    if (!socket) return;
    onSocket(null); socket.onmessage = null;
    // Closing CONNECTING aborts the TCP/TLS upgrade and creates ECONNRESET in Vite.
    // Let that upgrade finish, then close gracefully. The handshake deadline stays bounded.
    if (socket.readyState === 0) socket.onopen = () => socket.close(1000);
    else if (socket.readyState === 1) socket.close(1000);
  };
}
