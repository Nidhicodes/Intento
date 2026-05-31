'use client';

/**
 * Live redelegation using MetaMask Smart Accounts delegations.
 *
 * Creates scoped sub-delegations from the signed root delegation down to each
 * sub-agent. The orchestrator (session account) signs each one locally — no
 * MetaMask popup, no gas. ERC-7710 attenuation: each cap can only narrow.
 *
 * Flow: Your Smart Account → Orchestrator (root) → Risk / Yield / Execution
 */
import {
  createPublicClient,
  http,
  parseUnits,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import {
  toMetaMaskSmartAccount,
  Implementation,
  createDelegation,
  ScopeType,
} from '@metamask/smart-accounts-kit';
import { getSessionKey, SEPOLIA_USDC } from './permissions';

// Sub-agent addresses (match backend keys)
export const SUB_AGENTS = {
  risk: { address: '0x69f11f19d96914064Ce11E799D5f14660DA8AcfF' as Address, budget: 20, role: 'Volatility & drawdown analysis' },
  yield: { address: '0x10984b7A82F1F1c6910D182f81D03CBd6E4e5c45' as Address, budget: 20, role: 'APY scanning across protocols' },
  execution: { address: '0x19f7bDd940712E4b71f4EE1Ef57338220A181252' as Address, budget: 60, role: 'Trade execution via 1Shot' },
} as const;

export interface Redelegation {
  agent: 'risk' | 'yield' | 'execution';
  to: Address;
  budgetUsdc: number;
  signedDelegation: any;
  delegationHash: Hex;
}

const RPC = 'https://sepolia.base.org';

/**
 * Creates the three redelegations from the signed root delegation.
 * The orchestrator (a smart account signed by the session key) redelegates
 * a narrowed budget to each sub-agent.
 */
export async function createRedelegations(rootDelegation: any): Promise<Redelegation[]> {
  const sessionKey = getSessionKey();
  const sessionAccount = privateKeyToAccount(sessionKey);

  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC) });

  // The orchestrator is itself a smart account, signed by the session key.
  // It is the delegate of the root delegation, so it can redelegate.
  const orchestratorSA = await toMetaMaskSmartAccount({
    client: publicClient as any,
    implementation: Implementation.Hybrid,
    deployParams: [sessionAccount.address, [], [], []],
    deploySalt: '0x',
    signer: { account: sessionAccount },
  });

  const results: Redelegation[] = [];

  for (const [agentKey, agent] of Object.entries(SUB_AGENTS)) {
    // Redelegate from orchestrator → sub-agent, narrowing the budget cap
    const delegation = createDelegation({
      scope: {
        type: ScopeType.Erc20TransferAmount,
        tokenAddress: SEPOLIA_USDC,
        maxAmount: parseUnits(agent.budget.toString(), 6),
      },
      to: agent.address,
      from: orchestratorSA.address,
      parentDelegation: rootDelegation,
      environment: orchestratorSA.environment,
    });

    const signature = await orchestratorSA.signDelegation({ delegation });
    const signedDelegation = { ...delegation, signature };

    results.push({
      agent: agentKey as 'risk' | 'yield' | 'execution',
      to: agent.address,
      budgetUsdc: agent.budget,
      signedDelegation,
      delegationHash: (signedDelegation.authority || signature).slice(0, 66) as Hex,
    });
  }

  return results;
}
