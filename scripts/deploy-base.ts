import { ethers } from "hardhat";

/**
 * deploy-base.ts
 *
 * Deploys ShadowBridgeBase to Sepolia (used as both sides in testnet while
 * Base Sepolia awaits official Zama FHEVM support).
 *
 * Deploy this FIRST — ShadowBridgeETH needs the Base address.
 *
 * Token addresses (Zama Sepolia testnet):
 *   Raw mock USDC:    0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF
 *   Confidential cUSDC (ERC-7984 wrapper):
 *                     0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639
 *
 * Circle CCTP (Sepolia):
 *   MessageTransmitter: 0x7865fAfC2db2093669d92c0197e5d6f4Bf8175F3
 *
 * Required env vars:
 *   SEPOLIA_RPC_URL
 *   DEPLOYER_PRIVATE_KEY  (or MNEMONIC)
 */

// ── Sepolia constants ──────────────────────────────────────────────────────────
const RAW_USDC       = "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF";
const CUSDC_TOKEN    = "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639";
const MSG_TRANSMITTER = "0x7865fAfC2db2093669d92c0F33AeEF291086BEFD";
const TOKEN_MESSENGER = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA";

// Placeholder ETH bridge — update with setEthBridge() after ETH deploy
const ETH_BRIDGE_PLACEHOLDER = ethers.ZeroAddress;

// 100 micro-USDC per block (100 / 1_000_000 = 0.0001 USDC — testnet friendly)
const REWARD_RATE_PER_BLOCK = 100n;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const factory = await ethers.getContractFactory("ShadowBridgeBase");
  const bridge = await factory.deploy(
    RAW_USDC,
    TOKEN_MESSENGER,
    MSG_TRANSMITTER,
    ETH_BRIDGE_PLACEHOLDER,   // will be set via setEthBridge() after ETH deploy
    REWARD_RATE_PER_BLOCK
  );
  await bridge.waitForDeployment();
  const baseAddress = await bridge.getAddress();

  console.log("\n✓ ShadowBridgeBase deployed:", baseAddress);
  console.log("  rawUsdcToken:           ", RAW_USDC);
  console.log("  cctpMessageTransmitter: ", MSG_TRANSMITTER);
  console.log("  rewardRatePerBlock:     ", REWARD_RATE_PER_BLOCK.toString());

  // Wire up the confidential USDC wrapper (ERC-7984)
  console.log("\nConfiguring cUSDC token (ERC-7984)...");
  const setCUSDCTx = await (bridge as any).setCUSDCToken(CUSDC_TOKEN);
  await setCUSDCTx.wait();
  console.log("✓ cUSDCToken set to:", CUSDC_TOKEN);

  console.log("\n─────────────────────────────────────────");
  console.log("NEXT STEPS:");
  console.log("1. Deploy ShadowBridgeETH with baseShadowBridge =", baseAddress);
  console.log("2. Call ShadowBridgeBase.setEthBridge(<ETH_BRIDGE_ADDRESS>)");
  console.log("3. Call ShadowBridgeBase.registerDestination(3, <ARB_BRIDGE_ADDRESS>) to enable Arbitrum bridging");
  console.log("─────────────────────────────────────────");
  console.log("\nSet in your .env:");
  console.log("BASE_BRIDGE_ADDRESS=" + baseAddress);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
