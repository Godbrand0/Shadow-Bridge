import { execSync } from "child_process";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🚀 Starting Full ShadowBridge Orchestrated Deployment...");

  // 1. Deploy to Base Sepolia
  console.log("\n--- Step 1: Deploying to Base Sepolia ---");
  execSync("npx hardhat deploy --network baseSepolia --tags Destinations", { stdio: "inherit" });
  const baseBridgeAddress = getAddress("baseSepolia", "ShadowBridgeBase");
  console.log(`✅ Base Bridge: ${baseBridgeAddress}`);

  // 2. Deploy to Arbitrum Sepolia
  console.log("\n--- Step 2: Deploying to Arbitrum Sepolia ---");
  execSync("npx hardhat deploy --network arbitrumSepolia --tags Destinations", { stdio: "inherit" });
  const arbBridgeAddress = getAddress("arbitrumSepolia", "ShadowBridgeArbitrum");
  console.log(`✅ Arbitrum Bridge: ${arbBridgeAddress}`);

  // 3. Deploy to Ethereum Sepolia (Requires Base Bridge address)
  console.log("\n--- Step 3: Deploying to Ethereum Sepolia ---");
  process.env.BASE_BRIDGE_ADDRESS = baseBridgeAddress;
  execSync("npx hardhat deploy --network sepolia --tags ETH", { stdio: "inherit" });
  const ethBridgeAddress = getAddress("sepolia", "ShadowBridgeETH");
  console.log(`✅ Ethereum Bridge: ${ethBridgeAddress}`);

  // 4. Configure ETH Bridge (Register Arbitrum)
  console.log("\n--- Step 4: Configuring Ethereum Bridge ---");
  process.env.ARB_BRIDGE_ADDRESS = arbBridgeAddress;
  execSync("npx hardhat deploy --network sepolia --tags Configure", { stdio: "inherit" });

  console.log("\n--- Step 5: Final Cross-Chain Wiring ---");
  // Set the ETH bridge address on Base and Arb contracts so they can verify incoming burns
  process.env.ETH_BRIDGE_ADDRESS = ethBridgeAddress;
  // Note: We need a custom task or script to update ethShadowBridge on the L2s
  // because hardhat-deploy scripts run in isolation per network.
  console.log("Wiring Base bridge to ETH bridge...");
  execSync(`npx hardhat run scripts/set-eth-bridge.ts --network baseSepolia`, { stdio: "inherit", env: { ...process.env, BRIDGE_ADDRESS: baseBridgeAddress, ETH_BRIDGE: ethBridgeAddress } });
  
  console.log("Wiring Arbitrum bridge to ETH bridge...");
  execSync(`npx hardhat run scripts/set-eth-bridge.ts --network arbitrumSepolia`, { stdio: "inherit", env: { ...process.env, BRIDGE_ADDRESS: arbBridgeAddress, ETH_BRIDGE: ethBridgeAddress } });

  console.log("\n✨ Deployment Complete!");
  console.log("-----------------------------------------");
  console.log(`ETH Bridge:      ${ethBridgeAddress}`);
  console.log(`Base Bridge:     ${baseBridgeAddress}`);
  console.log(`Arbitrum Bridge: ${arbBridgeAddress}`);
  console.log("-----------------------------------------");
  console.log("Next: Update frontend/src/lib/contracts.ts with these addresses.");
}

function getAddress(network: string, contract: string): string {
  const filePath = path.join(__dirname, "../deployments", network, `${contract}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Deployment file not found for ${contract} on ${network} at ${filePath}`);
  }
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return data.address;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
