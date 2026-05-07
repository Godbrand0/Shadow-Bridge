import { ethers } from "hardhat";

/**
 * set-eth-bridge.ts
 *
 * Step 3 of the deployment sequence: calls ShadowBridgeBase.setEthBridge()
 * to complete the circular reference between the two contracts.
 *
 * Required env vars:
 *   BASE_BRIDGE_ADDRESS
 *   ETH_BRIDGE_ADDRESS
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  const baseAddress = process.env.BASE_BRIDGE_ADDRESS;
  const ethAddress  = process.env.ETH_BRIDGE_ADDRESS;

  if (!baseAddress || !ethAddress) {
    throw new Error("Both BASE_BRIDGE_ADDRESS and ETH_BRIDGE_ADDRESS must be set.");
  }

  const baseBridge = await ethers.getContractAt("ShadowBridgeBase", baseAddress, deployer);
  const tx = await (baseBridge as any).setEthBridge(ethAddress);
  const receipt = await tx.wait();

  console.log("✓ setEthBridge() called");
  console.log("  ShadowBridgeBase:  ", baseAddress);
  console.log("  ethShadowBridge → ", ethAddress);
  console.log("  tx:", receipt.hash);
  console.log("\nDeployment complete. Both contracts are wired.");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
