# ShadowBridge Documentation Index

This document provides a comprehensive index of all documentation related to the ShadowBridge project, including
analysis of both ShadowBridge and BLIP implementations, as well as reference materials for Circle CCTP and Zama FHEVM
SDK.

## Project Documentation

### ShadowBridge Analysis

- **[ShadowBridge: Multi-Chain Confidential Bridge Analysis](../SHADOWBRIDGE_ANALYSIS.md)**
  - Overview of ShadowBridge architecture and components
  - Detailed explanation of the bridge flow and FHE operations
  - Critical issues identified and recommendations for improvement
  - Comparison with BLIP implementation

### BLIP Analysis

- **[BLIP: Worldchain to Base Testnet Bridge](../BLIP_BRIDGE_ANALYSIS.md)**
  - Architecture overview of BLIP's bridge implementation
  - Complete bridge flow from user initiation to completion
  - Chain configuration for World Chain Testnet and Base Sepolia
  - Key features including real-time tracking and automatic retry mechanisms

## Circle CCTP Documentation

### CCTP Attestation Guide

- **[CCTP Attestation Guide](docs/CCTP_Attestation_Guide.md)**
  - Understanding Circle's attestation process
  - How to poll for attestations using Iris V2 API
  - Attestation verification and validation
  - Troubleshooting common attestation issues

### CCTP Transfer Troubleshooting

- **[CCTP Transfer Troubleshooting](docs/CCTP_Transfer_Troubleshooting.md)**
  - Common issues with CCTP transfers
  - Debugging stuck transactions
  - Error codes and their meanings
  - Best practices for reliable transfers

## Zama FHEVM SDK Documentation

### Zama SDK Overview

- **[Zama FHEVM SDK Overview](docs/Zama_SDK_Overview.md)**
  - Introduction to Fully Homomorphic Encryption
  - SDK architecture and components
  - Supported operations and data types
  - Integration with smart contracts

### Zama SDK Authentication

- **[Zama SDK Authentication](docs/Zama_SDK_Authentication.md)**
  - Setting up authentication with Zama services
  - API key management
  - Secure credential handling
  - Authentication best practices

### First Confidential dApp

- **[Building Your First Confidential dApp](docs/First_Confidential_dApp.md)**
  - Step-by-step guide to creating a confidential dApp
  - Setting up the development environment
  - Implementing FHE operations
  - Testing and deployment

### Wallet and Exchange Integration

- **[Wallet and Exchange Integration](docs/Wallet_Exchange_Integration.md)**
  - Integrating FHE operations with existing wallets
  - Exchange integration considerations
  - User experience best practices
  - Security considerations

## Quick Reference

### By Use Case

#### For Bridge Developers

- Start with [ShadowBridge Analysis](../SHADOWBRIDGE_ANALYSIS.md) to understand the architecture
- Review [CCTP Attestation Guide](docs/CCTP_Attestation_Guide.md) for cross-chain transfers
- Consult [CCTP Transfer Troubleshooting](docs/CCTP_Transfer_Troubleshooting.md) for debugging

#### For FHE Implementation

- Begin with [Zama SDK Overview](docs/Zama_SDK_Overview.md) for FHE concepts
- Follow [Building Your First Confidential dApp](docs/First_Confidential_dApp.md) for implementation
- Reference [Zama SDK Authentication](docs/Zama_SDK_Authentication.md) for setup

#### For Frontend Integration

- Review [Wallet and Exchange Integration](docs/Wallet_Exchange_Integration.md) for UX considerations
- See [BLIP Analysis](../BLIP_BRIDGE_ANALYSIS.md) for frontend architecture examples

### By Technology

#### Circle CCTP

- [CCTP Attestation Guide](docs/CCTP_Attestation_Guide.md)
- [CCTP Transfer Troubleshooting](docs/CCTP_Transfer_Troubleshooting.md)

#### Zama FHEVM

- [Zama SDK Overview](docs/Zama_SDK_Overview.md)
- [Zama SDK Authentication](docs/Zama_SDK_Authentication.md)
- [Building Your First Confidential dApp](docs/First_Confidential_dApp.md)

#### Bridge Implementations

- [ShadowBridge Analysis](../SHADOWBRIDGE_ANALYSIS.md)
- [BLIP Analysis](../BLIP_BRIDGE_ANALYSIS.md)

## Getting Started

1. **New to ShadowBridge?** Start with the [ShadowBridge Analysis](../SHADOWBRIDGE_ANALYSIS.md) to understand the
   project architecture.

2. **Implementing CCTP?** Read the [CCTP Attestation Guide](docs/CCTP_Attestation_Guide.md) to understand the
   cross-chain transfer process.

3. **Adding FHE?** Begin with the [Zama SDK Overview](docs/Zama_SDK_Overview.md) to learn about Fully Homomorphic
   Encryption.

4. **Building a frontend?** Review the [BLIP Analysis](../BLIP_BRIDGE_ANALYSIS.md) for frontend architecture examples
   and [Wallet and Exchange Integration](docs/Wallet_Exchange_Integration.md) for UX considerations.

## Contributing

This documentation is a living resource. If you find errors, omissions, or have suggestions for improvements, please
create an issue or submit a pull request.

## Additional Resources

- [ShadowBridge GitHub Repository](https://github.com/your-org/ShadowBridge)
- [Circle CCTP Documentation](https://developers.circle.com/docs/cctp-introduction)
- [Zama FHEVM Documentation](https://docs.zama.ai/fhevm)
- [BLIP GitHub Repository](https://github.com/your-org/BLIP)
