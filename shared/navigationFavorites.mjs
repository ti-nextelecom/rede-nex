export const MAX_NAVIGATION_FAVORITES = 6;
export function favoritesStorageKey(userId) { return userId ? `rede-nex:navigation:v1:${encodeURIComponent(userId)}` : null; }
export function normalizeFavoriteRoutes(routes, knownRoutes) {
  if (!Array.isArray(routes)) return [];
  const known = new Set(knownRoutes);
  return [...new Set(routes.filter(route => typeof route === 'string' && known.has(route)))].slice(0, MAX_NAVIGATION_FAVORITES);
}
export function parseNavigationFavorites(raw, knownRoutes, defaults) {
  try {
    const value = raw && raw.length <= 10000 ? JSON.parse(raw) : null;
    return normalizeFavoriteRoutes(value?.version === 1 && Array.isArray(value.routes) ? value.routes : defaults, knownRoutes);
  } catch { return normalizeFavoriteRoutes(defaults, knownRoutes); }
}
export function moveFavoriteRoute(routes, route, direction) {
  const next = [...routes], index = next.indexOf(route), target = index + direction;
  if (![-1, 1].includes(direction) || index < 0 || target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
