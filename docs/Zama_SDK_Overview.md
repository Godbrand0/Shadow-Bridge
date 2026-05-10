# Zama FHEVM SDK Overview

## Introduction

Zama's Fully Homomorphic Encryption Virtual Machine (FHEVM) SDK enables developers to build confidential smart contracts
where data remains encrypted throughout execution. This overview explains the key concepts, architecture, and
capabilities of the Zama FHEVM SDK.

## What is Fully Homomorphic Encryption (FHE)?

Fully Homomorphic Encryption is a revolutionary cryptographic technique that allows computations to be performed on
encrypted data without decrypting it first. This means:

- **Data Privacy**: Sensitive data remains encrypted at all times
- **Computation on Encrypted Data**: You can perform mathematical operations on encrypted values
- **Verifiable Results**: The results can be decrypted to reveal the correct outcome

In the context of blockchain, FHE enables:

- Confidential transactions
- Private smart contracts
- Encrypted state management
- Privacy-preserving DeFi applications

## FHEVM Architecture

The Zama FHEVM consists of several key components:

### 1. FHEVM Blockchain

A modified EVM-compatible blockchain that supports FHE operations:

- **TFHE (TFHE over Ethereum)**: Implementation of FHE specifically designed for smart contracts
- **Precompiled Contracts**: Special contracts that handle FHE operations
- **KMS (Key Management Service)**: Manages decryption keys securely

### 2. FHE Types

The SDK provides several encrypted data types:

| Type      | Description                       | Size    | Use Case                   |
| --------- | --------------------------------- | ------- | -------------------------- |
| `euint8`  | Encrypted 8-bit unsigned integer  | 8 bits  | Small values, flags        |
| `euint16` | Encrypted 16-bit unsigned integer | 16 bits | Medium values              |
| `euint32` | Encrypted 32-bit unsigned integer | 32 bits | Large values               |
| `euint64` | Encrypted 64-bit unsigned integer | 64 bits | Very large values, amounts |
| `ebool`   | Encrypted boolean                 | 1 bit   | Conditional logic          |

### 3. FHE Operations

The SDK supports various operations on encrypted data:

#### Basic Operations

```solidity
// Creation
euint64 encryptedAmount = FHE.asEuint64(100);

// Copy
euint64 copy = FHE.copy(encryptedAmount);

// Comparison
ebool isGreater = FHE.gt(encryptedAmount, FHE.asEuint64(50));
```

#### Arithmetic Operations

```solidity
// Addition
euint64 sum = FHE.add(encryptedAmount1, encryptedAmount2);

// Subtraction
euint64 difference = FHE.sub(encryptedAmount1, encryptedAmount2);

// Multiplication
euint64 product = FHE.mul(encryptedAmount, FHE.asEuint64(2));

// Division (limited support)
euint64 quotient = FHE.div(encryptedAmount, FHE.asEuint64(4));
```

#### Logical Operations

```solidity
// Comparisons
ebool isEqual = FHE.eq(encryptedAmount1, encryptedAmount2);
ebool isLess = FHE.lt(encryptedAmount1, encryptedAmount2);
ebool isGreaterOrEqual = FHE.ge(encryptedAmount1, encryptedAmount2);

// Logical operations
ebool andResult = FHE.and(encryptedBool1, encryptedBool2);
ebool orResult = FHE.or(encryptedBool1, encryptedBool2);
ebool notResult = FHE.not(encryptedBool);
```

#### Conditional Operations

```solidity
// Select (ternary operator)
euint64 result = FHE.select(condition, valueIfTrue, valueIfFalse);
```

### 4. Decryption Operations

Converting encrypted values back to plaintext:

```solidity
// Request decryption
bytes32 handle = FHE.makePubliclyDecryptable(encryptedAmount);

// Receive decrypted result in callback
function onDecryptCallback(
    bytes32[] calldata handles,
    bytes calldata abiEncodedResult,
    bytes calldata decryptionProof
) external {
    // Verify the decryption proof
    FHE.checkSignatures(handles, abiEncodedResult, decryptionProof);

    // Decode the result
    uint64 cleartextAmount = abi.decode(abiEncodedResult, (uint64));

    // Use the decrypted value
    _processDecryptedAmount(cleartextAmount);
}
```

