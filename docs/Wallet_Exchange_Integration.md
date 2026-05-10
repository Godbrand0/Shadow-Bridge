# Wallet and Exchange Integration with FHEVM

## Introduction

Integrating wallets and exchanges with FHEVM (Fully Homomorphic Encryption Virtual Machine) applications requires
special considerations to maintain confidentiality while providing a smooth user experience. This guide covers best
practices and implementation strategies for integrating various wallet types and exchange functionality with FHEVM
applications.

## Wallet Integration

### 1. Standard Web3 Wallets (MetaMask, etc.)

Standard Web3 wallets like MetaMask can be integrated with FHEVM applications with minimal modifications. The main
difference is that users need to be connected to the FHEVM network instead of Ethereum mainnet.

#### Basic Integration

```typescript
import { ethers } from "ethers";
import { FhevmInstance } from "fhevmjs";

class WalletService {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.JsonRpcSigner | null = null;
  private fhevmInstance: FhevmInstance | null = null;

  async connectWallet() {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        // Request account access
        await window.ethereum.request({ method: "eth_requestAccounts" });

        // Create provider and signer
        this.provider = new ethers.BrowserProvider(window.ethereum);
        this.signer = await this.provider.getSigner();

        // Initialize FHEVM
        await this.initializeFhevm();

        return this.signer.getAddress();
      } catch (error) {
        console.error("Error connecting wallet:", error);
        throw error;
      }
    } else {
      throw new Error("MetaMask not installed");
    }
  }

  async initializeFhevm() {
    this.fhevmInstance = await FhevmInstance.create({
      kmsUrl: "https://kms.zama.ai",
      networkUrl: "https://fhevm.zama.ai",
      apiKey: process.env.NEXT_PUBLIC_ZAMA_API_KEY || "",
    });
  }

  async encryptAmount(amount: number): Promise<{ ciphertext: any; proof: any }> {
    if (!this.fhevmInstance) {
      throw new Error("FHEVM not initialized");
    }

    const ciphertext = await this.fhevmInstance.encrypt64(amount);
    const proof = await this.fhevmInstance.generateProof({
      ciphertext: ciphertext,
      contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "",
    });

    return { ciphertext, proof };
  }

  getSigner(): ethers.JsonRpcSigner | null {
    return this.signer;
  }

  isConnected(): boolean {
    return this.signer !== null;
  }
}
```

#### Network Configuration

Users need to add the FHEVM network to their wallet:

```typescript
async function addFhevmNetwork() {
  if (typeof window !== "undefined" && window.ethereum) {
    try {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0x1f48", // 8008 in decimal
            chainName: "FHEVM",
            nativeCurrency: {
              name: "ETH",
              symbol: "ETH",
              decimals: 18,
            },
            rpcUrls: ["https://fhevm.zama.ai"],
            blockExplorerUrls: ["https://explorer.fhevm.zama.ai"],
          },
        ],
      });
    } catch (error) {
      console.error("Error adding FHEVM network:", error);
    }
  }
}
```

#### Network Switching

Automatically switch to FHEVM network when needed:

```typescript
async function switchToFhevmNetwork() {
  if (typeof window !== "undefined" && window.ethereum) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x1f48" }],
      });
    } catch (error: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (error.code === 4902) {
        await addFhevmNetwork();
      } else {
        console.error("Error switching to FHEVM network:", error);
      }
    }
  }
}
```

### 2. Hardware Wallets (Ledger, Trezor)

Hardware wallets provide enhanced security but require additional considerations for FHEVM integration.

#### Ledger Integration

