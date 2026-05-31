/**
 * TEST 2: Can you create and redeem a redelegation chain?
 * User (delegator) → Orchestrator (Agent A) → Risk Agent (Agent B)
 *
 * Flow:
 * 1. Create delegator smart account
 * 2. Create root delegation: delegator → orchestrator (100 USDC)
 * 3. Create redelegation: orchestrator → risk agent (20 USDC)
 * 4. Verify the chain is structurally valid
 * 5. (Optional) Attempt to redeem if accounts are funded
 */
import { parseUnits } from 'viem';
import {
  createDelegation,
  ScopeType,
} from '@metamask/smart-accounts-kit';
import {
  createDelegatorSmartAccount,
  createOrchestratorSmartAccount,
  orchestratorAccount,
  riskAgentAccount,
  environment,
  publicClient,
  USDC_ADDRESS,
  log,
  logResult,
} from './00-setup.js';

async function main() {
  const TEST = 'TEST-2-REDELEGATION';
  log(TEST, 'INFO', 'Starting: Redelegation chain creation');

  // Step 1: Create smart accounts
  log(TEST, 'INFO', 'Creating delegator smart account...');
  const delegatorSmartAccount = await createDelegatorSmartAccount();
  log(TEST, 'INFO', `Delegator: ${delegatorSmartAccount.address}`);

  log(TEST, 'INFO', 'Creating orchestrator smart account...');
  const orchestratorSmartAccount = await createOrchestratorSmartAccount();
  log(TEST, 'INFO', `Orchestrator: ${orchestratorSmartAccount.address}`);

  // Step 2: Create root delegation (delegator → orchestrator, 100 USDC periodic)
  const currentTime = Math.floor(Date.now() / 1000);
  const rootDelegation = createDelegation({
    scope: {
      type: ScopeType.Erc20PeriodTransfer,
      tokenAddress: USDC_ADDRESS,
      periodAmount: parseUnits('100', 6),
      periodDuration: 604800,
      startDate: currentTime,
    },
    to: orchestratorSmartAccount.address,
    from: delegatorSmartAccount.address,
    environment: delegatorSmartAccount.environment,
  });

  log(TEST, 'INFO', 'Root delegation created (delegator → orchestrator, 100 USDC/week)');

  // Step 3: Sign root delegation
  const rootSignature = await delegatorSmartAccount.signDelegation({
    delegation: rootDelegation,
  });
  const signedRootDelegation = { ...rootDelegation, signature: rootSignature };
  log(TEST, 'INFO', `Root delegation signed.`);

  // Step 4: Create redelegation (orchestrator → risk agent, 20 USDC)
  // The redelegation narrows the scope from 100 USDC to 20 USDC
  const redelegation = createDelegation({
    scope: {
      type: ScopeType.Erc20TransferAmount,
      tokenAddress: USDC_ADDRESS,
      maxAmount: parseUnits('20', 6), // 20 USDC cap
    },
    to: riskAgentAccount.address,
    from: orchestratorSmartAccount.address,
    parentDelegation: signedRootDelegation,
    environment: orchestratorSmartAccount.environment,
  });

  log(TEST, 'INFO', 'Redelegation created (orchestrator → risk agent, 20 USDC cap)');

  // Step 5: Sign redelegation
  const redelegationSignature = await orchestratorSmartAccount.signDelegation({
    delegation: redelegation,
  });
  const signedRedelegation = { ...redelegation, signature: redelegationSignature };
  log(TEST, 'INFO', `Redelegation signed.`);

  // Step 6: Validate chain structure
  const chainValid =
    // Root delegation: delegator → orchestrator
    signedRootDelegation.delegator.toLowerCase() === delegatorSmartAccount.address.toLowerCase() &&
    signedRootDelegation.delegate.toLowerCase() === orchestratorSmartAccount.address.toLowerCase() &&
    // Redelegation: orchestrator → risk agent
    signedRedelegation.delegator.toLowerCase() === orchestratorSmartAccount.address.toLowerCase() &&
    signedRedelegation.delegate.toLowerCase() === riskAgentAccount.address.toLowerCase() &&
    // Authority chain: redelegation's authority should be a hash (not ROOT_AUTHORITY)
    signedRedelegation.authority.length === 66 &&
    signedRedelegation.authority !== signedRootDelegation.authority; // child != root authority

  log(TEST, 'INFO', `Chain validation:`);
  log(TEST, 'INFO', `  Root delegator matches: ${signedRootDelegation.delegator.toLowerCase() === delegatorSmartAccount.address.toLowerCase()}`);
  log(TEST, 'INFO', `  Root delegate matches orchestrator: ${signedRootDelegation.delegate.toLowerCase() === orchestratorSmartAccount.address.toLowerCase()}`);
  log(TEST, 'INFO', `  Redelegation delegator matches orchestrator: ${signedRedelegation.delegator.toLowerCase() === orchestratorSmartAccount.address.toLowerCase()}`);
  log(TEST, 'INFO', `  Redelegation delegate matches risk agent: ${signedRedelegation.delegate.toLowerCase() === riskAgentAccount.address.toLowerCase()}`);
  log(TEST, 'INFO', `  Authority chain valid (child has parent hash): ${signedRedelegation.authority.length === 66 && signedRedelegation.authority !== signedRootDelegation.authority}`);

  logResult(TEST, chainValid,
    chainValid
      ? 'Redelegation chain PASSED. User → Orchestrator → Risk Agent delegation chain is structurally valid.'
      : `Chain validation failed. Check authority linkage.`
  );

  console.log('\n📋 Chain summary:');
  console.log(`  User (${delegatorSmartAccount.address})`);
  console.log(`    └─ 100 USDC/week → Orchestrator (${orchestratorSmartAccount.address})`);
  console.log(`        └─ 20 USDC cap → Risk Agent (${riskAgentAccount.address})`);
}

main().catch((err) => {
  console.error('❌ [TEST-2] FAILED with error:', err.message);
  console.error(err);
  process.exit(1);
});
