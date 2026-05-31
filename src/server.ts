/**
 * Intento API Server
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { parseIntent } from './intent/parser.js';
import { runCycle, getCycle, getAllCycles } from './orchestrator/cycle.js';
import { ensureSetup, redeemWithinCap, attemptOverspend } from './agents/proof.js';
import { LLM_API_KEY } from './config.js';
import type { Portfolio } from './types.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = parseInt(process.env.PORT || '3001');

// --- Health ---
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    chain: process.env.CHAIN || 'base-sepolia',
    llm: process.env.LLM_PROVIDER || 'groq',
  });
});

// --- Parse Intent ---
app.post('/api/intent', async (req, res) => {
  try {
    const { intent } = req.body;
    if (!intent) return res.status(400).json({ error: 'intent is required' });
    if (!LLM_API_KEY) return res.status(500).json({ error: 'LLM API key not configured (set GROQ_API_KEY or VENICE_API_KEY)' });

    const spec = await parseIntent(intent, LLM_API_KEY);
    res.json({ spec });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Run Cycle ---
app.post('/api/cycle', async (req, res) => {
  try {
    const { portfolio, spec } = req.body;
    if (!portfolio || !spec) {
      return res.status(400).json({ error: 'portfolio and spec are required' });
    }
    if (!LLM_API_KEY) return res.status(500).json({ error: 'LLM API key not configured' });

    const cycle = await runCycle(portfolio as Portfolio, spec, LLM_API_KEY);
    res.json({ cycleId: cycle.id, status: cycle.status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Get Cycle Status ---
app.get('/api/cycle/:id', (req, res) => {
  const cycle = getCycle(req.params.id);
  if (!cycle) return res.status(404).json({ error: 'Cycle not found' });
  res.json(cycle);
});

// --- List All Cycles ---
app.get('/api/cycles', (_req, res) => {
  res.json(getAllCycles());
});

// --- Enforcement Proof (onchain cap enforcement through the real chain) ---

// Report the user smart account's USDC balance
app.post('/api/proof/setup', async (req, res) => {
  try {
    const { userSmartAccount } = req.body;
    const info = await ensureSetup(userSmartAccount);
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Redeem within cap through the real chain — should succeed
app.post('/api/redeem', async (req, res) => {
  try {
    const { riskRedelegation, rootDelegation, amountUsdc } = req.body;
    const result = await redeemWithinCap(riskRedelegation, rootDelegation, amountUsdc || 1);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Attempt overspend through the real chain — should REVERT
app.post('/api/overspend', async (req, res) => {
  try {
    const { riskRedelegation, rootDelegation } = req.body;
    const result = await attemptOverspend(riskRedelegation, rootDelegation);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- 1Shot Webhook ---
app.post('/webhook/1shot', (req, res) => {
  const { taskId, status, txHash, error } = req.body;
  console.log(`[1Shot Webhook] taskId=${taskId} status=${status} tx=${txHash || 'none'}`);

  const cycles = getAllCycles();
  const cycle = cycles.find(c => c.txHash === taskId);
  if (cycle) {
    if (status === 'confirmed' && txHash) {
      cycle.txHash = txHash;
      cycle.status = 'completed';
      cycle.completedAt = Date.now();
    } else if (status === 'failed') {
      cycle.status = 'failed';
      cycle.error = error || 'Transaction failed';
      cycle.completedAt = Date.now();
    }
  }

  res.sendStatus(200);
});

// --- Start ---
app.listen(PORT, () => {
  const provider = process.env.LLM_PROVIDER || 'groq';
  console.log(`\n🚀 Intento API running on http://localhost:${PORT}`);
  console.log(`   Chain: ${process.env.CHAIN || 'base-sepolia'}`);
  console.log(`   LLM: ${provider} (${LLM_API_KEY ? 'key set' : '⚠️  NO KEY'})`);
  console.log(`   Pimlico: ${process.env.PIMLICO_API_KEY ? 'configured' : '⚠️  NOT SET'}\n`);
});

export default app;