```typescript
import { LedgerSigner } from "@ethersproject/signers";

class LedgerWalletService {
  private signer: LedgerSigner | null = null;
  private fhevmInstance: FhevmInstance | null = null;

  async connectLedger() {
    try {
      // Create a provider for FHEVM
      const provider = new ethers.JsonRpcProvider("https://fhevm.zama.ai");

      // Create a Ledger signer
      this.signer = new LedgerSigner(provider, "hid");

      // Initialize FHEVM
      await this.initializeFhevm();

      return this.signer.getAddress();
    } catch (error) {
      console.error("Error connecting Ledger:", error);
      throw error;
    }
  }

  async initializeFhevm() {
    this.fhevmInstance = await FhevmInstance.create({
      kmsUrl: "https://kms.zama.ai",
      networkUrl: "https://fhevm.zama.ai",
      apiKey: process.env.NEXT_PUBLIC_ZAMA_API_KEY || "",
    });
  }

  async signTransaction(transaction: ethers.TransactionRequest) {
    if (!this.signer) {
      throw new Error("Ledger not connected");
    }

    return this.signer.signTransaction(transaction);
  }
}
```

#### Trezor Integration

```typescript
import TrezorConnect from "trezor-connect";

class TrezorWalletService {
  private address: string | null = null;
  private fhevmInstance: FhevmInstance | null = null;

  async connectTrezor() {
    try {
      // Initialize TrezorConnect
      TrezorConnect.init({
        lazyLoad: true,
        manifest: {
          email: "your-email@example.com",
          appUrl: "your-app-url.com",
        },
      });

      // Get Ethereum address
      const result = await TrezorConnect.ethereumGetAddress({
        path: "m/44'/60'/0'/0/0",
        showOnTrezor: true,
      });

      if (result.success) {
        this.address = result.payload.address;

        // Initialize FHEVM
        await this.initializeFhevm();

        return this.address;
      } else {
        throw new Error(result.payload.error);
      }
    } catch (error) {
      console.error("Error connecting Trezor:", error);
      throw error;
    }
  }

  async signTransaction(transaction: ethers.TransactionRequest) {
    if (!this.address) {
      throw new Error("Trezor not connected");
    }

    const result = await TrezorConnect.ethereumSignTransaction({
      path: "m/44'/60'/0'/0/0",
      transaction: {
        to: transaction.to,
        value: transaction.value ? transaction.value.toString() : "0",
        data: transaction.data ? ethers.hexlify(transaction.data) : "",
        chainId: 8008, // FHEVM chain ID
        nonce: transaction.nonce ? ethers.toNumber(transaction.nonce) : 0,
        gasLimit: transaction.gasLimit ? transaction.gasLimit.toString() : "21000",
        gasPrice: transaction.gasPrice ? transaction.gasPrice.toString() : "0",
      },
    });

    if (result.success) {
      return result.payload.signature;
    } else {
      throw new Error(result.payload.error);
    }
  }
}
```

### 3. Mobile Wallets (WalletConnect)

WalletConnect allows integration with mobile wallets while maintaining confidentiality.

```typescript
import { WalletConnectClient } from "@walletconnect/client";
import { ethers } from "ethers";

class WalletConnectService {
  private client: WalletConnectClient | null = null;
  private provider: ethers.JsonRpcProvider | null = null;
  private signer: ethers.JsonRpcSigner | null = null;
  private fhevmInstance: FhevmInstance | null = null;

  async connectWalletConnect() {
    try {
      // Create WalletConnect client
      this.client = await WalletConnectClient.init({
        relayProvider: "wss://relay.walletconnect.com",
        projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
        metadata: {
          name: "FHEVM App",
          description: "Confidential dApp with FHEVM",
          url: "https://your-app-url.com",
          icons: ["https://your-app-url.com/icon.png"],
        },
      });

      // Connect to a wallet
      const { uri, approval } = await this.client.connect({
        requiredNamespaces: {
          eip155: {
            chains: ["eip155:8008"], // FHEVM chain ID
            methods: ["eth_sendTransaction", "eth_signTransaction"],
            events: ["chainChanged", "accountsChanged"],
          },
        },
      });

      // Display QR code for mobile wallet
      if (uri) {
        this.displayQRCode(uri);
      }

      // Wait for approval
      const session = await approval();

      // Create provider and signer
      this.provider = new ethers.JsonRpcProvider("https://fhevm.zama.ai");
      this.signer = new ethers.Wallet(session.namespaces.eip155.accounts[0].split(":")[2], this.provider);

      // Initialize FHEVM
      await this.initializeFhevm();

      return this.signer.getAddress();
    } catch (error) {
      console.error("Error connecting with WalletConnect:", error);
      throw error;
    }
  }

  displayQRCode(uri: string) {
    // In a real implementation, this would display a QR code
    console.log("QR Code URI:", uri);
  }

  async initializeFhevm() {
    this.fhevmInstance = await FhevmInstance.create({
      kmsUrl: "https://kms.zama.ai",
      networkUrl: "https://fhevm.zama.ai",
      apiKey: process.env.NEXT_PUBLIC_ZAMA_API_KEY || "",
    });
  }
}
```

