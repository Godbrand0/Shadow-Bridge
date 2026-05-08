/**
 * Minimal Hardhat config for Arbitrum Sepolia deployment only.
 * Intentionally excludes @fhevm/hardhat-plugin, which probes every network
 * with anvil_nodeInfo at startup — a call Arbitrum Sepolia's RPC rejects.
 *
 * Use with --no-compile to reuse artifacts from the main config:
 *   npx hardhat run scripts/deploy-arbitrum.ts \
 *     --network arbitrumSepolia \
 *     --config hardhat.config.arb.ts \
 *     --no-compile
 */
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import * as dotenv from "dotenv";
import type { HardhatUserConfig } from "hardhat/config";

dotenv.config();

const PRIVATE_KEY: string =
  process.env.PRIVATE_KEY ||
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const ARB_SEPOLIA_RPC_URL: string =
  process.env.ARB_SEPOLIA_RPC_URL ||
  "https://sepolia-rollup.arbitrum.io/rpc";
const ETHERSCAN_API_KEY: string = process.env.ETHERSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  networks: {
    arbitrumSepolia: {
      accounts: [PRIVATE_KEY],
      chainId: 421614,
      url: ARB_SEPOLIA_RPC_URL,
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
  },
  solidity: {
    version: "0.8.27",
    settings: {
      metadata: { bytecodeHash: "none" },
      optimizer: { enabled: true, runs: 800 },
      evmVersion: "cancun",
    },
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
};

export default config;
