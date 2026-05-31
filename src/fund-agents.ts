/**
 * One-time helper: distributes a small amount of Base Sepolia ETH from your
 * funded wallet to the agent EOAs so they can pay gas for redemptions.
 *
 * Usage:
 *   FUNDER_KEY=0xYOUR_WALLET_PRIVATE_KEY npx tsx src/fund-agents.ts
 *
 * Your key is read from the FUNDER_KEY env var and never stored.
 * Sends 0.002 ETH to each agent (enough for several txs).
 */
import 'dotenv/config';
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  formatEther,
  type Hex,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const RPC = process.env.RPC_URL || 'https://sepolia.base.org';
const AMOUNT_PER_AGENT = '0.002'; // ETH

const AGENTS: { role: string; address: Address }[] = [
  { role: 'Risk Agent', address: '0x69f11f19d96914064Ce11E799D5f14660DA8AcfF' },
  { role: 'Yield Scanner', address: '0x10984b7A82F1F1c6910D182f81D03CBd6E4e5c45' },
  { role: 'Execution Agent', address: '0x19f7bDd940712E4b71f4EE1Ef57338220A181252' },
  { role: 'Orchestrator', address: '0x24C1DF5B0995E059Ce1641523cd38c564fbf4D5B' },
];

async function main() {
  const funderKey = process.env.FUNDER_KEY as Hex | undefined;
  if (!funderKey) {
    console.error('\n❌ Set FUNDER_KEY to your wallet private key:\n');
    console.error('   FUNDER_KEY=0xYOUR_KEY npx tsx src/fund-agents.ts\n');
    console.error('   (Export your MetaMask key: Account details → Show private key)');
    console.error('   This is testnet only — never use a key with real funds.\n');
    process.exit(1);
  }

  const funder = privateKeyToAccount(funderKey);
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
  const walletClient = createWalletClient({ account: funder, chain: baseSepolia, transport: http(RPC) });

  const balance = await publicClient.getBalance({ address: funder.address });
  console.log(`\nFunder: ${funder.address}`);
  console.log(`Balance: ${formatEther(balance)} ETH\n`);

  const needed = parseEther(AMOUNT_PER_AGENT) * BigInt(AGENTS.length);
  if (balance < needed) {
    console.error(`❌ Insufficient balance. Need ~${formatEther(needed)} ETH, have ${formatEther(balance)}.`);
    process.exit(1);
  }

  for (const agent of AGENTS) {
    const current = await publicClient.getBalance({ address: agent.address });
    if (current >= parseEther('0.001')) {
      console.log(`✓ ${agent.role} already funded (${formatEther(current)} ETH) — skipping`);
      continue;
    }
    process.stdout.write(`→ Sending ${AMOUNT_PER_AGENT} ETH to ${agent.role}... `);
    const hash = await walletClient.sendTransaction({
      to: agent.address,
      value: parseEther(AMOUNT_PER_AGENT),
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`done (${hash.slice(0, 12)}...)`);
  }

  console.log('\n✅ All agents funded. Run: npx tsx src/check-setup.ts to confirm.\n');
}

main().catch((err) => {
  console.error('❌ Funding failed:', err.message);
  process.exit(1);
});
