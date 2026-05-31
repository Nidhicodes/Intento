'use client';

import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  className?: string;
}

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  const variants = {
    success: 'bg-accent-green/8 text-accent-green border-accent-green/15',
    warning: 'bg-accent-amber/8 text-accent-amber border-accent-amber/15',
    danger: 'bg-accent-red/8 text-accent-red border-accent-red/15',
    info: 'bg-accent-blue/8 text-accent-blue border-accent-blue/15',
    neutral: 'bg-bg-hover text-text-secondary border-border',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium rounded-md border',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
