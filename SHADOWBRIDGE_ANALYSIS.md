# ShadowBridge: Multi-Chain Confidential Bridge Analysis

## Overview

ShadowBridge is a confidential cross-chain settlement and staking protocol that enables users to bridge USDC between
Ethereum Sepolia, Base Sepolia, and Arbitrum Sepolia using Circle's CCTP (Cross-Chain Transfer Protocol). The key
differentiator is that all amounts are FHE-encrypted before they touch the blockchain, providing privacy for users'
financial activities.

## Architecture

### Core Components

1. **ShadowBridgeETH** ([`contracts/ShadowBridgeETH.sol`](contracts/ShadowBridgeETH.sol:1))
   - Source contract on Ethereum Sepolia
   - Handles confidential deposits and initiates CCTP burns
   - Supports bridging to Base Sepolia (domain 6) and Arbitrum Sepolia (domain 3)

2. **ShadowBridgeBase** ([`contracts/ShadowBridgeBase.sol`](contracts/ShadowBridgeBase.sol:1))
   - Destination contract on Base Sepolia
   - Inherits from `ShadowBridgeDest` which contains shared destination logic
   - Handles CCTP mints and re-encrypts amounts to maintain confidentiality

3. **ShadowBridgeArbitrum** ([`contracts/ShadowBridgeArbitrum.sol`](contracts/ShadowBridgeArbitrum.sol:1))
   - Destination contract on Arbitrum Sepolia
   - Also inherits from `ShadowBridgeDest`
   - Similar functionality to ShadowBridgeBase but for Arbitrum

4. **ShadowBridgeDest** ([`contracts/ShadowBridgeDest.sol`](contracts/ShadowBridgeDest.sol:1))
   - Abstract contract containing shared destination logic
   - Handles staking, rewards, and bridge-out functionality
   - Implements FHE operations for confidential balance management

### Flow Architecture

1. **Deposit Flow** (Ethereum → Destination Chain)
   - User encrypts USDC amount client-side using FHEVM SDK
   - Calls `depositConfidential()` on ShadowBridgeETH
   - Contract validates and stores encrypted amount
   - Off-chain FHEVM relayer decrypts the amount
   - Contract burns USDC via CCTP to destination chain

2. **Receive Flow** (Destination Chain)
   - CCTP mints USDC on destination chain
   - `receiveAndEncrypt()` immediately wraps to confidential cUSDC (ERC-7984)
   - User's encrypted balance is credited

3. **Staking Flow** (Destination Chain)
   - User can stake encrypted amounts
   - Rewards accrue based on stake amount and time
   - User can unstake (with FHE.select for branch-free clamping)

4. **Bridge-Out Flow** (Destination Chain → Another Chain)
   - User can bridge encrypted amounts to another supported chain
   - Amount is decrypted only in the callback stack frame
   - USDC is burned via CCTP to the destination

## Key Features

### 1. Confidentiality

- **FHE Encryption**: All amounts are encrypted using Fully Homomorphic Encryption
- **No Cleartext Exposure**: Amounts are never stored in plaintext in contract state
- **User-Controlled Decryption**: Users can decrypt their balances only when explicitly requested

### 2. Multi-Chain Support

- **Ethereum Sepolia**: Source chain for initial deposits
- **Base Sepolia**: Destination chain with staking capabilities
- **Arbitrum Sepolia**: Additional destination chain
- **Bi-Directional Bridging**: Users can bridge between any supported chains

### 3. Staking and Rewards

- **Encrypted Staking**: Users can stake their encrypted USDC
- **Reward Accrual**: Rewards are calculated based on encrypted stake amounts
- **Branch-Free Operations**: All stake arithmetic uses FHE operations to avoid information leakage

### 4. FHE Operations

The contract uses various FHE operations to maintain confidentiality:

| Operation                       | Where                                     | What it does                                  |
| ------------------------------- | ----------------------------------------- | --------------------------------------------- |
| `FHE.fromExternal()`            | `depositConfidential`, `stake`, `unstake` | Validates user-supplied ciphertext input      |
| `FHE.asEuint64()`               | `receiveAndEncrypt` (fallback)            | Encrypts the CCTP mint amount                 |
| `IERC7984.wrap()`               | `receiveAndEncrypt` (production)          | Wraps raw USDC, returns `euint64`             |
| `FHE.add()`                     | All balance updates                       | Encrypted accumulation                        |
| `FHE.sub()`                     | `unstake`                                 | Encrypted deduction                           |
| `FHE.mul()`                     | `_accrueRewards`                          | Scalar reward multiplication                  |
| `FHE.le()`                      | `unstake`                                 | Encrypted comparison                          |
| `FHE.select()`                  | `unstake`                                 | Branch-free clamp to actual stake             |
| `FHE.makePubliclyDecryptable()` | `unstake`, `decryptBalance`               | Schedules async KMS decryption                |
| `FHE.checkSignatures()`         | All callbacks                             | Verifies KMS proof before acting on cleartext |

## Issues and Areas for Improvement

### 1. Placeholder FHEVM Configuration

**Issue**: The FHEVM configuration for Base Sepolia and Arbitrum Sepolia contains placeholder addresses:

