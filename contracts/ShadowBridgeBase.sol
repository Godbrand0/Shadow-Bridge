// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ShadowBridgeBaseConfig} from "./config/ShadowBridgeConfig.sol";
import {ShadowBridgeDest} from "./ShadowBridgeDest.sol";

/// @title ShadowBridgeBase
/// @notice Base Sepolia destination of ShadowBridge.
///         All staking, reward, and CCTP receive logic lives in ShadowBridgeDest.
///         This contract only wires in the Base Sepolia FHEVM coprocessor config.
contract ShadowBridgeBase is ShadowBridgeBaseConfig, ShadowBridgeDest {
    constructor(
        address _usdcToken,
        address _cctpTokenMessenger,
        address _cctpMessageTransmitter,
        address _ethShadowBridge,
        uint256 _rewardRatePerBlock
    ) ShadowBridgeDest(_usdcToken, _cctpTokenMessenger, _cctpMessageTransmitter, _ethShadowBridge, _rewardRatePerBlock) {}
}
