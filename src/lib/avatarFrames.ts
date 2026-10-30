import { createContext, useContext } from 'react';
import { apiGet, apiPut } from './apiClient';
import type { AvatarFrame } from '../../shared/achievementFrames.mjs';

export type AvatarFrameEntry = { user_id: string; level: number; selected_slug: string; frame_slug: string };
export type AvatarFrameProfile = AvatarFrameEntry & { total_xp: number; frames: (AvatarFrame & { unlocked: boolean })[] };
export async function getMyAvatarFrames() {
  return (await apiGet<{ data: AvatarFrameProfile }>('/users/me/avatar-frame')).data;
}
export async function saveMyAvatarFrame(frame_slug: string) {
  return (await apiPut<{ data: AvatarFrameProfile }>('/users/me/avatar-frame', { frame_slug })).data;
}
export const AvatarFramesContext = createContext<{ entries: Map<string, AvatarFrameEntry>; update: (entry: AvatarFrameEntry) => void }>({ entries: new Map(), update: () => {} });
export function useAvatarFrames() { return useContext(AvatarFramesContext); }
