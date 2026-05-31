'use client';

import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', size = 'md', children, className, ...props }: ButtonProps) {
  const variants = {
    primary: 'bg-accent-blue hover:bg-accent-blue/90 text-white',
    secondary: 'bg-bg-hover hover:bg-border-subtle text-text-primary border border-border',
    danger: 'bg-accent-red hover:bg-accent-red/90 text-white',
    ghost: 'hover:bg-bg-hover text-text-secondary',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150',
        'active:scale-[0.98]',
        variants[variant],
        sizes[size],
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
