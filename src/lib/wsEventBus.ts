type MsgHandler = (msg: Record<string, unknown>) => void;

const handlers = new Set<MsgHandler>();

export const wsEventBus = {
  _ws: null as WebSocket | null,

  subscribe(handler: MsgHandler): () => void {
    handlers.add(handler);
    return () => handlers.delete(handler);
  },

  emit(msg: Record<string, unknown>): void {
    handlers.forEach(h => { try { h(msg); } catch {} });
  },

  send(msg: Record<string, unknown>): void {
    if (wsEventBus._ws?.readyState === WebSocket.OPEN) {
      wsEventBus._ws.send(JSON.stringify(msg));
    }
  },
};
