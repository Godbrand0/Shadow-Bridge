import hre from "hardhat";

// ── Sepolia contracts ─────────────────────────────────────────────────────────
const BASE_ADDRESS = "0x8410EcE3bD4bA15CF868Cf53F766736334fa389D";
const ETH_ADDRESS  = "0x03DDBa3088E598aB95Bc03Cb58ae209F77D29d18";

async function main() {
  console.log("Verifying ShadowBridgeBase...");
  await hre.run("verify:verify", {
    address: BASE_ADDRESS,
    contract: "contracts/ShadowBridgeBase.sol:ShadowBridgeBase",
    constructorArguments: [
      "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF", // rawUsdcToken
      "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA", // cctpTokenMessenger
      "0x7865fAfC2db2093669d92c0F33AeEF291086BEFD", // cctpMessageTransmitter
      "0x0000000000000000000000000000000000000000", // ethShadowBridge (ZeroAddress at deploy)
      100,                                          // rewardRatePerBlock
    ],
  });
  console.log("✓ ShadowBridgeBase verified");

  console.log("\nVerifying ShadowBridgeETH...");
  await hre.run("verify:verify", {
    address: ETH_ADDRESS,
    constructorArguments: [
      "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF", // usdcToken
      "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5", // cctpTokenMessenger
      "0x8410EcE3bD4bA15CF868Cf53F766736334fa389D", // baseShadowBridge
    ],
  });
  console.log("✓ ShadowBridgeETH verified");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
