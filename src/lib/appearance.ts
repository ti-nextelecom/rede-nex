import { createContext, useContext } from 'react';
import { appearancePalette, DEFAULT_APPEARANCE, legacyAppearance, type Appearance } from '../../shared/appearance.mjs';
import type { SaveStatus } from '../../shared/appearanceSaver.mjs';
import { apiGet, apiPut } from './apiClient';
export type AppearanceStatus = SaveStatus | 'loading' | 'load-error';
type AppearanceContextValue = { settings: Appearance; palette: ReturnType<typeof appearancePalette>; status: AppearanceStatus; error: string; update(patch: Partial<Appearance>): void; retry(): void; flush(): Promise<void> };
export const AppearanceContext = createContext<AppearanceContextValue>({
  settings: { ...DEFAULT_APPEARANCE } as Appearance, palette: appearancePalette(DEFAULT_APPEARANCE),
  status: 'loading' as AppearanceStatus, error: '', update: () => {}, retry: () => {}, flush: async () => {},
});
export function useAppearance() { return useContext(AppearanceContext); }
export async function getAppearance() { return (await apiGet<{ data: Appearance }>('/users/me/appearance')).data; }
export async function getLegacyAppearance() { return legacyAppearance((await apiGet<{ data: unknown }>('/users/me/chat-theme')).data); }
export async function saveAppearance(userId: string, value: Appearance) { return (await apiPut<{ data: Appearance }>('/users/me/appearance', value, { 'X-Nex-User-Id': userId })).data; }
