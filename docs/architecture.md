# ShadowBridge Architecture

## Overview

ShadowBridge is a confidential cross-chain settlement and staking protocol that uses:

- **Circle CCTP** (burn/mint) for trustless USDC bridging between Ethereum Sepolia and Base Sepolia.
- **Zama FHEVM** for fully encrypted balance accounting — no one (not even validators) can observe individual user amounts after the initial bridge step.

---

## Two-Contract System

```
Ethereum Sepolia                         Base Sepolia
─────────────────────────                ─────────────────────────
ShadowBridgeETH                          ShadowBridgeBase
│                                        │
│  depositConfidential()                 │  receiveAndEncrypt()
│  ├─ FHE.fromExternal (validate input)  │  ├─ CCTP receiveMessage (mint USDC)
│  ├─ store encrypted amount             │  ├─ FHE.asEuint64 (encrypt mint amt)
│  └─ makePubliclyDecryptable (→ KMS)    │  └─ add to _bridgedBalance
│                                        │
│  onDecryptCallback() ←── KMS relayer   │  stake() / unstake()
│  ├─ FHE.checkSignatures               │  ├─ FHE.fromExternal (validate)
│  └─ _decryptAndBridge()               │  ├─ FHE.le + FHE.select (safe clamp)
│      └─ CCTP depositForBurn ─────────▶│  └─ update _stakedBalance
                                         │
                                         │  accrueRewards() (keeper)
                                         │  └─ FHE.mul + FHE.add (encrypted reward)
                                         │
                                         │  decryptBalance()
                                         │  ├─ FHE.add (total = bridged+staked+rewards)
                                         │  ├─ makePubliclyDecryptable (→ KMS)
                                         │  └─ emit DecryptionRequested
                                         │
                                         │  onDecryptCallback() ←── KMS relayer
                                         │  ├─ FHE.checkSignatures
                                         │  └─ emit BalanceDecrypted(user, amount)
```

---

## Data Flow (Step by Step)

### 1. Confidential Deposit (ETH Side)
1. User encrypts desired USDC amount client-side using the FHEVM SDK.
2. User calls `depositConfidential(encryptedAmount, proof)`.
3. Contract validates the FHE input proof, stores `euint64` handle, marks it publicly decryptable.
4. Off-chain KMS relayer picks up the decryption request, produces cleartext + KMS signatures.
5. Relayer calls `onDecryptCallback(handles, abiEncodedResult, proof)`.
6. Contract verifies KMS signatures via `FHE.checkSignatures`, extracts `uint64` cleartext.
7. Contract approves CCTP and calls `depositForBurn` — USDC is burned on Sepolia.

### 2. Confidential Receive (Base Side)
1. Anyone (user or keeper) submits the CCTP attestation to `receiveAndEncrypt()`.
2. `tokenMessenger.receiveMessage()` mints USDC to the ShadowBridgeBase contract.
3. Minted amount is immediately re-encrypted as a `euint64` and added to the recipient's `_bridgedBalance`.
4. From this point forward, the balance is never visible on-chain in plaintext.

### 3. Private Staking
- `stake()`: user provides an encrypted stake amount; contract uses `FHE.select` to clamp to available balance (no plaintext branch).
- `accrueRewards()`: permissionless keeper; multiplies each user's staked balance by an encrypted reward rate and elapsed time.
- `unstake()`: returns staked amount + accumulated rewards to `_bridgedBalance`.

### 4. Balance Decryption
- `decryptBalance()` calls `FHE.makePubliclyDecryptable` on the user's total.
- Off-chain relayer obtains KMS signatures for the cleartext.
- `onDecryptCallback()` verifies signatures and emits `BalanceDecrypted(user, amount)`.
- User reads their balance from the event — the cleartext is never stored in contract state.

---

## Encrypted State Variables

| Contract | Variable | Type | Purpose |
|---|---|---|---|
| ShadowBridgeETH | `_pendingDeposit[user]` | `euint64` | Encrypted amount awaiting async decrypt + burn |
| ShadowBridgeBase | `_bridgedBalance[user]` | `euint64` | Unlocked bridged USDC, not yet staked |
| ShadowBridgeBase | `_stakedBalance[user]` | `euint64` | Currently staked USDC |
| ShadowBridgeBase | `_rewardBalance[user]` | `euint64` | Accumulated staking rewards |

---

## FHEVM Invariants

These invariants are enforced throughout the codebase:

1. **No plaintext branching on encrypted values** — always use `FHE.select(condition, a, b)`.
2. **`allowThis` after every FHE write** — ensures the contract can re-read its own handles on future calls.
3. **`allow(user)` before any user-facing operation** — required for user decryption via the relayer.
4. **No synchronous decryption** — `FHE.makePubliclyDecryptable` + callback is the only decryption path.
5. **`euint64` for all USDC amounts** — 6-decimal USDC fits in `uint64`; operations use the 64-bit family.

---

## Chain Compatibility Note

