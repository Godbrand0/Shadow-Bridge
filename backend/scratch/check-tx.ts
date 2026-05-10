import "dotenv/config";
import { ethers } from "ethers";

async function checkTx() {
  const rpc = "https://base-sepolia.drpc.org";
  const provider = new ethers.JsonRpcProvider(rpc);
  const txHash = "0xaeec2f9b0a6bff9fb5f25716eb96cfcd6fe562c974de8b7ee119135ca4b75e30";
  const tx = await provider.getTransaction(txHash);
  if (!tx) {
    console.log("Transaction not found");
    return;
  }
  console.log("To:", tx.to);
  console.log("Input:", tx.data);

  const receipt = await provider.getTransactionReceipt(txHash);
  console.log("Logs count:", receipt?.logs.length);
  for (const log of receipt?.logs ?? []) {
    console.log(`- Log Address: ${log.address}, Topics: ${JSON.stringify(log.topics)}`);
  }
}

checkTx().catch(console.error);
