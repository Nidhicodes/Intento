/**
 * Delegation creation using the validated MetaMask Smart Accounts Kit patterns.
 * Creates the full chain: user → orchestrator → sub-agents
 */
import { parseUnits, type Hex, type Address } from 'viem';
import {
  createDelegation,
  createOpenDelegation,
  ScopeType,
} from '@metamask/smart-accounts-kit';
import {
  environment,
  USDC,
  AGENT_BUDGETS,
  getOrchestratorSmartAccount,
  riskAgentAccount,
  yieldAgentAccount,
  executionAgentAccount,
} from '../config.js';
import type { DelegationChainInfo } from '../types.js';

type SmartAccount = Awaited<ReturnType<typeof getOrchestratorSmartAccount>>;
type Delegation = ReturnType<typeof createDelegation>;
type SignedDelegation = Delegation & { signature: Hex };

export interface RedelegationSet {
  risk: SignedDelegation;
  yield: SignedDelegation;
  execution: SignedDelegation;
  chainInfo: DelegationChainInfo;
}

/**
 * Creates redelegations from orchestrator to all sub-agents.
 * Requires the root permission context (from user's ERC-7715 grant).
 *
 * For the demo, we simulate the root delegation programmatically.
 * In production, this comes from requestExecutionPermissions via MetaMask.
 */
export async function createAgentRedelegations(
  rootDelegation: SignedDelegation,
  userAddress: Address
): Promise<RedelegationSet> {
  const orchestrator = await getOrchestratorSmartAccount();

  // Risk Agent: 20 USDC cap (for buying market data via x402)
  const riskDelegation = createDelegation({
    scope: {
      type: ScopeType.Erc20TransferAmount,
      tokenAddress: USDC,
      maxAmount: parseUnits(AGENT_BUDGETS.risk.toString(), 6),
    },
    to: riskAgentAccount.address,
    from: orchestrator.address,
    parentDelegation: rootDelegation,
    environment,
  });
  const riskSig = await orchestrator.signDelegation({ delegation: riskDelegation });
  const signedRisk = { ...riskDelegation, signature: riskSig } as SignedDelegation;

  // Yield Agent: 20 USDC cap (for buying APY data via x402)
  const yieldDelegation = createDelegation({
    scope: {
      type: ScopeType.Erc20TransferAmount,
      tokenAddress: USDC,
      maxAmount: parseUnits(AGENT_BUDGETS.yield.toString(), 6),
    },
    to: yieldAgentAccount.address,
    from: orchestrator.address,
    parentDelegation: rootDelegation,
    environment,
  });
  const yieldSig = await orchestrator.signDelegation({ delegation: yieldDelegation });
  const signedYield = { ...yieldDelegation, signature: yieldSig } as SignedDelegation;

  // Execution Agent: 60 USDC cap (for DeFi protocol interactions + gas)
  const execDelegation = createDelegation({
    scope: {
      type: ScopeType.Erc20TransferAmount,
      tokenAddress: USDC,
      maxAmount: parseUnits(AGENT_BUDGETS.execution.toString(), 6),
    },
    to: executionAgentAccount.address,
    from: orchestrator.address,
    parentDelegation: rootDelegation,
    environment,
  });
  const execSig = await orchestrator.signDelegation({ delegation: execDelegation });
  const signedExec = { ...execDelegation, signature: execSig } as SignedDelegation;

  return {
    risk: signedRisk,
    yield: signedYield,
    execution: signedExec,
    chainInfo: {
      userAddress,
      orchestratorAddress: orchestrator.address,
      agents: [
        { role: 'risk', address: riskAgentAccount.address, budgetUsdc: AGENT_BUDGETS.risk },
        { role: 'yield', address: yieldAgentAccount.address, budgetUsdc: AGENT_BUDGETS.yield },
        { role: 'execution', address: executionAgentAccount.address, budgetUsdc: AGENT_BUDGETS.execution },
      ],
    },
  };
}

/**
 * Creates the root delegation (simulates what MetaMask does when user approves).
 * In the real app, this comes from the frontend via requestExecutionPermissions.
 */
export async function createRootDelegation(
  delegatorSmartAccount: SmartAccount,
  periodAmountUsdc: number
): Promise<SignedDelegation> {
  const orchestrator = await getOrchestratorSmartAccount();
  const currentTime = Math.floor(Date.now() / 1000);

  const delegation = createDelegation({
    scope: {
      type: ScopeType.Erc20PeriodTransfer,
      tokenAddress: USDC,
      periodAmount: parseUnits(periodAmountUsdc.toString(), 6),
      periodDuration: 604800, // 1 week
      startDate: currentTime,
    },
    to: orchestrator.address,
    from: delegatorSmartAccount.address,
    environment: delegatorSmartAccount.environment,
  });

  const signature = await delegatorSmartAccount.signDelegation({ delegation });
  return { ...delegation, signature } as SignedDelegation;
}

/**
 * Creates an open delegation for x402 payment.
 * The sub-agent creates this so the x402 facilitator can redeem it.
 */
export async function createX402Delegation(
  parentDelegation: SignedDelegation,
  amountUsdc: number
): Promise<SignedDelegation> {
  const orchestrator = await getOrchestratorSmartAccount();

  const delegation = createOpenDelegation({
    scope: {
      type: ScopeType.Erc20TransferAmount,
      tokenAddress: USDC,
      maxAmount: parseUnits(amountUsdc.toString(), 6),
    },
    from: orchestrator.address,
    parentDelegation,
    environment,
  });

  const signature = await orchestrator.signDelegation({ delegation });
  return { ...delegation, signature } as SignedDelegation;
}
