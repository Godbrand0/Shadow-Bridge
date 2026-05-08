import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { execute, get } = hre.deployments;
  const network = hre.network.name;

  if (network === "sepolia") {
    const ethBridge = await get("ShadowBridgeETH");
    const arbBridgeAddress = process.env.ARB_BRIDGE_ADDRESS;

    if (arbBridgeAddress) {
      console.log(`Registering Arbitrum bridge ${arbBridgeAddress} on ETH bridge...`);
      await execute(
        "ShadowBridgeETH",
        { from: deployer, log: true },
        "registerDestination",
        3, // ARBITRUM_DOMAIN
        arbBridgeAddress
      );
    }
  }
};

export default func;
func.tags = ["Configure"];
func.runAtTheEnd = true;
