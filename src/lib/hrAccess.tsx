import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './auth';
import { apiGet } from './apiClient';

type Access = { admin: boolean; permissions: Record<string, boolean> };
type State = { userId: string; access: Access | null; loading: boolean; error: string };
const Context = createContext<{ allowed: (key: string) => boolean; admin: boolean; loading: boolean; error: string }>({ allowed: () => false, admin: false, loading: true, error: '' });
export function HrAccessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<State>({ userId: '', access: null, loading: true, error: '' });
  const userId = user?.id || '';
  const admin = (user?.role_name || user?.roles?.name) === 'Administrador';
  useEffect(() => {
    let alive = true;
    if (!userId) { setState({ userId: '', access: null, loading: false, error: '' }); return; }
    const load = () => apiGet<Access>('/access/me').then(access => {
      if (alive) setState({ userId, access, loading: false, error: '' });
    }).catch((error: Error) => { if (alive) setState({ userId, access: null, loading: false, error: error.message }); });
    void load();
    const timer = window.setInterval(load, 60000);
    window.addEventListener('focus', load);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener('focus', load); };
  }, [userId]);
  const current = state.userId === userId;
  // An administrator can discover the page before migration; the API never falls back.
  const allowed = (key: string) => current && (state.access ? state.access.permissions[key] === true : admin && !state.loading);
  return <Context.Provider value={{ allowed, admin: current && (state.access?.admin ?? admin), loading: !current || state.loading, error: current ? state.error : '' }}>{children}</Context.Provider>;
}
export const useHrAccess = () => useContext(Context);
