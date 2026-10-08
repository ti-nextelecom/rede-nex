/**
 * Design Tokens – Futuristic Theme
 * Neon accents, glass morphism, dark-first design
 */

export const glassEffects = {
  base: 'backdrop-blur-xl bg-white/[0.04] border border-white/[0.06]',
  hover: 'hover:bg-white/[0.08] hover:border-white/[0.12] transition-all hover:shadow-card-hover',
  focus: 'focus:bg-white/[0.08] focus:border-primary/50 focus:ring-2 focus:ring-primary/20',
};

export const gradientShadows = {
  primary: 'shadow-glow-primary hover:shadow-glow-cyan transition-shadow',
  secondary: 'shadow-glow-purple hover:shadow-glow-purple transition-shadow',
  accent: 'shadow-glow-pink hover:shadow-glow-pink transition-shadow',
};

export const animations = {
  slideUp: 'animate-slide-up',
  slideDown: 'animate-slide-down',
  fadeIn: 'animate-fade-in',
  bounceIn: 'animate-bounce-in',
  scaleIn: 'animate-scale-in',
  glowPulse: 'animate-glow-pulse',
  float: 'animate-float',
  gradientShift: 'animate-gradient-shift',
  shimmer: 'animate-shimmer',
  borderGlow: 'animate-border-glow',
};

export const hoverEffects = {
  scale: 'hover:scale-105 active:scale-95 transition-transform',
  glow: 'hover:shadow-glow-primary transition-shadow',
  lift: 'hover:-translate-y-1 transition-transform',
  brighten: 'hover:brightness-110 transition-all',
};

export const cardStyles = {
  glass: 'card-futuristic',
  stat: 'stat-card',
  post: 'post-card',
  gradient: 'rounded-2xl border border-white/[0.06] bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm hover:border-primary/20 hover:shadow-card-hover transition-all hover:scale-[1.02]',
  glow: 'rounded-2xl border border-primary/20 bg-primary/5 hover:shadow-glow-primary transition-all',
};

export const buttonStyles = {
  primary: 'btn-futuristic',
  glass: 'btn-glass',
  neon: 'border border-primary/30 text-primary hover:shadow-glow-primary hover:bg-primary/10 transition-all rounded-xl px-4 py-2',
  ghost: 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-all rounded-xl px-4 py-2',
};

export const textStyles = {
  gradientCyan: 'text-gradient-cyan',
  gradientPurple: 'text-gradient-purple',
  gradientWarm: 'text-gradient-warm',
  neon: 'text-primary drop-shadow-[0_0_8px_rgba(0,229,255,0.4)]',
};

export const navigationStyles = {
  activeIndicator: 'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:rounded-full after:shadow-glow-primary',
  hoverState: 'hover:bg-white/[0.06] transition-all rounded-lg',
};

export const overlayStyles = {
  backdrop: 'backdrop-blur-sm bg-black/40',
  darkBackdrop: 'backdrop-blur-md bg-black/60',
};

export const inputStyles = {
  glass: 'bg-white/[0.04] border border-white/[0.08] focus:bg-white/[0.06] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground transition-all',
  search: 'bg-white/[0.04] border border-white/[0.08] focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15 rounded-xl transition-all',
};

export const neonColors = {
  cyan: '#00e5ff',
  purple: '#a855f7',
  pink: '#ec4899',
  green: '#22d3ee',
  orange: '#f97316',
  blue: '#3b82f6',
} as const;
