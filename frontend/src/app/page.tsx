'use client';

import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { useLogStream } from '@/lib/hooks';
import { Link2, Activity, ShieldCheck } from 'lucide-react';

const LOG_LINES = [
  { text: '→ Delegation created  0x4f2a...8c1e', status: '✓' },
  { text: '→ Risk agent funded   20.00 USDC', status: '✓' },
  { text: '→ x402 data call      vol: LOW', status: '✓' },
  { text: '→ Yield scan          Aave: 8.2%', status: '✓' },
  { text: '→ Confidence score    0.87 / 1.0', status: '✓' },
  { text: '→ Executing via 1Shot ...', status: '⟳' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Nav />

      {/* HERO */}
      <section className="relative min-h-screen flex items-center px-6 pt-14 overflow-hidden">
        <div className="lightwave" />
        <div className="grid-overlay" />

        <div className="relative z-10 max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] text-amber-glow tracking-[0.2em] mb-6">
              AGENTIC DEFI • ERC-7710 • POWERED BY 1SHOT
            </p>

            <h1 className="font-display leading-[1.05] text-txt-primary" style={{ fontSize: 'clamp(44px, 6vw, 72px)' }}>
              Your portfolio, managed by{' '}
              <span className="italic" style={{ color: '#E8B86D' }}>agents</span>{' '}
              you actually control.
            </h1>

            <p className="text-txt-secondary mt-6 leading-relaxed" style={{ maxWidth: '520px', fontSize: '18px' }}>
              Speak your goal. Intento deploys a hierarchy of AI agents — each with a cryptographically
              enforced budget — to rebalance your DeFi portfolio autonomously. No gas needed. No blind trust required.
            </p>

            <div className="flex flex-wrap items-center gap-4 mt-8">
              <Link href="/onboard">
                <button
                  className="cta-amber text-white font-semibold rounded-lg px-6 flex items-center"
                  style={{ background: '#C9933A', height: '48px', fontSize: '14px' }}
                >
                  Start Managing
                </button>
              </Link>
              <button
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                className="rounded-lg px-6 flex items-center transition-all"
                style={{
                  height: '48px', fontSize: '14px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'var(--color-txt-secondary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(232,184,109,0.3)';
                  e.currentTarget.style.color = 'var(--color-txt-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                  e.currentTarget.style.color = 'var(--color-txt-secondary)';
                }}
              >
                See How It Works
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-8 text-[12px] text-txt-tertiary">
              <span>🔒 Permissions enforced onchain</span>
              <span>⚡ Gas-free via 1Shot</span>
              <span>🤖 3-agent hierarchy</span>
            </div>
          </div>

          {/* Right: live agent card */}
          <div className="hidden lg:flex justify-center">
            <LiveAgentCard />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="relative px-6 py-24 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            icon={<Link2 size={20} style={{ color: '#E8B86D' }} />}
            title="Limits enforced onchain, not in code"
            body="Each agent holds a signed ERC-7710 delegation with a USDC spending cap. The contract reverts any overspend. The AI reasoning layer cannot override it."
          />
          <FeatureCard
            icon={<Activity size={20} style={{ color: '#9B8FF8' }} />}
            title="Data spend is the trust signal"
            body="Agents that exhaust their x402 data budget before reporting are treated as high-confidence. Economic behavior — not text — drives execution decisions."
          />
          <FeatureCard
            icon={<ShieldCheck size={20} style={{ color: '#4ECDC4' }} />}
            title="Every action is verifiable"
            body="Intent → delegation → data spend → strategy → tx hash. Every step logged. Every number verifiable onchain. Not a narrative — a cryptographic record."
          />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="relative px-6 pb-24 max-w-7xl mx-auto scroll-mt-20">
        <h2 className="font-display text-txt-primary mb-12" style={{ fontSize: '32px' }}>How it works</h2>
        <div className="grid md:grid-cols-4 gap-6 relative">
          {[
            { n: 1, title: 'Speak your goal', body: 'Type what you want. Venice parses it into a permission spec.' },
            { n: 2, title: 'Approve once', body: 'MetaMask shows you exactly what agents can do. You approve with a single signature.' },
            { n: 3, title: 'Agents coordinate', body: 'Orchestrator creates 3 redelegations. Risk and Yield agents buy data. Confidence is scored.' },
            { n: 4, title: 'Executed onchain', body: '1Shot relays the transaction gas-free. Audit trail written. Portfolio updated.' },
          ].map((step) => (
            <div key={step.n} className="relative">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center mb-4 font-medium"
                style={{ border: '1px solid rgba(232,184,109,0.5)', color: '#E8B86D' }}
              >
                {step.n}
              </div>
              <h3 className="text-txt-primary font-medium text-sm">{step.title}</h3>
              <p className="text-txt-secondary text-xs mt-2 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* STATS BAR */}
      <section className="relative px-6 pb-24 max-w-7xl mx-auto">
        <div className="glass rounded-2xl flex flex-col md:flex-row items-center justify-around py-8 px-6 gap-6 md:gap-0">
          {[
            { value: '100%', label: 'Spend enforced onchain' },
            { value: '3', label: 'Agents in hierarchy' },
            { value: 'ERC-7710', label: 'Delegation standard' },
            { value: '0 ETH', label: 'Gas cost to user' },
          ].map((stat, i) => (
            <div key={i} className="flex items-center">
              <div className="text-center px-8">
                <p className="font-display text-amber-glow" style={{ fontSize: '28px' }}>{stat.value}</p>
                <p className="text-txt-tertiary text-xs mt-1">{stat.label}</p>
              </div>
              {i < 3 && <div className="hidden md:block w-px h-12" style={{ background: 'rgba(255,255,255,0.06)' }} />}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="glass glass-hover rounded-2xl p-6">
      <div className="mb-4">{icon}</div>
      <h3 className="text-txt-primary font-medium text-base leading-snug">{title}</h3>
      <p className="text-txt-secondary text-sm mt-3 leading-relaxed">{body}</p>
    </div>
  );
}

function LiveAgentCard() {
  const visibleLogs = useLogStream(LOG_LINES.length, 1500, 2000);

  return (
    <div
      className="glass rounded-2xl p-5 flex flex-col"
      style={{
        width: '420px',
        height: '520px',
        border: '1px solid rgba(123,110,246,0.2)',
        boxShadow: '0 0 60px rgba(123,110,246,0.08)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[10px] font-mono text-txt-secondary tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-glow live-dot" />
          LIVE CYCLE · SEPOLIA
        </span>
      </div>

      {/* Intent pill */}
      <div
        className="mt-4 rounded-lg px-3 py-2 text-xs text-txt-secondary"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        Maximize yield, drawdown &lt; 8%
      </div>

      {/* Delegation tree */}
      <div className="mt-6 relative" style={{ height: '150px' }}>
        {/* Orchestrator */}
        <div className="flex justify-center">
          <div
            className="rounded-lg px-4 py-2 text-center"
            style={{ background: 'rgba(123,110,246,0.12)', border: '1px solid rgba(123,110,246,0.35)' }}
          >
            <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: '#9B8FF8' }}>Orchestrator</p>
          </div>
        </div>

        {/* SVG flow lines */}
        <svg className="absolute left-0 right-0 w-full" style={{ top: '36px', height: '50px' }}>
          <line x1="50%" y1="0" x2="22%" y2="100%" stroke="#7B6EF6" strokeWidth="1.5" className="flow-line" opacity="0.6" />
          <line x1="50%" y1="0" x2="78%" y2="100%" stroke="#7B6EF6" strokeWidth="1.5" className="flow-line" opacity="0.6" />
        </svg>

        {/* Sub agents */}
        <div className="flex justify-between mt-[58px]">
          {[
            { label: 'Risk Agent', sub: '20 USDC' },
            { label: 'Yield Scanner', sub: '20 USDC' },
          ].map((a) => (
            <div
              key={a.label}
              className="rounded-lg px-3 py-2 text-center"
              style={{ background: 'rgba(78,205,196,0.12)', border: '1px solid rgba(78,205,196,0.3)' }}
            >
              <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: '#4ECDC4' }}>{a.label}</p>
              <p className="text-[10px] text-txt-tertiary mt-0.5">{a.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Log stream */}
      <div className="mt-6 flex-1 space-y-1.5 overflow-hidden">
        {LOG_LINES.slice(0, visibleLogs).map((line, i) => (
          <div key={i} className="log-in flex items-center justify-between font-mono text-[11px] text-txt-secondary">
            <span>{line.text}</span>
            <span className={line.status === '⟳' ? 'inline-block spin text-amber-glow' : 'text-teal-glow'}>
              {line.status}
            </span>
          </div>
        ))}
      </div>

      {/* Status bar */}
      <div
        className="mt-4 pt-3 text-[11px] text-amber-glow flex items-center justify-between"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span>Cycle 1 of ∞</span>
        <span>Est. yield gain: +$74/yr</span>
      </div>
    </div>
  );
}
