import type { ChatStorage } from './chatDrafts.mjs';
import type { ChatMessage } from '../src/lib/chatApi';
export interface OutboxEntry { clientId: string; conversationId: string; content: string; replyToId?: string; replyTo?: ChatMessage['reply_to']; createdAt: string; state: 'queued' | 'sending' | 'failed' | 'sent'; message?: ChatMessage; error?: string }
export interface ChatOutbox {
  getSnapshot(): OutboxEntry[];
  subscribe(listener: () => void): () => void;
  reconcile(messages: ChatMessage[]): void;
  enqueue(input: { conversationId: string; content: string; replyToId?: string; replyTo?: ChatMessage['reply_to'] }): string | null;
  retry(id: string): void;
  discard(id: string): void;
}
export function createChatOutbox(options: { ownerId: string | null; storage?: ChatStorage; send(entry: OutboxEntry): Promise<ChatMessage> }): ChatOutbox;
export function mergeChatOutbox(messages: ChatMessage[], entries: OutboxEntry[], conversationId: string | null, user: {id:string;name:string;photo_url?:string}): ChatMessage[];
