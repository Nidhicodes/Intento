/**
 * Verifies the rebuilt self-contained enforcement proof end-to-end against
 * Base Sepolia, using the SAME logic as frontend/src/server/proof.ts.
 *
 * Usage: npx tsx src/verify-proof.ts
 */
import 'dotenv/config';
import { createWalletClient, createPublicClient, http, encodeFunctionData, parseUnits, formatUnits, erc20Abi, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { toMetaMaskSmartAccount, Implementation, createDelegation, ScopeType, createExecution, ExecutionMode, contracts, getSmartAccountsEnvironment } from '@metamask/smart-accounts-kit';

const { DelegationManager } = contracts;
const RPC = process.env.RPC_URL || 'https://sepolia.base.org';
const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address;
const environment = getSmartAccountsEnvironment(baseSepolia.id);
const RISK_CAP = 20;

const pc = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
const risk = privateKeyToAccount(process.env.RISK_AGENT_PRIVATE_KEY as Hex);
const orch = privateKeyToAccount(process.env.ORCHESTRATOR_PRIVATE_KEY as Hex);

async function orchSA() {
  return toMetaMaskSmartAccount({
    client: pc as any, implementation: Implementation.Hybrid,
    deployParams: [orch.address, [], [], []], deploySalt: '0x', signer: { account: orch },
  });
}

async function buildDelegation(sa: any) {
  const d = createDelegation({
    scope: { type: ScopeType.Erc20TransferAmount, tokenAddress: USDC, maxAmount: parseUnits(RISK_CAP.toString(), 6) },
    to: risk.address, from: sa.address, environment: sa.environment,
  });
  const signature = await sa.signDelegation({ delegation: d });
  return { ...d, signature };
}

async function redeem(amount: number) {
  const sa = await orchSA();
  const del = await buildDelegation(sa);
  const calldata = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [risk.address, parseUnits(amount.toString(), 6)] });
  const execution = createExecution({ target: USDC, callData: calldata });
  const redeemCalldata = DelegationManager.encode.redeemDelegations({ delegations: [[del]], modes: [ExecutionMode.SingleDefault], executions: [[execution]] });
  const wallet = createWalletClient({ account: risk, chain: baseSepolia, transport: http(RPC) });
  try {
    const hash = await wallet.sendTransaction({ to: environment.DelegationManager as Address, data: redeemCalldata, chain: baseSepolia });
    const receipt = await pc.waitForTransactionReceipt({ hash });
    return { ok: receipt.status === 'success', hash, reverted: receipt.status === 'reverted' };
  } catch (e: any) {
    const m = e?.shortMessage || e?.message || String(e);
    return { ok: false, hash: null, reverted: /revert|exceeded|enforcer|caveat/i.test(m), msg: m.slice(0, 160) };
  }
}

async function main() {
  const sa = await orchSA();
  const code = await pc.getBytecode({ address: sa.address as Address });
  const bal = await pc.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [sa.address as Address] });
  console.log(`\nProof delegator (orchestrator SA): ${sa.address}`);
  console.log(`  deployed: ${!!code && code !== '0x'}  |  USDC: ${formatUnits(bal, 6)}`);
  console.log(`Risk agent (redeemer): ${risk.address}\n`);

  console.log('── Test A: redeem 1 USDC (<= 20 cap) → expect SUCCESS');
  const a = await redeem(1);
  console.log('  result:', JSON.stringify(a), '\n');

  console.log('── Test B: redeem 40 USDC (> 20 cap) → expect REVERT');
  const b = await redeem(40);
  console.log('  result:', JSON.stringify(b), '\n');

  const pass = a.ok && b.reverted;
  console.log(pass ? '✅ PROOF VERIFIED: within-cap succeeds, overspend reverts.' : '❌ Proof did not behave as expected — investigate.');
}
main().catch((e) => { console.error(e); process.exit(1); });
