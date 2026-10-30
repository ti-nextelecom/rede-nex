function trimEnd(value) {
  const counts = {}, pairs = { ')': '(', ']': '[', '}': '{' };
  for (const char of value) counts[char] = (counts[char] || 0) + 1;
  let end = value.length;
  while (end > 0) {
    const char = value[end - 1];
    if (/[.,!?;:]/.test(char)) { end--; continue; }
    if (pairs[char] && counts[char] > (counts[pairs[char]] || 0)) { counts[char]--; end--; continue; }
    break;
  }
  return value.slice(0, end);
}
export function textLinkParts(value) {
  const text = String(value ?? ''), parts = [];
  const pattern = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
  let previous = 0;
  for (const match of text.matchAll(pattern)) {
    if (match[0].length > 4096) continue;
    if (match.index > 0 && /[\w@/\\]/.test(text[match.index - 1])) continue;
    const label = trimEnd(match[0]);
    if (!label || label.length > 4096 || /[\u0000-\u001f\\]/.test(label)) continue;
    let url;
    try { url = new URL(/^www\./i.test(label) ? `https://${label}` : label); } catch { continue; }
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) continue;
    if (match.index > previous) parts.push({ kind: 'text', text: text.slice(previous, match.index) });
    parts.push({ kind: 'link', text: label, href: url.href });
    previous = match.index + label.length;
  }
  if (previous < text.length) parts.push({ kind: 'text', text: text.slice(previous) });
  return parts;
}
