export const TASK_UPLOAD_ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.ogg,.m4a,.mp3,.wav,.pdf,.doc,.docx,.xls,.xlsx';
const types = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm', ogg: 'audio/ogg', m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
export function taskUploadType(file) {
  if (!file.size) throw new Error('O arquivo está vazio.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Cada arquivo pode ter até 20 MB.');
  const type = file.type || types[file.name.split('.').pop().toLowerCase()];
  if (!Object.values(types).includes(type) && type !== 'audio/webm') throw new Error('Formato não permitido. Use imagens, vídeos, áudio, PDF, Word ou Excel.');
  return type;
}
export function safeTaskFileUrl(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f\\]/.test(value)) return null;
  const url = value.trim();
  if (/^\/(uploads\/|api\/media\/)/.test(url)) return url;
  try { const parsed = new URL(url); return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : null; } catch { return null; }
}
export function taskMediaKind(file) {
  const type = file.file_type || types[(file.name || '').split('.').pop().toLowerCase()] || '';
  return type.startsWith('image/') && type !== 'image/svg+xml' ? 'image' : type.startsWith('video/') ? 'video' : type.startsWith('audio/') ? 'audio' : 'file';
}
export function taskMessageContent(text, files = []) {
  const links = files.map(file => {
    const url = safeTaskFileUrl(file.file_url);
    if (!url) throw new Error('O anexo não possui um endereço válido.');
    return `[Anexo: ${file.name.replace(/[\[\]\r\n]/g, ' ').slice(0, 500)}](${url.replace(/\(/g, '%28').replace(/\)/g, '%29')})`;
  });
  const content = [text.trim(), links.join('\n')].filter(Boolean).join('\n\n');
  if (content.length > 4000) throw new Error('A mensagem com anexos excede o limite de 4.000 caracteres. Divida em mais de um envio.');
  return content;
}
export function parseTaskMessage(content, files = []) {
  const attachments = [];
  const text = String(content || '').replace(/^\[Anexo: ([^\]\r\n]+)\]\(([^)\r\n]+)\)$/gm, (line, name, url) => {
    const known = files.find(file => safeTaskFileUrl(file.file_url)?.replace(/\(/g, '%28').replace(/\)/g, '%29') === url);
    if (!known) return line; // Never fabricate an attachment when its record is unavailable.
    if (!attachments.some(file => file.id === known.id)) attachments.push(known);
    return '';
  }).trim();
  return { text, attachments };
}
export function canAccessTaskFiles(task, actor, adminRoles = ['Administrador', 'Gestor']) {
  return Boolean(task && actor && (adminRoles.includes(actor.role_name) || task.created_by === actor.id || task.owner_id === actor.id || task.assignees?.some(person => person.id === actor.id) || task.observers?.some(person => person.id === actor.id)));
}
export function descriptionImageMarkdown(file) {
  const url = safeTaskFileUrl(file.file_url);
  if (!url || taskMediaKind(file) !== 'image') throw new Error('A descrição aceita imagens válidas.');
  return `\n\n![${file.name.replace(/[\[\]\r\n]/g, ' ')}](${url.replace(/\(/g, '%28').replace(/\)/g, '%29')})\n\n`;
}
export function taskDescriptionParts(content) {
  const parts = [], pattern = /!\[([^\]\r\n]*)\]\(([^)\r\n]+)\)/g;
  let previous = 0;
  for (const match of String(content || '').matchAll(pattern)) {
    const url = safeTaskFileUrl(match[2]);
    if (!url || /\.svg(?:[?#]|$)/i.test(url)) continue;
    if (match.index > previous) parts.push({ kind: 'text', text: content.slice(previous, match.index) });
    parts.push({ kind: 'image', url, name: match[1] || 'Imagem da tarefa' });
    previous = match.index + match[0].length;
  }
  if (previous < content.length) parts.push({ kind: 'text', text: content.slice(previous) });
  return parts;
}

// Templates keep instructions and ordinary links, without embedding task media.
export function taskDescriptionWithoutMedia(content, files = []) {
  const known = new Set(files.map(file => safeTaskFileUrl(file?.file_url)).filter(Boolean));
  const isMedia = value => {
    const url = safeTaskFileUrl(value);
    return Boolean(url && (known.has(url) || /^\/(uploads\/|api\/media\/)/.test(url)));
  };
  return String(content || '')
    .replace(/!\[[^\]\r\n]*\]\([^\r\n)]*\)/g, '')
    .replace(/\[([^\]\r\n]*)\]\(([^)\r\n]+)\)/g, (match, _label, url) => isMedia(url) ? '' : match)
    .replace(/https?:\/\/[^\s<>]+|\/(?:uploads|api\/media)\/[^\s<>]+/g, value => isMedia(value) ? '' : value)
    .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n').trim();
}
