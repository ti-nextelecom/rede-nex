// Avatar achievements use XP levels; legacy rank slugs are intentionally unrelated.
export const LEVEL_XP = Object.freeze([0, 500, 1500, 3500, 7500, 15000, 30000, 60000, 100000, 150000]);
export const AVATAR_FRAMES = Object.freeze([
  { slug: 'automatic', name: 'Minha conquista atual', level: 0, motif: 'auto', colors: ['#ff970f', '#ff5c28'] },
  { slug: 'none', name: 'Sem borda', level: 0, motif: 'none', colors: ['#94a3b8', '#64748b'] },
  { slug: 'nex', name: 'Essência NEX', level: 0, motif: 'orbit', colors: ['#ffab32', '#ff6228'] },
  { slug: 'ocean', name: 'Oceano', level: 0, motif: 'double', colors: ['#52e4ee', '#3782f6'] },
  { slug: 'iris', name: 'Íris', level: 0, motif: 'dashes', colors: ['#dcb3ff', '#9255ed'] },
  ...[
    ['Primeiro passo', 'circle', '#88cdbb', '#407f97'],
    ['Explorador', 'dots', '#63dfef', '#3686e8'],
    ['Conexão', 'arcs', '#8eadff', '#6352d8'],
    ['Destaque', 'diamond', '#ffcf68', '#ed8c32'],
    ['Impulso', 'rays', '#ff9dc1', '#da418e'],
    ['Inspiração', 'leaves', '#93f4b1', '#23ab80'],
    ['Excelência', 'hex', '#a4f5ff', '#2faddd'],
    ['Referência', 'stars', '#dcb4ff', '#8557e9'],
    ['Legado', 'laurel', '#ffe9a0', '#d69a32'],
    ['Constelação', 'crown', '#fff1a5', '#ff6c42'],
  ].map(([name, motif, first, second], index) => ({ slug: `level-${index + 1}`, name, level: index + 1, motif, colors: [first, second] })),
].map(frame => Object.freeze({ ...frame, colors: Object.freeze(frame.colors) })));

export function levelForXP(xp) {
  const value = Math.max(0, Number(xp) || 0);
  return LEVEL_XP.reduce((level, minimum, index) => value >= minimum ? index + 1 : level, 1);
}
export function frameBySlug(slug) { return AVATAR_FRAMES.find(frame => frame.slug === slug); }
export function resolveAvatarFrame(slug, level) {
  const frame = frameBySlug(slug);
  return frame && frame.slug !== 'automatic' && frame.level <= level
    ? frame : frameBySlug(`level-${Math.max(1, Math.min(10, level || 1))}`);
}
