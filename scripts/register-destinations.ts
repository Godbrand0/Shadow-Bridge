import { ethers } from "hardhat";

/**
 * register-destinations.ts
 *
 * Registers cross-chain destinations so ShadowBridgeETH knows about Arbitrum,
 * and ShadowBridgeArbitrum knows about Base (bidirectional bridging).
 *
 * Required env vars:
 *   ETH_BRIDGE_ADDRESS
 *   BASE_BRIDGE_ADDRESS
 *   ARB_BRIDGE_ADDRESS
 */

const ARBITRUM_DOMAIN = 3;
const BASE_DOMAIN = 6;

const ETH_BRIDGE_ABI = [
  "function registerDestination(uint32 domain, address bridge) external",
  "function destinations(uint32) external view returns (bytes32)",
];

async function main() {
  const [deployer] = await ethers.getSigners();

  const ethAddress  = process.env.ETH_BRIDGE_ADDRESS!;
  const baseAddress = process.env.BASE_BRIDGE_ADDRESS!;
  const arbAddress  = process.env.ARB_BRIDGE_ADDRESS!;

  if (!ethAddress || !baseAddress || !arbAddress) {
    throw new Error("ETH_BRIDGE_ADDRESS, BASE_BRIDGE_ADDRESS, and ARB_BRIDGE_ADDRESS must all be set.");
  }

  // 1. Register Arbitrum on ShadowBridgeETH (domain 3)
  console.log("Registering Arbitrum destination on ShadowBridgeETH...");
  const ethBridge = await ethers.getContractAt(ETH_BRIDGE_ABI, ethAddress, deployer);
  const tx1 = await ethBridge.registerDestination(ARBITRUM_DOMAIN, arbAddress);
  const r1 = await tx1.wait();
  console.log(`✓ registerDestination(3, ${arbAddress})`);
  console.log("  tx:", r1.hash);

  console.log("\nAll destinations registered.");
  console.log("─────────────────────────────────────────");
  console.log("ShadowBridgeETH destinations:");
  console.log("  Base Sepolia (6):     pre-registered at construction");
  console.log("  Arbitrum Sepolia (3):", arbAddress);
  console.log("─────────────────────────────────────────");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
