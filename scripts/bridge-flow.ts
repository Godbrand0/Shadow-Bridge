import { ethers } from "hardhat";

/**
 * bridge-flow.ts
 * End-to-end smoke test / demonstration of the full ShadowBridge flow.
 *
 * Steps exercised:
 *   1. User approves USDC spend on Sepolia.
 *   2. User calls ShadowBridgeETH.depositConfidential() with an FHE-encrypted amount.
 *   3. Script polls for the DepositInitiated event.
 *   4. Off-chain: wait for Circle attestation (CCTP ~20 min on testnet).
 *   5. Call ShadowBridgeBase.receiveAndEncrypt() on Base Sepolia with the attestation.
 *   6. User calls ShadowBridgeBase.stake() with an encrypted portion.
 *   7. User calls ShadowBridgeBase.accrueRewards() after some time.
 *   8. User calls ShadowBridgeBase.unstake() with an encrypted amount.
 *   9. User calls ShadowBridgeBase.decryptBalance() to trigger async KMS decrypt.
 *  10. Script listens for the DecryptionRequested event and prints the request ID.
 *
 * TODO (Step 2+): wire in @zama-fhe/relayer-sdk for client-side FHE encryption
 *                 and replace placeholder encrypted bytes below.
 */

const ETH_BRIDGE = process.env.ETH_BRIDGE_ADDRESS!;
const BASE_BRIDGE = process.env.BASE_BRIDGE_ADDRESS!;
const USDC_SEPOLIA = process.env.USDC_SEPOLIA!;

async function main() {
  const [user] = await ethers.getSigners();
  console.log("Running bridge flow as:", user.address);

  // Step 1: Approve USDC on Sepolia
  // TODO: approve tokenMessenger via USDC.approve(ETH_BRIDGE, maxAmount)
  console.log("Step 1: TODO — approve USDC on Sepolia");

  // Step 2: depositConfidential
  // TODO: generate FHE ciphertext + proof using @zama-fhe/relayer-sdk
  const placeholderEncryptedAmount = "0x";
  const placeholderProof = "0x";
  console.log("Step 2: TODO — call depositConfidential with real FHE ciphertext");
  // const ethBridge = await ethers.getContractAt("ShadowBridgeETH", ETH_BRIDGE);
  // await ethBridge.depositConfidential(placeholderEncryptedAmount, placeholderProof);

  // Step 3: Wait for DepositInitiated event
  console.log("Step 3: TODO — listen for DepositInitiated event");

  // Step 4: Wait for Circle attestation
  console.log("Step 4: TODO — poll Circle Attestation Service for signed message");

  // Step 5: receiveAndEncrypt on Base
  console.log("Step 5: TODO — call receiveAndEncrypt with attestation");

  // Steps 6-10: staking flow
  console.log("Steps 6-10: TODO — stake, accrueRewards, unstake, decryptBalance");

  console.log("\nbridge-flow.ts scaffold complete. Implement TODOs in Step 2.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
