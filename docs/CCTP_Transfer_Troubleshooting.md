# CCTP Transfer Troubleshooting Guide

## Introduction

Circle's Cross-Chain Transfer Protocol (CCTP) enables secure USDC transfers between different blockchains. However, like
any complex system, things can go wrong. This guide helps you diagnose and resolve common issues with CCTP transfers.

## Common Issues and Solutions

### 1. Transaction Stuck at "Pending" Status

**Symptoms:**

- Transaction appears in the frontend but never completes
- No attestation received after extended period
- Backend logs show continuous polling without success

**Possible Causes:**

1. **Circle's attestation service is delayed**
   - Testnet attestations can take 5-40 minutes
   - Mainnet is typically faster (1-5 minutes)

2. **Invalid burn transaction**
   - Transaction failed but wasn't properly detected
   - Incorrect parameters passed to `depositForBurn`

3. **Network connectivity issues**
   - Unable to reach Circle's Iris API
   - RPC node connectivity problems

**Diagnostic Steps:**

```typescript
// Check if the burn transaction was successful
async function checkBurnTransaction(txHash: string, sourceChain: ChainConfig) {
  const provider = new ethers.JsonRpcProvider(sourceChain.rpcUrl);
  const receipt = await provider.getTransactionReceipt(txHash);

  if (!receipt) {
    console.error("Transaction not found");
    return false;
  }

  if (receipt.status === 0) {
    console.error("Transaction failed");
    return false;
  }

  // Check for MessageSent event
  const messageSentEvent = receipt.logs.find((log) => log.topics[0] === ethers.id("MessageSent(bytes)"));

  if (!messageSentEvent) {
    console.error("MessageSent event not found");
    return false;
  }

  return true;
}

// Check attestation status directly
async function checkAttestationStatus(messageHash: string) {
  try {
    const response = await fetch(`https://iris-api-sandbox.circle.com/v1/attestations/${messageHash}`);

    if (!response.ok) {
      console.error(`API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    console.log("Attestation status:", data.status);
    return data;
  } catch (error) {
    console.error("Failed to check attestation:", error);
    return null;
  }
}
```

**Solutions:**

1. **Wait longer**: Testnet attestations can be slow. Wait at least 40 minutes before assuming failure.
2. **Verify transaction**: Ensure the burn transaction was successful and emitted the correct events.
3. **Check API status**: Verify Circle's Iris API is accessible.
4. **Implement retry logic**: Add exponential backoff for polling.

### 2. "Invalid Attestation" Error

**Symptoms:**

- Backend receives attestation but fails to verify it
- Error message indicates invalid signature or mismatched message hash
- Destination chain transaction reverts

**Possible Causes:**

1. **Corrupted attestation data**
   - Network issues during API call
   - Malformed JSON response

2. **Signature verification failure**
   - Circle's signing key changed
   - Incorrect verification logic

3. **Message hash mismatch**
   - Attestation corresponds to a different transaction
   - Incorrect message hash extraction

**Diagnostic Steps:**

```typescript
function validateAttestation(attestation: any, expectedMessageHash: string): boolean {
  // Check basic structure
  if (!attestation || typeof attestation !== "object") {
    console.error("Invalid attestation format");
    return false;
  }

  // Check message hash matches
  if (attestation.messageHash !== expectedMessageHash) {
    console.error("Message hash mismatch");
    console.error("Expected:", expectedMessageHash);
    console.error("Received:", attestation.messageHash);
    return false;
  }

  // Check status
  if (attestation.status !== "complete") {
    console.error("Attestation not complete:", attestation.status);
    return false;
  }

  // Check required fields
  const requiredFields = ["attestation", "signature"];
  for (const field of requiredFields) {
    if (!attestation[field]) {
      console.error(`Missing required field: ${field}`);
      return false;
    }
  }

  return true;
}

function verifySignature(attestation: string, signature: string): boolean {
  // Implement signature verification logic
  // This typically involves:
  // 1. Recovering the signer's address from the signature
  // 2. Comparing it with Circle's known public key

  // For now, just check basic format
  if (!attestation.startsWith("0x") || !signature.startsWith("0x")) {
    return false;
  }

  if (attestation.length < 10 || signature.length < 10) {
    return false;
  }

  return true;
}
```

**Solutions:**

1. **Validate attestation structure**: Ensure all required fields are present and correctly formatted.
2. **Implement proper signature verification**: Use Circle's public keys to verify attestation signatures.
3. **Add logging**: Log detailed attestation data for debugging.
4. **Contact Circle support**: If signature verification consistently fails, Circle's signing keys may have changed.

### 3. Destination Chain Transaction Reverts

**Symptoms:**

- Attestation is successfully retrieved
- Transaction on destination chain fails with revert error
- USDC not minted on destination chain

**Possible Causes:**

1. **Invalid recipient address**
   - Address not properly formatted for destination chain
   - Address is a contract without proper fallback handling

2. **Insufficient gas**
   - Gas limit too low for the transaction
   - Gas price too low for current network conditions

3. **Nonce issues**
   - Incorrect nonce used for transaction
   - Nonce already used by another transaction

**Diagnostic Steps:**

```typescript
async function diagnoseDestinationTransaction(attestation: Attestation, destinationChain: ChainConfig) {
  const provider = new ethers.JsonRpcProvider(destinationChain.rpcUrl);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  const messageTransmitter = new ethers.Contract(
    destinationChain.messageTransmitter,
    [
      "function receiveMessage(bytes calldata message, bytes calldata signature)",
      "error InvalidSignature()",
      "error InvalidCaller()",
      "error AlreadyProcessed(bytes32)",
    ],
    wallet,
  );

  try {
    // Estimate gas first
    const gasEstimate = await messageTransmitter.receiveMessage.estimateGas(
      attestation.attestation,
      attestation.signature,
    );

    console.log("Estimated gas:", gasEstimate.toString());

    // Try to execute with higher gas limit
    const tx = await messageTransmitter.receiveMessage(
      attestation.attestation,
      attestation.signature,
      { gasLimit: (gasEstimate * 120n) / 100n }, // 20% buffer
    );

    const receipt = await tx.wait();
    console.log("Transaction successful:", receipt.hash);
  } catch (error) {
    console.error("Transaction failed:", error);

    // Check for specific error codes
    if (error.code === ethers.errors.CALL_EXCEPTION) {
      const revertData = error.data;
      console.error("Revert data:", revertData);

      // Parse common errors
      if (revertData.includes("InvalidSignature")) {
        console.error("Error: Invalid signature");
      } else if (revertData.includes("InvalidCaller")) {
        console.error("Error: Invalid caller");
      } else if (revertData.includes("AlreadyProcessed")) {
        console.error("Error: Message already processed");
      }
    }
  }
}
```

**Solutions:**

1. **Validate recipient address**: Ensure the address is properly formatted and exists on the destination chain.
2. **Adjust gas parameters**: Increase gas limit and use appropriate gas price.
3. **Check nonce**: Ensure the correct nonce is used for transactions.
4. **Handle specific errors**: Implement specific error handling for common revert reasons.

### 4. Rate Limiting Issues

**Symptoms:**

- API calls to Circle's Iris service return 429 errors
- Transactions succeed but attestations are delayed
- Backend logs show HTTP 429 Too Many Requests

**Possible Causes:**

1. **Too many API requests**
   - Polling frequency too high
   - Multiple instances making requests

2. **IP-based rate limiting**
   - Multiple services sharing the same IP
   - Exceeded request quota

**Diagnostic Steps:**

```typescript
class RateLimitedAPIClient {
  private lastRequestTime = 0;
  private minInterval = 1000; // 1 second between requests

  async makeRequest(url: string): Promise<any> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minInterval) {
      const delay = this.minInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      const response = await fetch(url);

      // Check for rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : 5000;

        console.log(`Rate limited. Retrying after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));

        return this.makeRequest(url); // Retry
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      this.lastRequestTime = Date.now();
      return await response.json();
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  }
}
```

**Solutions:**

1. **Implement rate limiting**: Add delays between API requests.
2. **Use exponential backoff**: Increase delay between retries.
3. **Distribute requests**: If running multiple instances, stagger request times.
4. **Consider webhooks**: Use Circle's webhook functionality instead of polling.

### 5. Network-Specific Issues

**Symptoms:**

- Transfers work on some chains but not others
- Inconsistent behavior across different networks
- Chain-specific error messages

**Possible Causes:**

1. **Chain configuration errors**
   - Incorrect contract addresses
   - Wrong domain identifiers

2. **Chain-specific requirements**
   - Different gas requirements
   - Unique transaction formats

**Diagnostic Steps:**

```typescript
function validateChainConfig(chain: ChainConfig): boolean {
  const requiredFields = ["name", "chainId", "rpcUrl", "tokenMessenger", "messageTransmitter", "usdcToken", "domain"];

  for (const field of requiredFields) {
    if (!chain[field as keyof ChainConfig]) {
      console.error(`Missing required field in chain config: ${field}`);
      return false;
    }
  }

  // Validate domain
  if (typeof chain.domain !== "number" || chain.domain <= 0) {
    console.error("Invalid domain:", chain.domain);
    return false;
  }

  // Validate contract addresses
  const addressFields = ["tokenMessenger", "messageTransmitter", "usdcToken"];
  for (const field of addressFields) {
    const address = chain[field as keyof ChainConfig] as string;
    if (!ethers.isAddress(address)) {
      console.error(`Invalid address for ${field}:`, address);
      return false;
    }
  }

  return true;
}
```

**Solutions:**

1. **Verify chain configurations**: Ensure all chain-specific settings are correct.
2. **Test on each chain**: Verify functionality on all supported chains.
3. **Handle chain-specific logic**: Implement special handling for chains with unique requirements.

## Debugging Checklist

When troubleshooting CCTP transfers, follow this checklist:

1. **Verify the burn transaction**
   - [ ] Transaction was successful
   - [ ] MessageSent event was emitted
   - [ ] Correct parameters were used

2. **Check attestation status**
   - [ ] Polling Circle's API
   - [ ] Attestation status is "complete"
   - [ ] Attestation data is valid

3. **Verify destination transaction**
   - [ ] Recipient address is valid
   - [ ] Gas parameters are appropriate
   - [ ] Transaction executes successfully

4. **Check for common errors**
   - [ ] Rate limiting issues
   - [ ] Network connectivity problems
   - [ ] Chain configuration errors

## Advanced Debugging Tools

### Transaction Explorer

Create a tool to explore the entire transfer process:

```typescript
class CCTPTransactionExplorer {
  async exploreTransfer(txHash: string, sourceChain: ChainConfig, destinationChain: ChainConfig) {
    console.log("=== CCTP Transfer Explorer ===");
    console.log("Transaction Hash:", txHash);
    console.log("Source Chain:", sourceChain.name);
    console.log("Destination Chain:", destinationChain.name);

    // 1. Check burn transaction
    console.log("\n1. Checking burn transaction...");
    const burnSuccess = await this.checkBurnTransaction(txHash, sourceChain);
    if (!burnSuccess) {
      console.error("❌ Burn transaction failed");
      return;
    }
    console.log("✅ Burn transaction successful");

    // 2. Extract message hash
    const messageHash = await this.extractMessageHash(txHash, sourceChain);
    console.log("Message Hash:", messageHash);

    // 3. Check attestation
    console.log("\n2. Checking attestation...");
    const attestation = await this.checkAttestation(messageHash);
    if (!attestation) {
      console.error("❌ Attestation not found or invalid");
      return;
    }
    console.log("✅ Attestation valid");

    // 4. Check destination transaction
    console.log("\n3. Checking destination transaction...");
    const destSuccess = await this.checkDestinationTransaction(attestation, destinationChain);
    if (!destSuccess) {
      console.error("❌ Destination transaction failed");
      return;
    }
    console.log("✅ Destination transaction successful");

    console.log("\n🎉 Transfer completed successfully!");
  }