## Exchange Integration

### 1. On-Ramp Integration (MoonPay, Ramp, etc.)

On-ramp services allow users to purchase cryptocurrency with fiat. Integrating them with FHEVM requires special
handling.

```typescript
class OnRampService {
  async createMoonPayUrl(address: string): string {
    const params = new URLSearchParams({
      apiKey: process.env.NEXT_PUBLIC_MOONPAY_API_KEY || "",
      baseCurrencyCode: "usd",
      baseCurrencyAmount: "100",
      quoteCurrencyCode: "eth",
      walletAddress: address,
      redirectURL: `${window.location.origin}/onramp-success`,
    });

    return `https://buy.moonpay.com?${params.toString()}`;
  }

  async createRampUrl(address: string): string {
    const params = new URLSearchParams({
      userAddress: address,
      swapAsset: "ETH",
      swapAmount: "100",
      fiatCurrency: "USD",
      hostApiKey: process.env.NEXT_PUBLIC_RAMP_API_KEY || "",
      hostLogoUrl: `${window.location.origin}/logo.png`,
      finalUrl: `${window.location.origin}/onramp-success`,
    });

    return `https://buy.ramp.network?${params.toString()}`;
  }

  async handleOnRampSuccess(transactionId: string) {
    // In a real implementation, this would:
    // 1. Verify the transaction with the on-ramp provider
    // 2. Wait for the funds to arrive on FHEVM
    // 3. Update the user's balance in the application

    console.log("On-ramp transaction completed:", transactionId);

    // Show success message to user
    alert("Funds have been successfully added to your FHEVM wallet!");
  }
}
```

### 2. Swap Integration (0x, Uniswap, etc.)

Swap integrations allow users to exchange tokens on FHEVM. Since FHEVM is EVM-compatible, most swap protocols can be
integrated with minimal modifications.

```typescript
import { ZeroXSwap } from "@0x/swap-sdk";

class SwapService {
  private swapClient: ZeroXSwap;

  constructor() {
    this.swapClient = new ZeroXSwap({
      chainId: 8008, // FHEVM chain ID
    });
  }

  async getQuote(fromToken: string, toToken: string, amount: string) {
    try {
      const quote = await this.swapClient.getQuote({
        sellToken: fromToken,
        buyToken: toToken,
        sellAmount: amount,
      });

      return quote;
    } catch (error) {
      console.error("Error getting swap quote:", error);
      throw error;
    }
  }

