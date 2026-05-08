// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ShadowBridgeArbitrumConfig} from "./config/ShadowBridgeConfig.sol";
import {ShadowBridgeDest} from "./ShadowBridgeDest.sol";

/// @title ShadowBridgeArbitrum
/// @notice Arbitrum Sepolia destination of ShadowBridge.
///         All staking, reward, and CCTP receive logic lives in ShadowBridgeDest.
///         This contract only wires in the Arbitrum Sepolia FHEVM coprocessor config.
///
///         CCTP V2 addresses (Arbitrum Sepolia, chainId 421614):
///           TokenMessenger:     0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA
///           MessageTransmitter: 0xe737e5cebeeba77efe34d4aa090756590b1ce275
///           USDC:               0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
///           Circle domain ID:   3
contract ShadowBridgeArbitrum is ShadowBridgeArbitrumConfig, ShadowBridgeDest {
    constructor(
        address _usdcToken,
        address _cctpTokenMessenger,
        address _cctpMessageTransmitter,
        address _ethShadowBridge,
        uint256 _rewardRatePerBlock
    ) ShadowBridgeDest(_usdcToken, _cctpTokenMessenger, _cctpMessageTransmitter, _ethShadowBridge, _rewardRatePerBlock) {}
}
