# ShadowBridge

> Confidential cross-chain settlement and staking protocol — Zama Builder Track 2025

ShadowBridge lets users bridge USDC from Ethereum Sepolia to Base Sepolia using Circle CCTP, then stake it with **fully private balances**. Every amount is FHE-encrypted before it touches the chain. Validators, MEV bots, and observers see only opaque ciphertexts — never dollar values.

---

## What It Does

1. User encrypts a USDC amount client-side using the Zama FHEVM SDK.
2. `depositConfidential()` burns it on Ethereum Sepolia via Circle CCTP.
3. `receiveAndEncrypt()` mints the USDC on Base, immediately wraps it to confidential cUSDC (ERC-7984), and credits the user's encrypted balance.
4. User stakes, accrues rewards, and unstakes — all with encrypted amounts — until they choose to call `decryptBalance()` and reveal their total to themselves.

---

## Why It's Novel

- **No existing bridge reveals nothing.** Most cross-chain bridges (CCTP, Across, Hop) show cleartext amounts on both chains. ShadowBridge encrypts the amount before the ETH burn and re-encrypts immediately after the Base mint.
- **ERC-7984 end-to-end.** Staking uses `IERC7984ERC20Wrapper.confidentialTransfer` so amounts remain encrypted even when tokens move between contracts — a first for cross-chain staking protocols.
- **User-controlled decryption.** The FHE KMS only reveals the balance when the user explicitly requests it. Nobody else can decrypt it, including the contract owner.
- **`FHE.select` over `if/else`.** All stake arithmetic (clamped unstake, reward math) uses branch-free FHE operations — the contract never exposes a conditional that could leak information.

---

## FHE Operations Used

| Operation | Where | What it does |
|---|---|---|
| `FHE.fromExternal(externalEuint64, proof)` | `depositConfidential`, `stake`, `unstake` | Validates user-supplied ciphertext input |
| `FHE.asEuint64(uint64)` | `receiveAndEncrypt` (fallback) | Encrypts the CCTP mint amount |
| `IERC7984ERC20Wrapper.wrap(address, uint256)` | `receiveAndEncrypt` (production) | Wraps raw USDC, returns `euint64` — no cleartext |
| `FHE.add(euint64, euint64)` | All balance updates | Encrypted accumulation |
| `FHE.sub(euint64, euint64)` | `unstake` | Encrypted deduction |
| `FHE.mul(euint64, uint64)` | `_accrueRewards` | Scalar reward multiplication (rate is public) |
| `FHE.le(euint64, euint64)` | `unstake` | Encrypted comparison — no plaintext branch |
| `FHE.select(ebool, euint64, euint64)` | `unstake` | Branch-free clamp to actual stake |
| `FHE.makePubliclyDecryptable(euint64)` | `unstake`, `decryptBalance` | Schedules async KMS decryption |
| `FHE.checkSignatures(bytes32[], bytes, bytes)` | All callbacks | Verifies KMS proof before acting on cleartext |
| `IERC7984.confidentialTransfer(address, euint64)` | `onUnstakeCallback` | Transfers cUSDC without revealing amount |

---

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for the full two-contract flow diagram, ERC-7984 integration details, and privacy guarantee analysis.

---

## Deployed Contracts

| Contract | Network | Address | Explorer |
|---|---|---|---|
| ShadowBridgeBase | Sepolia | `0x8410EcE3bD4bA15CF868Cf53F766736334fa389D` | [Etherscan ↗](https://sepolia.etherscan.io/address/0x8410EcE3bD4bA15CF868Cf53F766736334fa389D#code) |
| ShadowBridgeETH | Sepolia | `0x03DDBa3088E598aB95Bc03Cb58ae209F77D29d18` | [Etherscan ↗](https://sepolia.etherscan.io/address/0x03DDBa3088E598aB95Bc03Cb58ae209F77D29d18#code) |
| ShadowBridgeArbitrum | Arbitrum Sepolia | `0xA0DcB7dD510e410bD1BABBD920E095551658B20c` | [Arbiscan ↗](https://sepolia.arbiscan.io/address/0xA0DcB7dD510e410bD1BABBD920E095551658B20c#code) |
| Mock USDC (Sepolia) | Sepolia | `0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF` | — |
| Confidential cUSDC / ERC-7984 (Sepolia) | Sepolia | `0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639` | — |
| Mock USDC (Arbitrum Sepolia) | Arbitrum Sepolia | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` | — |

---

## Tech Stack

| Layer | Technology |
|---|---|
| FHE Runtime | Zama FHEVM · `fhevm-hardhat-template` v0.4.1 · `@fhevm/solidity` v0.11.1 |
| Confidential Tokens | OpenZeppelin Confidential Contracts v0.4.0 (`IERC7984`, `IERC7984ERC20Wrapper`) |
| Cross-chain Bridge | Circle CCTP (burn/mint flow, Sepolia TokenMessenger) |
| Smart Contracts | Solidity ^0.8.24 · Hardhat v2 · OpenZeppelin Contracts v5 |
| Frontend | Next.js 14 · wagmi v2 · viem · RainbowKit v2 · Inter + JetBrains Mono |
| Testing | Hardhat + Mocha + Chai · **27 tests, 100% pass rate** |

---

## How to Run

### Prerequisites
- Node ≥ 20
- A Sepolia RPC URL (Infura/Alchemy)
- A funded Sepolia wallet

### Install and test locally
```bash
npm install
npm run compile
npx hardhat test        # → 27 passing
```

### Mint testnet tokens (Sepolia)
```bash
npx hardhat run scripts/mint-test-tokens.ts --network sepolia
```

### Deploy (3-step sequence)
```bash
# 1. Deploy Base contract first
npx hardhat run scripts/deploy-base.ts --network sepolia

# 2. Deploy ETH contract (needs Base address)
BASE_BRIDGE_ADDRESS=0x... npx hardhat run scripts/deploy-eth.ts --network sepolia

# 3. Wire both contracts together
BASE_BRIDGE_ADDRESS=0x... ETH_BRIDGE_ADDRESS=0x... \
  npx hardhat run scripts/set-eth-bridge.ts --network sepolia
```

### Run frontend
```bash
cd frontend
cp .env.local.example .env.local   # fill in your deployed addresses + WalletConnect ID
npm install && npm run dev          # → http://localhost:3000
```

---

## Demo Video

> [Link TBD — record after deployment]

---

## License

MIT
