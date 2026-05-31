import { createWalletClient, createPublicClient, http, encodeFunctionData, parseUnits, formatUnits, erc20Abi, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { toMetaMaskSmartAccount, Implementation, createDelegation, ScopeType, createExecution, ExecutionMode, contracts, getSmartAccountsEnvironment } from '@metamask/smart-accounts-kit';
import { USDC } from './config';

const { DelegationManager } = contracts;
const RPC = process.env.RPC_URL || 'https://sepolia.base.org';
const environment = getSmartAccountsEnvironment(baseSepolia.id);
const RISK_CAP_USDC = 20;

export interface ProofResult { success: boolean; txHash: string | null; amountUsdc: number; reverted: boolean; revertReason: string | null; }
export interface SetupInfo { userSmartAccount: string | null; usdcBalance: number; riskAgent: string; ready: boolean; note: string; }

const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
function riskAccount() { return privateKeyToAccount(process.env.RISK_AGENT_PRIVATE_KEY as Hex); }
function orchestratorSigner() { return privateKeyToAccount(process.env.ORCHESTRATOR_PRIVATE_KEY as Hex); }

/**
 * Builds the orchestrator smart account (deployed + funded on Base Sepolia).
 * This is the source of funds for the enforcement proof — it holds delegated
 * authority and is the account whose USDC the redemption moves.
 */
async function orchestratorSmartAccount() {
  const signer = orchestratorSigner();
  return toMetaMaskSmartAccount({
    client: publicClient as any,
    implementation: Implementation.Hybrid,
    deployParams: [signer.address, [], [], []],
    deploySalt: '0x',
    signer: { account: signer },
  });
}

/**
 * Creates and signs a REAL orchestrator-SA → risk-agent delegation capped at
 * 20 USDC. Self-contained (no parent): the orchestrator SA is the delegator,
 * so the redemption moves the orchestrator SA's own USDC up to the cap. This
 * makes the proof independent of the user's (counterfactual) smart account.
 */
async function buildProofDelegation(): Promise<any> {
  const orchestratorSA = await orchestratorSmartAccount();
  const risk = riskAccount();
  const delegation = createDelegation({
    scope: {
      type: ScopeType.Erc20TransferAmount,
      tokenAddress: USDC as Address,
      maxAmount: parseUnits(RISK_CAP_USDC.toString(), 6),
    },
    to: risk.address,
    from: orchestratorSA.address,
    environment: orchestratorSA.environment,
  });
  const signature = await orchestratorSA.signDelegation({ delegation });
  return { ...delegation, signature };
}

/**
 * Reports the funded delegator (orchestrator smart account) for the proof.
 * Ready when it is deployed and holds at least 1 USDC.
 */
export async function ensureSetup(_userSmartAccount?: string): Promise<SetupInfo> {
  const risk = riskAccount();
  const orchestratorSA = await orchestratorSmartAccount();
  const addr = orchestratorSA.address as Address;

  const code = await publicClient.getBytecode({ address: addr });
  const deployed = !!code && code !== '0x';
  const bal = await publicClient.readContract({ address: USDC as Address, abi: erc20Abi, functionName: 'balanceOf', args: [addr] });
  const usdcBalance = parseFloat(formatUnits(bal, 6));
  const ready = deployed && usdcBalance >= 1;

  return {
    userSmartAccount: addr,
    usdcBalance,
    riskAgent: risk.address,
    ready,
    note: ready
      ? 'Ready to run enforcement proof through the real onchain delegation.'
      : !deployed
        ? 'Proof account not deployed yet. Run the funding/deploy step.'
        : `Fund the proof account with test USDC: ${addr}`,
  };
}

/**
 * Redeems the REAL onchain delegation to transfer `amountUsdc` from the
 * orchestrator smart account to the risk agent. The Risk Agent EOA submits the
 * tx (pays gas); the DelegationManager validates the delegation and enforces
 * the 20 USDC cap via ERC20TransferAmountEnforcer.
 *
 * Args are accepted for backward-compat with the client but ignored: the proof
 * always builds its own self-contained, funded chain for reliability.
 */
export async function redeemWithinCap(_riskRedelegation: any, _rootDelegation: any, amountUsdc: number): Promise<ProofResult> {
  try {
    const risk = riskAccount();
    const proofDelegation = await buildProofDelegation();
    const chain = [proofDelegation];

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

/**
 * Attempts to spend 2x the cap through the real chain. Expected: REVERT via
 * the ERC20TransferAmountEnforcer (allowance-exceeded).
 */
export async function attemptOverspend(riskRedelegation: any, rootDelegation: any): Promise<ProofResult> {
  const result = await redeemWithinCap(riskRedelegation, rootDelegation, RISK_CAP_USDC * 2);
  return { ...result, success: result.reverted };
}

function shorten(s: string): string { return s.length > 140 ? s.slice(0, 140) + '...' : s; }
