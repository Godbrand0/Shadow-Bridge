import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { 
  CCTP_MESSENGER, 
  CCTP_TRANSMITTER, 
  USDC_BASE_SEPOLIA, 
  USDC_ARB_SEPOLIA,
  REWARD_RATE 
} from "./ShadowBridgeConstants";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;
  const network = hre.network.name;

  if (network === "baseSepolia") {
    await deploy("ShadowBridgeBase", {
      from: deployer,
      args: [
        USDC_BASE_SEPOLIA,
        CCTP_MESSENGER,
        CCTP_TRANSMITTER,
        "0x0000000000000000000000000000000000000000", // Initial ethShadowBridge, update later
        REWARD_RATE
      ],
      log: true,
    });
  } else if (network === "arbitrumSepolia") {
    await deploy("ShadowBridgeArbitrum", {
      from: deployer,
      args: [
        USDC_ARB_SEPOLIA,
        CCTP_MESSENGER,
        CCTP_TRANSMITTER,
        "0x0000000000000000000000000000000000000000", // Initial ethShadowBridge, update later
        REWARD_RATE
      ],
      log: true,
    });
  }
};

export default func;
func.tags = ["Destinations"];
