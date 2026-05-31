/**
 * TEST 1: Can MetaMask grant ERC-7715 permissions on Base Sepolia?
 *
 * This test creates a smart account (delegator), deploys it,
 * then creates a delegation directly (simulating what requestExecutionPermissions does).
 *
 * NOTE: requestExecutionPermissions requires a browser + MetaMask extension.
 * For headless testing, we simulate the same flow programmatically:
 * - Create delegator smart account
 * - Create a delegation with erc20 periodic scope
 * - Sign it
 * - Verify the delegation is valid
 *
 * For the REAL browser test, use the Scaffold-ETH extension.
 */
import { parseUnits } from 'viem';
import {
  createDelegation,
  ScopeType,
} from '@metamask/smart-accounts-kit';
import {
  createDelegatorSmartAccount,
  orchestratorAccount,
  environment,
  bundlerClient,
  publicClient,
  USDC_ADDRESS,
  log,
  logResult,
} from './00-setup.js';

async function main() {
  const TEST = 'TEST-1-PERMISSIONS';
  log(TEST, 'INFO', 'Starting: ERC-7715 permission grant simulation on Base Sepolia');

  // Step 1: Create delegator smart account
  log(TEST, 'INFO', 'Creating delegator smart account...');
  const delegatorSmartAccount = await createDelegatorSmartAccount();
  log(TEST, 'INFO', `Delegator smart account address: ${delegatorSmartAccount.address}`);

  // Step 2: Check if deployed (if not, first UserOp will deploy it)
  const code = await publicClient.getCode({ address: delegatorSmartAccount.address });
  log(TEST, 'INFO', `Account deployed: ${!!code}`);

  // Step 3: Create a delegation with ERC-20 periodic scope
  // This simulates what MetaMask does internally when user approves requestExecutionPermissions
  const currentTime = Math.floor(Date.now() / 1000);
  const delegation = createDelegation({
    scope: {
      type: ScopeType.Erc20PeriodTransfer,
      tokenAddress: USDC_ADDRESS,
      periodAmount: parseUnits('100', 6), // 100 USDC per week
      periodDuration: 604800, // 1 week
      startDate: currentTime,
    },
    to: orchestratorAccount.address,
    from: delegatorSmartAccount.address,
    environment: delegatorSmartAccount.environment,
  });

  log(TEST, 'INFO', `Delegation created with hash authority`);
  log(TEST, 'INFO', `  Delegator: ${delegation.delegator}`);
  log(TEST, 'INFO', `  Delegate (orchestrator): ${delegation.delegate}`);
  log(TEST, 'INFO', `  Caveats count: ${delegation.caveats.length}`);

  // Step 4: Sign the delegation
  const signature = await delegatorSmartAccount.signDelegation({ delegation });
  log(TEST, 'INFO', `Delegation signed. Signature length: ${signature.length}`);

  const signedDelegation = { ...delegation, signature };

  // Step 5: Verify the delegation structure is valid
  const isValid =
    signedDelegation.delegate.toLowerCase() === orchestratorAccount.address.toLowerCase() &&
    signedDelegation.delegator.toLowerCase() === delegatorSmartAccount.address.toLowerCase() &&
    signedDelegation.caveats.length > 0 &&
    signedDelegation.signature.length > 2;

  logResult(TEST, isValid, isValid
    ? `ERC-7715 permission simulation PASSED. Delegation created and signed on Base Sepolia (chain ${84532}).`
    : `Delegation structure invalid.`
  );

  // Export for next test
  console.log('\n📋 Save this for Test 2:');
  console.log(`DELEGATOR_SMART_ACCOUNT=${delegatorSmartAccount.address}`);
  console.log(`SIGNED_DELEGATION_EXISTS=true`);

  return signedDelegation;
}

main().catch((err) => {
  console.error('❌ [TEST-1] FAILED with error:', err.message);
  console.error(err);
  process.exit(1);
});
