# Zama Builder Track — Submission

## Project name
ShadowBridge

## One-line description
Confidential cross-chain USDC bridge and staking protocol using Zama FHEVM + Circle CCTP — encrypted amounts, private balances, user-controlled decryption.

## GitHub repo URL
> https://github.com/[YOUR_USERNAME]/shadow-bridge  ← fill in

## Demo URL (frontend)
> https://shadow-bridge.vercel.app  ← fill in after Vercel deploy

## Demo video
> [YouTube/Loom link] ← record and link

---

## Tech stack checklist

- [x] Zama FHEVM (`@fhevm/solidity` v0.11.1, `fhevm-hardhat-template` v0.4.1)
- [x] OpenZeppelin Confidential Contracts v0.4.0 (`IERC7984`, `IERC7984ERC20Wrapper`)
- [x] Circle CCTP (cross-chain token transfer, Sepolia)
- [x] Hardhat + TypeScript
- [x] Next.js 14 frontend with wagmi + RainbowKit
- [ ] Base Sepolia mainnet deployment (awaiting Zama FHEVM Base Sepolia support)

---

## FHE features used

### Input validation
Every user-supplied encrypted amount is validated with `FHE.fromExternal(externalEuint64, proof)` — rejecting any ciphertext not bound to the calling user and this contract.

### Branch-free arithmetic
`FHE.select(FHE.le(requested, stake), requested, stake)` — the unstake clamp never reveals which branch executes, so observers cannot infer whether the user was trying to overdraw.

### Scalar reward multiplication
`FHE.mul(encryptedStake, uint64 rateScalar)` — the reward rate is public (auditable) but the stake is encrypted, so rewards are private by construction.

### ERC-7984 confidential token movements
`IERC7984ERC20Wrapper.wrap()` eliminates the need to call `FHE.asEuint64()` on the CCTP mint amount — `wrap()` returns a `euint64` handle directly, minimising the cleartext window to zero.

`IERC7984.confidentialTransfer()` and `confidentialTransferFrom()` keep token movements encrypted even as they cross contract boundaries.

### Async public decryption
`FHE.makePubliclyDecryptable()` + `FHE.checkSignatures()` — balances are revealed only when the user explicitly calls `decryptBalance()`. The KMS proof is verified on-chain before acting on any cleartext.

---

## What makes it unique

**The privacy gap ShadowBridge fills:**
Every major bridge today (Circle CCTP, Wormhole, Across, Hop) emits cleartext amounts in transaction calldata and events. A whale moving $10M is immediately visible to block explorers, MEV bots, and competing protocols.

ShadowBridge is the first bridge + staking protocol where:
1. The bridge amount is FHE-encrypted before the transaction is signed
2. The re-encrypted balance on the destination chain is never stored as a cleartext integer
3. Staking and rewards accrue on encrypted balances using `FHE.mul` and `FHE.select`
4. The user's financial position is revealed only when they choose, via a KMS-verified callback
5. The entire stack uses OpenZeppelin's ERC-7984 standard for confidential token movements

---

## Deployed contract addresses

> Fill in after deployment

| Contract | Network | Address | Explorer |
|---|---|---|---|
| ShadowBridgeBase | Sepolia | `0x...` | [Etherscan]() |
| ShadowBridgeETH | Sepolia | `0x...` | [Etherscan]() |

---

## Test results

```
27 passing (2s)
1 pending (Sepolia-only test, correctly skipped in local env)
0 failing
```

All tests run against the Hardhat FHEVM mock environment with real FHE operations
(not stub/placeholder calls). The full test suite covers:
- CCTP sender validation
- FHE input proof rejection
- `FHE.select` unstake clamp (both sufficient and over-request cases)
- Async KMS decrypt callback with `FHE.checkSignatures`
- Reward accrual via `FHE.mul` scalar
- `decryptBalance` → `onBalanceDecryptCallback` end-to-end
