export interface PendingCallInfo {
  from: string;
  callerName: string;
  callerPhoto?: string;
  callType: 'audio' | 'video';
  alreadyAccepted?: boolean;
}

let stored: PendingCallInfo | null = null;
let clearTimer: ReturnType<typeof setTimeout> | null = null;

export const pendingCallStore = {
  set(call: PendingCallInfo) {
    stored = call;
    if (clearTimer) clearTimeout(clearTimer);
    clearTimer = setTimeout(() => { stored = null; clearTimer = null; }, 10_000);
  },
  take(): PendingCallInfo | null {
    if (clearTimer) { clearTimeout(clearTimer); clearTimer = null; }
    const c = stored;
    stored = null;
    return c;
  },
};
