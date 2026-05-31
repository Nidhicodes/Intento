'use client';

/**
 * MetaMask Smart Accounts delegation flow.
 *
 * Works with ANY MetaMask version (signer-agnostic) — uses an EIP-712
 * signature instead of the bleeding-edge wallet_requestExecutionPermissions.
 *
 * Flow:
 *  1. Connect MetaMask (your EOA)
 *  2. Create a MetaMask Smart Account with your wallet as the signer
 *  3. Create a root delegation: your smart account → orchestrator (signed via MetaMask)
 *
 * Runs on Base Sepolia (free testnet).
 */
import {
  createWalletClient,
  createPublicClient,
  custom,
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
  getSmartAccountsEnvironment,
} from '@metamask/smart-accounts-kit';

// Base Sepolia USDC
export const SEPOLIA_USDC: Address = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

export interface GrantResult {
  rootDelegation: any; // signed root delegation (your SA → orchestrator SA)
  smartAccountAddress: Address; // your (user) smart account
  ownerAddress: Address; // your MetaMask EOA (owner of the user SA)
  orchestratorSaAddress: Address; // orchestrator smart account (root delegate)
  sessionAccountAddress: Address; // orchestrator EOA (signer)
  contextHash: string;
}

export interface PermissionParams {
  periodAmountUsdc: number;
  justification: string;
}

const RPC = 'https://sepolia.base.org';

/**
 * Finds the MetaMask provider specifically, even when other wallets
 * (Phantom, Coinbase, etc.) are installed and competing for window.ethereum.
 */
function getMetaMaskProvider(): any {
  if (typeof window === 'undefined') return null;
  const eth = (window as any).ethereum;
  if (!eth) return null;

  // EIP-5749 / multi-provider: window.ethereum.providers is an array
  if (Array.isArray(eth.providers) && eth.providers.length > 0) {
    const mm = eth.providers.find((p: any) => p.isMetaMask && !p.isPhantom && !p.isBraveWallet);
    if (mm) return mm;
  }

  // Single provider that is MetaMask
  if (eth.isMetaMask && !eth.isPhantom) return eth;

  // Last resort: return whatever is there (will at least not crash)
  return eth;
}

/**
 * Creates a MetaMask Smart Account (signed by the user's MetaMask wallet),
 * then creates and signs a root delegation to the orchestrator.
 */
export async function requestPermission(params: PermissionParams): Promise<GrantResult> {
  const ethereum = getMetaMaskProvider();
  if (!ethereum) {
    throw new Error('MetaMask not detected. Install the MetaMask extension.');
  }

  // Ensure accounts are available (targets MetaMask specifically)
  await ethereum.request({ method: 'eth_requestAccounts' });

  // Ensure we're on Base Sepolia
  await ensureBaseSepolia(ethereum);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC),
  });

  // Get the connected MetaMask account
  const accounts: string[] = await ethereum.request({ method: 'eth_accounts' });
  const ownerAddress = accounts[0] as Address;
  if (!ownerAddress) {
    throw new Error('No MetaMask account connected.');
  }

  // Wallet client backed by MetaMask, with the account explicitly set
  const walletClient = createWalletClient({
    account: ownerAddress,
    chain: baseSepolia,
    transport: custom(ethereum),
  });

  // Create a MetaMask Smart Account owned/signed by the user's MetaMask wallet
  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient as any,
    implementation: Implementation.Hybrid,
    deployParams: [ownerAddress, [], [], []],
    deploySalt: '0x',
    signer: { walletClient: walletClient as any },
  });

  // Orchestrator: a smart account whose owner/signer is the shared session key.
  // The root delegation must delegate to THIS smart account (not the EOA), so
  // the orchestrator SA can later redelegate as the valid delegate.
  const sessionAccount = privateKeyToAccount(getSessionKey());
  const orchestratorSA = await toMetaMaskSmartAccount({
    client: publicClient as any,
    implementation: Implementation.Hybrid,
    deployParams: [sessionAccount.address, [], [], []],
    deploySalt: '0x',
    signer: { account: sessionAccount },
  });

  // Create the root delegation: user SA → orchestrator SA, capped at weekly budget
  const delegation = createDelegation({
    scope: {
      type: ScopeType.Erc20PeriodTransfer,
      tokenAddress: SEPOLIA_USDC,
      periodAmount: parseUnits(params.periodAmountUsdc.toString(), 6),
      periodDuration: 604800, // 1 week
      startDate: Math.floor(Date.now() / 1000),
    },
    to: orchestratorSA.address,
    from: smartAccount.address,
    environment: smartAccount.environment,
  });

  // Sign the delegation — THIS triggers the MetaMask signature request
  const signature = await smartAccount.signDelegation({ delegation });
  const rootDelegation = { ...delegation, signature };

  return {
    rootDelegation,
    smartAccountAddress: smartAccount.address,
    ownerAddress,
    orchestratorSaAddress: orchestratorSA.address,
    sessionAccountAddress: sessionAccount.address,
    contextHash: signature.slice(0, 42),
  };
}

/**
 * Ensures MetaMask is on Base Sepolia, adding/switching the network if needed.
 */
async function ensureBaseSepolia(ethereum: any): Promise<void> {
  const targetChainId = '0x14a34'; // 84532 in hex
  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: targetChainId }],
    });
  } catch (err: any) {
    // 4902 = chain not added
    if (err.code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: targetChainId,
          chainName: 'Base Sepolia',
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://sepolia.base.org'],
          blockExplorerUrls: ['https://sepolia.basescan.org'],
        }],
      });
    } else {
      throw err;
    }
  }
}

/**
 * Returns the orchestrator session account private key (shared with backend).
 */
export function getSessionKey(): Hex {
  const fixed = process.env.NEXT_PUBLIC_ORCHESTRATOR_KEY as Hex | undefined;
  if (fixed && fixed.startsWith('0x') && fixed.length === 66) {
    return fixed;
  }
  // Fallback (shouldn't happen with env set)
  const KEY = 'intento_session_key';
  let key = localStorage.getItem(KEY);
  if (!key) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    key = '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(KEY, key);
  }
  return key as Hex;
}