## SDK Components

### 1. Solidity Library (`FHE.sol`)

The core library for FHE operations in smart contracts:

```solidity
import "@fhevm/contracts/FHE.sol";

contract ConfidentialContract {
  using FHE for *;

  function confidentialAddition(euint64 encryptedA, euint64 encryptedB) public pure returns (euint64) {
    return FHE.add(encryptedA, encryptedB);
  }
}
```

### 2. JavaScript/TypeScript SDK

Client-side encryption and interaction:

```typescript
import { FhevmInstance } from "fhevmjs";

// Initialize FHEVM instance
const fhevmInstance = await FhevmInstance.create({
  kmsUrl: "https://kms.zama.ai",
  networkUrl: "https://fhevm.zama.ai",
});

// Encrypt a value
const encryptedAmount = await fhevmInstance.encrypt64(100);

// Generate proof for contract interaction
const proof = await fhevmInstance.generateProof({
  ciphertext: encryptedAmount,
  contractAddress: "0x...",
});
```

### 3. Key Management Service (KMS)

Securely manages decryption keys:

- **Key Generation**: Creates cryptographic keys for encryption/decryption
- **Secure Storage**: Stores keys in a secure environment
- **Attestation**: Provides cryptographic proofs of correct decryption

## Integration with Smart Contracts

### Basic Confidential Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@fhevm/contracts/FHE.sol";

