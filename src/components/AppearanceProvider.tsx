import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import { AppearanceContext, getAppearance, getLegacyAppearance, saveAppearance, type AppearanceStatus } from '../lib/appearance';
import { DEFAULT_APPEARANCE, appearancePalette, parseAppearance, type Appearance } from '../../shared/appearance.mjs';
import { createAppearanceSaver, type AppearanceSaver } from '../../shared/appearanceSaver.mjs';
import '../styles/appearance.css';

const cacheKey = (id: string) => `nex:appearance:v1:${id}`;
function cache(id: string, value: Appearance) {
  // Images stay in the database, avoiding browser storage quotas and shared-account leaks.
  try { localStorage.setItem(cacheKey(id), JSON.stringify({ ...value, wallpaper: '', platformWallpaper: '' })); } catch { /* Server remains authoritative. */ }
}
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState({ owner: '', settings: { ...DEFAULT_APPEARANCE } as Appearance, status: 'loading' as AppearanceStatus, error: '' });
  const [attempt, setAttempt] = useState(0);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const saver = useRef<AppearanceSaver<Appearance> | null>(null);
  const draft = useRef<Appearance>({ ...DEFAULT_APPEARANCE });
  const generation = useRef(0);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => setSystemDark(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);
  useEffect(() => {
    const version = ++generation.current;
    saver.current?.stop(); saver.current = null;
    if (!user?.id) { setState({ owner: '', settings: { ...DEFAULT_APPEARANCE }, status: 'loading', error: '' }); return; }
    const owner = user.id;
    let initial = { ...DEFAULT_APPEARANCE };
    try { const stored = localStorage.getItem(cacheKey(owner)); if (stored) initial = parseAppearance(JSON.parse(stored)); } catch { /* Invalid caches never reach the UI. */ }
    setState({ owner, settings: initial, status: 'loading', error: '' });
    getAppearance().then(value => {
      if (version !== generation.current) return;
      const settings = parseAppearance(value);
      draft.current = settings; cache(owner, settings);
      setState({ owner, settings, status: 'saved', error: '' });
      saver.current = createAppearanceSaver({ save: value => saveAppearance(owner, value),
        onSaved: result => { if (version === generation.current) cache(owner, result); },
        onStatus: (status, cause) => {
          if (version !== generation.current) return;
          setState(current => ({ ...current, status, error: status === 'error' ? (cause instanceof Error ? cause.message.replace(/^API \d+: /, '') : 'Não foi possível salvar. Tente novamente.') : '' }));
        },
      });
    }).catch(async () => {
      if (version !== generation.current) return;
      let inherited = initial;
      try {
        const legacy = await getLegacyAppearance();
        inherited = { ...initial, wallpaper: legacy.wallpaper, chatBackground: initial.chatBackground ?? legacy.chatBackground, chatOutgoing: initial.chatOutgoing ?? legacy.chatOutgoing };
      } catch { /* Keep confirmed per-account colors while offline. */ }
      if (version === generation.current) setState(current => ({ ...current, settings: inherited, status: 'load-error', error: 'Não foi possível carregar sua aparência. Tente novamente para personalizar.' }));
    });
    return () => { generation.current = version + 1; saver.current?.stop(); saver.current = null; };
  }, [user?.id, attempt]);
  const owned = state.owner === (user?.id || '');
  const settings = owned ? state.settings : DEFAULT_APPEARANCE;
  const palette = useMemo(() => appearancePalette(settings, systemDark), [settings, systemDark]);
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', palette.dark);
    root.dataset.appearance = palette.dark ? 'dark' : 'light';
    root.style.colorScheme = palette.dark ? 'dark' : 'light';
    for (const [key, value] of Object.entries(palette.variables)) root.style.setProperty(key, value);
    root.dataset.platformWallpaper = settings.platformWallpaper ? 'true' : 'false';
    root.style.setProperty('--nex-platform-wallpaper', settings.platformWallpaper ? `url(${JSON.stringify(settings.platformWallpaper)})` : 'none');
  }, [palette, settings.platformWallpaper]);
  const update = useCallback((patch: Partial<Appearance>) => {
    if (!saver.current) return;
    const value = parseAppearance({ ...draft.current, ...patch });
    draft.current = value;
    setState(current => ({ ...current, settings: value }));
    saver.current.stage(value);
  }, []);
  const retry = useCallback(() => { if (state.status === 'load-error') setAttempt(value => value + 1); else void saver.current?.flush(); }, [state.status]);
  const flush = useCallback(async () => { await saver.current?.flush(); }, []);
  return <AppearanceContext.Provider value={{ settings, palette, status: owned ? state.status : 'loading', error: owned ? state.error : '', update, retry, flush }}>{children}</AppearanceContext.Provider>;
}
