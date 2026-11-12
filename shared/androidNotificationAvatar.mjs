// FCM data stays bounded; the phone only downloads HTTPS images.
export function androidAvatarUrl(value) {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u001f\\]/.test(value)) return '';
  try {
    const url = new URL(value, 'https://rede.nextelecom.net.br');
    if (url.protocol !== 'https:' || url.username || url.password || url.href.length > 1024) return '';
    return url.href;
  } catch { return ''; }
}