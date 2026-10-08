import * as React from 'react';

import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  variant?: 'default' | 'glass' | 'gradient';
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = 'default', ...props }, ref) => {
    const variantClasses = {
      default: 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      glass: 'flex h-10 w-full rounded-lg border-2 border-white/20 bg-white/10 px-4 py-2 text-sm backdrop-blur-xl shadow-sm transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:bg-white/15 hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-white/60 focus-visible:bg-white/20 focus-visible:shadow-lg focus-visible:shadow-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
      gradient: 'flex h-10 w-full rounded-lg border-2 border-primary/30 bg-gradient-to-br from-input/50 to-input/30 px-4 py-2 text-sm backdrop-blur-sm shadow-sm transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-primary/50 hover:bg-gradient-to-br hover:from-input/60 hover:to-input/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-primary focus-visible:shadow-lg focus-visible:shadow-primary/30 disabled:cursor-not-allowed disabled:opacity-50',
    };

    return (
      <input
        type={type}
        className={cn(
          variantClasses[variant],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
