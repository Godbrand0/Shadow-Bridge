import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { 
  CCTP_MESSENGER, 
  USDC_SEPOLIA 
} from "./ShadowBridgeConstants";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, getOrNull } = hre.deployments;
  const network = hre.network.name;

  if (network === "sepolia") {
    // Note: You must have deployed ShadowBridgeBase on Base Sepolia first 
    // and manually provided its address if not in the same deployment context.
    const baseBridgeAddress = process.env.BASE_BRIDGE_ADDRESS || "0x0000000000000000000000000000000000000000";

    await deploy("ShadowBridgeETH", {
      from: deployer,
      args: [
        USDC_SEPOLIA,
        CCTP_MESSENGER,
        baseBridgeAddress
      ],
      log: true,
    });
  }
};

export default func;
func.tags = ["ETH"];
