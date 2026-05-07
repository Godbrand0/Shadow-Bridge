// ── Addresses ─────────────────────────────────────────────────────────────────

export const ADDRESSES = {
  ethBridge: (process.env.NEXT_PUBLIC_ETH_BRIDGE_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  baseBridge: (process.env.NEXT_PUBLIC_BASE_BRIDGE_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  usdcSepolia: (process.env.NEXT_PUBLIC_USDC_SEPOLIA ||
    "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238") as `0x${string}`,
  usdcBase: (process.env.NEXT_PUBLIC_USDC_BASE_SEPOLIA ||
    "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as `0x${string}`,
} as const;

// ── ABIs ──────────────────────────────────────────────────────────────────────

export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export const ETH_BRIDGE_ABI = [
  {
    name: "depositConfidential",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "hasPendingBridge",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  // Events
  {
    name: "DepositReceived",
    type: "event",
    inputs: [{ name: "user", type: "address", indexed: true }],
  },
  {
    name: "BridgeExecuted",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "destinationDomain", type: "uint32", indexed: false },
    ],
  },
  {
    name: "DecryptionRequested",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "requestId", type: "uint256", indexed: false },
    ],
  },
] as const;

export const BASE_BRIDGE_ABI = [
  {
    name: "stake",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "unstake",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "decryptBalance",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "accrueRewards",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "hasPendingDecrypt",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  // Events
  {
    name: "Staked",
    type: "event",
    inputs: [{ name: "user", type: "address", indexed: true }],
  },
  {
    name: "UnstakeRequested",
    type: "event",
    inputs: [{ name: "user", type: "address", indexed: true }],
  },
  {
    name: "UnstakeCompleted",
    type: "event",
    inputs: [{ name: "user", type: "address", indexed: true }],
  },
  {
    name: "BalanceRevealed",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "total", type: "uint64", indexed: false },
    ],
  },
  {
    name: "DecryptionRequested",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "requestId", type: "uint256", indexed: false },
    ],
  },
  {
    name: "StakeReceived",
    type: "event",
    inputs: [{ name: "user", type: "address", indexed: true }],
  },
] as const;

// FHEVM coprocessor addresses on Sepolia
export const FHEVM_CONFIG = {
  aclAddress: (process.env.NEXT_PUBLIC_FHEVM_ACL_SEPOLIA ||
    "0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D") as `0x${string}`,
  kmsVerifierAddress: (process.env.NEXT_PUBLIC_FHEVM_KMS_VERIFIER_SEPOLIA ||
    "0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A") as `0x${string}`,
  inputVerifierAddress: (process.env.NEXT_PUBLIC_FHEVM_INPUT_VERIFIER_SEPOLIA ||
    "0x52e86988bd07447C596Df9975cD4ef0174A1574d") as `0x${string}`,
  relayerUrl:
    process.env.NEXT_PUBLIC_FHEVM_RELAYER_URL ||
    "https://relayer.sepolia.zama.ai",
};
