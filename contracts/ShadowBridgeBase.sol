// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ShadowBridgeBaseConfig} from "./config/ShadowBridgeConfig.sol";
import {ICCTPTokenMessenger} from "./interfaces/ICCTPTokenMessenger.sol";
import {IShadowBridge} from "./interfaces/IShadowBridge.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC7984ERC20Wrapper} from "@openzeppelin/confidential-contracts/interfaces/IERC7984ERC20Wrapper.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

/// @title ShadowBridgeBase
/// @notice Base Sepolia destination side of ShadowBridge.
///
///         Full flow after CCTP mint:
///         1. receiveAndEncrypt() — CCTP mints USDC to this contract, then if cUSDCToken is
///            configured the contract wraps it to confidential cUSDC (ERC-7984) via
///            IERC7984ERC20Wrapper.wrap(), eliminating the plaintext window entirely.
///         2. stake() — user tops up with encrypted USDC from their wallet.
///         3. acceptCUSDCStake() — alternative entry using ERC-7984 confidentialTransferFrom.
///         4. accrueRewards() — lazy per-user reward accrual before any stake mutation.
///         5. unstake() — FHE.select-guarded subtraction; async KMS decrypt returns cleartext
///            which is used to confidentialTransfer cUSDC (or raw USDC) back to the user.
///         6. decryptBalance() — async KMS decrypt of (stake + rewards) total.
///
///         Token design (ERC-7984):
///         - rawUsdcToken: standard USDC minted by Circle CCTP (plaintext amounts)
///         - cUSDCToken:   IERC7984ERC20Wrapper wrapping rawUsdc into confidential cUSDC
///                         deployed at 0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639 on Sepolia
///         - When cUSDCToken is set (non-zero), all token movements use confidentialTransfer /
///           confidentialTransferFrom, keeping amounts encrypted end-to-end.
///         - When cUSDCToken is address(0) (local tests), falls back to plain IERC20.
///
///         FHEVM invariants:
///         - No if/else on encrypted values — FHE.select() only.
///         - FHE.allowThis() called immediately after every FHE write.
///         - FHE.allow(user) called before any user-facing decrypt path.
///         - All decrypts are async; cleartext never lives in contract state.
contract ShadowBridgeBase is ShadowBridgeBaseConfig, Ownable, IShadowBridge {
    // -------------------------------------------------------------------------
    // Token addresses (Zama Sepolia testnet)
    // -------------------------------------------------------------------------

    /// @notice Underlying plaintext USDC (minted by Circle CCTP).
    ///         Sepolia: 0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF
    address public immutable usdcToken;

    /// @notice Confidential USDC wrapper (ERC-7984).  Set post-deployment via setCUSDCToken.
    ///         Sepolia: 0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639
    ///         Zero in local tests (fallback to plain ERC-20 transfers).
    IERC7984ERC20Wrapper public cUSDCToken;

    // -------------------------------------------------------------------------
    // Immutables
    // -------------------------------------------------------------------------

    /// @notice Circle CCTP MessageTransmitter on Base Sepolia.
    ICCTPTokenMessenger public immutable cctpMessageTransmitter;

    // -------------------------------------------------------------------------
    // Mutable config (updatable post-deployment)
    // -------------------------------------------------------------------------

    /// @notice Trusted ShadowBridgeETH address on Ethereum Sepolia.
    ///         Validated against the CCTP message sender field.
    ///         Settable via setEthBridge() to break the deployment circular dependency.
    address public ethShadowBridge;

    /// @notice Per-block reward rate (cleartext scalar multiplied by encrypted stake).
    uint256 public rewardRatePerBlock;

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

    // IShadowBridge provides: Staked, DecryptionRequested
    event StakeReceived(address indexed user);
    event UnstakeRequested(address indexed user);
    event UnstakeCompleted(address indexed user);
    event BalanceRevealed(address indexed user, uint64 total);
    event RewardRateUpdated(uint256 newRate);
    event EthBridgeSet(address indexed newBridge);
    event CUSDCTokenSet(address indexed newToken);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(
        address _usdcToken,
        address _cctpMessageTransmitter,
        address _ethShadowBridge,
        uint256 _rewardRatePerBlock
    ) Ownable(msg.sender) {
        usdcToken = _usdcToken;
        cctpMessageTransmitter = ICCTPTokenMessenger(_cctpMessageTransmitter);
        ethShadowBridge = _ethShadowBridge;
        rewardRatePerBlock = _rewardRatePerBlock;
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Updates the trusted ETH-side bridge address.
    ///         Called after ShadowBridgeETH is deployed to break the circular dependency.
    function setEthBridge(address _ethBridge) external onlyOwner {
        require(_ethBridge != address(0), "ShadowBridgeBase: zero address");
        ethShadowBridge = _ethBridge;
        emit EthBridgeSet(_ethBridge);
    }

    /// @notice Configures the confidential USDC wrapper (ERC-7984).
    ///         After setting, receiveAndEncrypt wraps to cUSDC and unstake uses
    ///         confidentialTransfer rather than plain IERC20.transfer.
    function setCUSDCToken(address _cUSDCToken) external onlyOwner {
        cUSDCToken = IERC7984ERC20Wrapper(_cUSDCToken);
        emit CUSDCTokenSet(_cUSDCToken);
    }

    /// @notice Updates the per-block reward rate.
    function setRewardRate(uint256 newRate) external onlyOwner {
        rewardRatePerBlock = newRate;
        emit RewardRateUpdated(newRate);
    }

    // -------------------------------------------------------------------------
    // External — CCTP receive + re-encrypt (ERC-7984 wrapping path)
    // -------------------------------------------------------------------------

    /// @notice Consumes a CCTP attestation, mints raw USDC, then immediately converts
    ///         the minted amount to an FHE-encrypted balance.
    ///
    ///         When cUSDCToken is configured:
    ///           CCTP mint → approve raw USDC → IERC7984ERC20Wrapper.wrap()
    ///           The wrap() return value is already a euint64 handle — no FHE.asEuint64
    ///           conversion needed, eliminating even the brief stack-frame plaintext.
    ///
    ///         When cUSDCToken is address(0) (local test fallback):
    ///           FHE.asEuint64(mintedAmount) is used instead.
    ///
    /// @param recipient    Address on Base Sepolia to credit with the bridged balance.
    /// @param cctpMessage  Raw CCTP message bytes from ShadowBridgeETH.depositForBurn.
    /// @param attestation  65-byte Circle attestation from the Attestation Service.
    function receiveAndEncrypt(
        address recipient,
        bytes calldata cctpMessage,
        bytes calldata attestation
    ) external {
        require(recipient != address(0), "ShadowBridgeBase: zero recipient");
        _validateCCTPSender(cctpMessage);

        uint256 balanceBefore = IERC20(usdcToken).balanceOf(address(this));
        cctpMessageTransmitter.receiveMessage(cctpMessage, attestation);
        uint256 mintedAmount = IERC20(usdcToken).balanceOf(address(this)) - balanceBefore;
        require(mintedAmount > 0, "ShadowBridgeBase: nothing minted");
        require(mintedAmount <= type(uint64).max, "ShadowBridgeBase: amount overflows uint64");

        _accrueRewards(recipient);

        euint64 enc;
        if (address(cUSDCToken) != address(0)) {
            // ERC-7984 path: wrap raw USDC to confidential cUSDC.
            // wrap() returns a euint64 handle — the amount is never in plaintext storage.
            IERC20(usdcToken).approve(address(cUSDCToken), mintedAmount);
            enc = cUSDCToken.wrap(address(this), mintedAmount);
            FHE.allowThis(enc);
        } else {
            // Fallback path (local tests): encrypt manually.
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
        revert("ShadowBridgeBase: use receiveAndEncrypt(address, bytes, bytes)");
    }

    // -------------------------------------------------------------------------
    // External — staking (encrypted input path)
    // -------------------------------------------------------------------------

    /// @notice Stakes via encrypted input proof (raw USDC backing; no ERC-7984 operator required).
    ///         The caller must pre-approve raw USDC to this contract.
    function stake(externalEuint64 encryptedAmount, bytes calldata inputProof) external override {
        require(!hasPendingDecrypt[msg.sender], "ShadowBridgeBase: decrypt pending");
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

    /// @notice Stakes directly from the caller's cUSDC balance using ERC-7984
    ///         confidentialTransferFrom.  Requires the caller to have previously called
    ///         cUSDCToken.setOperator(address(this), until) to authorise the bridge.
    ///
    ///         This is the preferred staking path when cUSDCToken is configured because
    ///         no plaintext amount is ever exposed — the transfer and the internal
    ///         accounting are both encrypted end-to-end.
    function acceptCUSDCStake(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external {
        require(address(cUSDCToken) != address(0), "ShadowBridgeBase: cUSDC not configured");
        require(!hasPendingDecrypt[msg.sender], "ShadowBridgeBase: decrypt pending");
        _accrueRewards(msg.sender);

        // Pull cUSDC from caller. The return value is the actual transferred amount handle.
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
        require(!hasPendingDecrypt[msg.sender], "ShadowBridgeBase: decrypt pending");
        require(FHE.isInitialized(_encryptedStake[msg.sender]), "ShadowBridgeBase: no stake");

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

    /// @notice Unstake callback. When cUSDCToken is configured, sends cUSDC to the user
    ///         via confidentialTransfer (encrypted end-to-end). Otherwise falls back to
    ///         plain IERC20.transfer of raw USDC.
    function onUnstakeCallback(
        bytes32[] calldata handles,
        bytes calldata abiEncodedResult,
        bytes calldata decryptionProof
    ) external {
        FHE.checkSignatures(handles, abiEncodedResult, decryptionProof);

        address user = _handleOwner[handles[0]];
        require(user != address(0), "ShadowBridgeBase: unknown handle");

        uint64 cleartextAmount = abi.decode(abiEncodedResult, (uint64));

        delete _handleOwner[handles[0]];
        hasPendingDecrypt[user] = false;

        if (cleartextAmount > 0) {
            if (address(cUSDCToken) != address(0)) {
                // ERC-7984 path: re-encrypt the cleartext so the transfer stays confidential.
                // The user receives cUSDC which they can hold, trade, or unwrap at any time.
                euint64 amountHandle = FHE.asEuint64(cleartextAmount);
                FHE.allowThis(amountHandle);
                FHE.allow(amountHandle, address(cUSDCToken));
                cUSDCToken.confidentialTransfer(user, amountHandle);
            } else {
                // Fallback path (local tests): plain USDC transfer.
                IERC20(usdcToken).transfer(user, uint256(cleartextAmount));
            }
        }

        emit UnstakeCompleted(user);
    }

    // -------------------------------------------------------------------------
    // External — balance decryption
    // -------------------------------------------------------------------------

    function decryptBalance() external override {
        require(!hasPendingDecrypt[msg.sender], "ShadowBridgeBase: decrypt already pending");

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
        require(handles.length == 1, "ShadowBridgeBase: expected 1 handle");
        FHE.checkSignatures(handles, abiEncodedResult, decryptionProof);

        address user = _handleOwner[handles[0]];
        require(user != address(0), "ShadowBridgeBase: unknown handle");

        uint64 total = abi.decode(abiEncodedResult, (uint64));

        delete _handleOwner[handles[0]];
        hasPendingDecrypt[user] = false;

        emit BalanceRevealed(user, total);
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
        require(message.length >= 52, "ShadowBridgeBase: message too short");
        bytes32 senderBytes;
        assembly {
            senderBytes := calldataload(add(message.offset, 20))
        }
        address sender = address(uint160(uint256(senderBytes)));
        require(sender == ethShadowBridge, "ShadowBridgeBase: untrusted source");
    }

    // -------------------------------------------------------------------------
    // IShadowBridge stub
    // -------------------------------------------------------------------------

    function depositConfidential(externalEuint64, bytes calldata) external pure override {
        revert("ShadowBridgeBase: eth-side only");
    }
}
