import 'dotenv/config';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type Chain,
} from 'viem';
import { createBundlerClient } from 'viem/account-abstraction';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import {
  getSmartAccountsEnvironment,
  toMetaMaskSmartAccount,
  Implementation,
  contracts,
  actions,
} from '@metamask/smart-accounts-kit';

const { erc7710WalletActions, erc7710BundlerActions } = actions;
export const { DelegationManager } = contracts;

// --- Chain Selection ---
const isMainnet = process.env.CHAIN === 'base';
export const chain: Chain = isMainnet ? base : baseSepolia;
export const chainId = chain.id;

// --- Token Addresses ---
export const USDC: Address = isMainnet
  ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
  : '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

// --- Environment ---
export const environment = getSmartAccountsEnvironment(chainId);

// --- Clients ---
const rpcUrl = process.env.RPC_URL || (isMainnet ? 'https://mainnet.base.org' : 'https://sepolia.base.org');

export const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});

const pimlicoUrl = `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${process.env.PIMLICO_API_KEY}`;

export const bundlerClient = createBundlerClient({
  client: publicClient,
  transport: http(pimlicoUrl),
  paymaster: true,
}).extend(erc7710BundlerActions());

// --- Agent Accounts ---
export const orchestratorAccount = privateKeyToAccount(process.env.ORCHESTRATOR_PRIVATE_KEY as Hex);
export const riskAgentAccount = privateKeyToAccount(process.env.RISK_AGENT_PRIVATE_KEY as Hex);
export const yieldAgentAccount = privateKeyToAccount(process.env.YIELD_AGENT_PRIVATE_KEY as Hex);
export const executionAgentAccount = privateKeyToAccount(process.env.EXECUTION_AGENT_PRIVATE_KEY as Hex);

// --- Wallet Clients (for signing delegations + x402) ---
export const orchestratorWallet = createWalletClient({
  account: orchestratorAccount,
  chain,
  transport: http(rpcUrl),
}).extend(erc7710WalletActions());

export const riskAgentWallet = createWalletClient({
  account: riskAgentAccount,
  chain,
  transport: http(rpcUrl),
}).extend(erc7710WalletActions());

export const yieldAgentWallet = createWalletClient({
  account: yieldAgentAccount,
  chain,
  transport: http(rpcUrl),
}).extend(erc7710WalletActions());

// --- Smart Accounts (lazy-created) ---
let _orchestratorSmartAccount: Awaited<ReturnType<typeof toMetaMaskSmartAccount>> | null = null;

export async function getOrchestratorSmartAccount() {
  if (!_orchestratorSmartAccount) {
    _orchestratorSmartAccount = await toMetaMaskSmartAccount({
      client: publicClient,
      implementation: Implementation.Hybrid,
      deployParams: [orchestratorAccount.address, [], [], []],
      deploySalt: '0x',
      signer: { account: orchestratorAccount },
    });
  }
  return _orchestratorSmartAccount;
}

// --- Constants ---
export const AGENT_BUDGETS = {
  risk: 20,      // USDC
  yield: 20,     // USDC
  execution: 60, // USDC
  total: 100,    // USDC per week
} as const;

export const CONFIDENCE_THRESHOLD = 0.4;
export const RISK_WEIGHT = 0.4;
export const YIELD_WEIGHT = 0.6;

// --- 1Shot (mainnet only) ---
export const ONESHOT_URL = 'https://relayer.1shotapi.com/relayers';

// --- Venice / LLM ---
// Use Groq (free) for development, Venice for production x402 demo
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'groq'; // 'groq' | 'venice'

export const VENICE_API_URL = LLM_PROVIDER === 'venice'
  ? 'https://api.venice.ai/api/v1'
  : 'https://api.groq.com/openai/v1';

export const VENICE_MODEL = LLM_PROVIDER === 'venice'
  ? 'llama-3.3-70b'
  : 'llama-3.3-70b-versatile';

export const LLM_API_KEY = LLM_PROVIDER === 'venice'
  ? process.env.VENICE_API_KEY
  : process.env.GROQ_API_KEY;
