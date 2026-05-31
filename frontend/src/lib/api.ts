/**
 * API client for the Intento backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface PermissionSpec {
  periodAmount: number;
  allowedProtocols: string[];
  allowedTokens: string[];
  excludedTokens: string[];
  maxSingleTx: number;
  riskTolerance: 'low' | 'medium' | 'high';
  objective: 'yield_maximization' | 'capital_preservation' | 'balanced';
  maxDrawdownPct: number;
  justification: string;
}

export interface Position {
  protocol: string;
  token: string;
  amount: number;
  apy: number;
  valueUsd: number;
}

export interface Portfolio {
  positions: Position[];
  totalValueUsd: number;
  userAddress: string;
}

export interface DataBuy {
  call: number;
  costUsdc: number;
  sufficiencyAfter: number;
}

export interface AgentOutput<T> {
  data: T;
  usdcSpent: number;
  budget: number;
  confidence: number;
  durationMs: number;
  dataBuys?: DataBuy[];
}

export interface RiskResult {
  volatility: Record<string, number>;
  maxDrawdown: Record<string, number>;
  correlationRisk: string;
  riskScore: number;
}

export interface YieldResult {
  opportunities: Array<{
    protocol: string;
    token: string;
    apy: number;
    tvl: number;
    riskFlags: string[];
  }>;
  recommendedMove: {
    from: { protocol: string; token: string; amount: number };
    to: { protocol: string; token: string };
    expectedApy: number;
    reason: string;
  } | null;
}

export interface Strategy {
  action: 'rebalance' | 'hold' | 'partial_rebalance';
  transactions: Array<{
    type: string;
    fromProtocol: string | null;
    toProtocol: string | null;
    token: string;
    amount: number;
    reason: string;
  }>;
  expectedNewApy: number;
  riskImpact: string;
  totalValueMoved: number;
}

export interface CycleRecord {
  id: string;
  status: 'running' | 'scoring' | 'executing' | 'completed' | 'failed' | 'held';
  startedAt: number;
  completedAt: number | null;
  permissionContext: string | null;
  userAddress: string | null;
  riskResult: AgentOutput<RiskResult> | null;
  yieldResult: AgentOutput<YieldResult> | null;
  combinedConfidence: number | null;
  strategy: Strategy | null;
  txHash: string | null;
  error: string | null;
}

// --- API Calls ---

export async function parseIntent(intent: string): Promise<PermissionSpec> {
  const res = await fetch(`${API_BASE}/api/intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to parse intent');
  }
  const data = await res.json();
  return data.spec;
}

export async function runCycle(portfolio: Portfolio, spec: PermissionSpec): Promise<{ cycleId: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/cycle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portfolio, spec }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to start cycle');
  }
  return res.json();
}

export async function getCycle(id: string): Promise<CycleRecord> {
  const res = await fetch(`${API_BASE}/api/cycle/${id}`);
  if (!res.ok) throw new Error('Cycle not found');
  return res.json();
}

export async function getAllCycles(): Promise<CycleRecord[]> {
  const res = await fetch(`${API_BASE}/api/cycles`);
  if (!res.ok) return [];
  return res.json();
}

export async function getHealth(): Promise<{ status: string; chain: string }> {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

// --- Redemption (onchain enforcement proof) ---

export interface RedemptionResult {
  success: boolean;
  txHash: string | null;
  amountUsdc: number;
  reverted: boolean;
  revertReason: string | null;
}

export interface ProofSetup {
  userSmartAccount: string | null;
  usdcBalance: number;
  riskAgent: string;
  ready: boolean;
  note: string;
}

export async function getProofSetup(userSmartAccount: string): Promise<ProofSetup> {
  const res = await fetch(`${API_BASE}/api/proof/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userSmartAccount }),
  });
  if (!res.ok) throw new Error('Failed to fetch proof setup');
  return res.json();
}

export async function redeemDelegation(
  riskRedelegation: any,
  rootDelegation: any,
  amountUsdc: number
): Promise<RedemptionResult> {
  const res = await fetch(`${API_BASE}/api/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ riskRedelegation, rootDelegation, amountUsdc }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Redemption failed');
  }
  return res.json();
}

export async function attemptOverspend(
  riskRedelegation: any,
  rootDelegation: any
): Promise<RedemptionResult> {
  const res = await fetch(`${API_BASE}/api/overspend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ riskRedelegation, rootDelegation }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Overspend test failed');
  }
  return res.json();
}
