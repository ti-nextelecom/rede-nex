import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary:
          'border border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'text-foreground border border-foreground/30',
        /* Novos estilos modernos */
        'glass':
          'border border-white/20 bg-white/10 text-white backdrop-blur-xl hover:bg-white/20 hover:border-white/40 hover:shadow-lg shadow-lg',
        'glass-primary':
          'border border-primary/30 bg-gradient-to-r from-primary/20 to-primary/10 text-primary backdrop-blur-lg hover:border-primary/60 hover:bg-gradient-to-r hover:from-primary/30 hover:to-primary/20 hover:shadow-lg hover:shadow-primary/50 shadow-md',
        'glow-primary':
          'border-2 border-primary/40 bg-primary/10 text-primary font-bold hover:border-primary hover:bg-primary/20 hover:shadow-2xl hover:shadow-primary/60 shadow-lg',
        'gradient-primary':
          'bg-gradient-primary text-white border border-primary/50 hover:shadow-lg hover:shadow-primary/50 hover:scale-105 transition-transform',
        'gradient-secondary':
          'bg-gradient-secondary text-white border border-secondary/50 hover:shadow-lg hover:shadow-secondary/50 hover:scale-105 transition-transform',
        'neon':
          'border-2 border-primary text-primary bg-transparent hover:bg-primary/10 hover:shadow-lg hover:shadow-primary/50 font-bold',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
