import { sepolia, baseSepolia, arbitrumSepolia } from "wagmi/chains";
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

export const ARB_CHAIN = {
  ...arbitrumSepolia,
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_ARB_SEPOLIA_RPC || "https://sepolia-rollup.arbitrum.io/rpc",
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
  [ARB_CHAIN.id]: http(
    process.env.NEXT_PUBLIC_ARB_SEPOLIA_RPC || "https://sepolia-rollup.arbitrum.io/rpc"
  ),
};

export function getExplorerTxUrl(chainId: number, hash: string): string {
  if (chainId === ETH_CHAIN.id) {
    return `https://sepolia.etherscan.io/tx/${hash}`;
  }
  if (chainId === ARB_CHAIN.id) {
    return `https://sepolia.arbiscan.io/tx/${hash}`;
  }
  return `https://sepolia.basescan.org/tx/${hash}`;
}
