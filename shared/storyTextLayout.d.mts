export const STORY_WIDTH: number;
export const STORY_HEIGHT: number;
export const STORY_TEXT_BOUNDS: { left: number; right: number; top: number; bottom: number };
export function layoutStoryText(overlay: { text: string; size: number; x: number; y: number }, measure: (text: string, size: number) => number): {
  lines: string[]; fontSize: number; width: number; height: number; x: number; y: number; lineHeight: number;
};
