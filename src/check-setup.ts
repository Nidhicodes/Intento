/**
 * Pre-demo setup checker.
 * Inspects all agent addresses on Base Sepolia and reports exactly
 * what needs funding before recording the demo.
 *
 * Usage: npx tsx src/check-setup.ts
 */
import 'dotenv/config';
import {
  createPublicClient,
  http,
  formatEther,
  formatUnits,
  erc20Abi,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const RPC = process.env.RPC_URL || 'https://sepolia.base.org';
const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address; // Base Sepolia USDC

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC),
});

interface AccountInfo {
  role: string;
  address: Address;
  needsGas: boolean;
  needsUsdc: boolean;
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  INTENTO — Base Sepolia Setup Check');
  console.log('═══════════════════════════════════════════════════\n');

  // Derive all agent addresses from env keys
  const accounts: AccountInfo[] = [];

  const keyMap: { role: string; env: string; needsGas: boolean; needsUsdc: boolean }[] = [
    { role: 'Orchestrator (session)', env: 'ORCHESTRATOR_PRIVATE_KEY', needsGas: true, needsUsdc: false },
    { role: 'Risk Agent', env: 'RISK_AGENT_PRIVATE_KEY', needsGas: true, needsUsdc: false },
    { role: 'Yield Scanner', env: 'YIELD_AGENT_PRIVATE_KEY', needsGas: true, needsUsdc: false },
    { role: 'Execution Agent', env: 'EXECUTION_AGENT_PRIVATE_KEY', needsGas: true, needsUsdc: false },
  ];

  for (const k of keyMap) {
    const pk = process.env[k.env] as Hex | undefined;
    if (!pk) {
      console.log(`⚠️  ${k.role}: ${k.env} not set in .env`);
      continue;
    }
    const acct = privateKeyToAccount(pk);
    accounts.push({ role: k.role, address: acct.address, needsGas: k.needsGas, needsUsdc: k.needsUsdc });
  }

  console.log('Checking balances on Base Sepolia...\n');

  const toFund: string[] = [];

  for (const acct of accounts) {
    const ethBalance = await publicClient.getBalance({ address: acct.address });
    let usdcBalance = 0n;
    try {
      usdcBalance = await publicClient.readContract({
        address: USDC,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [acct.address],
      });
    } catch {}

    const ethStr = parseFloat(formatEther(ethBalance)).toFixed(5);
    const usdcStr = parseFloat(formatUnits(usdcBalance, 6)).toFixed(2);

    const gasOk = ethBalance > 0n;
    const usdcOk = !acct.needsUsdc || usdcBalance > 0n;

    console.log(`${gasOk && usdcOk ? '✅' : '⚠️ '} ${acct.role}`);
    console.log(`   ${acct.address}`);
    console.log(`   ETH: ${ethStr}  |  USDC: ${usdcStr}`);

    if (!gasOk) {
      console.log(`   → NEEDS Sepolia ETH for gas`);
      toFund.push(`${acct.role}: ${acct.address} (needs ETH)`);
    }
    if (acct.needsUsdc && !usdcOk) {
      console.log(`   → NEEDS Sepolia USDC`);
      toFund.push(`${acct.role}: ${acct.address} (needs USDC)`);
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════');
  if (toFund.length === 0) {
    console.log('  ✅ ALL ACCOUNTS FUNDED — ready to record demo');
  } else {
    console.log('  ⚠️  FUNDING NEEDED:\n');
    toFund.forEach((f) => console.log(`   • ${f}`));
    console.log('\n  Get free Base Sepolia ETH:');
    console.log('   → https://www.alchemy.com/faucets/base-sepolia');
    console.log('   → https://docs.base.org/tools/network-faucets');
    console.log('\n  Get free Base Sepolia USDC (Circle faucet):');
    console.log('   → https://faucet.circle.com (select Base Sepolia)');
  }
  console.log('═══════════════════════════════════════════════════\n');

  // Demo guidance
  console.log('📋 FUNDING STRATEGY FOR DEMO:');
  console.log('   1. Fund all 4 agent EOAs above with ~0.002 Sepolia ETH each (gas).');
  console.log('      The Risk Agent especially — it submits the redeem + overspend txs.');
  console.log('   2. Fund your MetaMask wallet (the one you connect in the UI) with:');
  console.log('      • ~0.01 Sepolia ETH (to deploy the smart account on first grant)');
  console.log('      • ~5 test USDC (the funds the redeem proof moves)');
  console.log('   3. The OVERSPEND test reverts — it only costs gas, moves nothing.');
  console.log('');
  console.log('   Note: the orchestrator session address must match between');
  console.log('   frontend and backend. With NEXT_PUBLIC_ORCHESTRATOR_KEY set, it does.');
  console.log('   Expected orchestrator: 0x24C1DF5B0995E059Ce1641523cd38c564fbf4D5B\n');
}

main().catch((err) => {
  console.error('❌ Setup check failed:', err.message);
  process.exit(1);
});
