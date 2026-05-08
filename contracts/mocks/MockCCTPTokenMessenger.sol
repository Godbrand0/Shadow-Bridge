// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICCTPTokenMessenger} from "../interfaces/ICCTPTokenMessenger.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
}

/// @notice Mock CCTP TokenMessenger for local testing.
///
///         depositForBurn: transfers tokens from caller to itself (ETH-side simulation).
///         receiveMessage: mints a pre-configured amount of USDC to the caller (Base-side simulation).
contract MockCCTPTokenMessenger is ICCTPTokenMessenger {
    address public usdc;
    uint256 private _nextMintAmount;

    event BurnCalled(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, uint256 maxFee, uint32 minFinalityThreshold);

    constructor(address _usdc) {
        usdc = _usdc;
    }

    /// @notice Pre-configure how much USDC receiveMessage will mint on the next call.
    function setNextMintAmount(uint256 amount) external {
        _nextMintAmount = amount;
    }

    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32,
        uint256 maxFee,
        uint32 minFinalityThreshold
    ) external override returns (uint64 nonce) {
        IERC20(burnToken).transferFrom(msg.sender, address(this), amount);
        emit BurnCalled(amount, destinationDomain, mintRecipient, burnToken, maxFee, minFinalityThreshold);
        return 1;
    }

    function receiveMessage(
        bytes calldata,
        bytes calldata
    ) external override returns (bool success) {
        if (_nextMintAmount > 0) {
            IMintable(usdc).mint(msg.sender, _nextMintAmount);
            _nextMintAmount = 0;
        }
        return true;
    }
}
