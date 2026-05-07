// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ICCTPTokenMessenger} from "./interfaces/ICCTPTokenMessenger.sol";
import {IShadowBridge} from "./interfaces/IShadowBridge.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ShadowBridgeETH
/// @notice Ethereum Sepolia side of ShadowBridge.
///
///         Full flow:
///         1. User approves this contract to spend their USDC (cleartext, done client-side).
///         2. User calls depositConfidential() with an FHE-encrypted amount + ZK proof.
///         3. Contract validates the proof, stores the encrypted handle, marks it for
///            async public decryption via FHE.makePubliclyDecryptable.
///         4. Off-chain FHEVM relayer retrieves cleartext + KMS signatures.
///         5. Relayer (or any caller) submits cleartext + proof to onDecryptCallback().
///         6. Contract verifies KMS signatures via FHE.checkSignatures, then calls
///            _executeBridge() which pulls USDC from the user and burns it via CCTP,
///            targeting ShadowBridgeBase on Base Sepolia as the mint recipient.
///
///         FHEVM invariants:
///         - No if/else on encrypted values — FHE.select() only.
///         - FHE.allowThis() called after every operation writing a new handle.
///         - FHE.allow(user) called so the user can query their own handle off-chain.
///         - All decryption is async; no plaintext is ever stored in contract state.
contract ShadowBridgeETH is ZamaEthereumConfig, IShadowBridge {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @notice Circle domain ID for Base Sepolia.
    uint32 public constant BASE_DOMAIN = 6;

    // -------------------------------------------------------------------------
    // Immutables
    // -------------------------------------------------------------------------

    /// @notice USDC token on Ethereum Sepolia.
    address public immutable usdcToken;

    /// @notice Circle CCTP TokenMessenger on Ethereum Sepolia.
    ICCTPTokenMessenger public immutable cctpMessenger;

    /// @notice ShadowBridgeBase on Base Sepolia, encoded as a bytes32 CCTP mint recipient.
    bytes32 public immutable baseShadowBridge;

    // -------------------------------------------------------------------------
    // Encrypted state
    // -------------------------------------------------------------------------

    /// @dev Encrypted USDC deposit amount per user, pending the async decrypt→bridge step.
    mapping(address => euint64) private _encryptedDeposits;

    // -------------------------------------------------------------------------
    // Cleartext state
    // -------------------------------------------------------------------------

    /// @notice True while a user has a pending bridge in flight (guards against re-entry).
    mapping(address => bool) public hasPendingBridge;

    /// @dev Maps a ciphertext handle (bytes32) → depositor address, so the decrypt
    ///      callback can route the result back to the right user without a request ID.
    mapping(bytes32 => address) private _handleOwner;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address _usdcToken, address _cctpMessenger, address _baseShadowBridge) {
        usdcToken = _usdcToken;
        cctpMessenger = ICCTPTokenMessenger(_cctpMessenger);
        baseShadowBridge = bytes32(uint256(uint160(_baseShadowBridge)));
    }

    // -------------------------------------------------------------------------
    // External — deposit
    // -------------------------------------------------------------------------

    /// @notice Step 1 of the bridge flow. Validates the user's encrypted deposit amount,
    ///         stores it, and schedules an async KMS decryption.
    ///
    ///         The user must have pre-approved this contract to spend their USDC for at
    ///         least the deposited amount before calling this function.
    ///
    /// @param encryptedAmount  externalEuint64 ciphertext handle produced by the FHEVM SDK.
    /// @param inputProof       ZK input proof binding the handle to (msg.sender, address(this)).
    function depositConfidential(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external override {
        require(!hasPendingBridge[msg.sender], "ShadowBridgeETH: bridge already pending");

        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        _encryptedDeposits[msg.sender] = amount;
        FHE.allowThis(_encryptedDeposits[msg.sender]);
        FHE.allow(_encryptedDeposits[msg.sender], msg.sender);

        hasPendingBridge[msg.sender] = true;

        bytes32 handle = euint64.unwrap(_encryptedDeposits[msg.sender]);
        _handleOwner[handle] = msg.sender;

        FHE.makePubliclyDecryptable(_encryptedDeposits[msg.sender]);

        emit DepositReceived(msg.sender);
        emit DecryptionRequested(msg.sender, uint256(handle));
    }

    /// @notice Returns the raw bytes32 ciphertext handle for a user's pending deposit.
    ///         Used by the off-chain relayer and tests to fetch the handle for publicDecrypt.
    /// @param user  The depositor address.
    function getDepositHandle(address user) external view returns (bytes32) {
        return euint64.unwrap(_encryptedDeposits[user]);
    }

    // -------------------------------------------------------------------------
    // External — async decrypt callback
    // -------------------------------------------------------------------------

    /// @notice Called by the off-chain FHEVM relayer after the KMS produces a decryption.
    ///         Verifies KMS signatures then routes to _executeBridge.
    ///
    ///         Any address may submit this call; authorization is provided entirely by the
    ///         KMS signature check — FHE.checkSignatures reverts if the proof is invalid.
    ///
    /// @param handles          Array of ciphertext handles that were decrypted (length == 1).
    /// @param abiEncodedResult ABI-encoded uint64 cleartext from the KMS.
    /// @param decryptionProof  KMS signer signatures + metadata (from PublicDecryptResults).
    function onDecryptCallback(
        bytes32[] calldata handles,
        bytes calldata abiEncodedResult,
        bytes calldata decryptionProof
    ) external {
        FHE.checkSignatures(handles, abiEncodedResult, decryptionProof);

        address user = _handleOwner[handles[0]];
        require(user != address(0), "ShadowBridgeETH: unknown handle");

        uint64 cleartextAmount = abi.decode(abiEncodedResult, (uint64));
        _executeBridge(user, handles[0], cleartextAmount);
    }

    // -------------------------------------------------------------------------
    // Internal — bridge execution
    // -------------------------------------------------------------------------

    /// @notice Pulls USDC from the depositor and burns it via CCTP targeting Base Sepolia.
    ///
    /// @dev Amount is necessarily plaintext at this point for CCTP compatibility —
    ///      Circle's depositForBurn requires a cleartext uint256 amount. This is the
    ///      only moment plaintext exists, and it is never stored in contract state.
    ///      All encrypted state before (deposit handle) and after (Base side balances)
    ///      remains confidential.
    ///
    /// @param user    The original depositor whose USDC will be burned.
    /// @param handle  The ciphertext handle being settled, used to clean up state.
    /// @param amount  Cleartext USDC amount (6 decimals) from the async decrypt.
    function _executeBridge(address user, bytes32 handle, uint64 amount) internal {
        require(amount > 0, "ShadowBridgeETH: zero amount");

        hasPendingBridge[user] = false;
        delete _handleOwner[handle];
        _encryptedDeposits[user] = euint64.wrap(bytes32(0));

        IERC20(usdcToken).transferFrom(user, address(this), uint256(amount));
        IERC20(usdcToken).approve(address(cctpMessenger), uint256(amount));
        cctpMessenger.depositForBurn(uint256(amount), BASE_DOMAIN, baseShadowBridge, usdcToken);

        emit BridgeExecuted(user, BASE_DOMAIN);
    }

    // -------------------------------------------------------------------------
    // IShadowBridge — Base-side stubs (not applicable on ETH)
    // -------------------------------------------------------------------------

    function receiveAndEncrypt(bytes calldata, bytes calldata) external pure override {
        revert("ShadowBridgeETH: base-side only");
    }

    function stake(externalEuint64, bytes calldata) external pure override {
        revert("ShadowBridgeETH: base-side only");
    }

    function accrueRewards() external pure override {
        revert("ShadowBridgeETH: base-side only");
    }

    function unstake(externalEuint64, bytes calldata) external pure override {
        revert("ShadowBridgeETH: base-side only");
    }

    function decryptBalance() external pure override {
        revert("ShadowBridgeETH: base-side only");
    }
}
