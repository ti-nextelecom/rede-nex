export function realtimeRetryDelay(attempt: number, random?: () => number): number;
export function startRealtimeConnection(options: {
  url: string;
  onSocket: (socket: WebSocket | null) => void;
  onMessage: (message: Record<string, unknown>) => void;
}): () => void;
