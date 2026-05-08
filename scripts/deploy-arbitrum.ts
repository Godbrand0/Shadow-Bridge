import { ethers } from "hardhat";

/**
 * deploy-arbitrum.ts
 *
 * Deploys ShadowBridgeArbitrum to Arbitrum Sepolia (chainId 421614).
 * Run AFTER ShadowBridgeETH is deployed — needs the ETH bridge address.
 *
 * CCTP V2 addresses (Arbitrum Sepolia):
 *   MessageTransmitter: 0xe737e5cebeeba77efe34d4aa090756590b1ce275
 *   USDC:               0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
 *   Circle domain ID:   3
 *
 * Required env vars:
 *   ARB_SEPOLIA_RPC_URL      — Arbitrum Sepolia RPC
 *   DEPLOYER_PRIVATE_KEY
 *   ETH_BRIDGE_ADDRESS       — deployed ShadowBridgeETH address (from deploy-eth.ts)
 */

// ── Arbitrum Sepolia constants ─────────────────────────────────────────────────
const ARB_USDC            = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
const MSG_TRANSMITTER     = "0xe737e5cebeeba77efe34d4aa090756590b1ce275";
const TOKEN_MESSENGER     = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA";
const ARBITRUM_DOMAIN     = 3;
const BASE_DOMAIN         = 6;

// 100 micro-USDC per block (testnet friendly)
const REWARD_RATE_PER_BLOCK = 100n;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const ethBridgeAddress = process.env.ETH_BRIDGE_ADDRESS;
  if (!ethBridgeAddress || ethBridgeAddress === ethers.ZeroAddress) {
    throw new Error(
      "ETH_BRIDGE_ADDRESS env var is required. Run deploy-eth.ts first."
    );
  }

  const factory = await ethers.getContractFactory("ShadowBridgeArbitrum");
  const bridge = await factory.deploy(
    ARB_USDC,
    TOKEN_MESSENGER,
    MSG_TRANSMITTER,
    ethBridgeAddress,
    REWARD_RATE_PER_BLOCK
  );
  await bridge.waitForDeployment();
  const arbAddress = await bridge.getAddress();

  console.log("\n✓ ShadowBridgeArbitrum deployed:", arbAddress);
  console.log("  rawUsdcToken:           ", ARB_USDC);
  console.log("  cctpMessageTransmitter: ", MSG_TRANSMITTER);
  console.log("  ethShadowBridge:        ", ethBridgeAddress);
  console.log("  rewardRatePerBlock:     ", REWARD_RATE_PER_BLOCK.toString());

  console.log("\n─────────────────────────────────────────");
  console.log("NEXT STEPS:");
  console.log("1. Register Arbitrum destination on ShadowBridgeETH:");
  console.log(`   ShadowBridgeETH.registerDestination(${ARBITRUM_DOMAIN}, "${arbAddress}")`);
  console.log(`2. Register Base destination on ShadowBridgeArbitrum to enable Base bridging:`);
  console.log(`   ShadowBridgeArbitrum.registerDestination(${BASE_DOMAIN}, process.env.BASE_BRIDGE_ADDRESS)`);
  console.log("3. Optionally set cUSDC wrapper:");
  console.log("   ShadowBridgeArbitrum.setCUSDCToken(<ARB_CUSDC_ADDRESS>)");
  console.log("─────────────────────────────────────────");
  console.log("\nSet in your .env:");
  console.log("ARB_BRIDGE_ADDRESS=" + arbAddress);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
