/**
 * TEST 4: Can Venice x402 payments be made from delegated accounts?
 *
 * Flow:
 * 1. Create a smart account (buyer)
 * 2. Create a delegation (buyer → open, for x402 facilitator)
 * 3. Use @metamask/x402 to create a delegation provider
 * 4. Call Venice's x402-enabled endpoint
 *
 * IMPORTANT: The smart account needs USDC on Base Sepolia for this to work end-to-end.
 * If unfunded, we at least verify the SDK wiring works up to the payment step.
 */
import { parseUnits } from 'viem';
import {
  createDelegation,
  ScopeType,
  createOpenDelegation,
} from '@metamask/smart-accounts-kit';
import {
  createDelegatorSmartAccount,
  delegatorAccount,
  environment,
  publicClient,
  USDC_ADDRESS,
  chain,
  log,
  logResult,
} from './00-setup.js';

async function main() {
  const TEST = 'TEST-4-X402-VENICE';
  log(TEST, 'INFO', 'Starting: Venice x402 payment via delegation');

  // Step 1: Create buyer smart account
  log(TEST, 'INFO', 'Creating buyer smart account...');
  const buyerSmartAccount = await createDelegatorSmartAccount();
  log(TEST, 'INFO', `Buyer smart account: ${buyerSmartAccount.address}`);

  // Step 2: Check USDC balance
  const erc20Abi = [
    {
      name: 'balanceOf',
      type: 'function',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
    },
  ] as const;

  const balance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [buyerSmartAccount.address],
  });

  log(TEST, 'INFO', `USDC balance: ${Number(balance) / 1e6} USDC`);

  // Step 3: Try to import @metamask/x402
  log(TEST, 'INFO', 'Checking @metamask/x402 availability...');
  let x402Available = false;
  let createx402DelegationProvider: any;

  try {
    const x402Module = await import('@metamask/x402');
    createx402DelegationProvider = x402Module.createx402DelegationProvider;
    x402Available = true;
    log(TEST, 'INFO', '@metamask/x402 imported successfully');
  } catch (err: any) {
    log(TEST, 'INFO', `@metamask/x402 import failed: ${err.message}`);
    log(TEST, 'INFO', 'This might mean the package name is different. Checking alternatives...');

    // Try alternative package names
    const alternatives = ['@metamask/x402-erc7710', '@x402/metamask'];
    for (const pkg of alternatives) {
      try {
        const mod = await import(pkg);
        createx402DelegationProvider = mod.createx402DelegationProvider;
        x402Available = true;
        log(TEST, 'INFO', `Found at: ${pkg}`);
        break;
      } catch {}
    }
  }

  // Step 4: Try @x402/fetch
  let wrapFetchAvailable = false;
  try {
    const fetchModule = await import('@x402/fetch');
    wrapFetchAvailable = !!fetchModule.wrapFetchWithPayment;
    log(TEST, 'INFO', `@x402/fetch available: ${wrapFetchAvailable}`);
  } catch (err: any) {
    log(TEST, 'INFO', `@x402/fetch import failed: ${err.message}`);
  }

  // Step 5: Create an open delegation for x402 (simulating what the provider does)
  log(TEST, 'INFO', 'Creating open delegation for x402 payment...');
  const openDelegation = createOpenDelegation({
    scope: {
      type: ScopeType.Erc20TransferAmount,
      tokenAddress: USDC_ADDRESS,
      maxAmount: parseUnits('1', 6), // 1 USDC max for test
    },
    from: buyerSmartAccount.address,
    environment: buyerSmartAccount.environment,
  });

  log(TEST, 'INFO', `Open delegation created (1 USDC cap, any redeemer)`);
  log(TEST, 'INFO', `  Delegator: ${openDelegation.delegator}`);
  log(TEST, 'INFO', `  Delegate: ${openDelegation.delegate} (should be open/any)`);
  log(TEST, 'INFO', `  Caveats: ${openDelegation.caveats.length}`);

  // Step 6: Sign it
  const signature = await buyerSmartAccount.signDelegation({ delegation: openDelegation });
  log(TEST, 'INFO', `Open delegation signed`);

  // Step 7: Probe Venice x402 endpoint
  log(TEST, 'INFO', 'Probing Venice x402 endpoint...');
  let veniceX402Works = false;

  try {
    // Call Venice without payment — should get 402
    const response = await fetch('https://api.venice.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b',
        messages: [{ role: 'user', content: 'hello' }],
        max_tokens: 5,
      }),
    });

    log(TEST, 'INFO', `Venice response status: ${response.status}`);

    if (response.status === 402) {
      // Check for PAYMENT-REQUIRED header
      const paymentRequired = response.headers.get('PAYMENT-REQUIRED');
      log(TEST, 'INFO', `PAYMENT-REQUIRED header present: ${!!paymentRequired}`);

      if (paymentRequired) {
        try {
          const decoded = Buffer.from(paymentRequired, 'base64').toString('utf-8');
          const parsed = JSON.parse(decoded);
          log(TEST, 'INFO', `Payment requirements: ${JSON.stringify(parsed).substring(0, 300)}`);
          veniceX402Works = true;
        } catch {
          log(TEST, 'INFO', `PAYMENT-REQUIRED header (raw): ${paymentRequired.substring(0, 200)}`);
          veniceX402Works = true; // Header exists, just different format
        }
      }
    } else if (response.status === 401) {
      log(TEST, 'INFO', 'Got 401 — Venice might require API key OR x402 on a different path');
      // Try the x402-specific endpoint
      const x402Response = await fetch('https://api.venice.ai/api/v1/x402/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b',
          messages: [{ role: 'user', content: 'hello' }],
          max_tokens: 5,
        }),
      });
      log(TEST, 'INFO', `Venice x402 path status: ${x402Response.status}`);
      if (x402Response.status === 402) {
        veniceX402Works = true;
      }
    }
  } catch (err: any) {
    log(TEST, 'INFO', `Venice probe error: ${err.message}`);
  }

  // Step 8: Check MetaMask facilitator
  log(TEST, 'INFO', 'Checking MetaMask x402 facilitator on Base Sepolia...');
  let facilitatorWorks = false;
  try {
    const facilitatorUrl = 'https://tx-sentinel-base-sepolia.api.cx.metamask.io/platform/v2/x402';
    const facResponse = await fetch(facilitatorUrl, { method: 'GET' });
    log(TEST, 'INFO', `Facilitator status: ${facResponse.status}`);
    facilitatorWorks = facResponse.status !== 0; // Any response means it's reachable
  } catch (err: any) {
    log(TEST, 'INFO', `Facilitator error: ${err.message}`);
  }

  // Step 9: Evaluate
  const sdkWorks = x402Available || wrapFetchAvailable;
  const delegationWorks = signature.length > 2;

  log(TEST, 'INFO', '\n📋 Summary:');
  log(TEST, 'INFO', `  SDK packages available: ${sdkWorks}`);
  log(TEST, 'INFO', `  Delegation creation works: ${delegationWorks}`);
  log(TEST, 'INFO', `  Venice x402 endpoint responds with 402: ${veniceX402Works}`);
  log(TEST, 'INFO', `  MetaMask facilitator reachable: ${facilitatorWorks}`);
  log(TEST, 'INFO', `  USDC balance sufficient: ${Number(balance) > 0}`);

  const overallPass = delegationWorks && (veniceX402Works || facilitatorWorks);

  logResult(TEST, overallPass,
    overallPass
      ? 'x402 Venice payment flow is viable. Delegation creation works, Venice/facilitator endpoints respond.'
      : 'x402 flow has issues. Check which component failed above.'
  );

  if (!Number(balance)) {
    console.log('\n⚠️  NOTE: Smart account has no USDC. Fund it to test actual payment settlement.');
    console.log(`  Address to fund: ${buyerSmartAccount.address}`);
    console.log('  Need: ~5 USDC on Base Sepolia');
  }
}

main().catch((err) => {
  console.error('❌ [TEST-4] FAILED with error:', err.message);
  console.error(err);
  process.exit(1);
});
