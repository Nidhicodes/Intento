import { VENICE_API_URL, VENICE_MODEL, type AgentOutput, type YieldResult, type Portfolio, type PermissionSpec } from './config';

const BUDGET_USDC = 20;
const COST_PER_CALL_USDC = 6;
const MAX_CALLS = 3;
const SUFFICIENCY_TARGET = 0.85;

const YIELD_SYSTEM_PROMPT = `You are a DeFi yield analyst gathering protocol APY evidence incrementally.
Given the portfolio plus evidence gathered so far, return ONLY valid JSON:
{
  "opportunities": [{"protocol":"aave|compound|curve|uniswap","token":"USDC|USDT|DAI","apy":<decimal>,"tvl":<usd>,"riskFlags":["..."]}],
  "recommendedMove": {"from":{"protocol":"...","token":"...","amount":<num>},"to":{"protocol":"...","token":"..."},"expectedApy":<decimal>,"reason":"..."} | null,
  "dataSufficiency": <0.0-1.0>,
  "needMoreData": <true|false>
}
Only set dataSufficiency high once you've covered every allowed protocol. recommendedMove is null if no move beats holding by >0.5% APY.`;

export async function runYieldAgent(portfolio: Portfolio, spec: PermissionSpec, apiKey: string): Promise<AgentOutput<YieldResult>> {
  const startTime = Date.now();
  let usdcSpent = 0;
  let calls = 0;
  let last: (YieldResult & { dataSufficiency?: number; needMoreData?: boolean }) | null = null;
  const evidence: unknown[] = [];
  const dataBuys: { call: number; costUsdc: number; sufficiencyAfter: number }[] = [];

  while (calls < MAX_CALLS && usdcSpent + COST_PER_CALL_USDC <= BUDGET_USDC) {
    const result = await callLLM(portfolio, spec, evidence, apiKey);
    calls += 1;
    usdcSpent += COST_PER_CALL_USDC;
    last = result;
    const sufficiency = typeof result.dataSufficiency === 'number' ? result.dataSufficiency : 0.5;
    evidence.push({ call: calls, opportunities: result.opportunities?.length || 0, sufficiency });
    dataBuys.push({ call: calls, costUsdc: COST_PER_CALL_USDC, sufficiencyAfter: sufficiency });
    if (sufficiency >= SUFFICIENCY_TARGET && result.needMoreData !== true) break;
  }

  const data: YieldResult = last
    ? { opportunities: last.opportunities || [], recommendedMove: last.recommendedMove ?? null }
    : { opportunities: [], recommendedMove: null };

  return { data, usdcSpent, budget: BUDGET_USDC, confidence: usdcSpent / BUDGET_USDC, durationMs: Date.now() - startTime, dataBuys };
}

async function callLLM(portfolio: Portfolio, spec: PermissionSpec, evidence: unknown[], apiKey: string): Promise<YieldResult & { dataSufficiency?: number; needMoreData?: boolean }> {
  const response = await fetch(`${VENICE_API_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: VENICE_MODEL,
      messages: [
        { role: 'system', content: YIELD_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify({ currentPositions: portfolio.positions, allowedProtocols: spec.allowedProtocols, allowedTokens: spec.allowedTokens, excludedTokens: spec.excludedTokens, evidenceSoFar: evidence }) },
      ],
      temperature: 0.2,
      max_tokens: 800,
      ...(process.env.LLM_PROVIDER === 'venice' ? { venice_parameters: { enable_web_search: 'on' } } : {}),
    }),
  });
  if (!response.ok) throw new Error(`Yield agent data call failed: ${response.status}`);
  const json = await response.json();
  const raw = json.choices[0].message.content.trim();
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try { return JSON.parse(cleaned); } catch { return { opportunities: [], recommendedMove: null, dataSufficiency: 0.5, needMoreData: false }; }
}
