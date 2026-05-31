'use client';

import { useState, useEffect } from 'react';
import type { PermissionSpec } from './api';

export interface StoredRedelegation {
  agent: 'risk' | 'yield' | 'execution';
  to: string;
  budgetUsdc: number;
  delegationHash: string;
  signedDelegation: any;
}

export interface StoredGrant {
  context: string;
  rootDelegation: any;
  smartAccount: string;
  ownerAddress?: string;
  orchestratorSa?: string;
  sessionAccount: string;
  redelegations: StoredRedelegation[];
  spec: PermissionSpec | null;
  grantedAt: number;
}

const KEY = 'intento_grant';

export function readGrant(): StoredGrant | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredGrant) : null;
  } catch {
    return null;
  }
}

export function clearGrant(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(KEY);
}

/**
 * Hook that returns the current stored grant (reactive to a `revoked` flag).
 */
export function useGrant(): { grant: StoredGrant | null; refresh: () => void } {
  const [grant, setGrant] = useState<StoredGrant | null>(null);

  const refresh = () => setGrant(readGrant());

  useEffect(() => {
    refresh();
    // Re-read if another tab updates it
    const handler = () => refresh();
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return { grant, refresh };
}
