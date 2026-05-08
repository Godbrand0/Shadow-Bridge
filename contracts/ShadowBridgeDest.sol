// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ICCTPTokenMessenger} from "./interfaces/ICCTPTokenMessenger.sol";
import {IShadowBridge} from "./interfaces/IShadowBridge.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC7984ERC20Wrapper} from "@openzeppelin/confidential-contracts/interfaces/IERC7984ERC20Wrapper.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

/// @title ShadowBridgeDest
/// @notice Abstract destination-chain logic shared by ShadowBridgeBase and ShadowBridgeArbitrum.
///
///         Concrete subclasses inherit this plus a chain-specific FHEVM config contract
///         (ShadowBridgeBaseConfig or ShadowBridgeArbitrumConfig) which calls
///         FHE.setCoprocessor() before this constructor runs.
///
///         Full post-CCTP flow:
///         1. receiveAndEncrypt() — CCTP mints USDC, wraps to cUSDC (ERC-7984) if configured.
///         2. stake() / acceptCUSDCStake() — user tops up encrypted stake.
///         3. accrueRewards() — lazy per-user reward accrual.
///         4. unstake() — FHE.select-guarded subtraction; async KMS decrypt returns cleartext.
///         5. decryptBalance() — async KMS decrypt of (stake + rewards) total.
///
///         FHEVM invariants:
///         - No if/else on encrypted values — FHE.select() only.
///         - FHE.allowThis() called immediately after every FHE write.
///         - FHE.allow(user) called before any user-facing decrypt path.
///         - All decrypts are async; cleartext never lives in contract state.
abstract contract ShadowBridgeDest is Ownable, IShadowBridge {
    // -------------------------------------------------------------------------
    // Token addresses
    // -------------------------------------------------------------------------

    /// @notice Underlying plaintext USDC minted by Circle CCTP.
    address public immutable usdcToken;

    /// @notice Confidential USDC wrapper (ERC-7984). Set post-deployment via setCUSDCToken.
    ///         Zero in local tests (fallback to plain ERC-20 transfers).
    IERC7984ERC20Wrapper public cUSDCToken;

    // -------------------------------------------------------------------------
    // Immutables
    // -------------------------------------------------------------------------

    /// @notice Circle CCTP TokenMessenger on this chain.
    ICCTPTokenMessenger public immutable cctpTokenMessenger;

    /// @notice Circle CCTP MessageTransmitter on this chain.
    ICCTPTokenMessenger public immutable cctpMessageTransmitter;

    // -------------------------------------------------------------------------
    // Mutable config
    // -------------------------------------------------------------------------

    /// @notice Trusted ShadowBridgeETH address on Ethereum Sepolia.
    ///         Validated against the CCTP message sender field.
    address public ethShadowBridge;

    /// @notice Per-block reward rate (cleartext scalar multiplied by encrypted stake).
    uint256 public rewardRatePerBlock;

    uint256 public constant MAX_BRIDGE_FEE = 100_000;       // 0.1 USDC
    uint32  public constant MIN_FINALITY_THRESHOLD = 1_000; // Fast Transfer ~8s

    mapping(uint32 => bytes32) public destinations;          // domain → bridge address as bytes32
    mapping(address => bool)   public hasPendingBridge;      // guards concurrent bridge-outs

    struct PendingBridgeOut {
        address user;
        uint32  destinationDomain;
        bytes32 mintRecipient;
    }
    mapping(bytes32 => PendingBridgeOut) private _pendingBridgeOuts;

    // -------------------------------------------------------------------------
    // Encrypted state
    // -------------------------------------------------------------------------

    mapping(address => euint64) private _encryptedStake;
    mapping(address => euint64) private _encryptedRewards;

    // -------------------------------------------------------------------------
    // Cleartext state
    // -------------------------------------------------------------------------

    mapping(address => uint256) public lastRewardBlock;
    mapping(bytes32 => address) private _handleOwner;
    mapping(address => bool) public hasPendingDecrypt;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event StakeReceived(address indexed user);
    event UnstakeRequested(address indexed user);
    event UnstakeCompleted(address indexed user);
    event BalanceRevealed(address indexed user, uint64 total);
    event RewardRateUpdated(uint256 newRate);
    event EthBridgeSet(address indexed newBridge);
    event CUSDCTokenSet(address indexed newToken);

    event DestinationRegistered(uint32 indexed domain, address indexed bridge);
    event BridgeOutRequested(address indexed user, uint32 destinationDomain);
    event BridgeOutExecuted(address indexed user, uint32 destinationDomain);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(
        address _usdcToken,
        address _cctpTokenMessenger,
        address _cctpMessageTransmitter,
        address _ethShadowBridge,
        uint256 _rewardRatePerBlock
    ) Ownable(msg.sender) {
        usdcToken = _usdcToken;
        cctpTokenMessenger = ICCTPTokenMessenger(_cctpTokenMessenger);
        cctpMessageTransmitter = ICCTPTokenMessenger(_cctpMessageTransmitter);
        ethShadowBridge = _ethShadowBridge;
        rewardRatePerBlock = _rewardRatePerBlock;
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setEthBridge(address _ethBridge) external onlyOwner {
        require(_ethBridge != address(0), "ShadowBridgeDest: zero address");
        ethShadowBridge = _ethBridge;
        emit EthBridgeSet(_ethBridge);
    }

    function setCUSDCToken(address _cUSDCToken) external onlyOwner {
        cUSDCToken = IERC7984ERC20Wrapper(_cUSDCToken);
        emit CUSDCTokenSet(_cUSDCToken);
    }

    function setRewardRate(uint256 newRate) external onlyOwner {
        rewardRatePerBlock = newRate;
        emit RewardRateUpdated(newRate);
    }

    /// @notice Owner registers a peer ShadowBridgeDest contract on another chain.
    /// @param domain        Circle CCTP domain ID of the destination chain.
    /// @param bridge        ShadowBridgeDest contract on that chain (address(0) to remove).
    function registerDestination(uint32 domain, address bridge) external onlyOwner {
        destinations[domain] = bytes32(uint256(uint160(bridge)));
        emit DestinationRegistered(domain, bridge);
    }

    // -------------------------------------------------------------------------
    // External — CCTP receive + re-encrypt
    // -------------------------------------------------------------------------

    /// @notice Consumes a CCTP attestation, mints raw USDC, then immediately converts
    ///         the minted amount to an FHE-encrypted balance.
    function receiveAndEncrypt(
        address recipient,
        bytes calldata cctpMessage,
        bytes calldata attestation
    ) external {
        require(recipient != address(0), "ShadowBridgeDest: zero recipient");
        _validateCCTPSender(cctpMessage);

        uint256 balanceBefore = IERC20(usdcToken).balanceOf(address(this));
        cctpMessageTransmitter.receiveMessage(cctpMessage, attestation);
        uint256 mintedAmount = IERC20(usdcToken).balanceOf(address(this)) - balanceBefore;
        require(mintedAmount > 0, "ShadowBridgeDest: nothing minted");
        require(mintedAmount <= type(uint64).max, "ShadowBridgeDest: amount overflows uint64");

        _accrueRewards(recipient);

        euint64 enc;
        if (address(cUSDCToken) != address(0)) {
            IERC20(usdcToken).approve(address(cUSDCToken), mintedAmount);
            enc = cUSDCToken.wrap(address(this), mintedAmount);
            FHE.allowThis(enc);
        } else {
            enc = FHE.asEuint64(uint64(mintedAmount));
            FHE.allowThis(enc);
        }

        if (!FHE.isInitialized(_encryptedStake[recipient])) {
            _encryptedStake[recipient] = enc;
        } else {
            _encryptedStake[recipient] = FHE.add(_encryptedStake[recipient], enc);
        }
        FHE.allowThis(_encryptedStake[recipient]);
        FHE.allow(_encryptedStake[recipient], recipient);

        if (lastRewardBlock[recipient] == 0) {
            lastRewardBlock[recipient] = block.number;
        }

        emit StakeReceived(recipient);
    }

    function receiveAndEncrypt(bytes calldata, bytes calldata) external pure override {
        revert("ShadowBridgeDest: use receiveAndEncrypt(address, bytes, bytes)");
    }

    // -------------------------------------------------------------------------
    // External — staking
    // -------------------------------------------------------------------------

    function stake(externalEuint64 encryptedAmount, bytes calldata inputProof) external override {
        require(!hasPendingDecrypt[msg.sender], "ShadowBridgeDest: decrypt pending");
        _accrueRewards(msg.sender);

        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        FHE.allowThis(amount);

        if (!FHE.isInitialized(_encryptedStake[msg.sender])) {
            _encryptedStake[msg.sender] = amount;
        } else {
            _encryptedStake[msg.sender] = FHE.add(_encryptedStake[msg.sender], amount);
        }
        FHE.allowThis(_encryptedStake[msg.sender]);
        FHE.allow(_encryptedStake[msg.sender], msg.sender);

        if (lastRewardBlock[msg.sender] == 0) {
            lastRewardBlock[msg.sender] = block.number;
        }

        emit Staked(msg.sender);
    }

    function acceptCUSDCStake(externalEuint64 encryptedAmount, bytes calldata inputProof) external {
        require(address(cUSDCToken) != address(0), "ShadowBridgeDest: cUSDC not configured");
        require(!hasPendingDecrypt[msg.sender], "ShadowBridgeDest: decrypt pending");
        _accrueRewards(msg.sender);

        euint64 amount = cUSDCToken.confidentialTransferFrom(
            msg.sender,
            address(this),
            encryptedAmount,
            inputProof
        );
        FHE.allowThis(amount);

        if (!FHE.isInitialized(_encryptedStake[msg.sender])) {
            _encryptedStake[msg.sender] = amount;
        } else {
            _encryptedStake[msg.sender] = FHE.add(_encryptedStake[msg.sender], amount);
        }
        FHE.allowThis(_encryptedStake[msg.sender]);
        FHE.allow(_encryptedStake[msg.sender], msg.sender);

        if (lastRewardBlock[msg.sender] == 0) {
            lastRewardBlock[msg.sender] = block.number;
        }

        emit Staked(msg.sender);
    }

    function accrueRewards() external override {
        _accrueRewards(msg.sender);
    }

    // -------------------------------------------------------------------------
    // External — unstaking
    // -------------------------------------------------------------------------

    function unstake(externalEuint64 encryptedAmount, bytes calldata inputProof) external override {
        require(!hasPendingBridge[msg.sender], "ShadowBridgeDest: bridge pending");
        require(!hasPendingDecrypt[msg.sender], "ShadowBridgeDest: decrypt pending");
        require(FHE.isInitialized(_encryptedStake[msg.sender]), "ShadowBridgeDest: no stake");

        _accrueRewards(msg.sender);

        euint64 requested = FHE.fromExternal(encryptedAmount, inputProof);
        FHE.allowThis(requested);

        ebool isEnough = FHE.le(requested, _encryptedStake[msg.sender]);
        euint64 actualUnstake = FHE.select(isEnough, requested, _encryptedStake[msg.sender]);
        FHE.allowThis(actualUnstake);

        _encryptedStake[msg.sender] = FHE.sub(_encryptedStake[msg.sender], actualUnstake);
        FHE.allowThis(_encryptedStake[msg.sender]);
        FHE.allow(_encryptedStake[msg.sender], msg.sender);

        FHE.allow(actualUnstake, msg.sender);
        FHE.makePubliclyDecryptable(actualUnstake);

        bytes32 handle = euint64.unwrap(actualUnstake);
        _handleOwner[handle] = msg.sender;
        hasPendingDecrypt[msg.sender] = true;

        emit UnstakeRequested(msg.sender);
    }

    function onUnstakeCallback(
        bytes32[] calldata handles,
        bytes calldata abiEncodedResult,
        bytes calldata decryptionProof
    ) external {
        FHE.checkSignatures(handles, abiEncodedResult, decryptionProof);

        address user = _handleOwner[handles[0]];
        require(user != address(0), "ShadowBridgeDest: unknown handle");

        uint64 cleartextAmount = abi.decode(abiEncodedResult, (uint64));

        delete _handleOwner[handles[0]];
        hasPendingDecrypt[user] = false;

        if (cleartextAmount > 0) {
            if (address(cUSDCToken) != address(0)) {
                euint64 amountHandle = FHE.asEuint64(cleartextAmount);
                FHE.allowThis(amountHandle);
                FHE.allow(amountHandle, address(cUSDCToken));
                cUSDCToken.confidentialTransfer(user, amountHandle);
            } else {
                IERC20(usdcToken).transfer(user, uint256(cleartextAmount));
            }
        }

        emit UnstakeCompleted(user);
    }

    // -------------------------------------------------------------------------
    // External — balance decryption
    // -------------------------------------------------------------------------

    function decryptBalance() external override {
        require(!hasPendingBridge[msg.sender], "ShadowBridgeDest: bridge pending");
        require(!hasPendingDecrypt[msg.sender], "ShadowBridgeDest: decrypt already pending");

        _accrueRewards(msg.sender);

        euint64 total;
        if (!FHE.isInitialized(_encryptedRewards[msg.sender])) {
            total = _encryptedStake[msg.sender];
        } else {
            total = FHE.add(_encryptedStake[msg.sender], _encryptedRewards[msg.sender]);
            FHE.allowThis(total);
        }
        FHE.allow(total, msg.sender);
        FHE.makePubliclyDecryptable(total);

        bytes32 totalHandle = euint64.unwrap(total);
        _handleOwner[totalHandle] = msg.sender;
        hasPendingDecrypt[msg.sender] = true;

        emit DecryptionRequested(msg.sender, uint256(totalHandle));
    }

    function onBalanceDecryptCallback(
        bytes32[] calldata handles,
        bytes calldata abiEncodedResult,
        bytes calldata decryptionProof
    ) external {
        require(handles.length == 1, "ShadowBridgeDest: expected 1 handle");
        FHE.checkSignatures(handles, abiEncodedResult, decryptionProof);

        address user = _handleOwner[handles[0]];
        require(user != address(0), "ShadowBridgeDest: unknown handle");

        uint64 total = abi.decode(abiEncodedResult, (uint64));

        delete _handleOwner[handles[0]];
        hasPendingDecrypt[user] = false;

        emit BalanceRevealed(user, total);
    }

    // -------------------------------------------------------------------------
    // External — bridge out
    // -------------------------------------------------------------------------

    /// @notice Burns an encrypted portion of the caller's stake via CCTP to another chain.
    ///         Uses FHE.select for branch-free clamping — if requested > stake, full stake is used.
    ///         The plaintext amount is revealed only in the onBridgeOutCallback stack frame.
    ///
    /// @param encryptedAmount    externalEuint64 handle for the amount to bridge out.
    /// @param inputProof         ZK proof binding handle to (msg.sender, address(this)).
    /// @param destinationDomain  Circle domain ID of the target chain.
    /// @param mintRecipient      bytes32-padded address on the destination.
    ///                           Use the ShadowBridgeDest contract there to auto-stake,
    ///                           or the user's own address for raw USDC.
    function bridgeOut(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        uint32 destinationDomain,
        bytes32 mintRecipient
    ) external {
        require(!hasPendingBridge[msg.sender], "ShadowBridgeDest: bridge pending");
        require(!hasPendingDecrypt[msg.sender], "ShadowBridgeDest: decrypt pending");
        require(FHE.isInitialized(_encryptedStake[msg.sender]), "ShadowBridgeDest: no stake");
        require(mintRecipient != bytes32(0), "ShadowBridgeDest: zero recipient");

        _accrueRewards(msg.sender);

        euint64 requested = FHE.fromExternal(encryptedAmount, inputProof);
        FHE.allowThis(requested);

        ebool isEnough = FHE.le(requested, _encryptedStake[msg.sender]);
        euint64 actualBridge = FHE.select(isEnough, requested, _encryptedStake[msg.sender]);
        FHE.allowThis(actualBridge);

        _encryptedStake[msg.sender] = FHE.sub(_encryptedStake[msg.sender], actualBridge);
        FHE.allowThis(_encryptedStake[msg.sender]);
        FHE.allow(_encryptedStake[msg.sender], msg.sender);

        FHE.allow(actualBridge, msg.sender);
        FHE.makePubliclyDecryptable(actualBridge);

        bytes32 handle = euint64.unwrap(actualBridge);
        _pendingBridgeOuts[handle] = PendingBridgeOut({
            user: msg.sender,
            destinationDomain: destinationDomain,
            mintRecipient: mintRecipient
        });
        hasPendingBridge[msg.sender] = true;

        emit BridgeOutRequested(msg.sender, destinationDomain);
    }

    /// @notice KMS relayer callback after bridgeOut decryption.
    ///         Burns the cleartext amount via CCTP to the registered destination.
    function onBridgeOutCallback(
        bytes32[] calldata handles,
        bytes calldata abiEncodedResult,
        bytes calldata decryptionProof
    ) external {
        FHE.checkSignatures(handles, abiEncodedResult, decryptionProof);

        PendingBridgeOut memory pending = _pendingBridgeOuts[handles[0]];
        require(pending.user != address(0), "ShadowBridgeDest: unknown handle");

        uint64 cleartextAmount = abi.decode(abiEncodedResult, (uint64));
        require(cleartextAmount > 0, "ShadowBridgeDest: zero amount");

        delete _pendingBridgeOuts[handles[0]];
        hasPendingBridge[pending.user] = false;

        IERC20(usdcToken).approve(address(cctpTokenMessenger), uint256(cleartextAmount));
        cctpTokenMessenger.depositForBurn(
            uint256(cleartextAmount),
            pending.destinationDomain,
            pending.mintRecipient,
            usdcToken,
            bytes32(0),
            MAX_BRIDGE_FEE,
            MIN_FINALITY_THRESHOLD
        );

        emit BridgeOutExecuted(pending.user, pending.destinationDomain);
        emit BridgeExecuted(pending.user, pending.destinationDomain);
    }

    // -------------------------------------------------------------------------
    // View helpers
    // -------------------------------------------------------------------------

    function getStakeHandle(address user) external view returns (bytes32) {
        return euint64.unwrap(_encryptedStake[user]);
    }

    function getRewardHandle(address user) external view returns (bytes32) {
        return euint64.unwrap(_encryptedRewards[user]);
    }

    // -------------------------------------------------------------------------
    // Internal — reward accrual
    // -------------------------------------------------------------------------

    function _accrueRewards(address user) internal {
        if (lastRewardBlock[user] == 0 || !FHE.isInitialized(_encryptedStake[user])) return;

        uint256 blockDelta = block.number - lastRewardBlock[user];
        if (blockDelta == 0) return;

        uint256 rateScaled = blockDelta * rewardRatePerBlock;
        uint64 safeRate = rateScaled > type(uint64).max ? type(uint64).max : uint64(rateScaled);

        if (safeRate == 0) {
            lastRewardBlock[user] = block.number;
            return;
        }

        euint64 reward = FHE.mul(_encryptedStake[user], safeRate);
        FHE.allowThis(reward);

        _encryptedRewards[user] = FHE.add(_encryptedRewards[user], reward);
        FHE.allowThis(_encryptedRewards[user]);
        FHE.allow(_encryptedRewards[user], user);

        lastRewardBlock[user] = block.number;
    }

    // -------------------------------------------------------------------------
    // Internal — CCTP message validation
    // -------------------------------------------------------------------------

    function _validateCCTPSender(bytes calldata message) private view {
        require(message.length >= 52, "ShadowBridgeDest: message too short");
        bytes32 senderBytes;
        assembly {
            senderBytes := calldataload(add(message.offset, 20))
        }
        address sender = address(uint160(uint256(senderBytes)));
        require(sender == ethShadowBridge, "ShadowBridgeDest: untrusted source");
    }

    // -------------------------------------------------------------------------
    // IShadowBridge stub — ETH-side only
    // -------------------------------------------------------------------------

    function depositConfidential(externalEuint64, bytes calldata, uint32) external pure override {
        revert("ShadowBridgeDest: use bridgeOut on destination chain");
    }
}
