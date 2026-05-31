import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type Chain,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import { getSmartAccountsEnvironment, contracts } from '@metamask/smart-accounts-kit';

export const { DelegationManager } = contracts;

// --- Chain Selection ---
const isMainnet = process.env.CHAIN === 'base';
export const chain: Chain = isMainnet ? base : baseSepolia;
export const chainId = chain.id;

// --- Token Addresses ---
export const USDC: Address = isMainnet
  ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
  : '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

export const environment = getSmartAccountsEnvironment(chainId);

const rpcUrl = process.env.RPC_URL || (isMainnet ? 'https://mainnet.base.org' : 'https://sepolia.base.org');

export const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

// --- Agent accounts (lazy — only when keys present at runtime) ---
export function riskAccount() {
  return privateKeyToAccount(process.env.RISK_AGENT_PRIVATE_KEY as Hex);
}

// --- Constants ---
export const CONFIDENCE_THRESHOLD = 0.4;
export const RISK_WEIGHT = 0.4;
export const YIELD_WEIGHT = 0.6;

// --- LLM (Groq for dev, Venice for the Venice track) ---
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'groq';
export const VENICE_API_URL = LLM_PROVIDER === 'venice' ? 'https://api.venice.ai/api/v1' : 'https://api.groq.com/openai/v1';
export const VENICE_MODEL = LLM_PROVIDER === 'venice' ? 'llama-3.3-70b' : 'llama-3.3-70b-versatile';
export const LLM_API_KEY = LLM_PROVIDER === 'venice' ? process.env.VENICE_API_KEY : process.env.GROQ_API_KEY;

// --- Shared types ---
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

export interface Position { protocol: string; token: string; amount: number; apy: number; valueUsd: number; }
export interface Portfolio { positions: Position[]; totalValueUsd: number; userAddress: string; }

export interface RiskResult { volatility: Record<string, number>; maxDrawdown: Record<string, number>; correlationRisk: string; riskScore: number; }
export interface YieldResult {
  opportunities: Array<{ protocol: string; token: string; apy: number; tvl: number; riskFlags: string[] }>;
  recommendedMove: { from: { protocol: string; token: string; amount: number }; to: { protocol: string; token: string }; expectedApy: number; reason: string } | null;
}
export interface DataBuy { call: number; costUsdc: number; sufficiencyAfter: number; }
export interface AgentOutput<T> { data: T; usdcSpent: number; budget: number; confidence: number; durationMs: number; dataBuys?: DataBuy[]; }

export interface StrategyTx { type: 'withdraw' | 'deposit' | 'swap'; fromProtocol: string | null; toProtocol: string | null; token: string; amount: number; reason: string; }
export interface Strategy { action: 'rebalance' | 'hold' | 'partial_rebalance'; transactions: StrategyTx[]; expectedNewApy: number; riskImpact: string; totalValueMoved: number; }

export type CycleStatus = 'running' | 'scoring' | 'executing' | 'completed' | 'failed' | 'held';
export interface CycleRecord {
  id: string; status: CycleStatus; startedAt: number; completedAt: number | null;
  permissionContext: string | null; userAddress: string | null;
  riskResult: AgentOutput<RiskResult> | null; yieldResult: AgentOutput<YieldResult> | null;
  combinedConfidence: number | null; strategy: Strategy | null; txHash: string | null; error: string | null;
}
