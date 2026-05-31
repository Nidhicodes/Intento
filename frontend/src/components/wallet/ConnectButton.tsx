'use client';

import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';
import { Button } from '@/components/ui/Button';
import { shortenAddress } from '@/lib/utils';
import { Wallet, LogOut } from 'lucide-react';
import { useState } from 'react';

export function ConnectButton() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [showMenu, setShowMenu] = useState(false);

  if (!isConnected) {
    return (
      <Button
        variant="secondary"
        size="sm"
        disabled={isPending}
        onClick={() => {
          // Use the first available connector (injected/MetaMask)
          const connector = connectors[0];
          if (connector) connect({ connector });
        }}
      >
        <Wallet size={12} />
        {isPending ? 'Connecting...' : 'Connect'}
      </Button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:border-border-subtle transition-colors text-xs"
      >
        <span className="w-2 h-2 rounded-full bg-accent-green" />
        <span className="font-mono text-text-secondary">{shortenAddress(address!)}</span>
        <span className="text-text-muted">•</span>
        <span className="text-text-muted">{chain?.name || 'Unknown'}</span>
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-1 w-40 surface p-1 z-50">
            <button
              onClick={() => { disconnect(); setShowMenu(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-secondary hover:bg-bg-hover rounded-md transition-colors"
            >
              <LogOut size={12} />
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}
