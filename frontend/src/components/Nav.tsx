'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { shortenAddress } from '@/lib/utils';
import { useState } from 'react';
import { LogOut, Wallet } from 'lucide-react';

const links = [
  { label: 'Landing', href: '/' },
  { label: 'Setup', href: '/onboard' },
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Audit Trail', href: '/audit' },
];

export function Nav() {
  const pathname = usePathname();
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [showMenu, setShowMenu] = useState(false);

  const networkLabel = chain?.name?.includes('Sepolia') ? 'Base Sepolia' : chain?.name || 'Base Sepolia';

  const handleConnect = () => {
    const connector = connectors[0];
    if (connector) connect({ connector });
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-6"
      style={{
        background: 'rgba(9,9,15,0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" stroke="#E8B86D" strokeWidth="1.5" />
          <path d="M12 7L16 9.5V14.5L12 17L8 14.5V9.5L12 7Z" stroke="#E8B86D" strokeWidth="1" opacity="0.5" />
        </svg>
        <span className="text-amber-glow text-sm font-semibold" style={{ letterSpacing: '0.15em' }}>
          INTENTO
        </span>
      </Link>

      {/* Center links */}
      <div className="hidden md:flex items-center gap-7">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="relative text-xs transition-colors py-1"
              style={{ color: active ? 'var(--color-txt-primary)' : 'var(--color-txt-secondary)' }}
            >
              {link.label}
              {active && (
                <span className="absolute -bottom-1 left-0 right-0 h-px" style={{ background: 'var(--color-amber-glow)' }} />
              )}
            </Link>
          );
        })}
      </div>

      {/* Wallet indicator */}
      {isConnected && address ? (
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="glass flex items-center gap-2 px-3 py-1.5 rounded-full transition-all hover:bg-white/[0.06]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-teal-glow live-dot" />
            <span className="font-mono text-[11px] text-txt-secondary">{shortenAddress(address)}</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(123,110,246,0.12)', color: 'var(--color-violet-glow)' }}
            >
              {networkLabel}
            </span>
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-40 glass rounded-xl p-1 z-50">
                <button
                  onClick={() => { disconnect(); setShowMenu(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-txt-secondary hover:text-txt-primary hover:bg-white/[0.06] rounded-lg transition-colors"
                >
                  <LogOut size={12} /> Disconnect
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <button
          onClick={handleConnect}
          disabled={isPending}
          className="glass flex items-center gap-2 px-3 py-1.5 rounded-full transition-all hover:bg-white/[0.06] disabled:opacity-50"
          style={{ borderColor: 'rgba(232,184,109,0.3)' }}
        >
          <Wallet size={12} className="text-amber-glow" />
          <span className="text-[11px] text-amber-glow font-medium">
            {isPending ? 'Connecting...' : 'Connect Wallet'}
          </span>
        </button>
      )}
    </nav>
  );
}
