import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import { apiGet } from '../lib/apiClient';
import { AvatarFramesContext, type AvatarFrameEntry } from '../lib/avatarFrames';

export function AvatarFramesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<{ owner: string; entries: Map<string, AvatarFrameEntry> }>({ owner: '', entries: new Map() });
  const revision = useRef(0);
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    const owner = user.id;
    async function load() {
      const version = ++revision.current;
      try {
        const response = await apiGet<{ data: AvatarFrameEntry[] }>('/users/avatar-frames');
        if (alive && version === revision.current) setState({ owner, entries: new Map(response.data.map(entry => [entry.user_id, entry])) });
      } catch { /* A missing/offline API must never overwrite a confirmed preference. */ }
    }
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30000);
    const focus = () => void load();
    window.addEventListener('focus', focus);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener('focus', focus); };
  }, [user?.id]);
  const update = useCallback((entry: AvatarFrameEntry) => {
    revision.current++;
    setState(current => ({ owner: user?.id || '', entries: new Map(current.owner === user?.id ? current.entries : []).set(entry.user_id, entry) }));
  }, [user?.id]);
  return <AvatarFramesContext.Provider value={{ entries: state.owner === user?.id ? state.entries : new Map(), update }}>{children}</AvatarFramesContext.Provider>;
}
