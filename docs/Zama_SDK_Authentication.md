# Zama SDK Authentication Guide

## Introduction

Authentication is a critical component when working with Zama's FHEVM SDK. It ensures secure communication between your application and Zama's Key Management Service (KMS), which handles the decryption of encrypted values. This guide explains how to set up and manage authentication for your FHEVM applications.

## Authentication Overview

The Zama FHEVM SDK uses several authentication mechanisms:

1. **API Key Authentication**: For accessing Zama's KMS and other services
2. **Wallet Authentication**: For interacting with the FHEVM blockchain
3. **Proof Generation**: For validating encrypted inputs to smart contracts

## API Key Authentication

### Getting Your API Key

1. **Sign up for Zama Services**
   - Visit [Zama's Developer Portal](https://docs.zama.ai/)
   - Create an account or sign in with existing credentials
   - Navigate to the API Keys section

2. **Create a New API Key**
   - Click "Create New API Key"
   - Give your key a descriptive name (e.g., "My FHE App - Production")
   - Select the appropriate permissions:
     - `fhevm.decrypt`: Required for decryption operations
     - `fhevm.encrypt`: Required for client-side encryption
     - `fhevm.proof`: Required for proof generation
   - Click "Create"

3. **Secure Your API Key**
   - Copy the API key immediately (it won't be shown again)
   - Store it securely (e.g., in environment variables or a secret manager)
   - Never commit API keys to version control

### Using API Keys in Your Application

#### Environment Variables (Recommended)

```bash
# .env.local
ZAMA_API_KEY=your_api_key_here
ZAMA_KMS_URL=https://kms.zama.ai
ZAMA_NETWORK_URL=https://fhevm.zama.ai
```

```typescript
// config.ts
export const config = {
  apiKey: process.env.ZAMA_API_KEY,
  kmsUrl: process.env.ZAMA_KMS_URL,
  networkUrl: process.env.ZAMA_NETWORK_URL,
};
```

#### Direct Initialization

```typescript
import { FhevmInstance } from 'fhevmjs';

async function initializeFhevm() {
  const fhevmInstance = await FhevmInstance.create({
    kmsUrl: 'https://kms.zama.ai',
    networkUrl: 'https://fhevm.zama.ai',
    apiKey: 'your_api_key_here',
  });
  
  return fhevmInstance;
}
```

### API Key Rotation

Regularly rotating your API keys is a security best practice:

```typescript
class ApiKeyManager {
  private currentKey: string;
  private backupKey: string;
  
  constructor(currentKey: string, backupKey: string) {
    this.currentKey = currentKey;
    this.backupKey = backupKey;
  }
  
  async rotateKeys(newKey: string): Promise<void> {
    try {
      // Test the new key
      const testInstance = await FhevmInstance.create({
        kmsUrl: 'https://kms.zama.ai',
        networkUrl: 'https://fhevm.zama.ai',
        apiKey: newKey,
      });
      
      // If successful, rotate the keys
      this.backupKey = this.currentKey;
      this.currentKey = newKey;
      
      console.log('API key rotated successfully');
    } catch (error) {
      console.error('Failed to rotate API key:', error);
      throw error;
    }
  }
  
  getCurrentKey(): string {
    return this.currentKey;
  }
  
  getBackupKey(): string {
    return this.backupKey;
  }
}
```

## Wallet Authentication

### Setting Up Your Wallet

1. **Create or Import a Wallet**
   ```typescript
   import { ethers } from 'ethers';
   
   // Create a new wallet
   const wallet = ethers.Wallet.createRandom();
   
   // Or import from private key
   const wallet = new ethers.Wallet('your_private_key_here');
   
   console.log('Address:', wallet.address);
   console.log('Private Key:', wallet.privateKey);
   ```

2. **Fund Your Wallet**
   - For testnet: Use a faucet to get test tokens
   - For mainnet: Transfer real funds to your wallet

3. **Connect to FHEVM Network**
   ```typescript
   import { ethers } from 'ethers';
   
   const provider = new ethers.JsonRpcProvider('https://fhevm.zama.ai');
   const wallet = new ethers.Wallet('your_private_key_here', provider);
   
   // Check connection
   const balance = await wallet.getBalance();
   console.log('Balance:', ethers.formatEther(balance));
   ```

### Using Wallet in Your Application

```typescript
import { ethers } from 'ethers';
import { FhevmInstance } from 'fhevmjs';

class FhevmService {
  private fhevmInstance: FhevmInstance | null = null;
  private wallet: ethers.Wallet;
  
  constructor(privateKey: string) {
    const provider = new ethers.JsonRpcProvider('https://fhevm.zama.ai');
    this.wallet = new ethers.Wallet(privateKey, provider);
  }
  
  async initialize(apiKey: string): Promise<void> {
    this.fhevmInstance = await FhevmInstance.create({
      kmsUrl: 'https://kms.zama.ai',
      networkUrl: 'https://fhevm.zama.ai',
      apiKey: apiKey,
    });
  }
  
  async encryptAmount(amount: number): Promise<any> {
    if (!this.fhevmInstance) {
      throw new Error('FHEVM instance not initialized');
    }
    
    return await this.fhevmInstance.encrypt64(amount);
  }
  
  async generateProof(ciphertext: any, contractAddress: string): Promise<any> {
    if (!this.fhevmInstance) {
      throw new Error('FHEVM instance not initialized');
    }
    
    return await this.fhevmInstance.generateProof({
      ciphertext: ciphertext,
      contractAddress: contractAddress,
    });
  }
  
  getWalletAddress(): string {
    return this.wallet.address;
  }
}
```

## Proof Generation

### Understanding Proofs

Proofs are cryptographic evidence that:
1. The ciphertext was properly encrypted
2. The encryption was done by the authorized user
3. The ciphertext corresponds to a specific plaintext value

### Generating Proofs

```typescript
async function generateProofForContract(
  fhevmInstance: FhevmInstance,
  amount: number,
  contractAddress: string
): Promise<{ ciphertext: any; proof: any }> {
  // Encrypt the amount
  const ciphertext = await fhevmInstance.encrypt64(amount);
  
  // Generate proof
  const proof = await fhevmInstance.generateProof({
    ciphertext: ciphertext,
    contractAddress: contractAddress,
  });
  
  return { ciphertext, proof };
}
```

### Using Proofs in Smart Contracts

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@fhevm/contracts/FHE.sol";

contract ProofExample {
    mapping(address => euint64) private encryptedBalances;
    
    function depositWithProof(
        euint64 encryptedAmount,
        bytes calldata proof
    ) public {
        // Verify the proof
        require(FHE.verifyProof(encryptedAmount, proof), "Invalid proof");
        
        // Validate the amount
        ebool isPositive = FHE.gt(encryptedAmount, FHE.asEuint64(0));
        require(FHE.decrypt(isPositive), "Amount must be positive");
        
        // Add to balance
        encryptedBalances[msg.sender] = FHE.add(
            encryptedBalances[msg.sender],
            encryptedAmount
        );
    }
}
```

## Advanced Authentication Patterns

### Multi-User Authentication

For applications with multiple users, each user needs their own authentication:

```typescript
class UserFhevmService {
  private userInstances: Map<string, FhevmInstance> = new Map();
  
  async authenticateUser(
    userId: string,
    apiKey: string,
    privateKey: string
  ): Promise<void> {
    const fhevmInstance = await FhevmInstance.create({
      kmsUrl: 'https://kms.zama.ai',
      networkUrl: 'https://fhevm.zama.ai',
      apiKey: apiKey,
    });
    
    // Create wallet for the user
    const provider = new ethers.JsonRpcProvider('https://fhevm.zama.ai');
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // Store the instance
    this.userInstances.set(userId, {
      fhevm: fhevmInstance,
      wallet: wallet,
    });
  }
  
  getUserInstance(userId: string): { fhevm: FhevmInstance; wallet: ethers.Wallet } | null {
    return this.userInstances.get(userId) || null;
  }
}
```

### Session-Based Authentication

For web applications, implement session-based authentication:

```typescript
import { sign, verify } from 'jsonwebtoken';

class AuthService {
  private jwtSecret: string;
  
  constructor(jwtSecret: string) {
    this.jwtSecret = jwtSecret;
  }
  
  generateUserToken(userId: string, apiKey: string): string {
    const payload = {
      userId,
      apiKey,
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour expiration
    };
    
    return sign(payload, this.jwtSecret);
  }
  
  verifyUserToken(token: string): { userId: string; apiKey: string } | null {
    try {
      const decoded = verify(token, this.jwtSecret) as any;
      return {
        userId: decoded.userId,
        apiKey: decoded.apiKey,
      };
    } catch (error) {
      return null;
    }
  }
}

// Express middleware example
function authMiddleware(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const authService = new AuthService(process.env.JWT_SECRET!);
  const user = authService.verifyUserToken(token);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  req.user = user;
  next();
}
```

### Hardware Security Module (HSM) Integration

For enterprise applications, integrate with HSM for enhanced security:

```typescript
class HsmAuthService {
  private hsmClient: any; // Hypothetical HSM client
  
  constructor(hsmConfig: any) {
    this.hsmClient = new HsmClient(hsmConfig);
  }
  
  async signWithHsm(data: string): Promise<string> {
    // Use HSM to sign the data
    const signature = await this.hsmClient.sign({
      keyId: 'fhevm-signing-key',
      data: data,
      algorithm: 'ECDSA',
    });
    
    return signature;
  }
  
  async getHsmAuthenticatedFhevmInstance(apiKey: string): Promise<FhevmInstance> {
    // Create a signature for the API key
    const signature = await this.signWithHsm(apiKey);
    
    // Initialize FHEVM with HSM authentication
    const fhevmInstance = await FhevmInstance.create({
      kmsUrl: 'https://kms.zama.ai',
      networkUrl: 'https://fhevm.zama.ai',
      apiKey: apiKey,
      auth: {
        type: 'hsm',
        signature: signature,
        certificate: await this.hsmClient.getCertificate('fhevm-cert'),
      },
    });
    
    return fhevmInstance;
  }
}
```

## Error Handling

### Common Authentication Errors

```typescript
class AuthenticationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

async function handleAuthentication(apiKey: string): Promise<FhevmInstance> {
  try {
    return await FhevmInstance.create({
      kmsUrl: 'https://kms.zama.ai',
      networkUrl: 'https://fhevm.zama.ai',
      apiKey: apiKey,
    });
  } catch (error) {
    if (error.message.includes('401')) {
      throw new AuthenticationError('Invalid API key', 'INVALID_API_KEY');
    } else if (error.message.includes('403')) {
      throw new AuthenticationError('Insufficient permissions', 'INSUFFICIENT_PERMISSIONS');
    } else if (error.message.includes('429')) {
      throw new AuthenticationError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
    } else {
      throw new AuthenticationError('Authentication failed', 'AUTH_FAILED');
    }
  }
}
```

### Retry Logic with Exponential Backoff

```typescript
async function authenticateWithRetry(
  apiKey: string,
  maxRetries: number = 3
): Promise<FhevmInstance> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await FhevmInstance.create({
        kmsUrl: 'https://kms.zama.ai',
        networkUrl: 'https://fhevm.zama.ai',
        apiKey: apiKey,
      });
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`Authentication failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
```

## Security Best Practices

### 1. Secure API Key Storage

```typescript
// Use environment variables in production
const config = {
  apiKey: process.env.ZAMA_API_KEY,
  kmsUrl: process.env.ZAMA_KMS_URL,
  networkUrl: process.env.ZAMA_NETWORK_URL,
};

// For development, use a .env file (never commit to git)
if (process.env.NODE_ENV === 'development') {
  require('dotenv').config();
}
```

### 2. Implement Rate Limiting

```typescript
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxRequests: number;
  
  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }
  
  isAllowed(apiKey: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    if (!this.requests.has(apiKey)) {
      this.requests.set(apiKey, [now]);
      return true;
    }
    
    const timestamps = this.requests.get(apiKey)!;
    const validTimestamps = timestamps.filter(time => time > windowStart);
    
    if (validTimestamps.length >= this.maxRequests) {
      return false;
    }
    
    validTimestamps.push(now);
    this.requests.set(apiKey, validTimestamps);
    return true;
  }
}

// Usage in authentication
const rateLimiter = new RateLimiter(60 * 1000, 100); // 100 requests per minute

async function authenticatedOperation(apiKey: string): Promise<any> {
  if (!rateLimiter.isAllowed(apiKey)) {
    throw new AuthenticationError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
  }
  
  // Proceed with the operation
  // ...
}
```

### 3. Audit Logging

```typescript
class AuditLogger {
  private logs: Array<{
    timestamp: Date;
    apiKey: string;
    operation: string;
    success: boolean;
    error?: string;
  }> = [];
  
  log(apiKey: string, operation: string, success: boolean, error?: string): void {
    this.logs.push({
      timestamp: new Date(),
      apiKey: this.hashApiKey(apiKey),
      operation,
      success,
      error,
    });
    
    // In production, send to a logging service
    console.log('Audit log:', JSON.stringify({
      timestamp: new Date().toISOString(),
      apiKey: this.hashApiKey(apiKey),
      operation,
      success,
      error,
    }));
  }
  
  private hashApiKey(apiKey: string): string {
    // Hash the API key for privacy
    return require('crypto')
      .createHash('sha256')
      .update(apiKey)
      .digest('hex')
      .substring(0, 8);
  }
}

// Usage in authentication
const auditLogger = new AuditLogger();

async function authenticatedOperation(apiKey: string): Promise<any> {
  try {
    const result = await performOperation(apiKey);
    auditLogger.log(apiKey, 'performOperation', true);
    return result;
  } catch (error) {
    auditLogger.log(apiKey, 'performOperation', false, error.message);
    throw error;
  }
}
```

## Testing Authentication

### Unit Testing

```typescript
import { expect } from 'chai';
import { FhevmInstance } from 'fhevmjs';
import sinon from 'sinon';

describe('Authentication', () => {
  let fhevmInstance: FhevmInstance;
  let createStub: sinon.SinonStub;
  
  beforeEach(() => {
    createStub = sinon.stub(FhevmInstance, 'create');
  });
  
  afterEach(() => {
    createStub.restore();
  });
  
  it('should authenticate with valid API key', async () => {
    const mockInstance = { /* mock instance */ };
    createStub.resolves(mockInstance);
    
    const result = await authenticateWithApiKey('valid-api-key');
    
    expect(result).to.equal(mockInstance);
    expect(createStub.calledOnce).to.be.true;
    expect(createStub.firstCall.args[0].apiKey).to.equal('valid-api-key');
  });
  
  it('should reject with invalid API key', async () => {
    createStub.rejects(new Error('401 Unauthorized'));
    
    try {
      await authenticateWithApiKey('invalid-api-key');
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error.message).to.include('Invalid API key');
      expect(error.code).to.equal('INVALID_API_KEY');
    }
  });
});
```

### Integration Testing

```typescript
describe('Authentication Integration', () => {
  let realApiKey: string;
  
  before(() => {
    // Use a real API key for integration tests
    realApiKey = process.env.TEST_ZAMA_API_KEY;
    
    if (!realApiKey) {
      throw new Error('TEST_ZAMA_API_KEY environment variable is required');
    }
  });
  
  it('should successfully authenticate with real API key', async () => {
    const fhevmInstance = await FhevmInstance.create({
      kmsUrl: 'https://kms.zama.ai',
      networkUrl: 'https://fhevm.zama.ai',
      apiKey: realApiKey,
    });
    
    expect(fhevmInstance).to.not.be.null;
    
    // Test basic functionality
    const encryptedValue = await fhevmInstance.encrypt64(42);
    expect(encryptedValue).to.not.be.null;
  });
});
```

## Conclusion

Proper authentication is essential for building secure FHEVM applications. By following the practices outlined in this guide, you can ensure that your application:

1. Securely authenticates with Zama's services
2. Properly manages API keys and credentials
3. Generates valid proofs for smart contract interactions
4. Handles authentication errors gracefully
5. Implements security best practices

Remember to:
- Never commit API keys to version control
- Use environment variables or secret managers
- Implement proper error handling and retry logic
- Add rate limiting and audit logging
- Regularly rotate API keys

With these authentication mechanisms in place, your FHEVM application will be secure and ready for production use.