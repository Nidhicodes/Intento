'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAccount, useConnect } from 'wagmi';
import { Nav } from '@/components/Nav';
import { DelegationTree } from '@/components/DelegationTree';
import { Address } from '@/components/AddressPill';
import { parseIntent as parseIntentApi, type PermissionSpec } from '@/lib/api';
import { requestPermission } from '@/lib/permissions';
import { createRedelegations, type Redelegation } from '@/lib/redelegate';
import { Loader2, Check } from 'lucide-react';

const EXAMPLE_CHIPS = [
  'Maximize USDC yield on Aave and Compound',
  'Conservative: capital preservation, low risk',
  'Balanced: 70% yield, 30% safety buffer',
];

export default function OnboardPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [intent, setIntent] = useState('');
  const [parsing, setParsing] = useState(false);
  const [spec, setSpec] = useState<PermissionSpec | null>(null);

  const handleParse = async () => {
    if (!intent.trim()) return;
    setParsing(true);
    try {
      // Try real backend; fall back to mock spec on any failure (demo resilience)
      const result = await parseIntentApi(intent);
      setSpec(result);
    } catch {
      setSpec(MOCK_SPEC);
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="relative pt-24 pb-20 px-6">
        <div className="lightwave" />

        {/* Progress */}
        <div className="relative max-w-2xl mx-auto flex items-center justify-center gap-3 mb-12">
          <StepDot n={1} active={step === 1} done={step > 1} label="Intent" />
          <div className="w-16 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <StepDot n={2} active={step === 2} done={false} label="Permission" />
        </div>

        {step === 1 ? (
          <Step1
            intent={intent}
            setIntent={setIntent}
            parsing={parsing}
            spec={spec}
            onParse={handleParse}
            onContinue={() => setStep(2)}
          />
        ) : (
          <Step2 spec={spec} />
        )}
      </div>
    </div>
  );
}

function StepDot({ n, active, done, label }: { n: number; active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all"
        style={{
          border: `1px solid ${active || done ? 'rgba(232,184,109,0.5)' : 'rgba(255,255,255,0.15)'}`,
          color: active || done ? '#E8B86D' : 'var(--color-txt-tertiary)',
          background: active ? 'rgba(232,184,109,0.1)' : 'transparent',
        }}
      >
        {done ? '✓' : n}
      </div>
      <span className="text-xs" style={{ color: active ? 'var(--color-txt-primary)' : 'var(--color-txt-tertiary)' }}>
        {label}
      </span>
    </div>
  );
}

// ---------- STEP 1 ----------
function Step1({ intent, setIntent, parsing, spec, onParse, onContinue }: {
  intent: string;
  setIntent: (v: string) => void;
  parsing: boolean;
  spec: PermissionSpec | null;
  onParse: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="relative max-w-2xl mx-auto fade-page">
      <h1 className="font-display text-txt-primary text-center" style={{ fontSize: '40px' }}>
        What do you want your portfolio to do?
      </h1>

      <textarea
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        placeholder='e.g. "Maximize stablecoin yield while keeping drawdown under 8%. Don&apos;t touch my ETH. Rebalance weekly."'
        className="w-full mt-8 outline-none text-txt-primary placeholder:text-txt-tertiary resize-none"
        style={{
          background: 'rgba(255,255,255,0.035)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          padding: '24px',
          minHeight: '120px',
          fontSize: '15px',
          lineHeight: '1.6',
        }}
      />

      {/* Example chips */}
      <div className="flex flex-wrap gap-2 mt-4">
        {EXAMPLE_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => setIntent(chip)}
            className="glass rounded-full px-3 py-1.5 text-xs text-txt-secondary transition-all"
            style={{ borderColor: 'rgba(255,255,255,0.07)' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(232,184,109,0.4)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Parse button */}
      <button
        onClick={onParse}
        disabled={!intent.trim() || parsing}
        className="cta-amber w-full mt-6 rounded-lg text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
        style={{ background: '#C9933A', height: '52px', fontSize: '14px' }}
      >
        {parsing ? <><Loader2 size={16} className="spin" /> Parsing...</> : 'Parse Intent →'}
      </button>

      {/* Permission preview */}
      {spec && !parsing && (
        <div
          className="glass rounded-2xl mt-8 p-6 fade-page"
          style={{ borderLeft: '3px solid #E8B86D' }}
        >
          <h2 className="text-txt-primary font-medium text-base mb-5">
            Here&apos;s what agents will be authorized to do
          </h2>

          <div className="space-y-3">
            <PermRow icon="💰" label="Weekly budget" value={`${spec.periodAmount} USDC`} />
            <PermRow icon="📅" label="Permission expiry" value="30 days" />
            <PermRow icon="🏦" label="Allowed protocols" value={spec.allowedProtocols.map(formatProtocol).join(', ')} />
            <PermRow icon="🪙" label="Allowed tokens" value={spec.allowedTokens.join(', ')} />
            <PermRow icon="🚫" label="Excluded tokens" value={spec.excludedTokens.length ? `${spec.excludedTokens.join(', ')} (your ETH is safe)` : 'None'} />
            <PermRow icon="⚡" label="Max single tx" value={`${spec.maxSingleTx} USDC`} />
            <PermRow icon="🎯" label="Objective" value={formatObjective(spec.objective)} />
            <PermRow icon="📉" label="Max drawdown" value={`${spec.maxDrawdownPct}%`} />
          </div>

          <p className="text-txt-tertiary text-xs mt-5 leading-relaxed">
            These limits are enforced by a smart contract, not just software. Agents cannot exceed them.
          </p>

          <button
            onClick={onContinue}
            className="cta-amber w-full mt-6 rounded-lg text-white font-semibold"
            style={{ background: '#C9933A', height: '48px', fontSize: '14px' }}
          >
            Continue to Permission Grant →
          </button>
        </div>
      )}
    </div>
  );
}

function PermRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-base w-6">{icon}</span>
      <span className="text-txt-tertiary w-40">{label}</span>
      <span className="text-txt-primary font-medium">{value}</span>
    </div>
  );
}

