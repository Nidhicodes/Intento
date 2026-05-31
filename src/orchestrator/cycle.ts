/**
 * Orchestrator Cycle Runner
 * Coordinates the full intent → agents → confidence → execute flow.
 */
import { v4 as uuid } from 'uuid';
import { VENICE_API_URL, VENICE_MODEL, CONFIDENCE_THRESHOLD, RISK_WEIGHT, YIELD_WEIGHT, LLM_API_KEY } from '../config.js';
import { runRiskAgent } from '../agents/risk.js';
import { runYieldAgent } from '../agents/yield.js';
import { executeStrategy } from '../agents/execution.js';
import type {
  CycleRecord,
  Portfolio,
  PermissionSpec,
  Strategy,
  RiskResult,
  YieldResult,
  AgentOutput,
} from '../types.js';

// In-memory store for cycles (replace with DB in production)
const cycles: Map<string, CycleRecord> = new Map();

export function getCycle(id: string): CycleRecord | undefined {
  return cycles.get(id);
}

export function getAllCycles(): CycleRecord[] {
  return Array.from(cycles.values()).sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * Runs a full orchestration cycle:
 * 1. Run risk + yield agents in parallel (they buy data via x402)
 * 2. Score confidence based on their economic behavior
 * 3. If confidence passes threshold, build strategy via Venice
 * 4. Execute strategy via 1Shot/Pimlico
 */
export async function runCycle(
  portfolio: Portfolio,
  spec: PermissionSpec,
  apiKey: string,
  rootDelegation?: any,
  redelegations?: any,
): Promise<CycleRecord> {
  const cycle: CycleRecord = {
    id: uuid(),
    status: 'running',
    startedAt: Date.now(),
    completedAt: null,
    permissionContext: null,
    userAddress: portfolio.userAddress,
    riskResult: null,
    yieldResult: null,
    combinedConfidence: null,
    strategy: null,
    txHash: null,
    error: null,
  };
  cycles.set(cycle.id, cycle);

  try {
    // Phase 1: Run agents in parallel
    console.log(`[Cycle ${cycle.id}] Running risk + yield agents...`);
    const [riskResult, yieldResult] = await Promise.all([
      runRiskAgent(portfolio, spec, apiKey),
      runYieldAgent(portfolio, spec, apiKey),
    ]);

    cycle.riskResult = riskResult;
    cycle.yieldResult = yieldResult;
    cycle.status = 'scoring';

    // Phase 2: Score confidence
    const combined = riskResult.confidence * RISK_WEIGHT + yieldResult.confidence * YIELD_WEIGHT;
    cycle.combinedConfidence = combined;

    console.log(`[Cycle ${cycle.id}] Confidence: ${combined.toFixed(3)} (threshold: ${CONFIDENCE_THRESHOLD})`);
    console.log(`  Risk: spent ${riskResult.usdcSpent}/${riskResult.budget} USDC (${(riskResult.confidence * 100).toFixed(1)}%)`);
    console.log(`  Yield: spent ${yieldResult.usdcSpent}/${yieldResult.budget} USDC (${(yieldResult.confidence * 100).toFixed(1)}%)`);

    if (combined < CONFIDENCE_THRESHOLD) {
      cycle.status = 'held';
      cycle.completedAt = Date.now();
      console.log(`[Cycle ${cycle.id}] Below threshold — holding position.`);
      return cycle;
    }

    // Phase 3: Build strategy
    console.log(`[Cycle ${cycle.id}] Building strategy...`);
    const strategy = await buildStrategy(riskResult.data, yieldResult.data, portfolio, spec, apiKey);
    cycle.strategy = strategy;

    if (strategy.action === 'hold') {
      cycle.status = 'completed';
      cycle.completedAt = Date.now();
      console.log(`[Cycle ${cycle.id}] Strategy: HOLD (no profitable move found).`);
      return cycle;
    }

    // Phase 4: Execute
    cycle.status = 'executing';
    console.log(`[Cycle ${cycle.id}] Executing: ${strategy.transactions.length} transactions...`);

    const execResult = await executeStrategy(
      strategy,
      rootDelegation,
      redelegations?.execution,
    );

    cycle.txHash = execResult.txHash;
    cycle.status = execResult.error ? 'failed' : 'completed';
    cycle.error = execResult.error;
    cycle.completedAt = Date.now();

    console.log(`[Cycle ${cycle.id}] ${cycle.status.toUpperCase()} — tx: ${execResult.txHash || 'none'} via ${execResult.method}`);

  } catch (err: any) {
    cycle.status = 'failed';
    cycle.error = err.message;
    cycle.completedAt = Date.now();
    console.error(`[Cycle ${cycle.id}] FAILED:`, err.message);
  }

  return cycle;
}

/**
 * Builds execution strategy from agent outputs using Venice.
 */
async function buildStrategy(
  risk: RiskResult,
  yields: YieldResult,
  portfolio: Portfolio,
  spec: PermissionSpec,
  apiKey: string
): Promise<Strategy> {
  const systemPrompt = `You are a DeFi portfolio strategist. Return ONLY valid JSON.

Output: {"action":"rebalance|hold|partial_rebalance","transactions":[{"type":"withdraw|deposit|swap","fromProtocol":"...","toProtocol":"...","token":"...","amount":<number>,"reason":"..."}],"expectedNewApy":<decimal>,"riskImpact":"improved|neutral|worsened","totalValueMoved":<number>}

Rules:
- If risk is too high, recommend "hold"
- If yield improvement < 0.5% APY, recommend "hold"
- Never exceed maxSingleTx: ${spec.maxSingleTx} USDC
- Never touch: ${spec.excludedTokens.join(', ')}
- Only use: ${spec.allowedProtocols.join(', ')}`;

  const res = await fetch(`${VENICE_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VENICE_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({ risk, yields, portfolio: portfolio.positions }) },
      ],
      temperature: 0.1,
      max_tokens: 600,
    }),
  });

  if (!res.ok) throw new Error(`Strategy Venice call failed: ${res.status}`);

  const data = await res.json();
  const raw = data.choices[0].message.content.trim();
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return { action: 'hold', transactions: [], expectedNewApy: 0, riskImpact: 'neutral', totalValueMoved: 0 };
  }
}
