import type { Category, Post, Role, Training, User } from '../types';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './apiClient';
import { localDatabase } from './localDatabase';
import { dispatchXPEvent } from './xpEvents';

type ApiResponse<T> = {
  data?: T;
};

type DashboardData = Awaited<ReturnType<typeof localDatabase.getDashboardData>>;
type TrainingData = {
  trainings: Training[];
  categories: Category[];
};

export async function getDashboardData(): Promise<DashboardData> {
  try {
    const response = await apiGet<ApiResponse<DashboardData>>('/dashboard');
    if (response.data) return response.data;
    throw new Error('Dashboard payload vazio');
  } catch {
    return localDatabase.getDashboardData();
  }
}

export async function getFeedPosts(): Promise<Post[]> {
  try {
    const response = await apiGet<ApiResponse<Post[]>>('/feed/posts');
    return response.data ?? [];
  } catch {
    return [];
  }
}

export async function createPost(content: string, type: Post['type'], imageUrl?: string, videoUrl?: string) {
  const response = await apiPost<ApiResponse<Post> & { gamification?: unknown }>('/feed/posts', { content, type, image_url: imageUrl, video_url: videoUrl });
  dispatchXPEvent(response.gamification);
  if (!response.data) throw new Error('Post não criado');
  return response.data;
}

export async function commentPost(postId: string, content: string) {
  const response = await apiPost<ApiResponse<Post> & { gamification?: unknown }>(`/feed/posts/${postId}/comments`, { content });
  dispatchXPEvent(response.gamification);
  if (!response.data) throw new Error('Comentário não criado');
  return response.data;
}

export async function updatePost(postId: string, content: string) {
  const response = await apiPatch<ApiResponse<Post>>(`/feed/posts/${postId}`, { content });
  if (!response.data) throw new Error('Post não atualizado');
  return response.data;
}

export async function deletePost(postId: string) {
  await apiDelete(`/feed/posts/${postId}`);
}

export async function updateComment(postId: string, commentId: string, content: string) {
  const response = await apiPatch<ApiResponse<Post>>(`/feed/posts/${postId}/comments/${commentId}`, { content });
  if (!response.data) throw new Error('Comentário não atualizado');
  return response.data;
}

export async function deleteComment(postId: string, commentId: string) {
  await apiDelete(`/feed/posts/${postId}/comments/${commentId}`);
}

export async function reactToPost(postId: string, reaction: 'like' | 'love' | 'celebrate' | 'insightful' = 'like') {
  const response = await apiPost<ApiResponse<{ active: boolean; post?: Post }>>(`/feed/posts/${postId}/reactions`, { reaction });
  if (!response.data?.post) throw new Error('Reação não registrada');
  return response.data;
}

export async function reactToComment(postId: string, commentId: string, reaction: string = 'like') {
  const response = await apiPost<ApiResponse<{ active: boolean; post?: Post }>>(`/feed/posts/${postId}/comments/${commentId}/reactions`, { reaction });
  if (!response.data?.post) throw new Error('Reação não registrada');
  return response.data;
}

export async function voteOnPoll(postId: string, optionIndex: number) {
  const response = await apiPost<ApiResponse<Post>>(`/feed/posts/${postId}/vote`, { option_index: optionIndex });
  if (!response.data) throw new Error('Voto não registrado');
  return response.data;
}

export async function getUsers(): Promise<User[]> {
  try {
    const response = await apiGet<ApiResponse<User[]>>('/users');
    return response.data?.length ? response.data : localDatabase.getUsers() as unknown as Promise<User[]>;
  } catch {
    return localDatabase.getUsers() as unknown as Promise<User[]>;
  }
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  user_count?: number;
  parent_id?: string | null;
  manager_id?: string | null;
}

export async function getDepartments() {
  try {
    const response = await apiGet<ApiResponse<Department[]>>('/departments');
    return response.data?.length ? response.data : localDatabase.getDepartments();
  } catch {
    return localDatabase.getDepartments();
  }
}

export async function createDepartment(name: string, description?: string): Promise<Department> {
  const response = await apiPost<ApiResponse<Department>>('/departments', { name, description });
  if (!response.data) throw new Error('Departamento não criado');
  return response.data;
}

export async function updateDepartment(id: string, name: string, description?: string): Promise<Department> {
  const response = await apiPut<ApiResponse<Department>>(`/departments/${id}`, { name, description });
  if (!response.data) throw new Error('Departamento não atualizado');
  return response.data;
}

export async function deleteDepartmentById(id: string): Promise<void> {
  await apiDelete(`/departments/${id}`);
}

export async function getTrainingData(): Promise<TrainingData> {
  try {
    const response = await apiGet<ApiResponse<TrainingData>>('/trainings');
    if (response.data) return response.data;
    throw new Error('Training payload vazio');
  } catch {
    return { trainings: [], categories: [] };
  }
}

export async function getRoles(): Promise<Role[]> {
  try {
    const response = await apiGet<ApiResponse<Role[]>>('/roles');
    return response.data ?? [];
  } catch {
    return [];
  }
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  position?: string;
  department_id?: string;
  role_id?: string;
  phone?: string;
  admission_date?: string;
  birth_date?: string;
}

export async function createUser(data: CreateUserInput): Promise<User> {
  const response = await apiPost<ApiResponse<User>>('/users', data);
  if (!response.data) throw new Error('Erro ao criar usuario');
  return response.data;
}

export async function updateUser(id: string, data: Partial<CreateUserInput> & { status?: string }): Promise<User> {
  const response = await apiPut<ApiResponse<User>>(`/users/${id}`, data);
  if (!response.data) throw new Error('Erro ao atualizar usuario');
  return response.data;
}

export async function deleteUser(id: string): Promise<void> {
  await apiDelete(`/users/${id}`);
}

export interface CreateTrainingInput {
  title: string;
  description?: string;
  category_id?: string;
  video_url?: string;
  pdf_url?: string;
  duration_minutes?: number;
  level?: 'beginner' | 'intermediate' | 'advanced';
  status?: 'draft' | 'published' | 'archived';
}

export async function createTraining(data: CreateTrainingInput): Promise<Training> {
  const response = await apiPost<ApiResponse<Training>>('/trainings', data);
  if (!response.data) throw new Error('Erro ao criar treinamento');
  return response.data;
}

export async function updateTraining(id: string, data: Partial<CreateTrainingInput>): Promise<Training> {
  const response = await apiPut<ApiResponse<Training>>(`/trainings/${id}`, data);
  if (!response.data) throw new Error('Erro ao atualizar treinamento');
  return response.data;
}

export async function deleteTraining(id: string): Promise<void> {
  await apiDelete(`/trainings/${id}`);
}

export async function getAllTrainings(): Promise<TrainingData> {
  const response = await apiGet<ApiResponse<TrainingData>>('/trainings?all=1');
  return response.data ?? { trainings: [], categories: [] };
}

export async function saveTrainingProgress(id: string, progressPct: number): Promise<{ data: { ok: boolean; progress_pct: number }; gamification: unknown }> {
  return apiPost(`/trainings/${id}/progress`, { progress_pct: progressPct }) as Promise<{ data: { ok: boolean; progress_pct: number }; gamification: unknown }>;
}

export async function getTrainingProgress(id: string): Promise<{ progress_pct: number; completed_at: string | null }> {
  const res = await apiGet<{ data: { progress_pct: number; completed_at: string | null } }>(`/trainings/${id}/progress`);
  return res.data ?? { progress_pct: 0, completed_at: null };
}
