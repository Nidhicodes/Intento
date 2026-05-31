import type { Address, Hex } from 'viem';

// --- Intent & Permission ---
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

// --- Portfolio ---
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
  userAddress: Address;
}

// --- Agent Results ---
export interface RiskResult {
  volatility: Record<string, number>;
  maxDrawdown: Record<string, number>;
  correlationRisk: 'low' | 'medium' | 'high';
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

// --- Strategy ---
export interface StrategyTx {
  type: 'withdraw' | 'deposit' | 'swap';
  fromProtocol: string | null;
  toProtocol: string | null;
  token: string;
  amount: number;
  reason: string;
}

export interface Strategy {
  action: 'rebalance' | 'hold' | 'partial_rebalance';
  transactions: StrategyTx[];
  expectedNewApy: number;
  riskImpact: 'improved' | 'neutral' | 'worsened';
  totalValueMoved: number;
}

// --- Cycle ---
export type CycleStatus = 'running' | 'scoring' | 'executing' | 'completed' | 'failed' | 'held';

export interface CycleRecord {
  id: string;
  status: CycleStatus;
  startedAt: number;
  completedAt: number | null;

  // Permission context from user
  permissionContext: Hex | null;
  userAddress: Address | null;

  // Agent results
  riskResult: AgentOutput<RiskResult> | null;
  yieldResult: AgentOutput<YieldResult> | null;

  // Decision
  combinedConfidence: number | null;
  strategy: Strategy | null;

  // Execution
  txHash: string | null;
  error: string | null;
}

// --- Delegation Chain ---
export interface DelegationChainInfo {
  userAddress: Address;
  orchestratorAddress: Address;
  agents: Array<{
    role: string;
    address: Address;
    budgetUsdc: number;
  }>;
}
