export interface XPResult {
  xp_awarded: number;
  rank_up: { slug: string; name: string; emoji: string; color: string; min: number } | null;
  completed_missions: Array<{ slug: string; name: string; xp: number }>;
  new_badges: string[];
}

export function dispatchXPEvent(gamification: unknown) {
  if (!gamification || typeof gamification !== 'object') return;
  const g = gamification as Partial<XPResult>;
  if (!g.xp_awarded && !g.rank_up && !g.new_badges?.length) return;
  window.dispatchEvent(new CustomEvent('xp:award', { detail: g }));
}