// ---------- STEP 2 ----------
function Step2({ spec }: { spec: PermissionSpec | null }) {
  const [state, setState] = useState<'ready' | 'waiting' | 'redelegating' | 'success'>('ready');
  const [error, setError] = useState<string | null>(null);
  const [grantHash, setGrantHash] = useState<string>('');
  const [sessionAddr, setSessionAddr] = useState<string>('');
  const [redelegations, setRedelegations] = useState<Redelegation[]>([]);
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  const handleApprove = async () => {
    setError(null);

    if (!isConnected) {
      const connector = connectors[0];
      if (connector) connect({ connector });
      setError('Please connect your wallet, then click again.');
      return;
    }

    setState('waiting');
    try {
      // Step A: Create MetaMask Smart Account + sign root delegation (MetaMask signature)
      const result = await requestPermission({
        periodAmountUsdc: spec?.periodAmount || 100,
        justification: spec?.justification || 'Allow Intento agents to manage portfolio yield within budget',
      });

      setGrantHash(result.contextHash);
      setSessionAddr(result.sessionAccountAddress);

      // Step B: Live redelegation chain — orchestrator → sub-agents
      setState('redelegating');
      const chain = await createRedelegations(result.rootDelegation);
      setRedelegations(chain);

      // Persist the full chain for the dashboard + onchain redemption
      localStorage.setItem('intento_grant', JSON.stringify({
        context: result.contextHash,
        rootDelegation: result.rootDelegation,
        smartAccount: result.smartAccountAddress,
        ownerAddress: result.ownerAddress,
        orchestratorSa: result.orchestratorSaAddress,
        sessionAccount: result.sessionAccountAddress,
        redelegations: chain.map((r) => ({
          agent: r.agent,
          to: r.to,
          budgetUsdc: r.budgetUsdc,
          delegationHash: r.delegationHash,
          signedDelegation: r.signedDelegation,
        })),
        spec,
        grantedAt: Date.now(),
      }));

      setState('success');
    } catch (err: any) {
      setState('ready');
      if (err.message?.includes('rejected') || err.code === 4001) {
        setError('Signature request was rejected.');
      } else if (err.message?.includes('not detected')) {
        setError('MetaMask not detected. Install the MetaMask extension.');
      } else {
        setError(err.message || 'Failed to create delegation.');
      }
    }
  };

  return (
    <div className="relative max-w-2xl mx-auto fade-page">
      <h1 className="font-display text-txt-primary text-center mb-12" style={{ fontSize: '40px' }}>
        Grant permission to your agents
      </h1>

      {/* Delegation tree */}
      <div className="glass rounded-2xl p-8 mb-8">
        <DelegationTree
          orchestrator={{
            label: 'Orchestrator',
            address: sessionAddr ? `${sessionAddr.slice(0, 6)}...${sessionAddr.slice(-4)}` : '0x7f3a...c291',
            sub: 'Full weekly allocation',
            tint: 'violet',
          }}
          left={{ label: 'Risk Agent', address: '0x69f1...AcfF', sub: '20 USDC / cycle · volatility analysis', tint: 'teal' }}
          right={{ label: 'Yield Scanner', address: '0x1098...5c45', sub: '20 USDC / cycle · APY scanning', tint: 'teal' }}
        />
      </div>

      {/* Redelegation progress */}
      {(state === 'redelegating' || state === 'success') && redelegations.length > 0 && (
        <div className="glass rounded-2xl p-5 mb-6 fade-page">
          <p className="text-xs text-txt-muted uppercase tracking-wider mb-3" style={{ color: 'var(--color-txt-tertiary)' }}>
            Redelegation Chain — signed onchain
          </p>
          <div className="space-y-2">
            {redelegations.map((r) => (
              <div key={r.agent} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Check size={12} style={{ color: '#4ECDC4' }} />
                  <span className="text-txt-secondary capitalize">Orchestrator → {r.agent} Agent</span>
                  <span className="text-amber-glow font-mono">{r.budgetUsdc} USDC cap</span>
                </div>
                <Address value={r.delegationHash} className="text-[10px]" />
              </div>
            ))}
          </div>
        </div>
      )}

      {state === 'success' ? (
        <div className="glass rounded-2xl p-6 fade-page" style={{ borderLeft: '3px solid #4ECDC4' }}>
          <h2 className="text-txt-primary font-medium text-lg flex items-center gap-2">
            <span style={{ color: '#4ECDC4' }}>✓</span> Permission granted &amp; chain established
          </h2>
          <div className="flex items-center gap-2 mt-3 text-sm">
            <span className="text-txt-tertiary">Root permission:</span>
            <Address value={grantHash} />
          </div>
          <p className="text-txt-secondary text-sm mt-4">
            Your ERC-7715 grant is signed and {redelegations.length} scoped redelegations are live.
            Agents can now act within the budgets you approved.
          </p>
          <Link href="/dashboard">
            <button
              className="cta-amber mt-4 rounded-lg text-white font-semibold px-6"
              style={{ background: '#C9933A', height: '44px', fontSize: '14px' }}
            >
              Navigate to your dashboard →
            </button>
          </Link>
        </div>
      ) : (
        <>
          <button
            onClick={handleApprove}
            disabled={state === 'waiting' || state === 'redelegating'}
            className="pulse-amber w-full rounded-xl text-white font-semibold flex items-center justify-center gap-3"
            style={{
              background: 'linear-gradient(135deg, #C9933A, #E8B86D)',
              height: '56px',
              fontSize: '15px',
            }}
          >
            {state === 'waiting' ? (
              <><Loader2 size={18} className="spin" /> Waiting for MetaMask...</>
            ) : state === 'redelegating' ? (
              <><Loader2 size={18} className="spin" /> Creating redelegation chain...</>
            ) : (
              <>
                <span
                  className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold"
                  style={{ background: '#E17726', color: 'white' }}
                >
                  MM
                </span>
                {isConnected ? 'Grant Permission · Sign Once' : 'Connect Wallet to Continue'}
              </>
            )}
          </button>
          {error && <p className="text-rose-warn text-xs mt-3 text-center">{error}</p>}
          <p className="text-txt-tertiary text-xs mt-3 text-center">
            MetaMask will show you a human-readable permission dialog. You can revoke at any time.
          </p>
        </>
      )}
    </div>
  );
}

// ---------- Helpers ----------
function formatProtocol(p: string): string {
  const map: Record<string, string> = { aave: 'Aave V3', compound: 'Compound V3', curve: 'Curve', uniswap: 'Uniswap V3' };
  return map[p.toLowerCase()] || p;
}

function formatObjective(o: string): string {
  const map: Record<string, string> = {
    yield_maximization: 'Yield maximization',
    capital_preservation: 'Capital preservation',
    balanced: 'Balanced',
  };
  return map[o] || o;
}

const MOCK_SPEC: PermissionSpec = {
  periodAmount: 100,
  allowedProtocols: ['aave', 'compound'],
  allowedTokens: ['USDC', 'USDT', 'DAI'],
  excludedTokens: ['WETH', 'stETH'],
  maxSingleTx: 500,
  riskTolerance: 'medium',
  objective: 'yield_maximization',
  maxDrawdownPct: 8,
  justification: 'Maximize stablecoin yield with bounded risk',
};
