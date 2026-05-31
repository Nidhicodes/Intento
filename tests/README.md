# Integration Validation Tests

Run these in order. If any fail, architecture changes before building.

## Prerequisites

1. Install MetaMask browser extension (production >= v13.23.0)
2. Get a Pimlico API key: https://docs.pimlico.io/guides/create-api-key
3. Get Base Sepolia USDC from a faucet
4. Have Node.js 18+ installed

## Setup

```bash
cd tests
pnpm install
```

Then copy `.env.example` to `.env` and fill in your keys.

## Test Order

1. `pnpm test:permissions` — ERC-7715 permission grant on Base Sepolia
2. `pnpm test:redelegation` — Create and redeem a delegation chain
3. `pnpm test:1shot` — Relay a delegated transaction via 1Shot
4. `pnpm test:x402` — Pay Venice via x402 with delegation
5. `pnpm test:combined` — Full flow end-to-end

## Results

After each test, note:
- PASS / FAIL
- If FAIL: exact error message
- Time taken
- Any unexpected behavior
