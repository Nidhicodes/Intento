'use client';

import { useState } from 'react';
import { runCycle, getCycle, type CycleRecord, type PermissionSpec, type Portfolio } from '@/lib/api';
import { Activity, Loader2 } from 'lucide-react';

/**
 * Costly Signal centerpiece.
 *
 * Runs a real orchestration cycle and visualizes the novel mechanism:
 * agents buy market data iteratively, each x402 purchase costs real USDC
 * (capped onchain), and the orchestrator weights each agent's recommendation
 * by how much budget it committed to evidence. Trust = capital spent, not text.
 */
export function CostlySignal({ userAddress, spec }: { userAddress: string; spec: PermissionSpec | null }) {
  const [running, setRunning] = useState(false);
  const [cycle, setCycle] = useState<CycleRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    setCycle(null);
    try {
      const portfolio: Portfolio = {
        positions: [
          { protocol: 'aave', token: 'USDC', amount: 1800, apy: 0.041, valueUsd: 1800 },
          { protocol: 'compound', token: 'USDT', amount: 700, apy: 0.035, valueUsd: 700 },
        ],
        totalValueUsd: 2500,
        userAddress,
      };
      const effectiveSpec: PermissionSpec = spec || {
        periodAmount: 100, allowedProtocols: ['aave', 'compound'], allowedTokens: ['USDC', 'USDT', 'DAI'],
        excludedTokens: ['WETH', 'stETH'], maxSingleTx: 500, riskTolerance: 'medium',
        objective: 'yield_maximization', maxDrawdownPct: 8, justification: 'demo',
      };
      const { cycleId } = await runCycle(portfolio, effectiveSpec);
      // poll until terminal
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 800));
        const c = await getCycle(cycleId);
        setCycle(c);
        if (['completed', 'failed', 'held'].includes(c.status)) break;
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const risk = cycle?.riskResult;
  const yld = cycle?.yieldResult;

  return (
    <div className="glass2" style={{ borderRadius: 14, padding: 24, borderLeft: '3px solid var(--violet-500)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} style={{ color: 'var(--violet-500)' }} />
            Data Spend = Confidence
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
            Agents buy market data via x402. The more budget they commit to evidence, the more the orchestrator trusts them. Trust is earned with capital, not claimed with text.
          </p>
        </div>
        <button
          onClick={run}
          disabled={running}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, border: 'none',
            background: 'rgba(140,120,255,0.15)', color: 'var(--violet-500)', fontSize: 13, fontWeight: 500,
          }}
        >
          {running ? <><Loader2 size={13} className="animate-spin" /> Running cycle…</> : 'Run Live Cycle'}
        </button>
      </div>

      {error && <p style={{ color: 'var(--rose-400)', fontSize: 12, marginTop: 12 }}>{error}</p>}

      {(risk || yld) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
          {risk && <AgentSpend label="Risk Agent" output={risk} accent="#4ECFC8" />}
          {yld && <AgentSpend label="Yield Scanner" output={yld} accent="#DCA850" />}
        </div>
      )}

      {cycle?.combinedConfidence != null && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-dim)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--text-1)' }}>
            Combined confidence — weighted by capital each agent committed to evidence
          </span>
          <span className="mono" style={{ fontSize: 18, color: cycle.combinedConfidence >= 0.4 ? 'var(--teal-400)' : 'var(--amber-300)' }}>
            {(cycle.combinedConfidence * 100).toFixed(0)}%
            <span style={{ fontSize: 12, color: 'var(--text-2)', marginLeft: 8 }}>
              {cycle.combinedConfidence >= 0.4 ? '→ execute' : '→ hold'}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

function AgentSpend({ label, output, accent }: { label: string; output: any; accent: string }) {
  const buys = output.dataBuys || [];
  const pct = (output.usdcSpent / output.budget) * 100;

  return (
    <div style={{ background: 'var(--glass-1)', border: '1px solid var(--border-dim)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-0)' }}>{label}</span>
        <span className="mono" style={{ fontSize: 13, color: accent }}>
          {output.usdcSpent} / {output.budget} USDC
        </span>
      </div>

      {/* Per-buy ticks accumulating */}
      <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
        {buys.map((b: any) => (
          <div key={b.call} title={`Buy #${b.call}: ${b.costUsdc} USDC → sufficiency ${(b.sufficiencyAfter * 100).toFixed(0)}%`}
            style={{ flex: 1, height: 28, borderRadius: 6, background: accent, opacity: 0.35 + b.sufficiencyAfter * 0.65,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}
            className="mono">
            {b.costUsdc}
          </div>
        ))}
        {/* unfilled budget remainder */}
        {output.usdcSpent < output.budget && (
          <div style={{ flex: (output.budget - output.usdcSpent) / 6, height: 28, borderRadius: 6, border: '1px dashed var(--border-mid)' }} />
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{buys.length} data {buys.length === 1 ? 'buy' : 'buys'}</span>
        <span className="mono" style={{ fontSize: 11, color: accent }}>confidence {(output.confidence * 100).toFixed(0)}%</span>
      </div>

      {/* Spend bar */}
      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: accent, transition: 'width 0.6s ease-out' }} />
      </div>
    </div>
  );
}