  private async checkBurnTransaction(txHash: string, chain: ChainConfig): Promise<boolean> {
    // Implementation as shown earlier
  }

  private async extractMessageHash(txHash: string, chain: ChainConfig): Promise<string> {
    // Extract message hash from transaction logs
  }

  private async checkAttestation(messageHash: string): Promise<any> {
    // Check attestation status
  }

  private async checkDestinationTransaction(attestation: any, chain: ChainConfig): Promise<boolean> {
    // Check destination transaction
  }
}
```

### Monitoring Dashboard

Implement a monitoring dashboard to track transfer status:

```typescript
class CCTPMonitor {
  private transfers: Map<string, TransferStatus> = new Map();

  async monitorTransfer(txHash: string, sourceChain: ChainConfig, destinationChain: ChainConfig) {
    const status: TransferStatus = {
      txHash,
      sourceChain: sourceChain.name,
      destinationChain: destinationChain.name,
      status: "pending",
      timestamp: Date.now(),
      steps: [],
    };

    this.transfers.set(txHash, status);

    try {
      // Monitor each step
      await this.monitorBurn(status, sourceChain);
      await this.monitorAttestation(status);
      await this.monitorDestination(status, destinationChain);

      status.status = "completed";
    } catch (error) {
      status.status = "failed";
      status.error = error.message;
    }

    return status;
  }

