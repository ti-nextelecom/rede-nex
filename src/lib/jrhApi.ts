import { apiDelete, apiGet, apiPost, apiPut } from './apiClient';

type ApiResponse<T> = { data?: T };

export type JRHComment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  users: { id: string; name: string; photo_url: string | null; department_name: string | null } | null;
};

export type JRHReaction = {
  id: string;
  user_id: string;
  reaction: string;
  created_at: string;
};

export type JRHViewer = {
  user_id: string;
  viewed_at: string;
  name: string;
  photo_url: string | null;
  department_name?: string | null;
};

export type JRHPost = {
  id: string;
  author_id: string;
  title: string | null;
  content: string | null;
  type: string;
  category: string | null;
  image_url: string | null;
  video_url: string | null;
  pinned: boolean;
  visibility: string;
  created_at: string;
  updated_at: string;
  users: { id: string; name: string; email: string; photo_url: string | null; department_name: string | null } | null;
  likes: JRHReaction[];
  comments: JRHComment[];
  view_count: number;
  viewers: JRHViewer[];
};


export async function uploadJRHFile(file: File): Promise<string> {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsDataURL(file);
  });
  const res = await apiPost<ApiResponse<{ url: string }>>('/jrh/upload', {
    filename: file.name,
    mime: file.type,
    data,
  });
  if (!res.data?.url) throw new Error('Upload falhou');
  return res.data.url;
}

export async function listJRHPosts(): Promise<JRHPost[]> {
  const res = await apiGet<ApiResponse<JRHPost[]>>('/jrh');
  return res.data ?? [];
}

export async function createJRHPost(input: {
  title?: string;
  content?: string;
  category?: string;
  image_url?: string;
  video_url?: string;
}): Promise<JRHPost> {
  const res = await apiPost<ApiResponse<JRHPost>>('/jrh', input);
  if (!res.data) throw new Error('Post não criado');
  return res.data;
}

export async function deleteJRHPost(postId: string): Promise<void> {
  await apiDelete(`/jrh/posts/${postId}`);
}

export async function updateJRHPost(postId: string, input: {
  title?: string | null;
  content?: string | null;
  category?: string | null;
  image_url?: string | null;
  video_url?: string | null;
}): Promise<JRHPost> {
  const res = await apiPut<{ data: JRHPost }>(`/jrh/posts/${postId}`, input);
  return res.data;
}

export async function recordPostView(postId: string): Promise<void> {
  await apiPost(`/jrh/posts/${postId}/view`, {});
}

export async function getPostViews(postId: string): Promise<JRHViewer[]> {
  const res = await apiGet<ApiResponse<JRHViewer[]>>(`/jrh/posts/${postId}/views`);
  return res.data ?? [];
}

export async function toggleReaction(postId: string, reaction: string): Promise<{ action: string }> {
  const res = await apiPost<ApiResponse<{ action: string }>>(`/jrh/posts/${postId}/reactions`, { reaction });
  return res.data ?? { action: 'added' };
}

export async function addComment(postId: string, content: string): Promise<JRHComment> {
  const res = await apiPost<ApiResponse<JRHComment>>(`/jrh/posts/${postId}/comments`, { content });
  if (!res.data) throw new Error('Comentário não criado');
  return res.data;
}

export async function checkIsHR(): Promise<boolean> {
  const res = await apiGet<ApiResponse<{ is_hr: boolean }>>('/jrh/me/is-hr');
  return res.data?.is_hr ?? false;
}

export type BirthdayUser = {
  id: string;
  name: string;
  photo_url: string | null;
  department_name: string | null;
  birth_date: string;
  birth_day: number;
};

export async function getMonthBirthdays(): Promise<BirthdayUser[]> {
  const res = await apiGet<ApiResponse<BirthdayUser[]>>('/jrh/birthdays');
  return res.data ?? [];
}
