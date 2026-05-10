export interface ChainConfig {
  name: string;
  chainId: number;
  domain: number;
  /** Primary RPC URL — also rpcUrls[0]. Used for wallet/signing operations. */
  rpcUrl: string;
  /** Ordered list of RPC URLs tried in sequence for read operations. */
  rpcUrls: string[];
  explorer: string;
  shadowBridge: string;
  cctpTokenMessenger: string;
  cctpMessageTransmitter: string;
  usdc: string;
}

// ── Helper ────────────────────────────────────────────────────────────────────
// Build rpcUrls from an env override + ordered public fallbacks.
// If the env var is set, it goes first; public nodes fill the rest.

function rpcList(envUrl: string | undefined, publicFallbacks: string[]): string[] {
  const urls = envUrl ? [envUrl, ...publicFallbacks] : publicFallbacks;
  // Deduplicate while preserving order
  return [...new Set(urls)];
}

// ── Chain configs ─────────────────────────────────────────────────────────────

export const CHAINS: Record<string, ChainConfig> = {
  ETH_SEPOLIA: {
    name: "Ethereum Sepolia",
    chainId: 11155111,
    domain: 0,
    rpcUrl:
      process.env.ETH_SEPOLIA_RPC ?? "https://ethereum-sepolia-rpc.publicnode.com",
    rpcUrls: rpcList(process.env.ETH_SEPOLIA_RPC, [
      "https://ethereum-sepolia-rpc.publicnode.com",
      "https://rpc.sepolia.org",
      "https://sepolia.drpc.org",
    ]),
    explorer: "https://sepolia.etherscan.io",
    shadowBridge:
      process.env.ETH_BRIDGE_ADDRESS ??
      "0x03DDBa3088E598aB95Bc03Cb58ae209F77D29d18",
    cctpTokenMessenger:
      process.env.ETH_CCTP_MESSENGER ??
      "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
    cctpMessageTransmitter:
      process.env.ETH_CCTP_TRANSMITTER ??
      "0x7865f3792467fd37555622dAF2401a917057A60d",
    usdc:
      process.env.USDC_SEPOLIA ?? "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  },

  BASE_SEPOLIA: {
    name: "Base Sepolia",
    chainId: 84532,
    domain: 6,
    rpcUrl:
      process.env.BASE_SEPOLIA_RPC ?? "https://base-sepolia-rpc.publicnode.com",
    rpcUrls: rpcList(process.env.BASE_SEPOLIA_RPC, [
      "https://base-sepolia.drpc.org",
      "https://base-sepolia-rpc.publicnode.com",
      "https://sepolia.base.org",
    ]),
    explorer: "https://sepolia.basescan.org",
    shadowBridge:
      process.env.BASE_BRIDGE_ADDRESS ??
      "0x8410EcE3bD4bA15CF868Cf53F766736334fa389D",
    cctpTokenMessenger:
      process.env.BASE_CCTP_MESSENGER ??
      "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
    cctpMessageTransmitter:
      process.env.BASE_CCTP_TRANSMITTER ??
      "0x7865fA0b6b3be3A9C4996166C9c9aB1DDed3C5b6",
    usdc:
      process.env.USDC_BASE_SEPOLIA ??
      "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },

  ARB_SEPOLIA: {
    name: "Arbitrum Sepolia",
    chainId: 421614,
    domain: 3,
    rpcUrl:
      process.env.ARB_SEPOLIA_RPC ??
      "https://arbitrum-sepolia-rpc.publicnode.com",
    rpcUrls: rpcList(process.env.ARB_SEPOLIA_RPC, [
      "https://arbitrum-sepolia-rpc.publicnode.com",
      "https://sepolia-rollup.arbitrum.io/rpc",
      "https://arbitrum-sepolia.drpc.org",
    ]),
    explorer: "https://sepolia.arbiscan.io",
    shadowBridge:
      process.env.ARB_BRIDGE_ADDRESS ??
      "0xA0DcB7dD510e410bD1BABBD920E095551658B20c",
    cctpTokenMessenger:
      process.env.ARB_CCTP_MESSENGER ??
      "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
    cctpMessageTransmitter:
      process.env.ARB_CCTP_TRANSMITTER ??
      "0xaCF1ceeF35caAc005e15888dDb8A3515C41B4872",
    usdc:
      process.env.USDC_ARB_SEPOLIA ??
      "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  },
};

export const BY_DOMAIN: Record<number, ChainConfig> = Object.fromEntries(
  Object.values(CHAINS).map((c) => [c.domain, c])
);

export const BY_CHAIN_ID: Record<number, ChainConfig> = Object.fromEntries(
  Object.values(CHAINS).map((c) => [c.chainId, c])
);

// Circle Iris V2 sandbox API base URL
export const IRIS_API_URL =
  process.env.IRIS_API_URL ?? "https://iris-api-sandbox.circle.com";
