export function chatDelivery(conversation: { last_message?: { sender?: { id: string }; created_at: string; recipient_count?: number; read_count?: number }; other_participant?: { last_read_at?: string } }, myId?: string): { read: boolean; complete: boolean; label: string } | null;
export function applyChatRead<T>(conversations: T[], event: { conversationId?: unknown; readBy?: unknown; lastReadAt?: unknown }): T[];
export function preserveConversationReads<T>(previous: T[], latest: T[]): T[];
