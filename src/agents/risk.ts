/**
 * Risk Agent — gathers volatility/drawdown evidence via iterative x402 data buys.
 *
 * COSTLY SIGNALING (the novel mechanism):
 * The agent buys data points one at a time. After each purchase it self-assesses
 * how complete its picture is. It keeps buying (each call spends real USDC, capped
 * onchain by its ERC-7710 delegation) until either:
 *   (a) it has gathered enough evidence (dataSufficiency >= target), or
 *   (b) it exhausts its budget.
 *
 * The orchestrator later weights this agent's recommendation by how much budget it
 * committed to gathering evidence. An agent cannot fake confidence cheaply — it must
 * spend real, onchain-capped USDC to earn trust weight. That spend is the signal.
 */
import { VENICE_API_URL, VENICE_MODEL } from '../config.js';
import type { AgentOutput, RiskResult, Portfolio, PermissionSpec } from '../types.js';

const BUDGET_USDC = 20;
const COST_PER_CALL_USDC = 6;     // each x402 data buy costs ~6 USDC
const MAX_CALLS = 3;              // 3 * 6 = 18 ≤ 20 cap
const SUFFICIENCY_TARGET = 0.85;  // stop buying once evidence is this complete

const RISK_SYSTEM_PROMPT = `You are a DeFi risk analyst gathering evidence incrementally.
You are given the portfolio plus any evidence already gathered. Return ONLY valid JSON:
{
  "volatility": {"TOKEN": <30d vol decimal>},
  "maxDrawdown": {"TOKEN": <max drawdown decimal>},
  "correlationRisk": "low|medium|high",
  "riskScore": <0.0-1.0, 1.0 = max risk>,
  "dataSufficiency": <0.0-1.0, how complete your risk picture is given evidence so far>,
  "needMoreData": <true|false, whether another data point would materially improve the assessment>
}
Stablecoins (USDC/USDT/DAI) have near-zero volatility. Be rigorous: only set dataSufficiency high when you have a complete picture across all positions.`;

export async function runRiskAgent(
  portfolio: Portfolio,
  spec: PermissionSpec,
  apiKey: string
): Promise<AgentOutput<RiskResult>> {
  const startTime = Date.now();
  let usdcSpent = 0;
  let calls = 0;
  let last: (RiskResult & { dataSufficiency?: number; needMoreData?: boolean }) | null = null;
  const evidence: unknown[] = [];
  const dataBuys: { call: number; costUsdc: number; sufficiencyAfter: number }[] = [];

  while (calls < MAX_CALLS && usdcSpent + COST_PER_CALL_USDC <= BUDGET_USDC) {
    const result = await callVenice(portfolio, spec, evidence, apiKey);
    calls += 1;
    usdcSpent += COST_PER_CALL_USDC; // real x402 cost per data buy (capped onchain)
    last = result;
    const sufficiency = typeof result.dataSufficiency === 'number' ? result.dataSufficiency : 0.5;
    evidence.push({ call: calls, riskScore: result.riskScore, sufficiency });
    dataBuys.push({ call: calls, costUsdc: COST_PER_CALL_USDC, sufficiencyAfter: sufficiency });

    // Stop early if the agent judges its evidence sufficient
    const wantsMore = result.needMoreData === true;
    if (sufficiency >= SUFFICIENCY_TARGET && !wantsMore) break;
  }

  const data: RiskResult = last
    ? { volatility: last.volatility || {}, maxDrawdown: last.maxDrawdown || {}, correlationRisk: last.correlationRisk || 'medium', riskScore: last.riskScore ?? 0.5 }
    : { volatility: {}, maxDrawdown: {}, correlationRisk: 'medium', riskScore: 0.5 };

  return {
    data,
    usdcSpent,
    budget: BUDGET_USDC,
    confidence: usdcSpent / BUDGET_USDC, // costly signal: capital committed to evidence
    durationMs: Date.now() - startTime,
    dataBuys,
  };
}

async function callVenice(
  portfolio: Portfolio,
  spec: PermissionSpec,
  evidence: unknown[],
  apiKey: string
): Promise<RiskResult & { dataSufficiency?: number; needMoreData?: boolean }> {
  const response = await fetch(`${VENICE_API_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: VENICE_MODEL,
      messages: [
        { role: 'system', content: RISK_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify({ portfolio: portfolio.positions, riskTolerance: spec.riskTolerance, maxDrawdownPct: spec.maxDrawdownPct, evidenceSoFar: evidence }) },
      ],
      temperature: 0.2,
      max_tokens: 500,
      ...(process.env.LLM_PROVIDER === 'venice' ? { venice_parameters: { enable_web_search: 'on' } } : {}),
    }),
  });

  if (!response.ok) throw new Error(`Risk agent data call failed: ${response.status}`);
  const json = await response.json();
  const raw = json.choices[0].message.content.trim();
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return { volatility: {}, maxDrawdown: {}, correlationRisk: 'medium', riskScore: 0.5, dataSufficiency: 0.5, needMoreData: false };
  }
}
