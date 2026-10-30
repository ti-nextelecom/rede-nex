import type { ChatDraftStore, ChatStorage } from './chatDrafts.mjs';
export interface JarvisMessage { id: string; role: 'user' | 'assistant'; content: string }
export interface JarvisState { messages: JarvisMessage[]; pending: JarvisMessage | null; error: string }
export interface JarvisConversation {
  getSnapshot(): JarvisState;
  subscribe(listener: () => void): () => void;
  send(): Promise<boolean>;
}
export function createJarvisConversation(options: {
  ownerId: string | null; storage?: ChatStorage; drafts: ChatDraftStore;
  request(messages: Pick<JarvisMessage, 'role' | 'content'>[]): Promise<{ reply?: string }>;
}): JarvisConversation;
