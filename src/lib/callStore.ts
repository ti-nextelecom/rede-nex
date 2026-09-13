import type { CallState, CallType, CallPeer } from '../hooks/useVoiceCall';

type StartCallFn = (peer: CallPeer, type: CallType) => void;
type CallStateListener = (state: CallState) => void;

let _startCall: StartCallFn | null = null;
let _currentState: CallState = 'idle';
const _listeners = new Set<CallStateListener>();

export const callStore = {
  register(startFn: StartCallFn) {
    _startCall = startFn;
  },
  startCall(peer: CallPeer, type: CallType = 'audio') {
    _startCall?.(peer, type);
  },
  getState(): CallState {
    return _currentState;
  },
  setState(state: CallState) {
    _currentState = state;
    _listeners.forEach(l => l(state));
  },
  subscribe(fn: CallStateListener): () => void {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },
};
