# ShadowBridge Architecture

## Overview

ShadowBridge is a confidential cross-chain USDC bridge that uses:

- **Circle CCTP V2** (burn/mint) for trustless USDC bridging between Ethereum Sepolia, Base Sepolia, and Arbitrum Sepolia.
- **Zama FHEVM** for fully encrypted balance accounting — no on-chain observer can see individual amounts after the initial bridge step.

---

## Three-Contract System

```
Ethereum Sepolia          Base Sepolia             Arbitrum Sepolia
─────────────────         ─────────────────         ─────────────────
ShadowBridgeETH           ShadowBridgeDest          ShadowBridgeDest
│                         │                         │
│ depositConfidential()   │ receiveAndEncrypt()      │ receiveAndEncrypt()
│ ├─ validate FHE input   │ ├─ CCTP receiveMessage   │ ├─ CCTP receiveMessage
│ ├─ store euint64 handle │ ├─ FHE.asEuint64         │ ├─ FHE.asEuint64
│ └─ makePubliclyDecrypt  │ └─ add to _encryptedStake│ └─ add to _encryptedStake
│                         │                         │
│ onDecryptCallback()     │ bridgeOut()              │ bridgeOut()
│ ├─ FHE.checkSignatures  │ ├─ validate FHE input    │ ├─ validate FHE input
│ └─ CCTP depositForBurn  │ ├─ FHE.le + select clamp │ ├─ FHE.le + select clamp
│        ──────────────▶  │ └─ makePubliclyDecrypt   │ └─ makePubliclyDecrypt
                          │                         │
                          │ onBridgeOutCallback()    │ onBridgeOutCallback()
                          │ ├─ FHE.checkSignatures   │ ├─ FHE.checkSignatures
                          │ └─ CCTP depositForBurn   │ └─ CCTP depositForBurn
```

**Valid bridge routes:**

| From | To |
|---|---|
| Ethereum Sepolia | Base Sepolia, Arbitrum Sepolia |
| Base Sepolia | Arbitrum Sepolia |
| Arbitrum Sepolia | Base Sepolia |

---

## Data Flow (Step by Step)

### 1. Confidential Deposit (ETH → L2)

1. User encrypts USDC amount client-side using the Zama relayer SDK (`@zama-fhe/relayer-sdk/web`).
2. User calls `depositConfidential(encryptedAmount, inputProof, destinationDomain)`.
3. Contract validates the FHE input proof, stores `euint64` handle, marks it publicly decryptable.
4. Zama's off-chain KMS gateway picks up the decryption request and calls `onDecryptCallback(handles, abiEncodedResult, proof)`.
5. Contract verifies KMS signatures via `FHE.checkSignatures`, extracts `uint64` cleartext.
6. Contract calls CCTP `depositForBurn` — USDC is burned on Sepolia.

> **Note:** The KMS gateway on Sepolia testnet is operated by Zama at `https://relayer.sepolia.zama.ai`. On Base/Arbitrum Sepolia, Zama has not yet deployed FHEVM infrastructure — `onBridgeOutCallback` invocations on L2 are currently handled via the same Sepolia gateway for testnet evaluation.

### 2. Confidential Receive (L2 side)

1. The backend relay service extracts the CCTP `MessageSent` bytes from the burn receipt.
2. Relay polls Circle Iris V2 API until the attestation is complete (~5–40 min on testnet).
3. Relay calls `receiveAndEncrypt(recipient, cctpMessage, attestation)` on the destination bridge.
4. `tokenMessenger.receiveMessage()` mints USDC to the bridge contract.
5. Minted amount is re-encrypted via `FHE.asEuint64` (or `cUSDCToken.wrap()` if ERC-7984 is configured) and added to `_encryptedStake[recipient]`.
6. From this point forward, the balance is never visible on-chain in plaintext.

### 3. Bridge Out (L2 → L2 or L2 → ETH)

1. User provides an FHE-encrypted amount and calls `bridgeOut(encryptedAmount, proof, destDomain, mintRecipient)`.
2. Contract uses `FHE.le + FHE.select` to clamp the amount to available balance — **no plaintext branching**.
3. Contract calls `FHE.makePubliclyDecryptable` on the clamped amount.
4. Zama gateway calls `onBridgeOutCallback`, which verifies signatures and calls CCTP `depositForBurn`.
5. Relay picks up the burn on the source L2 and delivers it to the destination chain via `receiveAndEncrypt`.

---

## Encrypted State Variables

| Contract | Variable | Type | Purpose |
|---|---|---|---|
| ShadowBridgeETH | `_pendingDeposit[user]` | `euint64` | Encrypted amount awaiting async KMS decrypt + CCTP burn |
| ShadowBridgeDest | `_encryptedStake[user]` | `euint64` | Bridged USDC balance, encrypted on-chain |

---

## FHEVM Client SDK

The frontend uses `@zama-fhe/relayer-sdk/web` (browser-only bundle). The SDK is loaded with a dynamic import to prevent server-side rendering errors:

```typescript
// frontend/src/lib/fhevm.ts
const sdk = await import("@zama-fhe/relayer-sdk/web");
const createFn = sdk.createFhevmInstance ?? sdk.default?.createFhevmInstance;

const instance = await createFn({
  networkUrl: process.env.NEXT_PUBLIC_ETH_SEPOLIA_RPC,
  relayerUrl: "https://relayer.sepolia.zama.ai",
  chainId: 11155111,
  aclContractAddress: "0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D",
  kmsContractAddress: "0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A",
  inputVerifierContractAddress: "0x52e86988bd07447C596Df9975cD4ef0174A1574d",
});
```

