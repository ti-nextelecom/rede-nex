export function safeMediaSource(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f\\]/.test(value)) return null;
  if (/^\/(?!\/)/.test(value)) return value;
  if (/^data:(?:image\/(?:png|jpeg|webp|gif|avif)|application\/pdf);base64,[a-zA-Z0-9+/=]+$/.test(value)) return value;
  try { const url = new URL(value); return ['http:', 'https:', 'blob:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function mediaKind({ url = '', name = '', type = '' }) {
  if (type === 'application/pdf' || /\.pdf(?:[?#]|$)/i.test(name || url) || url.startsWith('data:application/pdf')) return 'pdf';
  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif|svg)(?:[?#]|$)/i.test(name || url) || url.startsWith('data:image/')) return 'image';
  if (type.startsWith('video/') || /\.(mp4|webm|mov)(?:[?#]|$)/i.test(name || url)) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  return 'file';
}
export const clampZoom = value => Math.max(.25, Math.min(4, Number.isFinite(value) ? value : 1));
export function fitMedia(width, height, viewportWidth, viewportHeight, zoom = 1) {
  const fit = Math.min(Math.max(1, viewportWidth - 32) / Math.max(1, width), Math.max(1, viewportHeight - 32) / Math.max(1, height), 1);
  return { width: Math.max(1, width * fit * clampZoom(zoom)), height: Math.max(1, height * fit * clampZoom(zoom)) };
}
export function selectionRect(a, b, crop = { x: 0, y: 0, width: 1, height: 1 }) {
  const x = Math.max(crop.x, Math.min(a.x, b.x)), y = Math.max(crop.y, Math.min(a.y, b.y));
  return { x, y, width: Math.max(0, Math.min(crop.x + crop.width, Math.max(a.x, b.x)) - x), height: Math.max(0, Math.min(crop.y + crop.height, Math.max(a.y, b.y)) - y) };
}
