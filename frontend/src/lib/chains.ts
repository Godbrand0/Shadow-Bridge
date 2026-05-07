import { sepolia, baseSepolia } from "wagmi/chains";
import { http } from "wagmi";

export const ETH_CHAIN = {
  ...sepolia,
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_ETH_SEPOLIA_RPC || "https://rpc.sepolia.org",
      ],
    },
  },
} as const;

export const BASE_CHAIN = {
  ...baseSepolia,
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || "https://sepolia.base.org",
      ],
    },
  },
} as const;

export const TRANSPORTS = {
  [ETH_CHAIN.id]: http(
    process.env.NEXT_PUBLIC_ETH_SEPOLIA_RPC || "https://rpc.sepolia.org"
  ),
  [BASE_CHAIN.id]: http(
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || "https://sepolia.base.org"
  ),
};

export function getExplorerTxUrl(chainId: number, hash: string): string {
  if (chainId === ETH_CHAIN.id) {
    return `https://sepolia.etherscan.io/tx/${hash}`;
  }
  return `https://sepolia.basescan.org/tx/${hash}`;
}