When the Zama relayer is unreachable, `getFhevmInstance()` returns `null` and the UI enters **demo mode** — the bridge panel displays a warning banner and encryption falls back to placeholder ciphertexts that will not succeed on-chain.

---

## FHEVM Invariants

1. **No plaintext branching on encrypted values** — always use `FHE.select(condition, a, b)`.
2. **`allowThis` after every FHE write** — ensures the contract can re-read its own handles on future calls.
3. **`allow(user)` before any user-facing operation** — required for user decryption via the relayer.
4. **No synchronous decryption** — `FHE.makePubliclyDecryptable` + callback is the only decryption path.
5. **`euint64` for all USDC amounts** — 6-decimal USDC fits in `uint64`; all FHE operations use the 64-bit family.

---

## Circle CCTP Domain IDs

| Network | Domain |
|---|---|
| Ethereum Sepolia | 0 |
| Arbitrum Sepolia | 3 |
| Base Sepolia | 6 |

---

## Deployed Contract Addresses (Sepolia Testnet)

| Contract | Chain | Address |
|---|---|---|
| ShadowBridgeETH | Ethereum Sepolia (11155111) | `0x03DDBa3088E598aB95Bc03Cb58ae209F77D29d18` |
| ShadowBridgeDest (Base) | Base Sepolia (84532) | `0x8410EcE3bD4bA15CF868Cf53F766736334fa389D` |
| ShadowBridgeDest (Arb) | Arbitrum Sepolia (421614) | `0xA0DcB7dD510e410bD1BABBD920E095551658B20c` |

---

## Deployment Order

1. Deploy `ShadowBridgeDest` on Base Sepolia.
2. Deploy `ShadowBridgeDest` on Arbitrum Sepolia.
3. Deploy `ShadowBridgeETH` on Ethereum Sepolia.
4. Call `ShadowBridgeETH.registerDestination(6, <BASE_DEST>)`.
5. Call `ShadowBridgeETH.registerDestination(3, <ARB_DEST>)`.
6. Call `ShadowBridgeDest.setEthBridge(<ETH_BRIDGE>)` on both L2 contracts.
7. Call `ShadowBridgeDest.registerDestination(3, <ARB_DEST>)` on Base.
8. Call `ShadowBridgeDest.registerDestination(6, <BASE_DEST>)` on Arbitrum.
9. Fund the backend relayer wallet with ETH on all three chains.

---

## ERC-7984 Integration

Circle CCTP mints USDC as a plaintext `uint256`. ShadowBridgeDest minimises the cleartext lifetime to a single stack frame in `receiveAndEncrypt`:

```
CCTP mint → uint256 mintedAmount → FHE.asEuint64() → euint64 handle
     (cleartext, one stack frame only)                (encrypted forever after)
```

If `cUSDCToken` (ERC-7984 wrapper) is configured, `wrap()` is used instead, which provides an additional integrity guarantee via OpenZeppelin Confidential Contracts. Without a configured cUSDC address, `FHE.asEuint64()` is used — amounts remain FHE-encrypted either way.

> **Important:** Zama has not yet deployed the ERC-7984 reference implementation to Base or Arbitrum Sepolia. The `cUSDCToken` address is currently zero on all testnet deployments; `FHE.asEuint64()` is the active path.

---

## Chain Compatibility Note (Testnet)

Zama's FHEVM coprocessor is officially deployed on Ethereum Sepolia only. Both `ShadowBridgeBaseConfig` and `ShadowBridgeArbitrumConfig` in `contracts/config/ShadowBridgeConfig.sol` currently use Sepolia's ACL / Coprocessor / KMSVerifier addresses as placeholders. When Zama deploys FHEVM to Base/Arb Sepolia, update the addresses in that config file — no contract logic changes are required.

---

## Privacy Guarantees

| Data | Visible to observers? | Why |
|---|---|---|
| Bridge initiation (`depositConfidential` tx) | Yes — tx exists | Amount is an opaque ciphertext handle |
| Deposited USDC amount | **No** | Encrypted client-side before signing |
| Bridged balance on L2 | **No** | `euint64` handle, never stored as `uint256` |
| Bridge-out amount | **No** | FHE-encrypted input; CCTP burn amount revealed only inside `onBridgeOutCallback` stack frame |
| CCTP burn amount (`depositForBurn`) | Yes — visible to Circle nodes | Unavoidable: CCTP V2 requires a plaintext `uint256` |

The single unavoidable plaintext moment is the `depositForBurn` call inside `_executeBridge` / `onBridgeOutCallback`. The cleartext exists only in that stack frame and is never written to contract state.

---

## Local Development & Smoke Test

Run the full E2E flow against the Hardhat mock network:

```bash
npx hardhat run scripts/bridge-flow.ts
```

The script deploys mock contracts, performs a 7-step bridge cycle (deposit → CCTP relay → receiveAndEncrypt → verify → bridgeOut), and asserts encrypted balance amounts using the FHEVM mock decrypt.

For live testnet bridging, use the frontend UI and backend relay service — FHE encryption requires a browser environment (WebAssembly + `@zama-fhe/relayer-sdk/web`).
