/**
 * Execution Agent — submits DeFi transactions via 1Shot relayer (mainnet)
 * or Pimlico bundler (testnet) using the delegated permission.
 */
import { encodeFunctionData, parseUnits, erc20Abi, type Address, type Hex } from 'viem';
import {
  USDC,
  ONESHOT_URL,
  chainId,
  bundlerClient,
  publicClient,
  getOrchestratorSmartAccount,
  environment,
} from '../config.js';
import { createExecution, ExecutionMode, contracts } from '@metamask/smart-accounts-kit';
import type { Strategy } from '../types.js';

const { DelegationManager } = contracts;

interface ExecutionResult {
  txHash: string | null;
  method: '1shot' | 'pimlico' | 'simulated';
  gasFeePaid: number;
  error: string | null;
}

/**
 * Executes the strategy. Tries 1Shot on mainnet, falls back to Pimlico bundler.
 */
export async function executeStrategy(
  strategy: Strategy,
  rootDelegation: any, // SignedDelegation
  riskRedelegation: any, // SignedDelegation (for the execution agent's delegation)
): Promise<ExecutionResult> {
  if (strategy.action === 'hold') {
    return { txHash: null, method: 'simulated', gasFeePaid: 0, error: null };
  }

  // Build calldata for the first transaction in the strategy
  const tx = strategy.transactions[0];
  if (!tx) {
    return { txHash: null, method: 'simulated', gasFeePaid: 0, error: 'No transactions in strategy' };
  }

  // Encode the actual protocol interaction based on strategy
  // For deposits: encode supply/deposit call to the target protocol
  // For withdrawals: encode withdraw call
  // For swaps: encode swap router call
  // Simplified: use USDC transfer to the protocol address as demo
  const recipient = getProtocolAddress(tx.toProtocol || tx.fromProtocol || 'aave');
  const calldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [
      recipient,
      parseUnits(tx.amount.toString(), 6),
    ],
  });

  // Try 1Shot on mainnet (chain 8453)
  if (chainId === 8453) {
    try {
      return await executeVia1Shot(calldata, tx.amount);
    } catch (err: any) {
      console.log(`1Shot failed: ${err.message}, falling back to Pimlico`);
    }
  }

  // Fallback: Pimlico bundler with delegation
  try {
    return await executeViaPimlico(calldata, rootDelegation, riskRedelegation);
  } catch (err: any) {
    return { txHash: null, method: 'pimlico', gasFeePaid: 0, error: err.message };
  }
}

async function executeVia1Shot(calldata: Hex, amountUsdc: number): Promise<ExecutionResult> {
  // Step 1: Get fee quote
  const feeRes = await fetch(ONESHOT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'relayer_getFeeData',
      params: { chainId: '8453', token: USDC },
    }),
  });

  const feeData = await feeRes.json();
  if (feeData.error) throw new Error(feeData.error.message);

  const minFee = parseFloat(feeData.result.minFee);

  // Step 2: Submit transaction
  const submitRes = await fetch(ONESHOT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'relayer_sendTransactions',
      params: {
        chainId: '8453',
        transactions: [{ to: USDC, data: calldata, value: '0x0' }],
        feeToken: USDC,
        feeAmount: feeData.result.minFee,
        context: feeData.result.context,
      },
    }),
  });

  const submitData = await submitRes.json();
  if (submitData.error) throw new Error(submitData.error.message);

  return {
    txHash: submitData.result?.taskId || null,
    method: '1shot',
    gasFeePaid: minFee,
    error: null,
  };
}

async function executeViaPimlico(
  calldata: Hex,
  rootDelegation: any,
  execDelegation: any
): Promise<ExecutionResult> {
  const orchestrator = await getOrchestratorSmartAccount();

  // Build redemption calldata
  const execution = createExecution({
    target: USDC,
    callData: calldata,
  });

  const redeemCalldata = DelegationManager.encode.redeemDelegations({
    delegations: [[execDelegation, rootDelegation]],
    modes: [ExecutionMode.SingleDefault],
    executions: [[execution]],
  });

  // Submit via bundler
  const userOpHash = await bundlerClient.sendUserOperationWithDelegation({
    publicClient,
    account: orchestrator,
    calls: [{
      to: USDC,
      data: calldata,
      permissionContext: rootDelegation,
      delegationManager: environment.DelegationManager,
    }],
    maxFeePerGas: 1n,
    maxPriorityFeePerGas: 1n,
  });

  return {
    txHash: userOpHash,
    method: 'pimlico',
    gasFeePaid: 0.01,
    error: null,
  };
}

// Protocol address mapping (Base mainnet)
const PROTOCOL_ADDRESSES: Record<string, Address> = {
  aave: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5' as Address,    // Aave V3 Pool on Base
  compound: '0xb125E6687d4313864e53df431d5425969c15Eb2F' as Address, // Compound V3 USDC on Base
  curve: '0x0000000000000000000000000000000000000000' as Address,     // Placeholder
  uniswap: '0x2626664c2603336E57B271c5C0b26F421741e481' as Address,  // Uniswap V3 Router on Base
};

function getProtocolAddress(protocol: string | null): Address {
  if (!protocol) return PROTOCOL_ADDRESSES.aave;
  return PROTOCOL_ADDRESSES[protocol.toLowerCase()] || PROTOCOL_ADDRESSES.aave;
}