  async executeSwap(quote: any, signer: ethers.JsonRpcSigner) {
    try {
      const tx = await this.swapClient.executeSwap(quote, signer);
      await tx.wait();

      return tx.hash;
    } catch (error) {
      console.error("Error executing swap:", error);
      throw error;
    }
  }
}
```

### 3. Bridge Integration (Cross-Chain)

Bridge integrations allow users to move assets between FHEVM and other blockchains.

```typescript
class BridgeService {
  async bridgeToEthereum(amount: string, signer: ethers.JsonRpcSigner) {
    try {
      // In a real implementation, this would:
      // 1. Lock the tokens on FHEVM
      // 2. Mint equivalent tokens on Ethereum
      // 3. Use a secure oracle to verify the transaction

      const bridgeContract = new ethers.Contract(
        process.env.NEXT_PUBLIC_BRIDGE_CONTRACT_ADDRESS || "",
        [
          "function lockTokens(uint256 amount)",
          "event TokensLocked(address indexed user, uint256 amount, bytes32 transactionId)",
        ],
        signer,
      );

      const tx = await bridgeContract.lockTokens(ethers.parseEther(amount));
      const receipt = await tx.wait();

      // Extract transaction ID from event
      const event = receipt.logs.find((log) => log.topics[0] === ethers.id("TokensLocked(address,uint256,bytes32)"));

      if (event) {
        const transactionId = ethers.AbiCoder.defaultAbiCoder().decode(["bytes32"], event.topics[3])[0];

        return transactionId;
      }

      throw new Error("Transaction ID not found in receipt");
    } catch (error) {
      console.error("Error bridging to Ethereum:", error);
      throw error;
    }
  }

  async bridgeFromEthereum(transactionId: string) {
    try {
      // In a real implementation, this would:
      // 1. Verify the transaction on Ethereum
      // 2. Unlock the tokens on FHEVM
      // 3. Update the user's balance

      console.log("Bridging from Ethereum:", transactionId);

      // Show success message to user
      alert("Tokens have been successfully bridged to FHEVM!");
    } catch (error) {
      console.error("Error bridging from Ethereum:", error);
      throw error;
    }
  }
}
```

## User Experience Considerations

### 1. Network Switching

Make network switching seamless for users:

```typescript
async function ensureCorrectNetwork() {
  if (typeof window !== "undefined" && window.ethereum) {
    const chainId = await window.ethereum.request({ method: "eth_chainId" });

    if (chainId !== "0x1f48") {
      // Not FHEVM
      try {
        await switchToFhevmNetwork();
      } catch (error) {
        console.error("Error switching network:", error);

        // Show user-friendly message
        alert("Please switch to the FHEVM network to use this application");
      }
    }
  }
}
```

### 2. Transaction Confirmation

Provide clear feedback during transactions:

```typescript
class TransactionService {
  async sendTransaction(transaction: ethers.TransactionRequest, signer: ethers.JsonRpcSigner) {
    try {
      // Show loading state
      showTransactionModal("Preparing transaction...");

      // Estimate gas
      const gasEstimate = await signer.estimateGas(transaction);

      // Update modal
      showTransactionModal("Confirming transaction in wallet...");

      // Send transaction
      const tx = await signer.sendTransaction({
        ...transaction,
        gasLimit: (gasEstimate * 120n) / 100n, // 20% buffer
      });

      // Update modal
      showTransactionModal("Transaction sent! Waiting for confirmation...");

      // Wait for confirmation
      const receipt = await tx.wait();

      // Close modal
      closeTransactionModal();

      return receipt;
    } catch (error) {
      // Close modal
      closeTransactionModal();

      // Show error message
      alert(`Transaction failed: ${error.message}`);

      throw error;
    }
  }
}
```

### 3. Balance Display

Show encrypted balances in a user-friendly way:

```typescript
class BalanceService {
  async getEncryptedBalance(address: string, contract: ethers.Contract): Promise<string> {
    try {
      // Request decryption of balance
      const tx = await contract.requestBalanceDecryption(address);
      await tx.wait();

      // In a real implementation, you would listen for the decryption callback
      // and return the decrypted balance

      return "*****"; // Placeholder while waiting for decryption
    } catch (error) {
      console.error("Error getting balance:", error);
      return "Error";
    }
  }

  formatBalance(balance: string): string {
    if (balance === "*****") {
      return "*****";
    }

    try {
      const amount = parseFloat(balance);
      if (isNaN(amount)) {
        return "*****";
      }

      return amount.toFixed(4);
    } catch (error) {
      return "*****";
    }
  }
}
```

## Security Considerations

### 1. Private Key Management

Never store private keys in the frontend:

```typescript
// Bad: Storing private key in localStorage
localStorage.setItem("privateKey", privateKey);

