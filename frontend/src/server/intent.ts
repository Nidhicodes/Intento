import { z } from 'zod';
import { VENICE_API_URL, VENICE_MODEL, type PermissionSpec } from './config';

const specSchema = z.object({
  periodAmount: z.number().int().min(1).max(100000),
  allowedProtocols: z.array(z.string()).min(1),
  allowedTokens: z.array(z.string()).min(1),
  excludedTokens: z.array(z.string()),
  maxSingleTx: z.number().min(1),
  riskTolerance: z.enum(['low', 'medium', 'high']),
  objective: z.enum(['yield_maximization', 'capital_preservation', 'balanced']),
  maxDrawdownPct: z.number().min(1).max(100),
  justification: z.string().min(5).max(200),
});

const SYSTEM_PROMPT = `You are a DeFi permission parameter extractor. Output ONLY valid JSON, no markdown.
Schema:
{
  "periodAmount": <USDC per week, integer>,
  "allowedProtocols": ["aave","compound","curve","uniswap"],
  "allowedTokens": ["USDC","USDT","DAI","WETH","stETH"],
  "excludedTokens": ["<tokens to never touch>"],
  "maxSingleTx": <max single tx in USDC>,
  "riskTolerance": "low|medium|high",
  "objective": "yield_maximization|capital_preservation|balanced",
  "maxDrawdownPct": <1-100>,
  "justification": "<one sentence>"
}
Rules: "don't touch my ETH" -> excludedTokens ["WETH","stETH"]; yield/APY -> yield_maximization; safety -> capital_preservation; default periodAmount 100; default maxSingleTx 50% of periodAmount; default riskTolerance medium.`;

export async function parseIntent(intent: string, apiKey: string): Promise<PermissionSpec> {
  const raw = await callLLM(intent, apiKey);
  const result = tryParse(raw);
  if (result.success) return result.data;
  const retryRaw = await callLLM(`${intent}\n\nPrevious output failed: ${result.error}. Fix the JSON.`, apiKey);
  const retry = tryParse(retryRaw);
  if (retry.success) return retry.data;
  throw new Error(`Intent parsing failed: ${retry.error}`);
}

async function callLLM(userMsg: string, apiKey: string): Promise<string> {
  const res = await fetch(`${VENICE_API_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: VENICE_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMsg },
      ],
      temperature: 0.1,
      max_tokens: 500,
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

function tryParse(raw: string): { success: true; data: PermissionSpec } | { success: false; error: string } {
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = specSchema.parse(JSON.parse(cleaned));
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
