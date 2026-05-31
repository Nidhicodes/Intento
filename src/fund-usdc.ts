/**
 * Sends test USDC from your wallet to the orchestrator smart account
 * so the enforcement proof can move real funds.
 *
 * Usage:
 *   FUNDER_KEY=0xYOUR_WALLET_KEY npx tsx src/fund-usdc.ts [amountUSDC]
 */
import 'dotenv/config';
import {
  createWalletClient,
  createPublicClient,
  http,
  encodeFunctionData,
  parseUnits,
  formatUnits,
  erc20Abi,
  type Hex,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { toMetaMaskSmartAccount, Implementation } from '@metamask/smart-accounts-kit';

const RPC = process.env.RPC_URL || 'https://sepolia.base.org';
const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address;

async function main() {
  const funderKey = process.env.FUNDER_KEY as Hex | undefined;
  if (!funderKey) {
    console.error('\n❌ Set FUNDER_KEY:  FUNDER_KEY=0xYOUR_KEY TARGET=0xSMART_ACCOUNT npx tsx src/fund-usdc.ts 9\n');
    process.exit(1);
  }
  const amount = process.argv[2] || '9';
  const target = process.env.TARGET as Address | undefined;

  const funder = privateKeyToAccount(funderKey);
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
  const walletClient = createWalletClient({ account: funder, chain: baseSepolia, transport: http(RPC) });

  // Target: explicit TARGET env, else fall back to orchestrator SA
  let destination: Address;
  if (target) {
    destination = target;
  } else {
    const orchestrator = privateKeyToAccount(process.env.ORCHESTRATOR_PRIVATE_KEY as Hex);
    const sa = await toMetaMaskSmartAccount({
      client: publicClient as any,
      implementation: Implementation.Hybrid,
      deployParams: [orchestrator.address, [], [], []],
      deploySalt: '0x',
      signer: { account: orchestrator },
    });
    destination = sa.address;
  }

  const bal = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [funder.address] });
  console.log(`\nFunder ${funder.address}: ${formatUnits(bal, 6)} USDC`);
  console.log(`Sending ${amount} USDC → ${destination}\n`);

  if (bal < parseUnits(amount, 6)) {
    console.error(`❌ Not enough USDC. Have ${formatUnits(bal, 6)}, need ${amount}.`);
    process.exit(1);
  }

  const data = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [destination, parseUnits(amount, 6)] });
  const hash = await walletClient.sendTransaction({ to: USDC, data, chain: baseSepolia });
  console.log(`→ tx: ${hash}`);
  await publicClient.waitForTransactionReceipt({ hash });

  // small delay for RPC to update
  await new Promise((r) => setTimeout(r, 2000));
  const newBal = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [destination] });
  console.log(`\n✅ ${destination} now holds ${formatUnits(newBal, 6)} USDC. Ready for the proof.\n`);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
