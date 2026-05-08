import hre from "hardhat";

const ARB_ADDRESS = "0xA0DcB7dD510e410bD1BABBD920E095551658B20c";

async function main() {
  console.log("Verifying ShadowBridgeArbitrum on Arbiscan...");
  await hre.run("verify:verify", {
    address: ARB_ADDRESS,
    contract: "contracts/ShadowBridgeArbitrum.sol:ShadowBridgeArbitrum",
    constructorArguments: [
      "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // rawUsdcToken (ARB USDC)
      "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA", // cctpTokenMessenger
      "0xe737e5cebeeba77efe34d4aa090756590b1ce275", // cctpMessageTransmitter
      "0x3BaeC7006BA6922c6B885D774B76557a66627B26", // ethShadowBridge (value at construction)
      100,                                          // rewardRatePerBlock
    ],
  });
  console.log("✓ ShadowBridgeArbitrum verified");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
