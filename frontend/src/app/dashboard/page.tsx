'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCountUp, useCountdown } from '@/lib/hooks';
import { useGrant, clearGrant, type StoredGrant } from '@/lib/grant';
import { Address } from '@/components/AddressPill';
import { CostlySignal } from '@/components/CostlySignal';
import { redeemDelegation, attemptOverspend, type RedemptionResult } from '@/lib/api';
import { TrendingUp, Check, Zap, ChevronDown, ShieldCheck, ShieldX, Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const { grant, refresh } = useGrant();
  const [revoked, setRevoked] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const permissionActive = !!grant && !revoked;

  const handleRevoke = () => {
    clearGrant();
    setRevoked(true);
    refresh();
  };

  const scrollToPositions = () => {
    document.getElementById('positions')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex gap-6">
      <Sidebar
        grant={grant}
        permissionActive={permissionActive}
        onRevoke={handleRevoke}
        onScrollPositions={scrollToPositions}
        onOpenSettings={() => setShowSettings(true)}
      />
      <main className="flex-1 min-w-0 space-y-6">
        {!grant && !revoked && <NoGrantBanner />}
        {revoked && <RevokedBanner onRegrant={() => { setRevoked(false); }} />}

        <StatCards loading={loading} grant={grant} />

        {/* Centerpiece 1: the novelty — data spend as confidence */}
        {grant && (
          <CostlySignal userAddress={grant.smartAccount || grant.ownerAddress || ''} spec={grant.spec} />
        )}

        {/* Centerpiece 2: the headline proof — chain redeems, cap reverts */}
        {grant && grant.redelegations?.length > 0 && (
          <EnforcementProof grant={grant} />
        )}

        <DelegationChainPanel grant={grant} />
        <PositionsTable />
        <LastCyclePanel />
        <UpcomingCycle />
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}

// ---------- BANNERS ----------
function NoGrantBanner() {
  return (
    <div className="glass rounded-2xl p-4 flex items-center justify-between fade-page" style={{ borderLeft: '3px solid #E8B86D' }}>
      <div>
        <p className="text-amber-glow text-sm font-medium">No active permission</p>
        <p className="text-txt-tertiary text-xs mt-0.5">Grant agents a budget to start autonomous management.</p>
      </div>
      <Link href="/onboard">
        <button className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(232,184,109,0.15)', color: '#E8B86D', border: '1px solid rgba(232,184,109,0.3)' }}>
          Grant Permission →
        </button>
      </Link>
    </div>
  );
}

function RevokedBanner({ onRegrant }: { onRegrant: () => void }) {
  return (
    <div className="glass rounded-2xl p-4 flex items-center justify-between fade-page" style={{ borderLeft: '3px solid #F87171' }}>
      <div>
        <p className="text-rose-warn text-sm font-medium">Permission revoked</p>
        <p className="text-txt-tertiary text-xs mt-0.5">All agent delegations disabled. Agents can no longer act.</p>
      </div>
      <Link href="/onboard">
        <button onClick={onRegrant} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(232,184,109,0.15)', color: '#E8B86D', border: '1px solid rgba(232,184,109,0.3)' }}>
          Re-grant →
        </button>
      </Link>
    </div>
  );
}

// ---------- ENFORCEMENT PROOF (item 2) ----------
function EnforcementProof({ grant }: { grant: StoredGrant }) {
  const [setup, setSetup] = useState<import('@/lib/api').ProofSetup | null>(null);
  const [redeemState, setRedeemState] = useState<'idle' | 'running' | 'done'>('idle');
  const [redeemResult, setRedeemResult] = useState<RedemptionResult | null>(null);
  const [overspendState, setOverspendState] = useState<'idle' | 'running' | 'done'>('idle');
  const [overspendResult, setOverspendResult] = useState<RedemptionResult | null>(null);

  useEffect(() => {
    if (!grant.smartAccount) return;
    import('@/lib/api').then(({ getProofSetup }) => {
      getProofSetup(grant.smartAccount).then(setSetup).catch(() => {});
    });
  }, [grant.smartAccount]);

  const riskDelegation = grant.redelegations.find(r => r.agent === 'risk');

  const runRedeem = async () => {
    if (!riskDelegation) return;
    setRedeemState('running');
    try {
      const result = await redeemDelegation(riskDelegation.signedDelegation, grant.rootDelegation, 1);
      setRedeemResult(result);
    } catch (err: any) {
      setRedeemResult({ success: false, txHash: null, amountUsdc: 1, reverted: false, revertReason: err.message });
    }
    setRedeemState('done');
  };

  const runOverspend = async () => {
    if (!riskDelegation) return;
    setOverspendState('running');
    try {
      const result = await attemptOverspend(riskDelegation.signedDelegation, grant.rootDelegation);
      setOverspendResult(result);
    } catch (err: any) {
      setOverspendResult({ success: false, txHash: null, amountUsdc: 40, reverted: false, revertReason: err.message });
    }
    setOverspendState('done');
  };

  const notReady = setup && !setup.ready;

  return (
    <div className="glass rounded-2xl p-6" style={{ borderLeft: '3px solid #9B8FF8' }}>
      <h2 className="text-txt-primary font-medium text-sm flex items-center gap-2">
        <ShieldCheck size={16} style={{ color: '#9B8FF8' }} />
        Onchain Enforcement Proof
      </h2>
      <p className="text-txt-tertiary text-xs mt-1">
        Risk Agent has a 20 USDC cap. Prove the cap is enforced by the contract, not by code.
      </p>

      {/* Setup status */}
      {notReady && (
        <div className="mt-4 rounded-lg p-3 text-[11px]" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)' }}>
          <p className="text-amber-glow font-medium">Setup needed before proof can run:</p>
          <p className="text-txt-secondary mt-1">{setup?.note}</p>
          {setup && setup.usdcBalance === 0 && setup.userSmartAccount && (
            <div className="mt-2">
              <span className="text-txt-tertiary">Fund this address with test USDC: </span>
              <Address value={setup.userSmartAccount} className="text-[10px]" />
            </div>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 mt-5">
        {/* Within cap */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(78,205,196,0.06)', border: '1px solid rgba(78,205,196,0.2)' }}>
          <p className="text-txt-primary text-xs font-medium">Spend within cap</p>
          <p className="text-txt-tertiary text-[11px] mt-0.5">Redeem 1 USDC (≤ 20 cap) → should succeed</p>
          <button
            onClick={runRedeem}
            disabled={redeemState === 'running'}
            className="mt-3 text-xs px-3 py-1.5 rounded-lg w-full flex items-center justify-center gap-2"
            style={{ background: 'rgba(78,205,196,0.15)', color: '#4ECDC4', border: '1px solid rgba(78,205,196,0.3)' }}
          >
            {redeemState === 'running' ? <><Loader2 size={11} className="spin" /> Redeeming...</> : 'Redeem 1 USDC'}
          </button>
          {redeemResult && (
            <div className="mt-3 text-[11px] fade-page">
              {redeemResult.success ? (
                <div className="flex items-center gap-1.5 text-teal-glow flex-wrap">
                  <Check size={11} /> Succeeded
                  {redeemResult.txHash && (
                    <a href={`https://sepolia.basescan.org/tx/${redeemResult.txHash}`} target="_blank" rel="noreferrer" className="text-[10px] underline hover:text-amber-glow">
                      view tx ↗
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-txt-tertiary">{shorten(redeemResult.revertReason)}</p>
              )}
            </div>
          )}
        </div>

        {/* Overspend */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
          <p className="text-txt-primary text-xs font-medium">Attempt overspend</p>
          <p className="text-txt-tertiary text-[11px] mt-0.5">Redeem 40 USDC (&gt; 20 cap) → should REVERT</p>
          <button
            onClick={runOverspend}
            disabled={overspendState === 'running'}
            className="mt-3 text-xs px-3 py-1.5 rounded-lg w-full flex items-center justify-center gap-2"
            style={{ background: 'rgba(248,113,113,0.15)', color: '#F87171', border: '1px solid rgba(248,113,113,0.3)' }}
          >
            {overspendState === 'running' ? <><Loader2 size={11} className="spin" /> Testing...</> : 'Attempt 40 USDC'}
          </button>
          {overspendResult && (
            <div className="mt-3 text-[11px] fade-page">
              {overspendResult.reverted ? (
                <div className="flex items-center gap-1.5 text-teal-glow">
                  <ShieldX size={11} /> Reverted by contract ✓
                </div>
              ) : (
                <p className="text-rose-warn">{shorten(overspendResult.revertReason) || 'Did not revert'}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {overspendResult?.reverted && (
        <p className="text-teal-glow text-[11px] mt-4 fade-page">
          The contract rejected the overspend. The agent&apos;s budget is cryptographically enforced — no AI reasoning can exceed it.
        </p>
      )}
    </div>
  );
}

function shorten(s: string | null): string {
  if (!s) return '';
  return s.length > 80 ? s.slice(0, 80) + '...' : s;
}

// ---------- DELEGATION CHAIN PANEL ----------
function DelegationChainPanel({ grant }: { grant: StoredGrant | null }) {
  if (!grant || !grant.redelegations?.length) return null;

  return (
    <div className="glass rounded-2xl p-6">
      <h2 className="text-txt-primary font-medium text-sm mb-1">Active Delegation Chain</h2>
      <p className="text-txt-tertiary text-[11px] mb-4">Signed onchain from your single permission grant</p>

      <div className="space-y-1.5 font-mono text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#E8B86D' }} />
          <span className="text-txt-primary">You</span>
          <span className="text-txt-tertiary ml-auto">{grant.spec?.periodAmount || 100} USDC/wk</span>
        </div>
        <div className="flex items-center gap-2" style={{ paddingLeft: '20px' }}>
          <span className="text-txt-tertiary">└─</span>
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#9B8FF8' }} />
          <span className="text-txt-primary">Orchestrator</span>
          <Address value={grant.sessionAccount} className="text-[10px] ml-2" />
        </div>
        {grant.redelegations.map((r) => (
          <div key={r.agent} className="flex items-center gap-2" style={{ paddingLeft: '40px' }}>
            <span className="text-txt-tertiary">└─</span>
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#4ECDC4' }} />
            <span className="text-txt-primary capitalize">{r.agent} Agent</span>
            <span className="text-amber-glow ml-2">{r.budgetUsdc} USDC cap</span>
            <Address value={r.delegationHash} className="text-[10px] ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- SIDEBAR ----------
function Sidebar({ grant, permissionActive, onRevoke, onScrollPositions, onOpenSettings }: {
  grant: StoredGrant | null;
  permissionActive: boolean;
  onRevoke: () => void;
  onScrollPositions: () => void;
  onOpenSettings: () => void;
}) {
  const total = useCountUp(4247, 800, 2);
  const budgetTotal = grant?.spec?.periodAmount || 100;
  const budgetPct = 42;
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  return (
    <aside className="hidden lg:block w-60 shrink-0">
      <div className="glass rounded-2xl p-5 sticky top-20 space-y-6">
        {/* Portfolio summary */}
        <div>
          <p className="text-txt-tertiary text-xs uppercase tracking-wider">Your Portfolio</p>
          <p className="font-display text-amber-glow mt-1" style={{ fontSize: '28px' }}>
            ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-teal-glow text-xs mt-0.5">+$12.40 (+0.29%)</p>
          <Sparkline />
        </div>

        <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* Active permission */}
        <div>
          <p className="text-txt-tertiary text-xs uppercase tracking-wider mb-2">Active Permission</p>
          {permissionActive ? (
            <>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-txt-secondary">Weekly budget</span>
                <span className="text-txt-primary font-mono">{budgetTotal} USDC</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full bar-fill rounded-full" style={{ width: `${budgetPct}%`, background: '#E8B86D' }} />
              </div>
              <p className="text-txt-tertiary text-[10px] mt-1">{Math.round(budgetTotal * budgetPct / 100)} USDC spent this week</p>
              <div className="flex items-center justify-between mt-3 text-xs">
                <span className="text-txt-secondary">Expiry</span>
                <span className="text-txt-primary">30 days</span>
              </div>

              {confirmRevoke ? (
                <div className="mt-2 flex items-center gap-2">
                  <button onClick={() => { onRevoke(); setConfirmRevoke(false); }} className="text-rose-warn text-xs px-2 py-1 rounded" style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)' }}>
                    Confirm revoke
                  </button>
                  <button onClick={() => setConfirmRevoke(false)} className="text-txt-tertiary text-xs hover:text-txt-secondary">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmRevoke(true)} className="text-rose-warn text-xs mt-2 hover:underline">Revoke</button>
              )}
            </>
          ) : (
            <p className="text-txt-tertiary text-xs">No active permission</p>
          )}
        </div>

        <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* Agent status */}
        <div className="space-y-2">
          <AgentStatus dot={permissionActive ? '#9B8FF8' : '#5C5A56'} label="Orchestrator" status={permissionActive ? 'Idle' : 'Disabled'} />
          <AgentStatus dot={permissionActive ? '#4ECDC4' : '#5C5A56'} label="Risk Agent" status={permissionActive ? 'Ready' : 'Disabled'} />
          <AgentStatus dot={permissionActive ? '#4ECDC4' : '#5C5A56'} label="Yield Scanner" status={permissionActive ? 'Ready' : 'Disabled'} />
        </div>

        <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* Nav links */}
        <div className="space-y-1 text-sm">
          <p className="text-amber-glow">Portfolio</p>
          <button onClick={onScrollPositions} className="block text-left text-txt-secondary hover:text-txt-primary cursor-pointer transition-colors">Positions</button>
          <Link href="/audit" className="block text-txt-secondary hover:text-txt-primary transition-colors">Audit Trail</Link>
          <button onClick={onOpenSettings} className="block text-left text-txt-secondary hover:text-txt-primary cursor-pointer transition-colors">Settings</button>
        </div>
      </div>
    </aside>
  );
}

function AgentStatus({ dot, label, status }: { dot: string; label: string; status: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
      <span className="text-txt-primary">{label}</span>
      <span className="text-txt-tertiary ml-auto">{status}</span>
    </div>
  );
}

function Sparkline() {
  const pts = [20, 18, 22, 19, 24, 23, 27, 30];
  const max = Math.max(...pts), min = Math.min(...pts);
  const path = pts.map((p, i) => {
    const x = (i / (pts.length - 1)) * 100;
    const y = 30 - ((p - min) / (max - min)) * 26;
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 100 32" className="w-full mt-2" style={{ height: '32px' }}>
      <path d={path} fill="none" stroke="#4ECDC4" strokeWidth="1.5" />
    </svg>
  );
}

// ---------- STAT CARDS ----------
function StatCards({ loading, grant }: { loading: boolean; grant: StoredGrant | null }) {
  if (loading) {
    return (
      <div className="grid md:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => <div key={i} className="glass rounded-2xl p-6 h-32 skeleton" />)}
      </div>
    );
  }
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <ApyCard />
      <ActivityCard />
      <GasCard />
    </div>
  );
}

function ApyCard() {
  const apy = useCountUp(8.2, 800, 1);
  return (
    <div className="glass glass-hover rounded-2xl p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-amber-glow" style={{ fontSize: '40px' }}>{apy.toFixed(1)}%</p>
          <p className="text-txt-secondary text-xs mt-1">Weighted avg APY</p>
          <p className="text-txt-tertiary text-[11px] mt-0.5">vs 4.1% before Intento</p>
        </div>
        <TrendingUp size={18} style={{ color: '#4ECDC4' }} />
      </div>
    </div>
  );
}

function ActivityCard() {
  const count = useCountUp(1, 800);
  return (
    <div className="glass glass-hover rounded-2xl p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-txt-primary" style={{ fontSize: '40px' }}>{count}</p>
          <p className="text-txt-secondary text-xs mt-1">Rebalances executed</p>
          <p className="text-txt-tertiary text-[11px] mt-0.5">Last: 6 hours ago</p>
        </div>
        <Check size={18} style={{ color: '#4ECDC4' }} />
      </div>
    </div>
  );
}

function GasCard() {
  return (
    <div className="glass glass-hover rounded-2xl p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-teal-glow" style={{ fontSize: '40px' }}>$0.00</p>
          <p className="text-txt-secondary text-xs mt-1">ETH spent on gas</p>
          <p className="text-txt-tertiary text-[11px] mt-0.5">1.2 USDC paid via 1Shot</p>
        </div>
        <Zap size={18} style={{ color: '#E8B86D' }} />
      </div>
    </div>
  );
}

// ---------- POSITIONS ----------
function PositionsTable() {
  const rows = [
    { protocol: 'Compound V3', token: 'USDC', deposited: '1,800 USDC', apy: '8.2%', value: '$1,812.40', pnl: '+$12.40' },
    { protocol: 'Aave V3', token: 'USDT', deposited: '2,400 USDC', apy: '7.1%', value: '$2,434.60', pnl: '+$34.60' },
  ];
  return (
    <div id="positions" className="glass rounded-2xl p-6 scroll-mt-20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-txt-primary font-medium text-sm">Current Positions</h2>
        <span className="text-txt-tertiary text-[11px]">Last updated 6h ago</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-txt-tertiary text-xs" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <th className="text-left font-normal pb-2">Protocol</th>
            <th className="text-left font-normal pb-2">Token</th>
            <th className="text-left font-normal pb-2">Deposited</th>
            <th className="text-left font-normal pb-2">APY</th>
            <th className="text-left font-normal pb-2">Value</th>
            <th className="text-right font-normal pb-2">P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <td className="py-3 text-txt-primary">{r.protocol}</td>
              <td className="py-3 text-txt-secondary">{r.token}</td>
              <td className="py-3 text-txt-secondary font-mono text-xs">{r.deposited}</td>
              <td className="py-3 text-amber-glow">{r.apy}</td>
              <td className="py-3 text-txt-primary font-mono text-xs">{r.value}</td>
              <td className="py-3 text-right text-teal-glow font-mono text-xs">{r.pnl}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-txt-tertiary text-[11px] mt-4">
        Intento will add more positions as better yield opportunities arise.
      </p>
    </div>
  );
}

// ---------- LAST CYCLE ----------
function LastCyclePanel() {
  const [expanded, setExpanded] = useState(false);
  const steps = [
    { label: 'Intent parsed', sub: null },
    { label: 'Delegations created', sub: null },
    { label: 'Data purchased', sub: '38 USDC across 2 agents' },
    { label: 'Strategy decided', sub: 'Confidence: 0.87' },
    { label: 'Executed', sub: 'via 1Shot · 1.2 USDC gas' },
  ];

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-txt-primary font-medium text-sm">Last Rebalancing Cycle</h2>
        <span className="text-txt-tertiary text-[11px]">6 hours ago</span>
      </div>

      <div className="flex items-center justify-between relative">
        {steps.map((step, i) => (
          <div key={i} className="flex flex-col items-center flex-1 relative">
            {i < steps.length - 1 && (
              <div className="absolute top-3 left-1/2 w-full h-px" style={{ background: 'rgba(232,184,109,0.3)' }} />
            )}
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] relative z-10" style={{ background: 'rgba(232,184,109,0.15)', border: '1px solid rgba(232,184,109,0.4)', color: '#E8B86D' }}>✓</div>
            <p className="text-txt-primary text-[11px] mt-2 text-center">{step.label}</p>
            {step.sub && <p className="text-txt-tertiary text-[10px] text-center mt-0.5">{step.sub}</p>}
          </div>
        ))}
      </div>

      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 text-xs text-txt-secondary mt-6 hover:text-txt-primary transition-colors">
        <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        View agent spend breakdown
      </button>

      {expanded && (
        <div className="grid md:grid-cols-2 gap-4 mt-4 fade-page">
          <AgentBreakdown name="Risk Agent" budget={20} spent={18} confidence={0.9} finding="Vol LOW · drawdown risk 3.2%" />
          <AgentBreakdown name="Yield Scanner" budget={20} spent={20} confidence={1.0} finding="Compound USDC 8.2% > Aave 4.1%" />
        </div>
      )}
    </div>
  );
}

function AgentBreakdown({ name, budget, spent, confidence, finding }: {
  name: string; budget: number; spent: number; confidence: number; finding: string;
}) {
  const pct = (spent / budget) * 100;
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-txt-primary text-sm font-medium mb-3">{name}</p>
      <div className="space-y-1.5 text-xs">
        <Row label="Budget" value={`${budget} USDC`} />
        <Row label="Spent" value={`${spent} USDC`} />
        <Row label="Remaining" value={`${budget - spent} USDC`} />
        <Row label="Confidence" value={confidence.toFixed(2)} highlight />
      </div>
      <div className="h-1.5 rounded-full overflow-hidden mt-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full bar-fill rounded-full" style={{ width: `${pct}%`, background: '#E8B86D' }} />
      </div>
      <p className="text-txt-secondary text-[11px] mt-3">{finding}</p>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-txt-tertiary">{label}</span>
      <span className={highlight ? 'text-amber-glow font-mono' : 'text-txt-primary font-mono'}>{value}</span>
    </div>
  );
}

// ---------- UPCOMING ----------
function UpcomingCycle() {
  const countdown = useCountdown(5 * 3600 + 32 * 60);
  return (
    <div className="glass rounded-2xl p-6" style={{ opacity: 0.7 }}>
      <div className="flex items-center justify-between">
        <span className="text-txt-secondary text-sm">Next cycle</span>
        <span className="font-mono text-amber-glow text-sm">{countdown}</span>
      </div>
    </div>
  );
}

// ---------- SETTINGS MODAL ----------
function SettingsModal({ onClose }: { onClose: () => void }) {
  const [budget, setBudget] = useState(100);
  const [autoRebalance, setAutoRebalance] = useState(true);
  const [riskTolerance, setRiskTolerance] = useState('medium');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ background: 'rgba(9,9,15,0.85)' }} onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-md fade-page" onClick={(e) => e.stopPropagation()} style={{ borderRadius: '20px' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-txt-primary font-medium text-base">Settings</h2>
          <button onClick={onClose} className="text-txt-tertiary hover:text-txt-primary transition-colors">✕</button>
        </div>

        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-txt-secondary text-sm">Weekly budget</label>
              <span className="text-amber-glow font-mono text-sm">{budget} USDC</span>
            </div>
            <input type="range" min={50} max={500} step={10} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="w-full" style={{ accentColor: '#C9933A' }} />
            <div className="flex justify-between text-[10px] text-txt-tertiary mt-1"><span>50</span><span>500</span></div>
          </div>

          <div>
            <label className="text-txt-secondary text-sm block mb-2">Risk tolerance</label>
            <div className="flex gap-2">
              {['low', 'medium', 'high'].map((level) => (
                <button key={level} onClick={() => setRiskTolerance(level)} className="flex-1 py-2 rounded-lg text-xs capitalize transition-all" style={{ background: riskTolerance === level ? 'rgba(232,184,109,0.15)' : 'rgba(255,255,255,0.035)', border: `1px solid ${riskTolerance === level ? 'rgba(232,184,109,0.4)' : 'rgba(255,255,255,0.07)'}`, color: riskTolerance === level ? '#E8B86D' : 'var(--color-txt-secondary)' }}>
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-txt-secondary text-sm">Auto-rebalance</label>
              <p className="text-txt-tertiary text-[11px]">Run cycles automatically every week</p>
            </div>
            <button onClick={() => setAutoRebalance(!autoRebalance)} className="w-11 h-6 rounded-full transition-all relative" style={{ background: autoRebalance ? '#C9933A' : 'rgba(255,255,255,0.1)' }}>
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: autoRebalance ? '22px' : '2px' }} />
            </button>
          </div>
        </div>

        <button onClick={onClose} className="cta-amber w-full mt-6 rounded-lg text-white font-semibold" style={{ background: '#C9933A', height: '44px', fontSize: '14px' }}>
          Save Settings
        </button>
      </div>
    </div>
  );
}