`ZamaEthereumConfig` covers Ethereum mainnet (1), Sepolia (11155111), and local Hardhat (31337).
**Base Sepolia (84532) is not yet in Zama's canonical config.** When Zama adds Base Sepolia
support, `ShadowBridgeBase` should be updated to inherit from the appropriate Base config or
accept constructor-injected coprocessor addresses via a custom `AbstractFHEVMConfig`.

For local testing, both contracts compile and run against Hardhat's built-in FHEVM mock.

---

## Circle CCTP Domain IDs

| Network | Domain |
|---|---|
| Ethereum Sepolia | 0 |
| Base Sepolia | 6 |

---

## Deployment Order

1. Deploy `ShadowBridgeBase` (constructor sets `ethShadowBridge = address(0)` initially).
2. Call `ShadowBridgeBase.setCUSDCToken(0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639)`.
3. Deploy `ShadowBridgeETH` passing the Base address as `baseShadowBridge`.
4. Call `ShadowBridgeBase.setEthBridge(<ETH_ADDRESS>)` to complete the wire.
5. Mint test USDC: `npx hardhat run scripts/mint-test-tokens.ts --network sepolia`.

---

## Token Integration — ERC-7984 and cUSDCMock

### Why two tokens?

Circle CCTP operates with **plaintext amounts** — `depositForBurn(uint256 amount, ...)` requires a cleartext number. There is no way to avoid this exposure at the bridge layer. ShadowBridge minimises it to a single stack-frame lifetime:

```
CCTP mint → uint256 mintedAmount → wrap() → euint64 handle
     (cleartext)                              (encrypted forever after)
```

The underlying mock USDC (`0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF`) is a standard ERC-20 used by Circle CCTP for the burn/mint messages.

The confidential cUSDC (`0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639`) is an `ERC7984ERC20Wrapper` — an OpenZeppelin Confidential Contracts implementation of ERC-7984 that wraps the raw token into FHE-encrypted balances.

### ERC-7984 operations used

| Function | Called from | Purpose |
|---|---|---|
| `IERC7984ERC20Wrapper.wrap(address, uint256)` | `receiveAndEncrypt` | Converts raw USDC to `euint64` handle |
| `IERC7984.confidentialTransfer(address, euint64)` | `onUnstakeCallback` | Returns tokens without revealing amount |
| `IERC7984.confidentialTransferFrom(from, to, externalEuint64, proof)` | `acceptCUSDCStake` | Pulls cUSDC from staker without revealing amount |

### How ERC-7984 improves the staking design

Without ERC-7984:
- Staking requires a plaintext approval + `transferFrom` that exposes the amount
- The USDC moves as cleartext on-chain

With ERC-7984:
- `acceptCUSDCStake` uses `confidentialTransferFrom` — the amount flows as `euint64`
- `onUnstakeCallback` uses `confidentialTransfer` — returned tokens stay encrypted
- Only the initial CCTP mint (unavoidable) and the final `onUnstakeCallback` (KMS-verified) ever see cleartext

---

## Privacy Guarantees

| Data | Visible to observers? | Why |
|---|---|---|
| Bridge initiation (tx to `depositConfidential`) | Yes — tx exists | But amount is an opaque ciphertext handle |
| Deposited USDC amount | **No** | Encrypted client-side before signing |
| Staked balance | **No** | `euint64` handle, never stored as uint256 |
| Reward balance | **No** | Computed via FHE.mul(stake, rate), all encrypted |
| Reward rate | Yes | Public scalar — makes rewards auditable without leaking stake size |
| Final revealed balance | Yes — emitted in `BalanceRevealed` | User explicitly opted in via `decryptBalance()` |
| Unstake amount | Yes — emitted in `UnstakeCompleted` indirectly | KMS delivers cleartext to `onUnstakeCallback`; the event logs the user address only, not the amount |

---

## The Single Plaintext Exposure Point

ShadowBridgeETH's `_executeBridge` function calls `tokenMessenger.depositForBurn(uint256 amount, ...)`.
Circle CCTP does not support FHE-encrypted amounts — the burn takes a plaintext `uint256`.

This is **unavoidable** given current CCTP v1 design. The amount is:
1. Produced by the KMS decrypt callback (async, off-chain signed)
2. Exists only in the `_executeBridge` stack frame — never written to state
3. Immediately consumed by `depositForBurn` and never stored

The rest of the flow — re-encryption on Base, staking, rewards, unstaking — uses encrypted amounts exclusively.

---

## Testnet Limitations

`ShadowBridgeBaseConfig` delegates to `ZamaConfig.getEthereumCoprocessorConfig()` for chains
1 (mainnet), 11155111 (Sepolia), and 31337 (Hardhat). **Base Sepolia (chainId 84532) uses
placeholder Sepolia addresses** for the ACL, Coprocessor, and KMSVerifier because Zama has not
yet deployed to Base Sepolia.

Until Zama publishes official Base Sepolia FHEVM addresses, both contracts are deployed to
Ethereum Sepolia for testnet evaluation. The architecture supports Base Sepolia by updating
the constants in `ShadowBridgeConfig.sol`.