contract ConfidentialVault {
  mapping(address => euint64) private encryptedBalances;
  mapping(bytes32 => address) private handleOwners;

  event Deposited(address indexed user, bytes32 handle);
  event Withdrawn(address indexed user, uint64 amount);

  function deposit(euint64 encryptedAmount) public {
    // Validate the input
    require(FHE.isInitialized(encryptedAmount), "Invalid ciphertext");

    // Add to balance
    encryptedBalances[msg.sender] = FHE.add(encryptedBalances[msg.sender], encryptedAmount);

    emit Deposited(msg.sender, FHE.getHandle(encryptedAmount));
  }

  function requestWithdrawal() public {
    euint64 balance = encryptedBalances[msg.sender];

    // Check if balance is greater than 0
    ebool hasBalance = FHE.gt(balance, FHE.asEuint64(0));
    require(FHE.decrypt(hasBalance), "No balance to withdraw");

    // Request decryption
    bytes32 handle = FHE.makePubliclyDecryptable(balance);
    handleOwners[handle] = msg.sender;
  }

  function onDecryptCallback(
    bytes32[] calldata handles,
    bytes calldata abiEncodedResult,
    bytes calldata decryptionProof
  ) external {
    // Verify the decryption proof
    FHE.checkSignatures(handles, abiEncodedResult, decryptionProof);

    // Get the owner
    address owner = handleOwners[handles[0]];
    require(owner != address(0), "Invalid handle");

    // Decode the result
    uint64 amount = abi.decode(abiEncodedResult, (uint64));

    // Reset balance
    encryptedBalances[owner] = FHE.asEuint64(0);

    // Transfer the amount (in a real implementation)
    emit Withdrawn(owner, amount);
  }
}
```

### Advanced Confidential Contract with Staking

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@fhevm/contracts/FHE.sol";

contract ConfidentialStaking {
  mapping(address => euint64) private encryptedStakes;
  mapping(address => euint64) private encryptedRewards;
  mapping(bytes32 => address) private handleOwners;

  uint256 public constant REWARD_RATE = 100; // 1% per day

  event Staked(address indexed user, bytes32 handle);
  event Unstaked(address indexed user, uint64 amount);
  event RewardPaid(address indexed user, uint64 reward);

  function stake(euint64 encryptedAmount) public {
    require(FHE.isInitialized(encryptedAmount), "Invalid ciphertext");

    // Add to stake
    encryptedStakes[msg.sender] = FHE.add(encryptedStakes[msg.sender], encryptedAmount);

    emit Staked(msg.sender, FHE.getHandle(encryptedAmount));
  }

  function unstake() public {
    euint64 stake = encryptedStakes[msg.sender];

    // Check if stake is greater than 0
    ebool hasStake = FHE.gt(stake, FHE.asEuint64(0));
    require(FHE.decrypt(hasStake), "No stake to unstake");

    // Accrue rewards first
    _accrueRewards(msg.sender);

    // Request decryption of stake amount
    bytes32 handle = FHE.makePubliclyDecryptable(stake);
    handleOwners[handle] = msg.sender;
  }

  function claimRewards() public {
    euint64 rewards = encryptedRewards[msg.sender];

    // Check if rewards are greater than 0
    ebool hasRewards = FHE.gt(rewards, FHE.asEuint64(0));
    require(FHE.decrypt(hasRewards), "No rewards to claim");

    // Request decryption of rewards
    bytes32 handle = FHE.makePubliclyDecryptable(rewards);
    handleOwners[handle] = msg.sender;
  }

  function _accrueRewards(address user) internal {
    euint64 stake = encryptedStakes[user];
    euint64 currentRewards = encryptedRewards[user];

    // Calculate rewards: stake * rewardRate / 10000
    euint64 newRewards = FHE.mul(stake, FHE.asEuint64(REWARD_RATE));
    newRewards = FHE.div(newRewards, FHE.asEuint64(10000));

    // Add to existing rewards
    encryptedRewards[user] = FHE.add(currentRewards, newRewards);
  }

  function onDecryptCallback(
    bytes32[] calldata handles,
    bytes calldata abiEncodedResult,
    bytes calldata decryptionProof
  ) external {
    // Verify the decryption proof
    FHE.checkSignatures(handles, abiEncodedResult, decryptionProof);

    // Get the owner
    address owner = handleOwners[handles[0]];
    require(owner != address(0), "Invalid handle");

    // Decode the result
    uint64 amount = abi.decode(abiEncodedResult, (uint64));

    // Determine if this is unstake or reward claim
    euint64 stake = encryptedStakes[owner];
    euint64 rewards = encryptedRewards[owner];

    // Check which amount matches the decrypted value
    ebool isStake = FHE.eq(stake, FHE.asEuint64(amount));
    ebool isReward = FHE.eq(rewards, FHE.asEuint64(amount));

    if (FHE.decrypt(isStake)) {
      // This is an unstake
      encryptedStakes[owner] = FHE.asEuint64(0);
      emit Unstaked(owner, amount);
    } else if (FHE.decrypt(isReward)) {
      // This is a reward claim
      encryptedRewards[owner] = FHE.asEuint64(0);
      emit RewardPaid(owner, amount);
    } else {
      revert("Invalid decryption");
    }
  }
}
```

## Client-Side Integration

### React Integration Example

```typescript
import { useState, useEffect } from 'react';
import { FhevmInstance } from 'fhevmjs';

function ConfidentialStakingApp() {
    const [fhevm, setFhevm] = useState<FhevmInstance | null>(null);
    const [account, setAccount] = useState<string | null>(null);
    const [stakeAmount, setStakeAmount] = useState<string>('0');
    const [isStaking, setIsStaking] = useState(false);

    useEffect(() => {
        async function initializeFhevm() {
            const instance = await FhevmInstance.create({
                kmsUrl: 'https://kms.zama.ai',
                networkUrl: 'https://fhevm.zama.ai',
            });

            setFhevm(instance);
        }

        initializeFhevm();
    }, []);

    async function handleStake() {
        if (!fhevm || !account || !stakeAmount) return;

        setIsStaking(true);

        try {
            // Convert amount to number
            const amount = parseInt(stakeAmount);

            // Encrypt the amount
            const encryptedAmount = await fhevm.encrypt64(amount);

            // Generate proof
            const proof = await fhevm.generateProof({
                ciphertext: encryptedAmount,
                contractAddress: '0x...', // Your contract address
            });

            // Call the contract
            const tx = await contract.stake(encryptedAmount, proof);
            await tx.wait();

            console.log('Staked successfully');
        } catch (error) {
            console.error('Stake failed:', error);
        } finally {
            setIsStaking(false);
        }
    }

    return (
        <div>
            <h1>Confidential Staking</h1>
            <div>
                <label>Stake Amount:</label>
                <input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                />
                <button onClick={handleStake} disabled={isStaking}>
                    {isStaking ? 'Staking...' : 'Stake'}
                </button>
            </div>
        </div>
    );
}
```

