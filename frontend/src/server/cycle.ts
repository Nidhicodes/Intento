import { VENICE_API_URL, VENICE_MODEL, CONFIDENCE_THRESHOLD, RISK_WEIGHT, YIELD_WEIGHT,
  type CycleRecord, type Portfolio, type PermissionSpec, type Strategy, type RiskResult, type YieldResult } from './config';
import { runRiskAgent } from './risk';
import { runYieldAgent } from './yield';

/**
 * Runs a full cycle and returns the complete record synchronously.
 * (Serverless-friendly: no shared in-memory store, no polling.)
 */
export async function runCycle(portfolio: Portfolio, spec: PermissionSpec, apiKey: string): Promise<CycleRecord> {
  const cycle: CycleRecord = {
    id: cryptoRandomId(),
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

  try {
    const [riskResult, yieldResult] = await Promise.all([
      runRiskAgent(portfolio, spec, apiKey),
      runYieldAgent(portfolio, spec, apiKey),
    ]);
    cycle.riskResult = riskResult;
    cycle.yieldResult = yieldResult;
    cycle.status = 'scoring';

    const combined = riskResult.confidence * RISK_WEIGHT + yieldResult.confidence * YIELD_WEIGHT;
    cycle.combinedConfidence = combined;

    if (combined < CONFIDENCE_THRESHOLD) {
      cycle.status = 'held';
      cycle.completedAt = Date.now();
      return cycle;
    }

    const strategy = await buildStrategy(riskResult.data, yieldResult.data, portfolio, spec, apiKey);
    cycle.strategy = strategy;
    cycle.status = 'completed';
    cycle.completedAt = Date.now();
    return cycle;
  } catch (err: any) {
    cycle.status = 'failed';
    cycle.error = err.message;
    cycle.completedAt = Date.now();
    return cycle;
  }
}

async function buildStrategy(risk: RiskResult, yields: YieldResult, portfolio: Portfolio, spec: PermissionSpec, apiKey: string): Promise<Strategy> {
  const systemPrompt = `You are a DeFi portfolio strategist. Return ONLY valid JSON.
Output: {"action":"rebalance|hold|partial_rebalance","transactions":[{"type":"withdraw|deposit|swap","fromProtocol":"...","toProtocol":"...","token":"...","amount":<number>,"reason":"..."}],"expectedNewApy":<decimal>,"riskImpact":"improved|neutral|worsened","totalValueMoved":<number>}
Rules: high risk -> "hold"; yield gain <0.5% -> "hold"; never exceed maxSingleTx ${spec.maxSingleTx} USDC; never touch ${spec.excludedTokens.join(', ')}; only use ${spec.allowedProtocols.join(', ')}.`;

  const res = await fetch(`${VENICE_API_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
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
  if (!res.ok) throw new Error(`Strategy call failed: ${res.status}`);
  const data = await res.json();
  const raw = data.choices[0].message.content.trim();
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try { return JSON.parse(cleaned); } catch { return { action: 'hold', transactions: [], expectedNewApy: 0, riskImpact: 'neutral', totalValueMoved: 0 }; }
}

function cryptoRandomId(): string {
  return 'cyc_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
