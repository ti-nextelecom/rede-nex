import { apiGet, apiPost } from './apiClient';

type ApiResponse<T> = { data?: T };

export type Story = {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  video_url: string | null;
  expires_at: string;
  created_at: string;
  users: { id: string; name: string; photo_url: string | null; department_name: string | null } | null;
  view_count: number;
  viewed_by_me: boolean;
};

export type StoryViewer = {
  user_id: string;
  viewed_at: string;
  name: string;
  photo_url: string | null;
};

export async function listStories(): Promise<Story[]> {
  const res = await apiGet<ApiResponse<Story[]>>('/stories');
  return res.data ?? [];
}

export async function createStory(input: {
  content?: string;
  image_url?: string;
  video_url?: string;
}): Promise<Story> {
  const res = await apiPost<ApiResponse<Story>>('/stories', input);
  if (!res.data) throw new Error('Story não criada');
  return res.data;
}

export async function recordStoryView(storyId: string): Promise<void> {
  await apiPost(`/stories/${storyId}/view`, {});
}

export async function getStoryViewers(storyId: string): Promise<StoryViewer[]> {
  const res = await apiGet<ApiResponse<StoryViewer[]>>(`/stories/${storyId}/viewers`);
  return res.data ?? [];
}