## Best Practices

### 1. Minimize Decryption

Decryption is expensive and reveals sensitive information. Minimize its use:

```solidity
// Bad: Decrypting for comparison
function badExample(euint64 encryptedAmount) public {
  uint64 amount = FHE.decrypt(encryptedAmount);
  require(amount > 0, "Amount must be positive");
}

// Good: Using encrypted comparison
function goodExample(euint64 encryptedAmount) public {
  ebool isPositive = FHE.gt(encryptedAmount, FHE.asEuint64(0));
  require(FHE.decrypt(isPositive), "Amount must be positive");
}
```

### 2. Use Branch-Free Logic

Avoid conditional statements that depend on encrypted values:

```solidity
// Bad: Branching on encrypted values
function badExample(euint64 encryptedAmount) public {
  if (FHE.decrypt(FHE.gt(encryptedAmount, FHE.asEuint64(100)))) {
    // Do something
  } else {
    // Do something else
  }
}

// Good: Using FHE.select
function goodExample(euint64 encryptedAmount) public {
  ebool isLarge = FHE.gt(encryptedAmount, FHE.asEuint64(100));
  euint64 result = FHE.select(
    isLarge,
    FHE.mul(encryptedAmount, FHE.asEuint64(2)), // Double if large
    FHE.add(encryptedAmount, FHE.asEuint64(10)) // Add 10 if small
  );
}
```

### 3. Validate Input Ciphertexts

Always validate encrypted inputs:

```solidity
function deposit(euint64 encryptedAmount) public {
  // Validate the ciphertext
  require(FHE.isInitialized(encryptedAmount), "Invalid ciphertext");

  // Additional validation if needed
  ebool isPositive = FHE.gt(encryptedAmount, FHE.asEuint64(0));
  require(FHE.decrypt(isPositive), "Amount must be positive");

  // Process the deposit
  // ...
}
```

### 4. Handle Decryption Securely

Always verify decryption proofs:

```solidity
function onDecryptCallback(
  bytes32[] calldata handles,
  bytes calldata abiEncodedResult,
  bytes calldata decryptionProof
) external {
  // Always verify the proof
  FHE.checkSignatures(handles, abiEncodedResult, decryptionProof);

  // Additional validation
  require(handles.length == 1, "Invalid handles length");

  // Process the result
  // ...
}
```

## Limitations and Considerations

### 1. Performance

FHE operations are computationally expensive:

- Each operation requires significant gas
- Complex computations may exceed block gas limits
- Decryption can take several seconds

### 2. Supported Operations

Not all operations are supported:

- Limited support for division
- No support for floating-point numbers
- Limited support for complex mathematical functions

### 3. Data Types

Only specific data types are supported:

- Unsigned integers (8, 16, 32, 64 bits)
- Booleans
- No support for signed integers or floating-point

### 4. Network Availability

FHEVM is currently available on:

- Testnet: Fully functional for development
- Mainnet: Limited availability, check Zama's documentation

## Conclusion

The Zama FHEVM SDK opens up new possibilities for privacy-preserving blockchain applications. By understanding its
architecture, capabilities, and limitations, you can build sophisticated confidential smart contracts that protect user
privacy while maintaining the benefits of blockchain technology.

Remember to:

1. Minimize decryption operations
2. Use branch-free logic with encrypted values
3. Always validate input ciphertexts
4. Handle decryption securely with proper proof verification
5. Consider performance implications when designing complex operations

With these principles in mind, you'll be well-equipped to build the next generation of confidential decentralized
applications.
