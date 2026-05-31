/**
 * CLI script to run a single orchestration cycle.
 * Usage: npm run cycle
 */
import 'dotenv/config';
import { parseIntent } from './intent/parser.js';
import { runCycle } from './orchestrator/cycle.js';
import { LLM_API_KEY } from './config.js';
import type { Portfolio } from './types.js';

const DEMO_INTENT = 'Maximize my stablecoin yield, keep drawdown under 10%, only use Aave and Compound, rebalance weekly';

const DEMO_PORTFOLIO: Portfolio = {
  positions: [
    { protocol: 'aave', token: 'USDC', amount: 2000, apy: 0.041, valueUsd: 2000 },
    { protocol: 'compound', token: 'USDC', amount: 500, apy: 0.035, valueUsd: 500 },
  ],
  totalValueUsd: 2500,
  userAddress: '0x0000000000000000000000000000000000000001',
};

async function main() {
  if (!LLM_API_KEY) {
    console.error('❌ Set GROQ_API_KEY (or VENICE_API_KEY) in .env');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('  INTENTO — Single Cycle Run');
  console.log('═══════════════════════════════════════════════════\n');

  // Step 1: Parse intent
  console.log('📝 Intent:', DEMO_INTENT);
  console.log('\n── Parsing intent... ──');
  const spec = await parseIntent(DEMO_INTENT, LLM_API_KEY);
  console.log('✓ Parsed spec:', JSON.stringify(spec, null, 2));

  // Step 2: Run cycle
  console.log('\n── Running cycle... ──');
  const cycle = await runCycle(DEMO_PORTFOLIO, spec, LLM_API_KEY);

  // Step 3: Print results
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  CYCLE RESULT');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  ID: ${cycle.id}`);
  console.log(`  Status: ${cycle.status}`);
  console.log(`  Duration: ${cycle.completedAt ? cycle.completedAt - cycle.startedAt : '?'}ms`);
  console.log(`  Confidence: ${cycle.combinedConfidence?.toFixed(3) || 'N/A'}`);
  console.log(`  Strategy: ${cycle.strategy?.action || 'none'}`);
  console.log(`  Tx Hash: ${cycle.txHash || 'none'}`);
  console.log(`  Error: ${cycle.error || 'none'}`);

  if (cycle.riskResult) {
    console.log(`\n  Risk Agent:`);
    console.log(`    Spent: ${cycle.riskResult.usdcSpent}/${cycle.riskResult.budget} USDC`);
    console.log(`    Confidence: ${(cycle.riskResult.confidence * 100).toFixed(1)}%`);
    console.log(`    Risk Score: ${cycle.riskResult.data.riskScore}`);
  }

  if (cycle.yieldResult) {
    console.log(`\n  Yield Agent:`);
    console.log(`    Spent: ${cycle.yieldResult.usdcSpent}/${cycle.yieldResult.budget} USDC`);
    console.log(`    Confidence: ${(cycle.yieldResult.confidence * 100).toFixed(1)}%`);
    console.log(`    Opportunities: ${cycle.yieldResult.data.opportunities.length}`);
    console.log(`    Recommended: ${cycle.yieldResult.data.recommendedMove?.reason || 'none'}`);
  }

  if (cycle.strategy && cycle.strategy.action !== 'hold') {
    console.log(`\n  Strategy:`);
    for (const tx of cycle.strategy.transactions) {
      console.log(`    ${tx.type}: ${tx.amount} ${tx.token} (${tx.fromProtocol} → ${tx.toProtocol})`);
      console.log(`      Reason: ${tx.reason}`);
    }
    console.log(`    Expected APY: ${(cycle.strategy.expectedNewApy * 100).toFixed(2)}%`);
  }

  console.log('\n═══════════════════════════════════════════════════\n');
}

main().catch(console.error);
