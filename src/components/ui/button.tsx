import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline:
          'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        /* Novos estilos futuristas */
        'gradient-primary':
          'relative bg-gradient-primary text-white shadow-lg shadow-[hsl(var(--gradient-primary-start))]/35 hover:shadow-xl hover:shadow-[hsl(var(--gradient-primary-start))]/50 hover:scale-105 active:scale-95 overflow-hidden group',
        'gradient-secondary':
          'relative bg-gradient-secondary text-white shadow-lg shadow-[hsl(var(--gradient-secondary-start))]/35 hover:shadow-xl hover:shadow-[hsl(var(--gradient-secondary-start))]/50 hover:scale-105 active:scale-95 overflow-hidden group',
        'gradient-accent':
          'relative bg-gradient-accent text-white shadow-lg shadow-[hsl(var(--gradient-accent-start))]/35 hover:shadow-xl hover:shadow-[hsl(var(--gradient-accent-start))]/50 hover:scale-105 active:scale-95 overflow-hidden group',
        'glass':
          'relative bg-white/10 text-foreground backdrop-blur-xl border border-white/20 hover:bg-white/20 hover:border-white/40 shadow-lg hover:shadow-xl transition-all',
        'glass-primary':
          'relative bg-gradient-to-br from-[hsl(var(--gradient-primary-start))]/20 to-[hsl(var(--gradient-primary-end))]/20 text-foreground backdrop-blur-lg border border-[hsl(var(--gradient-primary-start))]/30 hover:border-[hsl(var(--gradient-primary-start))]/60 hover:bg-gradient-to-br hover:from-[hsl(var(--gradient-primary-start))]/30 hover:to-[hsl(var(--gradient-primary-end))]/30 shadow-lg hover:shadow-xl hover:shadow-[hsl(var(--gradient-primary-start))]/20 transition-all',
        'neon':
          'relative text-white border-2 border-transparent bg-gradient-primary hover:border-current before:absolute before:inset-0 before:bg-gradient-primary before:opacity-0 hover:before:opacity-20 before:transition-opacity before:rounded-md',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
