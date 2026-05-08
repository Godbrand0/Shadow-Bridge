// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

/// @title IShadowBridge
/// @notice Shared interface for both sides of the ShadowBridge cross-chain confidential flow.
interface IShadowBridge {
    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted when a confidential deposit is accepted on the ETH side.
    ///         Amount is intentionally omitted to preserve privacy.
    event DepositReceived(address indexed user);

    /// @notice Emitted when the ETH side executes the CCTP burn after async decryption.
    ///         Amount is intentionally omitted; only the destination domain is logged.
    event BridgeExecuted(address indexed user, uint32 destinationDomain);

    /// @notice Emitted when an async KMS decryption is requested.
    event DecryptionRequested(address indexed user, uint256 requestId);

    /// @notice Emitted on the Base side when a CCTP mint is re-encrypted for the recipient.
    event EncryptedReceive(address indexed recipient, uint64 cctpNonce);

    /// @notice Emitted when a user stakes on the Base side.
    event Staked(address indexed user);

    /// @notice Emitted when a user unstakes on the Base side.
    event Unstaked(address indexed user);

    // -------------------------------------------------------------------------
    // Ethereum-side interface
    // -------------------------------------------------------------------------

    /// @notice Accepts an FHE-encrypted USDC amount and schedules a decrypt→bridge.
    /// @param encryptedAmount   externalEuint64 handle produced by the FHEVM client SDK.
    /// @param inputProof        ZK proof binding encryptedAmount to msg.sender + this contract.
    /// @param destinationDomain Circle domain ID of the target chain (e.g. 6 = Base, 3 = Arbitrum).
    function depositConfidential(externalEuint64 encryptedAmount, bytes calldata inputProof, uint32 destinationDomain) external;

    // -------------------------------------------------------------------------
    // Base-side interface
    // -------------------------------------------------------------------------

    /// @notice Consumes a CCTP attestation, mints USDC on Base, then re-encrypts.
    function receiveAndEncrypt(bytes calldata cctpMessage, bytes calldata attestation) external;

    /// @notice Stakes an encrypted portion of the caller's bridged balance.
    /// @param encryptedAmount  externalEuint64 handle for the amount to stake.
    /// @param inputProof       Proof binding encryptedAmount to msg.sender.
    function stake(externalEuint64 encryptedAmount, bytes calldata inputProof) external;

    /// @notice Accrues staking rewards (permissionless keeper).
    function accrueRewards() external;

    /// @notice Unstakes an encrypted amount and returns it to the bridged balance.
    /// @param encryptedAmount  externalEuint64 handle for the amount to unstake.
    /// @param inputProof       Proof binding encryptedAmount to msg.sender.
    function unstake(externalEuint64 encryptedAmount, bytes calldata inputProof) external;

    /// @notice Marks the caller's total balance as publicly decryptable.
    function decryptBalance() external;

    /// @notice Burns an encrypted portion of stake via CCTP to a destination chain.
    /// @param encryptedAmount    externalEuint64 handle for the amount to bridge out.
    /// @param inputProof         ZK proof binding handle to msg.sender.
    /// @param destinationDomain  Circle domain ID of target chain.
    /// @param mintRecipient      bytes32-padded recipient address on the destination chain.
    function bridgeOut(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        uint32 destinationDomain,
        bytes32 mintRecipient
    ) external;
}
