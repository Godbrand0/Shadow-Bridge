import "dotenv/config";
import { ethers } from "ethers";

async function scan() {
  const rpc = "https://base-sepolia.drpc.org";
  const provider = new ethers.JsonRpcProvider(rpc);
  const bridge = "0x8410EcE3bD4bA15CF868Cf53F766736334fa389D";
  const abi = ["event BridgeOutExecuted(address indexed user, uint32 destinationDomain)"];
  const contract = new ethers.Contract(bridge, abi, provider);

  const tip = await provider.getBlockNumber();
  const from = tip - 5000;
  console.log(`Scanning Base Sepolia from block ${from} to ${tip}...`);

  const events = await contract.queryFilter("BridgeOutExecuted", from, tip);
  console.log(`Found ${events.length} events:`);
  for (const ev of events as ethers.EventLog[]) {
    console.log(`- Tx: ${ev.transactionHash}, User: ${ev.args[0]}, Domain: ${ev.args[1]}`);
  }
}

scan().catch(console.error);
