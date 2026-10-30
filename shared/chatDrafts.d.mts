export const JARVIS_CONVERSATION_ID: 'jarvis';
export interface DraftToken { readonly text: string }
export interface ChatDraftStore {
  flush(): void;
  getSnapshot(): Record<string, DraftToken>;
  subscribe(listener: () => void): () => void;
  capture(id: string): DraftToken | undefined;
  set(id: string, value: string | ((previous: string) => string)): void;
  clearIfUnchanged(id: string, token: DraftToken | undefined): boolean;
}
export interface ChatStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export function createChatDraftStore(options: { ownerId: string | null; storage?: ChatStorage }): ChatDraftStore;