  private async monitorBurn(status: TransferStatus, chain: ChainConfig) {
    status.steps.push({ name: "Burn Transaction", status: "pending" });

    // Check burn transaction
    const success = await this.checkBurnTransaction(status.txHash, chain);

    status.steps[0].status = success ? "completed" : "failed";
    if (!success) {
      throw new Error("Burn transaction failed");
    }
  }

  private async monitorAttestation(status: TransferStatus) {
    status.steps.push({ name: "Attestation", status: "pending" });

    // Get message hash and poll for attestation
    const messageHash = await this.extractMessageHash(status.txHash, this.getSourceChain(status));
    const attestation = await this.pollForAttestation(messageHash);

    status.steps[1].status = "completed";
    status.attestation = attestation;
  }

  private async monitorDestination(status: TransferStatus, chain: ChainConfig) {
    status.steps.push({ name: "Destination Transaction", status: "pending" });

    // Execute destination transaction
    const success = await this.executeDestinationTransaction(status.attestation, chain);

    status.steps[2].status = success ? "completed" : "failed";
    if (!success) {
      throw new Error("Destination transaction failed");
    }
  }

  getTransferStatus(txHash: string): TransferStatus | undefined {
    return this.transfers.get(txHash);
  }

  getAllTransfers(): TransferStatus[] {
    return Array.from(this.transfers.values());
  }
}
```

## Conclusion

Troubleshooting CCTP transfers requires a systematic approach to identify where the process is failing. By understanding
the common issues and implementing proper diagnostic tools, you can quickly resolve problems and ensure reliable
cross-chain transfers.

Remember to:

1. Log everything for debugging
2. Implement proper error handling
3. Use rate limiting for API calls
4. Test on all supported chains
5. Monitor transfers in production

With these tools and techniques, you'll be well-equipped to handle any issues that arise with your CCTP implementation.
