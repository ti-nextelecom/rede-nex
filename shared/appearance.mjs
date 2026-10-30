export const DEFAULT_APPEARANCE = Object.freeze({ version: 1, mode: 'dark', accent: '#ff7a00', surface: '#182536', chatBackground: null, chatIncoming: null, chatOutgoing: null, wallpaper: '', platformWallpaper: '' });
const keys = Object.keys(DEFAULT_APPEARANCE);
const hex = /^#[0-9a-f]{6}$/i;
export function validWallpaper(value) {
  if (typeof value !== 'string' || value.length > 7_100_000) return false;
  if (!value) return true;
  // Existing chat uploads accepted image/*, including SVG/AVIF. Image sources are
  // rendered only as CSS backgrounds or <img>, never as markup or navigation.
  if (/^data:image\/[a-z0-9.+-]+(?:;charset=[a-z0-9-]+)?;base64,[A-Za-z0-9+/]+=*$/i.test(value)) return true;
  if (/^data:image\/[a-z0-9.+-]+(?:;charset=[a-z0-9-]+)?,.+$/is.test(value)) return true;
  if (/^\/(?:uploads|api\/media)\/[a-zA-Z0-9/_\-.]+$/.test(value) && !value.includes('..')) return true;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && value.length <= 2048; } catch { return false; }
}
export function parseAppearance(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || Object.keys(value).some(key => !keys.includes(key))) throw new Error('Preferências de aparência inválidas');
  if (value.version !== 1 || !['light', 'dark', 'system'].includes(value.mode)) throw new Error('Selecione um modo de aparência válido');
  for (const key of ['accent', 'surface', 'chatBackground', 'chatIncoming', 'chatOutgoing']) {
    if (key.startsWith('chat') && value[key] === null) continue;
    if (typeof value[key] !== 'string' || !hex.test(value[key])) throw new Error('Use uma cor hexadecimal válida, como #2563eb');
  }
  if (!validWallpaper(value.wallpaper) || !validWallpaper(value.platformWallpaper)) throw new Error('Selecione uma imagem de fundo válida');
  return Object.fromEntries(keys.map(key => [key, typeof value[key] === 'string' && hex.test(value[key]) ? value[key].toLowerCase() : value[key]]));
}
export function legacyAppearance(theme) {
  const next = { ...DEFAULT_APPEARANCE };
  if (!theme || typeof theme !== 'object') return next;
  if (hex.test(theme.bubbleColor)) next.chatOutgoing = theme.bubbleColor.toLowerCase();
  if (hex.test(theme.bgColor)) next.chatBackground = theme.bgColor.toLowerCase();
  if (validWallpaper(theme.bgImage)) next.wallpaper = theme.bgImage;
  return next;
}
export function rgb(color) { return [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255); }
export function luminance(color) {
  return rgb(color).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
}
export function contrast(first, second) { const a = luminance(first), b = luminance(second); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); }
export function readableText(background) { return contrast(background, '#ffffff') >= contrast(background, '#000000') ? '#ffffff' : '#000000'; }
export function accessibleInk(color, background) {
  const [h,s,l] = hexHsl(color), direction = readableText(background) === '#ffffff' ? 1 : -1;
  let result = color;
  for (let step = 1; contrast(result, background) < 4.5 && step <= 100; step++) result = hslHex(h, s, Math.max(0, Math.min(100, l + direction * step)));
  return result;
}
export function hexHsl(color) {
  const [r, g, b] = rgb(color), max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const l = (max + min) / 2;
  const s = delta ? delta / (1 - Math.abs(2 * l - 1)) : 0;
  let h = !delta ? 0 : max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  h = (h * 60 + 360) % 360;
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}
export function hslHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  return '#' + [0, 8, 4].map(n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); }).join('');
}
export function appearancePalette(settings, systemDark = true) {
  const dark = settings.mode === 'system' ? systemDark : settings.mode === 'dark';
  const [h, saturation] = hexHsl(settings.surface), s = Math.min(saturation, 42);
  const hsl = lightness => `${h} ${s}% ${lightness}%`;
  const color = lightness => hslHex(h, s, lightness);
  const accentHsl = hexHsl(settings.accent);
  const card = color(dark ? 12 : 99);
  const ink = accessibleInk(settings.accent, card);
  const incoming = settings.chatIncoming || card;
  const outgoing = settings.chatOutgoing || hslHex(accentHsl[0], Math.min(accentHsl[1], 45), dark ? 25 : 88);
  return { dark, variables: {
    '--background': hsl(dark ? 7 : 96), '--card': hsl(dark ? 12 : 99), '--popover': hsl(dark ? 14 : 99),
    '--foreground': hsl(dark ? 94 : 13), '--card-foreground': hsl(dark ? 94 : 13), '--popover-foreground': hsl(dark ? 94 : 13),
    '--muted': hsl(dark ? 16 : 93), '--muted-foreground': hsl(dark ? 70 : 38), '--accent': hsl(dark ? 20 : 89), '--accent-foreground': hsl(dark ? 94 : 13),
    '--input': hsl(dark ? 10 : 99), '--border': hsl(dark ? 26 : 80), '--ring': `${accentHsl[0]} ${accentHsl[1]}% ${accentHsl[2]}%`,
    '--primary': `${accentHsl[0]} ${accentHsl[1]}% ${accentHsl[2]}%`, '--primary-foreground': readableText(settings.accent) === '#ffffff' ? '0 0% 100%' : '0 0% 0%',
    '--secondary': hsl(dark ? 24 : 85), '--secondary-foreground': hsl(dark ? 94 : 13),
    '--color-text-secondary': hsl(dark ? 70 : 38), '--color-text-muted': hsl(dark ? 65 : 42),
    '--nex-accent': settings.accent, '--nex-accent-ink': ink, '--nex-on-accent': readableText(settings.accent),
    '--nex-chat-bg': settings.chatBackground || color(dark ? 8 : 95),
    '--nex-chat-incoming': incoming, '--nex-chat-incoming-text': readableText(incoming),
    '--nex-chat-outgoing': outgoing, '--nex-chat-outgoing-text': readableText(outgoing),
    '--gradient-primary-start': `${accentHsl[0]} ${accentHsl[1]}% ${accentHsl[2]}%`, '--gradient-primary-end': `${(accentHsl[0] + 14) % 360} ${accentHsl[1]}% ${Math.max(20, accentHsl[2] - 6)}%`,
  }, chat: { background: settings.chatBackground || color(dark ? 8 : 95), incoming, outgoing, incomingText: readableText(incoming), outgoingText: readableText(outgoing), wallpaper: settings.wallpaper } };
}
