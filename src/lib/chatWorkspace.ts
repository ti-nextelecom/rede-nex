import { createChatDraftStore, type ChatDraftStore } from '../../shared/chatDrafts.mjs';
import { createJarvisConversation, type JarvisConversation } from '../../shared/jarvisConversation.mjs';
import { apiPost } from './apiClient';

interface ChatWorkspace { drafts: ChatDraftStore; jarvis: JarvisConversation }
// Client-only stores survive route changes. Each account has independent state and storage.
const workspaces = new Map<string | null, ChatWorkspace>();
export function getChatWorkspace(ownerId: string | null): ChatWorkspace {
  let workspace = workspaces.get(ownerId);
  if (!workspace) {
    let storage: Storage | undefined;
    try { storage = window.localStorage; } catch { /* In-memory fallback. */ }
    const drafts = createChatDraftStore({ ownerId, storage });
    workspace = {
      drafts,
      jarvis: createJarvisConversation({ ownerId, storage, drafts,
        request: messages => apiPost('/jarves', { messages, voice_mode: false }),
      }),
    };
    workspaces.set(ownerId, workspace);
  }
  return workspace;
}
