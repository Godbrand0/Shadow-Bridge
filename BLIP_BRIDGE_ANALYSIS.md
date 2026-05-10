# BLIP: Worldchain to Base Testnet Bridge

BLIP is a blockchain bridge project that enables users to transfer USDC from World Chain Testnet to Base Sepolia using Circle's Cross-Chain Transfer Protocol (CCTP). Here's how it works:

## Architecture Overview

The bridge consists of several key components:

1. **Frontend Interface** ([`bridge/page.tsx`](../blip/frontend/app/bridge/page.tsx:1))
   - A React-based web interface where users can initiate bridge transactions
   - Supports both regular Web3 wallets and Worldcoin MiniKit
   - Displays real-time status updates during the bridging process

2. **Backend Services** ([`cctp-monitor.ts`](../blip/backend/src/services/cctp-monitor.ts:1))
   - Handles the monitoring and relaying of transactions between chains
   - Polls Circle's Iris V2 API for transaction attestations
   - Updates on-chain records and notifies frontend via WebSocket

3. **Smart Contracts** ([`BlipHistory.sol`](../blip/contract/src/BlipHistory.sol:1))
   - Records bridge transactions on-chain
   - Tracks the status of each bridge operation
   - Maintains a history of user transactions

## Bridge Flow

The bridging process follows these steps:

### 1. User Initiation (Frontend)
- User connects their wallet (Web3 wallet or Worldcoin MiniKit)
- User specifies the amount of USDC to bridge and recipient address
- User approves the TokenMessenger contract to spend their USDC
- User calls `depositForBurn()` on the World Chain TokenMessenger contract

### 2. Transaction Recording (On-Chain)
- The [`BlipHistory`](../blip/contract/src/BlipHistory.sol:10) contract records the bridge intent
- It stores the user's address, amount, recipient, and burn transaction hash
- Status is set to "PENDING"

### 3. Backend Monitoring (CCTP Monitor)
- The backend's [`monitorAndRelay`](../blip/backend/src/services/cctp-monitor.ts:138) function is triggered
- It extracts the MessageSent event from the burn transaction receipt
- It polls Circle's Iris V2 API for the attestation (typically takes 5-40 minutes on testnet)

### 4. Attestation and Relay
- Once the attestation is ready, the backend calls `receiveMessage()` on Base Sepolia
- This mints the USDC on the destination chain
- The backend updates the on-chain record status to "COMPLETED"

### 5. Status Updates
- The backend notifies the frontend via WebSocket about status changes
- The frontend displays real-time updates to the user
- Users can view their transaction history and status

## Chain Configuration

The bridge is configured to work between:

- **Source Chain**: World Chain Testnet (Chain ID: 4801, Domain: 14)
- **Destination Chain**: Base Sepolia (Chain ID: 84532, Domain: 6)

The configuration is defined in [`chains.ts`](../blip/backend/src/config/chains.ts:1):

```typescript
export const CHAINS = {
  WORLD_CHAIN: {
    name: "World Chain Testnet",
    chainId: 4801,
    rpcUrl: process.env.WORLD_CHAIN_RPC!,
    explorer: "https://worldchain-sepolia.explorer.alchemy.com",
    tokenMessenger: process.env.WORLD_CHAIN_TOKEN_MESSENGER!,
    messageTransmitter: process.env.WORLD_CHAIN_MESSAGE_TRANSMITTER!,
    usdcToken: process.env.WORLD_CHAIN_USDC!,
    domain: parseInt(process.env.WORLD_CHAIN_DOMAIN || "14")
  },
  BASE_SEPOLIA: {
    name: "Base Sepolia",
    chainId: 84532,
    rpcUrl: process.env.BASE_RPC!,
    explorer: "https://sepolia.basescan.org",
    tokenMessenger: process.env.BASE_SEPOLIA_TOKEN_MESSENGER!,
    messageTransmitter: process.env.BASE_SEPOLIA_MESSAGE_TRANSMITTER!,
    usdcToken: process.env.BASE_SEPOLIA_USDC!,
    domain: parseInt(process.env.BASE_SEPOLIA_DOMAIN || "6")
  }
}
```

## Key Features

1. **Real-time Status Tracking**: Users can monitor their bridge transactions in real-time through the frontend interface.

2. **Automatic Retry Mechanism**: If a transaction fails, the system can automatically retry it through the [`/retry`](../blip/backend/src/routes/bridge.routes.ts:76) endpoint.

3. **On-chain Record Keeping**: All bridge transactions are recorded on-chain in the [`BlipHistory`](../blip/contract/src/BlipHistory.sol:10) contract, providing transparency and auditability.

4. **WebSocket Notifications**: The frontend receives real-time updates via WebSocket connections, ensuring users are always informed about their transaction status.

5. **Multi-wallet Support**: The bridge supports both regular Web3 wallets and Worldcoin MiniKit for user authentication and transaction signing.

## Security Considerations

1. **Transaction Verification**: The system verifies that users are World ID verified before allowing them to bridge funds.

2. **Attestation Validation**: The backend waits for Circle's official attestation before relaying transactions to the destination chain.

3. **Error Handling**: The system includes comprehensive error handling to manage failed transactions and network issues.

This bridge implementation provides a secure and user-friendly way to transfer USDC between World Chain Testnet and Base Sepolia, leveraging Circle's CCTP for trustless cross-chain transfers.