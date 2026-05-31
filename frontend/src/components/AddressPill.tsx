'use client';

import { useCopy } from '@/lib/hooks';
import { shortenAddress } from '@/lib/utils';

export function Address({ value, className = '' }: { value: string; className?: string }) {
  const [copied, copy] = useCopy();
  return (
    <span className="relative inline-block">
      <button
        onClick={() => copy(value)}
        className={`font-mono text-txt-secondary hover:text-amber-glow transition-colors cursor-pointer ${className}`}
        title="Click to copy"
      >
        {shortenAddress(value)}
      </button>
      {copied && (
        <span
          className="absolute left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5 rounded-md whitespace-nowrap"
          style={{
            top: '-26px',
            background: 'rgba(78,205,196,0.15)',
            color: 'var(--color-teal-glow)',
            border: '1px solid rgba(78,205,196,0.3)',
          }}
        >
          Copied!
        </span>
      )}
    </span>
  );
}
