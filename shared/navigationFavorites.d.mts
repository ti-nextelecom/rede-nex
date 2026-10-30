export const MAX_NAVIGATION_FAVORITES: number;
export function favoritesStorageKey(userId: string): string | null;
export function normalizeFavoriteRoutes(routes: unknown, knownRoutes: string[]): string[];
export function parseNavigationFavorites(raw: string | null, knownRoutes: string[], defaults: string[]): string[];
export function moveFavoriteRoute(routes: string[], route: string, direction: number): string[];
