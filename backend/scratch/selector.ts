import { ethers } from "ethers";
const sig = "bridgeOut(bytes32,bytes,uint32,bytes32)";
console.log(ethers.id(sig).slice(0, 10));
