# Intento — Demo Testing Runbook

Everything runs on **Base Sepolia (free testnet)**. No mainnet, no paid credits.

## Prerequisites

1. **MetaMask** browser extension, v13.23.0+ (ERC-7715 is in production MetaMask now)
2. **Base Sepolia** network added to MetaMask:
   - Network: Base Sepolia
   - RPC: https://sepolia.base.org
   - Chain ID: 84532
   - Currency: ETH
   - Explorer: https://sepolia.basescan.org

## Step 1 — Check what needs funding

```bash
cd /Users/sqnidhi/Intento
npx tsx src/check-setup.ts
```

This shows all agent addresses and their balances, and tells you exactly what to fund.

## Step 2 — Fund the accounts (all free)

**Sepolia ETH (for gas)** — fund all 4 agent EOAs + your MetaMask wallet:
- https://www.alchemy.com/faucets/base-sepolia
- https://docs.base.org/tools/network-faucets

Send ~0.002 ETH to each agent address from the check output.

**Sepolia USDC (the funds the proof moves)** — fund your MetaMask wallet:
- https://faucet.circle.com (select Base Sepolia)
- Get ~5 test USDC

Re-run `npx tsx src/check-setup.ts` until all agents show ✅.

## Step 3 — Start both servers

Terminal 1 (backend):
```bash
cd /Users/sqnidhi/Intento
npx tsx src/server.ts
```

Terminal 2 (frontend):
```bash
cd /Users/sqnidhi/Intento/frontend
npx next dev
```

Open http://localhost:3000

## Step 4 — Walk the demo flow

1. **Landing** → click "Start Managing"
2. **Onboard Step 1** → type an intent (or click a chip) → "Parse Intent"
   - Backend parses via Groq (free), shows the permission spec
3. **Onboard Step 2** → "Continue to Permission Grant"
   - Connect MetaMask (Base Sepolia)
   - Click "Grant Permission · Sign Once" → **real MetaMask ERC-7715 dialog**
   - Approve → 3 redelegations form live with real hashes
4. **Dashboard** → "Navigate to your dashboard"
   - See the real delegation chain (your address → orchestrator → 3 agents)
   - Scroll to **"Onchain Enforcement Proof"**:
     - Click **"Redeem 1 USDC"** → succeeds, shows tx hash
     - Click **"Attempt 40 USDC"** → **REVERTS** (the headline moment)
5. **Audit Trail** → view the verifiable record
6. **Revoke** (sidebar) → clears the grant, agents disabled

## The winning moments to capture on video

1. The MetaMask permission dialog appearing (qualification requirement)
2. The 3 redelegations forming with real hashes (A2A coordination)
3. The overspend attempt getting **reverted by the contract** (the trust thesis)

## Troubleshooting

- **"Wallet does not support ERC-7715"** → update MetaMask to v13.23.0+
- **Redeem fails with "insufficient gas"** → fund the Risk Agent EOA with Sepolia ETH
- **Redeem fails with "allowance/balance"** → fund your MetaMask smart account with test USDC
- **Overspend doesn't revert** → check the cap in the redelegation matches (20 USDC for Risk)
