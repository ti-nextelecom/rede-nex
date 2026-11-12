/** The active @query ends at the caret, not at the end of the message. */
export function taskMentionAt(text, caret) {
  const end = Math.max(0, Math.min(text.length, caret));
  const match = text.slice(0, end).match(/(?:^|[\s(])@([^@\n]{0,80})$/u);
  return match ? { start: end - match[1].length - 1, end, query: match[1] } : null;
}
export function applyTaskMention(text, range, name) {
  if (!range || text[range.start] !== '@' || !name.trim()) return null;
  const insert = '@' + name.trim() + ' ';
  return { text: text.slice(0, range.start) + insert + text.slice(range.end), caret: range.start + insert.length };
}