```solidity
// ShadowBridgeBaseConfig
address private constant _BASE_SEPOLIA_ACL            = 0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D;
address private constant _BASE_SEPOLIA_COPROCESSOR    = 0x92C920834Ec8941d2C77D188936E1f7A6f49c127;
address private constant _BASE_SEPOLIA_KMS_VERIFIER   = 0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A;

// ShadowBridgeArbitrumConfig
address private constant _ARB_SEPOLIA_ACL           = 0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D;
address private constant _ARB_SEPOLIA_COPROCESSOR   = 0x92C920834Ec8941d2C77D188936E1f7A6f49c127;
address private constant _ARB_SEPOLIA_KMS_VERIFIER  = 0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A;
```

**Impact**: The contracts cannot function properly on these chains until Zama deploys the actual FHEVM infrastructure.

**Recommendation**: Replace with actual FHEVM addresses when Zama publishes them.

### 2. Deployment Complexity

**Issue**: The deployment process requires multiple steps with manual address passing:

```bash
# 1. Deploy Base contract first
npx hardhat run scripts/deploy-base.ts --network sepolia

# 2. Deploy ETH contract (needs Base address)
BASE_BRIDGE_ADDRESS=0x... npx hardhat run scripts/deploy-eth.ts --network sepolia

# 3. Wire both contracts together
BASE_BRIDGE_ADDRESS=0x... ETH_BRIDGE_ADDRESS=0x... \
  npx hardhat run scripts/set-eth-bridge.ts --network sepolia
```

**Impact**: This makes deployment error-prone and difficult to automate.

**Recommendation**: Create a single deployment script that handles all contracts and their interconnections.

### 3. Limited Error Handling

**Issue**: The contracts have limited error handling, especially for cross-chain operations:

```solidity
function onDecryptCallback(
  bytes32[] calldata handles,
  bytes calldata abiEncodedResult,
  bytes calldata decryptionProof
) external {
  FHE.checkSignatures(handles, abiEncodedResult, decryptionProof);

  address user = _handleOwner[handles[0]];
  require(user != address(0), "ShadowBridgeETH: unknown handle");

  uint64 cleartextAmount = abi.decode(abiEncodedResult, (uint64));
  uint32 domain = _handleDomain[handles[0]];
  _executeBridge(user, handles[0], cleartextAmount, domain);
}
```

**Impact**: If any step in the cross-chain process fails, there's no clear recovery mechanism.

**Recommendation**: Add comprehensive error handling and recovery mechanisms for cross-chain operations.

### 4. Missing Mock Contracts

**Issue**: The test files reference mock contracts that don't exist in the repository:

```typescript
import { MockUSDC, MockCCTPTokenMessenger } from "../types";
```

**Impact**: This makes it difficult to run and understand the tests.

**Recommendation**: Create the missing mock contracts or update the tests to use available mocks.

### 5. Incomplete Documentation

**Issue**: The README mentions an architecture document that doesn't exist:

```
See [`docs/architecture.md`](docs/architecture.md) for the full two-contract flow diagram, ERC-7984 integration details, and privacy guarantee analysis.
```

**Impact**: Developers cannot fully understand the system without proper documentation.

**Recommendation**: Create the missing documentation files.

### 6. Hardcoded Network Configuration

**Issue**: Network configurations are hardcoded in the contracts:

```solidity
uint32 public constant BASE_DOMAIN = 6;
uint32 public constant ARBITRUM_DOMAIN = 3;
```

**Impact**: This makes it difficult to add support for new chains or update existing configurations.

**Recommendation**: Make network configurations more flexible and updatable.

### 7. Limited Testing for Cross-Chain Scenarios

**Issue**: While there are comprehensive tests for individual contracts, there are limited tests for end-to-end
cross-chain scenarios.

**Impact**: Cross-chain functionality may not work as expected in production.

**Recommendation**: Add more comprehensive tests that simulate real-world cross-chain scenarios.

## Comparison with BLIP

### Similarities

1. **CCTP Integration**: Both projects use Circle's CCTP for cross-chain transfers.
2. **Multi-Chain Support**: Both support bridging between multiple chains.
3. **Testnet Focus**: Both are designed for testnet environments.

### Differences

1. **Confidentiality**: ShadowBridge provides FHE-based confidentiality, while BLIP works with cleartext amounts.
2. **Complexity**: ShadowBridge is significantly more complex due to its FHE operations.
3. **Staking**: ShadowBridge includes staking functionality with encrypted rewards, while BLIP focuses purely on
   bridging.
4. **Architecture**: BLIP has a simpler architecture with a clear separation between frontend, backend, and smart
   contracts, while ShadowBridge's architecture is more integrated.
5. **Maturity**: BLIP appears to be more mature and production-ready, while ShadowBridge is still in development with
   placeholder configurations.

### Recommendations for ShadowBridge

1. **Fix Placeholder Configurations**: Replace placeholder FHEVM addresses with actual ones when available.
2. **Simplify Deployment**: Create a single deployment script that handles all contracts.
3. **Improve Error Handling**: Add comprehensive error handling and recovery mechanisms.
4. **Complete Documentation**: Create all missing documentation files.
5. **Add Mock Contracts**: Create the missing mock contracts for testing.
6. **Flexible Configuration**: Make network configurations more flexible.
7. **Comprehensive Testing**: Add more end-to-end tests for cross-chain scenarios.

## Conclusion

ShadowBridge is an innovative project that brings confidentiality to cross-chain bridging through FHE encryption.
However, it's still in development and has several issues that need to be addressed before it can be considered
production-ready. The most critical issues are the placeholder FHEVM configurations and the complex deployment process.

By addressing these issues, ShadowBridge could become a powerful tool for confidential cross-chain transactions,
offering privacy that's not available in most existing bridge solutions.
