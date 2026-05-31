import { z } from 'zod';
import { VENICE_API_URL, VENICE_MODEL } from '../config.js';
import type { PermissionSpec } from '../types.js';

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

const SYSTEM_PROMPT = `You are a DeFi permission parameter extractor. Given a user's portfolio intent, output ONLY valid JSON. No explanation, no markdown fences.

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
  "justification": "<one sentence for wallet permission dialog>"
}

Rules:
- "don't touch my ETH" → excludedTokens: ["WETH","stETH"]
- mentions yield/APY → objective: yield_maximization
- mentions safety → objective: capital_preservation
- default periodAmount: 100 if unspecified
- default maxSingleTx: 50% of periodAmount
- default riskTolerance: medium`;

export async function parseIntent(intent: string, apiKey: string): Promise<PermissionSpec> {
  const raw = await callVenice(intent, apiKey);
  const result = tryParse(raw);

  if (result.success) return result.data;

  // Retry once with error context
  const retryRaw = await callVenice(
    `${intent}\n\nPrevious output failed: ${result.error}. Fix the JSON.`,
    apiKey
  );
  const retry = tryParse(retryRaw);
  if (retry.success) return retry.data;

  throw new Error(`Intent parsing failed: ${retry.error}`);
}

async function callVenice(userMsg: string, apiKey: string): Promise<string> {
  const res = await fetch(`${VENICE_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
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

  if (!res.ok) throw new Error(`Venice ${res.status}: ${await res.text()}`);
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
