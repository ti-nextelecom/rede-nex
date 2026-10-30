import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { favoritesStorageKey, normalizeFavoriteRoutes, parseNavigationFavorites } from '../../shared/navigationFavorites.mjs';
import { NAVIGATION, PRIMARY_NAVIGATION } from '../components/layout/navigation';

const EVENT = 'nex-navigation-favorites-changed';
const known = NAVIGATION.map(item => item.to), defaults = PRIMARY_NAVIGATION.map(item => item.to);

/** Per-account browser preference. No access rights are stored or granted here.
 * A future server preference endpoint can replace this storage adapter without
 * changing the editor. This intentionally does not mutate the production DB.
 */
export function useNavigationFavorites(userId: string) {
  const key = favoritesStorageKey(userId);
  const subscribe = useCallback((notify: () => void) => {
    const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) notify(); };
    window.addEventListener('storage', storage); window.addEventListener(EVENT, notify);
    return () => { window.removeEventListener('storage', storage); window.removeEventListener(EVENT, notify); };
  }, [key]);
  const snapshot = useCallback(() => { try { return key ? localStorage.getItem(key) : null; } catch { return null; } }, [key]);
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const routes = useMemo(() => parseNavigationFavorites(raw, known, defaults), [raw]);
  const save = useCallback((next: string[]) => {
    if (!key) throw new Error('Entre na sua conta para personalizar os atalhos.');
    try { localStorage.setItem(key, JSON.stringify({ version: 1, routes: normalizeFavoriteRoutes(next, known) })); }
    catch { throw new Error('Não foi possível salvar neste navegador. Verifique se o armazenamento está permitido e tente novamente.'); }
    window.dispatchEvent(new Event(EVENT));
  }, [key]);
  return { routes, save };
}
