import { apiGet } from './apiClient';

export interface Rank {
  slug: string;
  name: string;
  min: number;
  color: string;
  emoji: string;
}

export interface Badge {
  slug: string;
  name: string;
  description: string;
  icon_emoji: string;
  color: string;
  category: string;
  earned_at?: string;
}

export interface GamificationProfile {
  total_xp: number;
  rank_slug: string;
  rank: Rank;
  next_rank: Rank | null;
  progress_pct: number;
  xp_to_next: number;
  badges: Badge[];
  ranks: Rank[];
}

export interface Mission {
  slug: string;
  name: string;
  description: string;
  icon_emoji: string;
  xp_reward: number;
  type: 'daily' | 'weekly' | 'achievement';
  action: string;
  target_count: number;
  current_count: number;
  completed: boolean;
  xp_claimed: boolean;
  sort_order: number;
}

export interface RankingEntry {
  id: string;
  name: string;
  photo_url?: string;
  position?: string;
  total_xp: number;
  rank_slug: string;
  rank: Rank;
  rank_position: number;
}

export async function getGamificationProfile(userId?: string): Promise<GamificationProfile> {
  const path = userId ? `/gamification/profile/${userId}` : '/gamification/profile';
  const res = await apiGet<{ data: GamificationProfile }>(path);
  return res.data;
}

export async function getMissions(): Promise<Mission[]> {
  const res = await apiGet<{ data: Mission[] }>('/gamification/missions');
  return res.data;
}

export async function getRanking(): Promise<{ ranking: RankingEntry[]; my_position: number | null }> {
  const res = await apiGet<{ data: { ranking: RankingEntry[]; my_position: number | null } }>('/gamification/ranking');
  return res.data;
}
