// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ICCTPTokenMessenger} from "./interfaces/ICCTPTokenMessenger.sol";
import {IShadowBridge} from "./interfaces/IShadowBridge.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ShadowBridgeETH
/// @notice Ethereum Sepolia source of ShadowBridge. Supports multiple destination chains.
///
///         Full flow:
///         1. Owner registers destination chains via registerDestination().
///         2. User calls depositConfidential() with encrypted amount + destination domain.
///         3. Contract stores encrypted handle and schedules async KMS decryption.
///         4. Off-chain FHEVM relayer submits cleartext + proof to onDecryptCallback().
///         5. Contract pulls USDC from user, burns it via CCTP V2 targeting the chosen destination.
///
///         Supported destinations (CCTP V2 domain IDs):
///           Base Sepolia:     6
///           Arbitrum Sepolia: 3
///
///         FHEVM invariants:
///         - No if/else on encrypted values — FHE.select() only.
///         - FHE.allowThis() called after every operation writing a new handle.
///         - FHE.allow(user) called so the user can query their own handle off-chain.
///         - All decryption is async; no plaintext is ever stored in contract state.
contract ShadowBridgeETH is ZamaEthereumConfig, Ownable, IShadowBridge {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @notice Circle domain ID for Base Sepolia.
    uint32 public constant BASE_DOMAIN = 6;

    /// @notice Circle domain ID for Arbitrum Sepolia.
    uint32 public constant ARBITRUM_DOMAIN = 3;

    /// @notice Maximum fee Circle may deduct from the bridged amount (0.1 USDC).
    ///         Recipient on the destination chain receives amount - actualFee where actualFee <= MAX_BRIDGE_FEE.
    uint256 public constant MAX_BRIDGE_FEE = 100_000;

    /// @notice Fast Transfer finality threshold for CCTP V2. Produces attestation in ~8s.
    uint32 public constant MIN_FINALITY_THRESHOLD = 1_000;

    // -------------------------------------------------------------------------
    // Immutables
    // -------------------------------------------------------------------------

    /// @notice USDC token on Ethereum Sepolia.
    address public immutable usdcToken;

    /// @notice Circle CCTP V2 TokenMessenger on Ethereum Sepolia.
    ICCTPTokenMessenger public immutable cctpMessenger;

    // -------------------------------------------------------------------------
    // Mutable config
    // -------------------------------------------------------------------------

    /// @notice Maps Circle domain ID → destination bridge address (as bytes32 CCTP mint recipient).
    ///         Populated at construction for Base and via registerDestination() for additional chains.
    mapping(uint32 => bytes32) public destinations;

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

    /// @dev Maps ciphertext handle → depositor address for callback routing.
    mapping(bytes32 => address) private _handleOwner;

    /// @dev Maps ciphertext handle → destination domain for callback routing.
    mapping(bytes32 => uint32) private _handleDomain;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event DestinationRegistered(uint32 indexed domain, address indexed bridge);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address _usdcToken, address _cctpMessenger, address _baseShadowBridge) Ownable(msg.sender) {
        usdcToken = _usdcToken;
        cctpMessenger = ICCTPTokenMessenger(_cctpMessenger);
        // Pre-register Base Sepolia as a destination
        destinations[BASE_DOMAIN] = bytes32(uint256(uint160(_baseShadowBridge)));
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Registers or updates a destination chain bridge address.
    /// @param domain  Circle CCTP domain ID of the destination chain.
    /// @param bridge  ShadowBridgeDest-compatible contract on that chain.
    function registerDestination(uint32 domain, address bridge) external onlyOwner {
        require(bridge != address(0), "ShadowBridgeETH: zero address");
        destinations[domain] = bytes32(uint256(uint160(bridge)));
        emit DestinationRegistered(domain, bridge);
    }

    // -------------------------------------------------------------------------
    // External — deposit
    // -------------------------------------------------------------------------

    /// @notice Step 1 of the bridge flow. Validates the user's encrypted deposit amount,
    ///         stores it, and schedules an async KMS decryption targeting the given chain.
    ///
    /// @param encryptedAmount    externalEuint64 ciphertext handle from the FHEVM SDK.
    /// @param inputProof         ZK proof binding the handle to (msg.sender, address(this)).
    /// @param destinationDomain  Circle domain ID of the target chain (6 = Base, 3 = Arbitrum).
    function depositConfidential(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        uint32 destinationDomain
    ) external override {
        require(!hasPendingBridge[msg.sender], "ShadowBridgeETH: bridge already pending");
        require(destinations[destinationDomain] != bytes32(0), "ShadowBridgeETH: unknown destination");

        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        _encryptedDeposits[msg.sender] = amount;
        FHE.allowThis(_encryptedDeposits[msg.sender]);
        FHE.allow(_encryptedDeposits[msg.sender], msg.sender);

        hasPendingBridge[msg.sender] = true;

        bytes32 handle = euint64.unwrap(_encryptedDeposits[msg.sender]);
        _handleOwner[handle] = msg.sender;
        _handleDomain[handle] = destinationDomain;

        FHE.makePubliclyDecryptable(_encryptedDeposits[msg.sender]);

        emit DepositReceived(msg.sender);
        emit DecryptionRequested(msg.sender, uint256(handle));
    }

    /// @notice Returns the raw bytes32 ciphertext handle for a user's pending deposit.
    function getDepositHandle(address user) external view returns (bytes32) {
        return euint64.unwrap(_encryptedDeposits[user]);
    }

    // -------------------------------------------------------------------------
    // External — async decrypt callback
    // -------------------------------------------------------------------------

    /// @notice Called by the off-chain FHEVM relayer after the KMS produces a decryption.
    ///         Verifies KMS signatures then routes to _executeBridge.
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

    // -------------------------------------------------------------------------
    // Internal — bridge execution
    // -------------------------------------------------------------------------

    /// @notice Pulls USDC from the depositor and burns it via CCTP V2 to the chosen destination.
    ///
    /// @dev The amount is plaintext only in this stack frame — Circle's depositForBurn requires
    ///      a cleartext uint256. It is never stored in contract state.
    function _executeBridge(address user, bytes32 handle, uint64 amount, uint32 destinationDomain) internal {
        require(amount > 0, "ShadowBridgeETH: zero amount");

        hasPendingBridge[user] = false;
        delete _handleOwner[handle];
        delete _handleDomain[handle];
        _encryptedDeposits[user] = euint64.wrap(bytes32(0));

        bytes32 destBridge = destinations[destinationDomain];

        IERC20(usdcToken).transferFrom(user, address(this), uint256(amount));
        IERC20(usdcToken).approve(address(cctpMessenger), uint256(amount));
        cctpMessenger.depositForBurn(
            uint256(amount),
            destinationDomain,
            destBridge,
            usdcToken,
            bytes32(0),
            MAX_BRIDGE_FEE,
            MIN_FINALITY_THRESHOLD
        );

        emit BridgeExecuted(user, destinationDomain);
    }

    // -------------------------------------------------------------------------
    // IShadowBridge — destination-side stubs (not applicable on ETH)
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

    function bridgeOut(externalEuint64, bytes calldata, uint32, bytes32) external pure override {
        revert("ShadowBridgeETH: use bridgeOut on destination chain");
    }
}
