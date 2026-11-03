import { textLinkParts } from './textLinks.mjs';

const normalized = name => name.toLocaleLowerCase('pt-BR');
const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Match existing plain @Full Name mentions against the visible user directory. */
export function buildMentionMatcher(users) {
  const idsByName = new Map();
  const names = new Map();
  for (const user of users) {
    const name = user.name?.trim();
    if (!user.id || !name) continue;
    const key = normalized(name);
    const previous = idsByName.get(key);
    idsByName.set(key, previous === undefined || previous === user.id ? user.id : null);
    names.set(key, name);
  }
  const uniqueNames = [...names].filter(([key]) => idsByName.get(key)).map(([, name]) => name).sort((a,b) => b.length-a.length);
  const pattern = uniqueNames.length ? new RegExp(`(?<![\\p{L}\\p{N}_@./\\\\-])@(${uniqueNames.map(escapePattern).join('|')})(?![\\p{L}\\p{N}_@])`, 'giu') : null;
  return { pattern, idsByName };
}

/** URL tokens are never interpreted as mentions; original text is preserved. */
const TODOS_PATTERN = /(?<![\p{L}\p{N}_@.\/\-])@todos(?![\p{L}\p{N}_@])/giu;
export function chatTextParts(text, matcher) {
  const withTodos = textLinkParts(text).flatMap(part => {
    if (part.kind === 'link') return [part];
    const parts = [];
    let previous = 0;
    for (const match of part.text.matchAll(TODOS_PATTERN)) {
      if (match.index > previous) parts.push({ kind: 'text', text: part.text.slice(previous, match.index) });
      parts.push({ kind: 'mention', text: match[0], userId: '__todos__' });
      previous = match.index + match[0].length;
    }
    if (previous < part.text.length) parts.push({ kind: 'text', text: part.text.slice(previous) });
    return parts;
  });
  if (!matcher?.pattern) return withTodos;
  return withTodos.flatMap(part => {
    if (part.kind === 'link' || part.kind === 'mention') return [part];
    const parts = [];
    let previous = 0;
    for (const match of part.text.matchAll(matcher.pattern)) {
      const userId=matcher.idsByName.get(normalized(match[1]));
      if(!userId)continue;
      if (match.index > previous) parts.push({ kind: 'text', text: part.text.slice(previous, match.index) });
      parts.push({ kind: 'mention', text: match[0], userId });
      previous = match.index + match[0].length;
    }
    if (previous < part.text.length) parts.push({ kind: 'text', text: part.text.slice(previous) });
    return parts;
  });
}
