/**
 * Shared setup for all tests.
 * Creates accounts, clients, and smart accounts needed across tests.
 */
import 'dotenv/config';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
} from 'viem';
import { createBundlerClient } from 'viem/account-abstraction';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import {
  toMetaMaskSmartAccount,
  Implementation,
  getSmartAccountsEnvironment,
} from '@metamask/smart-accounts-kit';
import { actions } from '@metamask/smart-accounts-kit';
const { erc7710WalletActions, erc7710BundlerActions } = actions;

// --- Config ---
export const chain = baseSepolia;
export const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address; // Base Sepolia USDC

// --- Clients ---
export const publicClient = createPublicClient({
  chain,
  transport: http(process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org'),
});

const pimlicoUrl = `https://api.pimlico.io/v2/${chain.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`;

export const bundlerClient = createBundlerClient({
  client: publicClient,
  transport: http(pimlicoUrl),
  paymaster: true, // Pimlico acts as paymaster too
}).extend(erc7710BundlerActions());

// --- Accounts ---
export const delegatorAccount = privateKeyToAccount(process.env.DELEGATOR_PRIVATE_KEY as Hex);
export const orchestratorAccount = privateKeyToAccount(process.env.ORCHESTRATOR_PRIVATE_KEY as Hex);
export const riskAgentAccount = privateKeyToAccount(process.env.RISK_AGENT_PRIVATE_KEY as Hex);

// --- Smart Accounts ---
export async function createDelegatorSmartAccount() {
  return toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Hybrid,
    deployParams: [delegatorAccount.address, [], [], []],
    deploySalt: '0x',
    signer: { account: delegatorAccount },
  });
}

export async function createOrchestratorSmartAccount() {
  return toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Hybrid,
    deployParams: [orchestratorAccount.address, [], [], []],
    deploySalt: '0x',
    signer: { account: orchestratorAccount },
  });
}

// --- Environment ---
export const environment = getSmartAccountsEnvironment(chain.id);

// --- Wallet Clients for ERC-7710 ---
export const orchestratorWalletClient = createWalletClient({
  account: orchestratorAccount,
  chain,
  transport: http(process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org'),
}).extend(erc7710WalletActions());

export const riskAgentWalletClient = createWalletClient({
  account: riskAgentAccount,
  chain,
  transport: http(process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org'),
}).extend(erc7710WalletActions());

// --- Helpers ---
export function log(test: string, status: 'PASS' | 'FAIL' | 'INFO', message: string) {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : 'ℹ️';
  console.log(`${icon} [${test}] ${message}`);
}

export function logResult(test: string, passed: boolean, details: string) {
  log(test, passed ? 'PASS' : 'FAIL', details);
  if (!passed) {
    console.log('\n⚠️  ARCHITECTURE CHANGE NEEDED. Stop here and reassess.\n');
    process.exit(1);
  }
}
