import { createWalletClient, createPublicClient, http, encodeFunctionData, parseUnits, formatUnits, erc20Abi, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { createExecution, ExecutionMode, contracts, getSmartAccountsEnvironment } from '@metamask/smart-accounts-kit';
import { USDC } from './config';

const { DelegationManager } = contracts;
const RPC = process.env.RPC_URL || 'https://sepolia.base.org';
const environment = getSmartAccountsEnvironment(baseSepolia.id);
const RISK_CAP_USDC = 20;

export interface ProofResult { success: boolean; txHash: string | null; amountUsdc: number; reverted: boolean; revertReason: string | null; }
export interface SetupInfo { userSmartAccount: string | null; usdcBalance: number; riskAgent: string; ready: boolean; note: string; }

const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
function riskAccount() { return privateKeyToAccount(process.env.RISK_AGENT_PRIVATE_KEY as Hex); }

export async function ensureSetup(userSmartAccount?: string): Promise<SetupInfo> {
  const risk = riskAccount();
  if (!userSmartAccount) {
    return { userSmartAccount: null, usdcBalance: 0, riskAgent: risk.address, ready: false, note: 'Grant permission first to establish your smart account.' };
  }
  const bal = await publicClient.readContract({ address: USDC as Address, abi: erc20Abi, functionName: 'balanceOf', args: [userSmartAccount as Address] });
  const usdcBalance = parseFloat(formatUnits(bal, 6));
  return {
    userSmartAccount, usdcBalance, riskAgent: risk.address, ready: usdcBalance > 0,
    note: usdcBalance > 0 ? 'Ready to run enforcement proof through the real chain.' : `Fund your smart account with test USDC: ${userSmartAccount}`,
  };
}

export async function redeemWithinCap(riskRedelegation: any, rootDelegation: any, amountUsdc: number): Promise<ProofResult> {
  try {
    if (!riskRedelegation || !rootDelegation) {
      return { success: false, txHash: null, amountUsdc, reverted: false, revertReason: 'Missing delegation chain. Grant permission first.' };
    }
    const risk = riskAccount();
    const chain = [riskRedelegation, rootDelegation];
    const calldata = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [risk.address, parseUnits(amountUsdc.toString(), 6)] });
    const execution = createExecution({ target: USDC as Address, callData: calldata });
    const redeemCalldata = DelegationManager.encode.redeemDelegations({ delegations: [chain], modes: [ExecutionMode.SingleDefault], executions: [[execution]] });

    const riskWallet = createWalletClient({ account: risk, chain: baseSepolia, transport: http(RPC) });
    const txHash = await riskWallet.sendTransaction({ to: environment.DelegationManager as Address, data: redeemCalldata, chain: baseSepolia });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status === 'reverted') return { success: false, txHash, amountUsdc, reverted: true, revertReason: 'Reverted onchain' };
    return { success: true, txHash, amountUsdc, reverted: false, revertReason: null };
  } catch (err: any) {
    const message = err?.shortMessage || err?.message || String(err);
    const isRevert = /revert|allowance-exceeded|exceeded|caveat|enforcer/i.test(message);
    return { success: false, txHash: null, amountUsdc, reverted: isRevert, revertReason: shorten(message) };
  }
}

export async function attemptOverspend(riskRedelegation: any, rootDelegation: any): Promise<ProofResult> {
  const result = await redeemWithinCap(riskRedelegation, rootDelegation, RISK_CAP_USDC * 2);
  return { ...result, success: result.reverted };
}

function shorten(s: string): string { return s.length > 140 ? s.slice(0, 140) + '...' : s; }
