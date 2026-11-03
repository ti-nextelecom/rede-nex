import { buildMentionMatcher, chatTextParts } from './chatMentions.mjs';

export function chatMessageLink(conversationId, messageId, mention = false) {
  const params = new URLSearchParams({ conversa: conversationId });
  if (messageId) params.set('mensagem', messageId);
  if (mention) params.set('mencao', '1');
  return '/bate-papo?' + params;
}
export function chatNotificationTarget(link) {
  if (typeof link !== 'string' || !link.startsWith('/') || link.startsWith('//') || link.includes('\\')) return null;
  try {
    const url = new URL(link, 'https://local.invalid');
    const conversationId = url.searchParams.get('conversa');
    return url.pathname === '/bate-papo' && conversationId ? { conversationId, messageId: url.searchParams.get('mensagem'), mention: url.searchParams.get('mencao') === '1' } : null;
  } catch { return null; }
}
export function chatMentionText(content) {
  const text = String(content || '').replace(/^\[FWD:[^\n]*\]\n/, '');
  // Attachment names, media URLs and encoded bytes are never interpreted as mentions.
  return /^\[(?:IMAGE|VIDEO|AUDIO_MSG|AUDIO|STICKER|DOC(?:\|[^\]]*)?|FILE)\]/.test(text) ? text.slice(text.indexOf('\n') < 0 ? text.length : text.indexOf('\n') + 1) : text;
}
export function buildChatNotices({ participants, actorId, conversationId, message }) {
  const users = participants.map(person => ({ id: person.user_id, name: person.name }));
  const parts = chatTextParts(chatMentionText(message.content), buildMentionMatcher(users));
  const everyone = parts.some(part => part.kind === 'mention' && part.userId === '__todos__');
  const mentioned = new Set(parts.filter(part => part.kind === 'mention').map(part => part.userId));
  const recipients = users.filter(user => user.id !== actorId);
  const actor = participants.find(person => person.user_id === actorId);
  const media = /^\[(IMAGE|VIDEO|AUDIO_MSG|AUDIO|DOC(?:\|[^\]]*)?|FILE|STICKER)\]/.test(message.content || '');
  const caption = chatMentionText(message.content);
  const preview = (media ? (caption || 'Enviou uma mídia ou arquivo') : message.content || '').slice(0, 160);
  return [false, true].flatMap(isMention => {
    const userIds = recipients.filter(user => (everyone || mentioned.has(user.id)) === isMention).map(user => user.id);
    return userIds.length ? [{ actorId, actorName: actor?.name || 'Colaborador', actorPhotoUrl: actor?.photo_url || null,
      userIds, type: 'chat', title: isMention ? `${actor?.name || 'Colaborador'} mencionou você` : actor?.name || 'Nova mensagem',
      message: preview, link: chatMessageLink(conversationId, message.id, isMention), mentioned: isMention }] : [];
  });
}
