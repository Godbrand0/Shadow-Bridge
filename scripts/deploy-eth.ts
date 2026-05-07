import { ethers } from "hardhat";

/**
 * deploy-eth.ts
 *
 * Deploys ShadowBridgeETH to Ethereum Sepolia.
 * Run AFTER deploy-base.ts — needs the Base bridge address.
 *
 * Token addresses (Sepolia):
 *   Raw mock USDC: 0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF
 *
 * Circle CCTP (Sepolia):
 *   TokenMessenger: 0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5
 *
 * Required env vars:
 *   SEPOLIA_RPC_URL
 *   DEPLOYER_PRIVATE_KEY
 *   BASE_BRIDGE_ADDRESS   (output from deploy-base.ts)
 */

const RAW_USDC        = "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF";
const TOKEN_MESSENGER = "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const baseBridgeAddress = process.env.BASE_BRIDGE_ADDRESS;
  if (!baseBridgeAddress || baseBridgeAddress === ethers.ZeroAddress) {
    throw new Error(
      "BASE_BRIDGE_ADDRESS env var is required. Run deploy-base.ts first."
    );
  }

  const factory = await ethers.getContractFactory("ShadowBridgeETH");
  const bridge = await factory.deploy(
    RAW_USDC,
    TOKEN_MESSENGER,
    baseBridgeAddress
  );
  await bridge.waitForDeployment();
  const ethAddress = await bridge.getAddress();

  console.log("\n✓ ShadowBridgeETH deployed:", ethAddress);
  console.log("  usdcToken:            ", RAW_USDC);
  console.log("  cctpTokenMessenger:   ", TOKEN_MESSENGER);
  console.log("  baseShadowBridge:     ", baseBridgeAddress);

  console.log("\n─────────────────────────────────────────");
  console.log("NEXT STEP: wire ETH address into Base contract:");
  console.log("  npx hardhat run scripts/set-eth-bridge.ts --network sepolia");
  console.log("  (or call ShadowBridgeBase.setEthBridge manually)");
  console.log("─────────────────────────────────────────");
  console.log("\nSet in your .env:");
  console.log("ETH_BRIDGE_ADDRESS=" + ethAddress);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
