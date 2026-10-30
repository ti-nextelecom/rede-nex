export const CHAT_REACTIONS = Object.freeze(['👍','❤️','😂','😮','😢','🙏','👏','🔥']);
export const isChatReaction = value => typeof value === 'string' && CHAT_REACTIONS.includes(value);
