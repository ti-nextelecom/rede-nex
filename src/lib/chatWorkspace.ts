import { createChatDraftStore, type ChatDraftStore } from '../../shared/chatDrafts.mjs';
import { createJarvisConversation, type JarvisConversation } from '../../shared/jarvisConversation.mjs';
import { createChatOutbox, type ChatOutbox } from '../../shared/chatOutbox.mjs';
import { sendChatMessage } from './chatApi';
import { apiPost } from './apiClient';

interface ChatWorkspace { drafts: ChatDraftStore; jarvis: JarvisConversation; outbox: ChatOutbox }
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
      outbox: createChatOutbox({ ownerId, storage, send: entry => sendChatMessage(entry.conversationId, entry.content, entry.replyToId, entry.clientId, ownerId || undefined) }),
      jarvis: createJarvisConversation({ ownerId, storage, drafts,
        request: messages => apiPost('/jarves', { messages, voice_mode: false }),
      }),
    };
    workspaces.set(ownerId, workspace);
  }
  return workspace;
}

function flushDrafts() { for (const workspace of workspaces.values()) workspace.drafts.flush(); }
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushDrafts);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushDrafts(); });
}
