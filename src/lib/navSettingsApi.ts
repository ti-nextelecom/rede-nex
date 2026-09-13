import { apiGet, apiPut, apiDelete } from './apiClient';

export type NavSettings = Record<string, string[] | null>;

let cache: NavSettings | null = null;
let cacheTs = 0;
const TTL = 5 * 60 * 1000;

export async function getNavSettings(): Promise<NavSettings> {
  if (cache && Date.now() - cacheTs < TTL) return cache;
  try {
    const res = await apiGet<{ data: NavSettings }>('/nav-settings');
    cache = res.data ?? {};
    cacheTs = Date.now();
    return cache;
  } catch {
    return cache ?? {};
  }
}

export function invalidateNavCache() {
  cache = null;
  cacheTs = 0;
}

export async function updateNavSettings(roleName: string, visibleRoutes: string[] | null): Promise<void> {
  await apiPut(`/nav-settings/${encodeURIComponent(roleName)}`, { visible_routes: visibleRoutes });
  invalidateNavCache();
}

export async function resetNavSettings(roleName: string): Promise<void> {
  await apiDelete(`/nav-settings/${encodeURIComponent(roleName)}`);
  invalidateNavCache();
}
