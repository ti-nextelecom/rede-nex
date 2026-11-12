const TYPES = new Set([
  'image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm',
  'audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/aac','audio/flac','audio/amr','text/html',
  'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip','application/x-zip-compressed','application/x-zip','application/x-rar-compressed','application/vnd.rar','application/x-7z-compressed',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain','text/csv',
]);
const BY_EXTENSION = {
  jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',
  html:'text/html',htm:'text/html',aac:'audio/aac',flac:'audio/flac',amr:'audio/amr',opus:'audio/ogg',oga:'audio/ogg',
  mp4:'video/mp4',webm:'video/webm',ogg:'audio/ogg',m4a:'audio/mp4',mp3:'audio/mpeg',wav:'audio/wav',
  pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip:'application/zip',rar:'application/vnd.rar','7z':'application/x-7z-compressed',
  ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',txt:'text/plain',csv:'text/csv',
};
const ALIASES = {'audio/x-wav':'audio/wav','audio/wave':'audio/wav','audio/x-m4a':'audio/mp4','audio/m4a':'audio/mp4','audio/mp3':'audio/mpeg','audio/x-mpeg':'audio/mpeg','application/ogg':'audio/ogg','audio/opus':'audio/ogg','audio/x-aac':'audio/aac','audio/aacp':'audio/aac','audio/x-flac':'audio/flac','audio/amr-wb':'audio/amr'};
export const CHAT_UPLOAD_ACCEPT = 'image/*,video/*,audio/*,text/html,.html,.htm,.aac,.flac,.amr,.opus,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.7z,.ppt,.pptx,.txt,.csv';
export function chatUploadType(file) {
  if (!file || !Number.isFinite(file.size) || file.size <= 0) throw new Error('O arquivo está vazio. Selecione outro arquivo.');
  if (file.size > 20 * 1024 * 1024) throw new Error('O arquivo deve ter no máximo 20 MB.');
  const raw = String(file.type || '').split(';')[0].trim().toLowerCase();
  const reported = Object.hasOwn(ALIASES,raw) ? ALIASES[raw] : raw;
  if (TYPES.has(reported)) return reported;
  // Some Android document providers omit the MIME type. The server still validates file signatures.
  if (!reported || reported === 'application/octet-stream' || reported === 'binary/octet-stream') {
    const extension = String(file.name || '').split('.').at(-1).toLowerCase();
    const inferred = Object.hasOwn(BY_EXTENSION, extension) ? BY_EXTENSION[extension] : null;
    if (inferred) return inferred;
  }
  throw new Error('Formato não permitido. Envie uma imagem, PDF ou outro documento compatível.');
}
