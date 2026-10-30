export interface AvatarFrame { readonly slug: string; readonly name: string; readonly level: number; readonly motif: string; readonly colors: readonly string[] }
export const LEVEL_XP: readonly number[];
export const AVATAR_FRAMES: readonly AvatarFrame[];
export function levelForXP(xp: number | string | null | undefined): number;
export function frameBySlug(slug: string | null | undefined): AvatarFrame | undefined;
export function resolveAvatarFrame(slug: string | null | undefined, level: number): AvatarFrame;
