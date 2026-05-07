// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ICCTPTokenMessenger
/// @notice Minimal Circle CCTP TokenMessenger interface for burn/mint cross-chain flow.
interface ICCTPTokenMessenger {
    /// @notice Burns tokens on the source chain and emits a message for minting on the destination.
    /// @param amount        Amount of tokens to burn (in token's native decimals).
    /// @param destinationDomain  Circle domain ID of the destination chain (e.g. Base Sepolia = 6).
    /// @param mintRecipient  Address on the destination chain that will receive minted tokens (padded to bytes32).
    /// @param burnToken     Address of the token contract to burn on the source chain (e.g. USDC).
    /// @return nonce        Unique nonce assigned to this burn message.
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken
    ) external returns (uint64 nonce);

    /// @notice Mints tokens on the destination chain by consuming a valid attested burn message.
    /// @param message       The raw message bytes emitted by depositForBurn on the source chain.
    /// @param attestation   65-byte ECDSA attestation from Circle's Attestation Service proving message validity.
    /// @return success      True if the message was processed and tokens were minted.
    function receiveMessage(
        bytes calldata message,
        bytes calldata attestation
    ) external returns (bool success);
}
