export function mergeChatMessages<T extends { id: string; created_at: string }>(previous: T[], latest: T[]): T[];
export function chatScrollAction(input: { initial: boolean; following: boolean; ownMessage: boolean; prepending: boolean }): 'preserve' | 'bottom' | 'none';
