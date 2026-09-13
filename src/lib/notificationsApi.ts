import { apiGet, apiPatch } from './apiClient';

export interface NotificationRow {
  id: string;
  title: string;
  message?: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'feed' | 'wiki' | 'chat';
  read: boolean;
  link?: string;
  actor_name?: string;
  actor_photo_url?: string;
  created_at: string;
}

export async function getNotifications() {
  const response = await apiGet<{ data?: NotificationRow[] }>('/notifications');
  return response.data ?? [];
}

export async function markNotificationRead(id: string) {
  return apiPatch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  return apiPatch('/notifications');
}