// Good: Using a secure wallet integration
const signer = await provider.getSigner();
```

### 2. Input Validation

Validate all user inputs:

```typescript
function validateAmount(amount: string): boolean {
  // Check if amount is a valid number
  if (!/^\d+(\.\d+)?$/.test(amount)) {
    return false;
  }

  // Check if amount is positive
  const numAmount = parseFloat(amount);
  if (numAmount <= 0) {
    return false;
  }

  // Check if amount has reasonable precision
  const decimalPlaces = amount.split(".")[1]?.length || 0;
  if (decimalPlaces > 18) {
    return false;
  }

  return true;
}
```

### 3. Error Handling

Implement comprehensive error handling:

```typescript
class ErrorHandler {
  static handle(error: any): string {
    // MetaMask user rejected transaction
    if (error.code === 4001) {
      return "Transaction was rejected by user";
    }

    // Insufficient funds
    if (error.code === -32603 && error.message.includes("insufficient funds")) {
      return "Insufficient funds for this transaction";
    }

    // Network error
    if (error.code === "NETWORK_ERROR") {
      return "Network error. Please check your connection";
    }

    // Default error
    return error.message || "An unknown error occurred";
  }
}
```

## Testing Integration

### 1. Unit Testing

```typescript
import { expect } from "chai";
import { ethers } from "ethers";
import { WalletService } from "../services/WalletService";

describe("WalletService", () => {
  let walletService: WalletService;

  beforeEach(() => {
    walletService = new WalletService();
  });

  it("should encrypt amount correctly", async () => {
    // Mock FhevmInstance
    const mockFhevmInstance = {
      encrypt64: async (amount: number) => ({ ciphertext: `encrypted_${amount}` }),
      generateProof: async (params: any) => ({ proof: `proof_${params.contractAddress}` }),
    };

    // @ts-ignore
    walletService.fhevmInstance = mockFhevmInstance;

    const result = await walletService.encryptAmount(100);

    expect(result.ciphertext).to.equal("encrypted_100");
    expect(result.proof).to.include("proof_");
  });
});
```

### 2. Integration Testing

```typescript
describe("Wallet Integration", () => {
  it("should connect to MetaMask", async () => {
    // This test requires MetaMask to be installed and unlocked
    const walletService = new WalletService();

    try {
      const address = await walletService.connectWallet();
      expect(address).to.match(/^0x[a-fA-F0-9]{40}$/);
    } catch (error) {
      // Skip test if MetaMask is not available
      console.log("MetaMask not available, skipping test");
    }
  });
});
```

### 3. End-to-End Testing

```typescript
describe("End-to-End Flow", () => {
  it("should complete a full transaction flow", async () => {
    // This test requires a real wallet and FHEVM network connection

    // 1. Connect wallet
    const walletService = new WalletService();
    const address = await walletService.connectWallet();

    // 2. Encrypt amount
    const { ciphertext, proof } = await walletService.encryptAmount(100);

    // 3. Send transaction
    const signer = walletService.getSigner();
    const contract = new ethers.Contract(
      process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "",
      ["function deposit(euint64, bytes)"],
      signer,
    );

    const tx = await contract.deposit(ciphertext, proof);
    const receipt = await tx.wait();

    // 4. Verify transaction
    expect(receipt.status).to.equal(1);
  });
});
```

## Conclusion

Integrating wallets and exchanges with FHEVM applications requires careful consideration of confidentiality, user
experience, and security. By following the best practices outlined in this guide, you can create seamless integrations
that maintain privacy while providing a smooth user experience.

Key takeaways:

1. Support multiple wallet types for maximum accessibility
2. Make network switching seamless for users
3. Provide clear feedback during transactions
4. Never store private keys in the frontend
5. Validate all user inputs
6. Implement comprehensive error handling
7. Test all integrations thoroughly

With these principles in mind, you can build robust FHEVM applications that integrate well with the existing blockchain
ecosystem.
