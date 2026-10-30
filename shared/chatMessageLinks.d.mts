export function chatMessageLink(conversationId: string, messageId?: string | null, mention?: boolean): string;
export function chatNotificationTarget(link?: string | null): { conversationId: string; messageId: string | null; mention: boolean } | null;
export function chatMentionText(content: string): string;
export function buildChatNotices(input: { participants: { user_id: string; name: string; photo_url?: string }[]; actorId: string; conversationId: string; message: { id: string; content: string } }): { actorId: string; actorName: string; actorPhotoUrl: string | null; userIds: string[]; type: string; title: string; message: string; link: string; mentioned: boolean }[];
