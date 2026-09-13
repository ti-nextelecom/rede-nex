import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './apiClient';
import { dispatchXPEvent } from './xpEvents';

export interface OtherParticipant {
  id: string;
  name: string;
  photo_url?: string;
  last_seen_at?: string;
  online: boolean;
  last_read_at?: string;
}

export interface GroupParticipant {
  id: string;
  name: string;
  photo_url?: string;
  role: 'owner' | 'admin' | 'member';
  online?: boolean;
  position?: string;
}

export interface ChatConversation {
  id: string;
  name?: string;
  type: 'direct' | 'group';
  description?: string;
  avatar_url?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  participant_count: number;
  unread_count: number;
  broadcast_mode?: boolean;
  my_role?: 'owner' | 'admin' | 'member';
  is_muted?: boolean;
  is_pinned?: boolean;
  pinned_message?: { id: string; content: string; sender?: { id: string; name: string } } | null;
  last_message?: {
    id: string;
    content: string;
    created_at: string;
    sender?: { id: string; name: string; photo_url?: string };
  };
  other_participant?: OtherParticipant;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id?: string;
  content: string;
  attachment_url?: string;
  created_at: string;
  updated_at: string;
  edited_at?: string;
  reply_to_id?: string;
  is_deleted?: boolean;
  reply_to?: { id: string; content: string; sender?: { id: string; name: string } } | null;
  sender?: { id: string; name: string; photo_url?: string; position?: string };
}

export interface MessageEdit {
  content: string;
  edited_at: string;
}

export async function getConversations() {
  const response = await apiGet<{ data?: ChatConversation[] }>('/chat/conversations');
  return response.data ?? [];
}

export async function createConversation(input: { name?: string; description?: string; participant_ids?: string[]; type?: 'group' | 'direct' }) {
  const response = await apiPost<{ data?: ChatConversation }>('/chat/conversations', input);
  if (!response.data) throw new Error('Conversa não criada');
  return response.data;
}

export async function getMessages(conversationId: string, beforeId?: string) {
  const qs = beforeId ? `?before_id=${encodeURIComponent(beforeId)}` : '';
  const response = await apiGet<{ data?: ChatMessage[]; has_more?: boolean }>(`/chat/conversations/${conversationId}/messages${qs}`);
  return { messages: response.data ?? [], hasMore: response.has_more ?? false };
}

export async function markConversationRead(conversationId: string): Promise<void> {
  try { await apiPost(`/chat/conversations/${conversationId}/read`, {}); } catch {}
}

export async function sendChatMessage(conversationId: string, content: string, replyToId?: string) {
  const response = await apiPost<{ data?: ChatMessage; gamification?: unknown }>(`/chat/conversations/${conversationId}/messages`, { content, reply_to_id: replyToId ?? null });
  dispatchXPEvent(response.gamification);
  if (!response.data) throw new Error('Mensagem não enviada');
  return response.data;
}

export async function deleteChatMessage(conversationId: string, messageId: string): Promise<boolean> {
  try { await apiDelete(`/chat/conversations/${conversationId}/messages/${messageId}`); return true; } catch { return false; }
}

export async function getGroupParticipants(conversationId: string): Promise<GroupParticipant[]> {
  const response = await apiGet<{ data?: GroupParticipant[] }>(`/chat/conversations/${conversationId}/participants`);
  return response.data ?? [];
}

export async function updateConversationSettings(conversationId: string, input: { name?: string; description?: string; broadcast_mode?: boolean }) {
  const response = await apiPut<{ data?: ChatConversation }>(`/chat/conversations/${conversationId}`, input);
  return response.data;
}

export async function updateParticipantRole(conversationId: string, userId: string, role: string) {
  const response = await apiPatch<{ data?: GroupParticipant[] }>(`/chat/conversations/${conversationId}/participants/${userId}`, { role });
  return response.data;
}

export async function removeParticipantFromGroup(conversationId: string, userId: string) {
  await apiDelete(`/chat/conversations/${conversationId}/participants/${userId}`);
}

export async function editChatMessage(conversationId: string, messageId: string, content: string): Promise<ChatMessage> {
  const response = await apiPut<{ data: ChatMessage }>(`/chat/conversations/${conversationId}/messages/${messageId}`, { content });
  return response.data;
}

export async function getMessageHistory(conversationId: string, messageId: string): Promise<MessageEdit[]> {
  const response = await apiGet<{ data: MessageEdit[] }>(`/chat/conversations/${conversationId}/messages/${messageId}/history`);
  return response.data ?? [];
}

export async function addParticipantsToGroup(conversationId: string, participantIds: string[]) {
  const response = await apiPost<{ data?: ChatConversation[] }>(`/chat/conversations/${conversationId}/participants`, { participant_ids: participantIds });
  return response.data;
}

export interface MessageReader {
  id: string;
  name: string;
  photo_url?: string;
  last_read_at: string;
}

export async function getMessageReaders(conversationId: string, messageId: string): Promise<MessageReader[]> {
  const response = await apiGet<{ data?: MessageReader[] }>(`/chat/conversations/${conversationId}/messages/${messageId}/readers`);
  return response.data ?? [];
}

export async function uploadChatMedia(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const response = await apiPost<{ data?: { public_url: string } }>('/chat/media', {
          data: reader.result,
          file_name: file.name,
          file_type: file.type,
        });
        resolve(response.data?.public_url ?? '');
      } catch (e) { reject(e); }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadConversationAvatar(conversationId: string, file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const response = await apiPost<{ data?: { public_url: string } }>(`/chat/conversations/${conversationId}/avatar`, {
          data: reader.result,
          file_name: file.name,
          file_type: file.type,
        });
        resolve(response.data?.public_url || URL.createObjectURL(file));
      } catch (e) { reject(e); }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function toggleMuteConversation(conversationId: string): Promise<boolean> {
  const response = await apiPost<{ data?: { is_muted: boolean } }>(`/chat/conversations/${conversationId}/mute`, {});
  return response.data?.is_muted ?? false;
}

export async function pinChatConversation(conversationId: string): Promise<boolean> {
  const response = await apiPut<{ data?: { is_pinned: boolean } }>(`/chat/conversations/${conversationId}/pin`, {});
  return response.data?.is_pinned ?? false;
}

export async function pinChatMessage(conversationId: string, messageId: string | null): Promise<ChatConversation | null> {
  const response = await apiPut<{ data?: ChatConversation }>(`/chat/conversations/${conversationId}/pin-message`, { message_id: messageId });
  return response.data ?? null;
}

export async function getNotes(conversationId: string): Promise<{ content: string }> {
  const response = await apiGet<{ data?: { content: string } }>(`/chat/conversations/${conversationId}/notes`);
  return response.data ?? { content: '' };
}

export async function saveNotes(conversationId: string, content: string): Promise<void> {
  await apiPut(`/chat/conversations/${conversationId}/notes`, { content });
}
