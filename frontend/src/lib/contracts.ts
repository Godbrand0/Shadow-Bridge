// ── Addresses ─────────────────────────────────────────────────────────────────

export const ADDRESSES = {
  ethBridge: (process.env.NEXT_PUBLIC_ETH_BRIDGE_ADDRESS ||
    "0x03DDBa3088E598aB95Bc03Cb58ae209F77D29d18") as `0x${string}`,
  baseBridge: (process.env.NEXT_PUBLIC_BASE_BRIDGE_ADDRESS ||
    "0x8410EcE3bD4bA15CF868Cf53F766736334fa389D") as `0x${string}`,
  arbBridge: (process.env.NEXT_PUBLIC_ARB_BRIDGE_ADDRESS ||
    "0xA0DcB7dD510e410bD1BABBD920E095551658B20c") as `0x${string}`,
  usdcSepolia: (process.env.NEXT_PUBLIC_USDC_SEPOLIA ||
    "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF") as `0x${string}`,
  usdcBase: (process.env.NEXT_PUBLIC_USDC_BASE_SEPOLIA ||
    "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as `0x${string}`,
  usdcArb: (process.env.NEXT_PUBLIC_USDC_ARB_SEPOLIA ||
    "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d") as `0x${string}`,
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

// ── ShadowBridgeETH ABI (Ethereum Sepolia source chain) ───────────────────────

export const ETH_BRIDGE_ABI = [
  // ── Events ──
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "address", name: "user",              type: "address" },
      { indexed: false, internalType: "uint32",  name: "destinationDomain", type: "uint32"  },
    ],
    name: "BridgeExecuted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "address", name: "user",      type: "address" },
      { indexed: false, internalType: "uint256", name: "requestId", type: "uint256" },
    ],
    name: "DecryptionRequested",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, internalType: "address", name: "user", type: "address" }],
    name: "DepositReceived",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint32",  name: "domain", type: "uint32"  },
      { indexed: true, internalType: "address", name: "bridge", type: "address" },
    ],
    name: "DestinationRegistered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "address", name: "recipient", type: "address" },
      { indexed: false, internalType: "uint64",  name: "cctpNonce", type: "uint64"  },
    ],
    name: "EncryptedReceive",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "previousOwner", type: "address" },
      { indexed: true, internalType: "address", name: "newOwner",      type: "address" },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "bytes32[]", name: "handlesList",       type: "bytes32[]" },
      { indexed: false, internalType: "bytes",     name: "abiEncodedCleartexts", type: "bytes"  },
    ],
    name: "PublicDecryptionVerified",
    type: "event",
  },
  // ── Read ──
  {
    inputs: [],
    name: "ARBITRUM_DOMAIN",
    outputs: [{ internalType: "uint32", name: "", type: "uint32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "BASE_DOMAIN",
    outputs: [{ internalType: "uint32", name: "", type: "uint32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MAX_BRIDGE_FEE",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MIN_FINALITY_THRESHOLD",
    outputs: [{ internalType: "uint32", name: "", type: "uint32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "cctpMessenger",
    outputs: [{ internalType: "contract ICCTPTokenMessenger", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "confidentialProtocolId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint32", name: "", type: "uint32" }],
    name: "destinations",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "getDepositHandle",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "hasPendingBridge",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "usdcToken",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  // ── Write ──
  {
    inputs: [
      { internalType: "externalEuint64", name: "encryptedAmount",    type: "bytes32" },
      { internalType: "bytes",           name: "inputProof",         type: "bytes"   },
      { internalType: "uint32",          name: "destinationDomain",  type: "uint32"  },
    ],
    name: "depositConfidential",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32[]", name: "handles",          type: "bytes32[]" },
      { internalType: "bytes",     name: "abiEncodedResult", type: "bytes"     },
      { internalType: "bytes",     name: "decryptionProof",  type: "bytes"     },
    ],
    name: "onDecryptCallback",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint32",  name: "domain", type: "uint32"  },
      { internalType: "address", name: "bridge", type: "address" },
    ],
    name: "registerDestination",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "newOwner", type: "address" }],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ── ShadowBridgeDest ABI (Base Sepolia + Arbitrum Sepolia destination chains) ─

export const DEST_BRIDGE_ABI = [
  // ── Errors ──
  { inputs: [], name: "InvalidKMSSignatures", type: "error" },
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "OwnableInvalidOwner",
    type: "error",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "OwnableUnauthorizedAccount",
    type: "error",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "handle", type: "bytes32" },
      { internalType: "address", name: "sender", type: "address" },
    ],
    name: "SenderNotAllowedToUseHandle",
    type: "error",
  },
  // ── Events ──
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "address", name: "user",              type: "address" },
      { indexed: false, internalType: "uint32",  name: "destinationDomain", type: "uint32"  },
    ],
    name: "BridgeExecuted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "address", name: "user",              type: "address" },
      { indexed: false, internalType: "uint32",  name: "destinationDomain", type: "uint32"  },
    ],
    name: "BridgeOutExecuted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "address", name: "user",              type: "address" },
      { indexed: false, internalType: "uint32",  name: "destinationDomain", type: "uint32"  },
    ],
    name: "BridgeOutRequested",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, internalType: "address", name: "newToken", type: "address" }],
    name: "CUSDCTokenSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "address", name: "user",      type: "address" },
      { indexed: false, internalType: "uint256", name: "requestId", type: "uint256" },
    ],
    name: "DecryptionRequested",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, internalType: "address", name: "user", type: "address" }],
    name: "DepositReceived",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint32",  name: "domain", type: "uint32"  },
      { indexed: true, internalType: "address", name: "bridge", type: "address" },
    ],
    name: "DestinationRegistered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "address", name: "recipient", type: "address" },
      { indexed: false, internalType: "uint64",  name: "cctpNonce", type: "uint64"  },
    ],
    name: "EncryptedReceive",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, internalType: "address", name: "newBridge", type: "address" }],
    name: "EthBridgeSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "previousOwner", type: "address" },
      { indexed: true, internalType: "address", name: "newOwner",      type: "address" },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "bytes32[]", name: "handlesList",          type: "bytes32[]" },
      { indexed: false, internalType: "bytes",     name: "abiEncodedCleartexts", type: "bytes"     },
    ],
    name: "PublicDecryptionVerified",
    type: "event",
  },
  // ── Read ──
  {
    inputs: [],
    name: "MAX_BRIDGE_FEE",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MIN_FINALITY_THRESHOLD",
    outputs: [{ internalType: "uint32", name: "", type: "uint32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "cctpMessageTransmitter",
    outputs: [{ internalType: "contract ICCTPTokenMessenger", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "cctpTokenMessenger",
    outputs: [{ internalType: "contract ICCTPTokenMessenger", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint32", name: "", type: "uint32" }],
    name: "destinations",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "ethShadowBridge",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "hasPendingBridge",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "usdcToken",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  // ── Write ──
  {
    inputs: [
      { internalType: "externalEuint64", name: "encryptedAmount",   type: "bytes32" },
      { internalType: "bytes",           name: "inputProof",        type: "bytes"   },
      { internalType: "uint32",          name: "destinationDomain", type: "uint32"  },
      { internalType: "bytes32",         name: "mintRecipient",     type: "bytes32" },
    ],
    name: "bridgeOut",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32[]", name: "handles",          type: "bytes32[]" },
      { internalType: "bytes",     name: "abiEncodedResult", type: "bytes"     },
      { internalType: "bytes",     name: "decryptionProof",  type: "bytes"     },
    ],
    name: "onBridgeOutCallback",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "recipient",   type: "address" },
      { internalType: "bytes",   name: "cctpMessage", type: "bytes"   },
      { internalType: "bytes",   name: "attestation", type: "bytes"   },
    ],
    name: "receiveAndEncrypt",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint32",  name: "domain", type: "uint32"  },
      { internalType: "address", name: "bridge", type: "address" },
    ],
    name: "registerDestination",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_ethBridge", type: "address" }],
    name: "setEthBridge",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "newOwner", type: "address" }],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ── FHEVM coprocessor addresses on Sepolia ────────────────────────────────────

export const FHEVM_CONFIG = {
  aclAddress: (process.env.NEXT_PUBLIC_FHEVM_ACL_SEPOLIA ||
    "0x687820221192C5B662b25367F70076A37bc79b6c") as `0x${string}`,
  kmsVerifierAddress: (process.env.NEXT_PUBLIC_FHEVM_KMS_VERIFIER_SEPOLIA ||
    "0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC") as `0x${string}`,
  inputVerifierAddress: (process.env.NEXT_PUBLIC_FHEVM_INPUT_VERIFIER_SEPOLIA ||
    "0xbc91f3daD1A5F19F8390c400196e58073B6a0BC4") as `0x${string}`,
  verifyingContractAddressDecryption: (process.env.NEXT_PUBLIC_FHEVM_DECRYPTION_ADDRESS ||
    "0xb6E160B1ff80D67Bfe90A85eE06Ce0A2613607D1") as `0x${string}`,
  verifyingContractAddressInputVerification: (process.env.NEXT_PUBLIC_FHEVM_INPUT_VERIFICATION_ADDRESS ||
    "0x7048C39f048125eDa9d678AEbaDfB22F7900a29F") as `0x${string}`,
  relayerUrl:
    process.env.NEXT_PUBLIC_FHEVM_RELAYER_URL ||
    "https://relayer.testnet.zama.cloud",
  gatewayChainId: 10901,
};
