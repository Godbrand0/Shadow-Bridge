// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE} from "@fhevm/solidity/lib/FHE.sol";
import {CoprocessorConfig} from "@fhevm/solidity/lib/Impl.sol";
import {ZamaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

// ShadowBridgeBaseConfig
// FHEVM coprocessor config for Base Sepolia (chainId 84532).
// PLACEHOLDER — Zama has not yet deployed FHEVM on Base Sepolia.
// Replace the three addresses below with real values when Zama publishes them.
abstract contract ShadowBridgeBaseConfig {
    address private constant _BASE_SEPOLIA_ACL            = 0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D;
    address private constant _BASE_SEPOLIA_COPROCESSOR    = 0x92C920834Ec8941d2C77D188936E1f7A6f49c127;
    address private constant _BASE_SEPOLIA_KMS_VERIFIER   = 0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A;

    constructor() {
        if (block.chainid == 84532) {
            FHE.setCoprocessor(
                CoprocessorConfig({
                    ACLAddress: _BASE_SEPOLIA_ACL,
                    CoprocessorAddress: _BASE_SEPOLIA_COPROCESSOR,
                    KMSVerifierAddress: _BASE_SEPOLIA_KMS_VERIFIER
                })
            );
        } else {
            // Sepolia (11155111) and Hardhat (31337): delegate to ZamaConfig so
            // hardhat-plugin-generated addresses are picked up automatically.
            FHE.setCoprocessor(ZamaConfig.getEthereumCoprocessorConfig());
        }
    }
}

// ShadowBridgeArbitrumConfig
// FHEVM coprocessor config for Arbitrum Sepolia (chainId 421614).
// PLACEHOLDER — Zama has not yet deployed FHEVM on Arbitrum Sepolia.
// Replace the three addresses below with real values when Zama publishes them.
abstract contract ShadowBridgeArbitrumConfig {
    address private constant _ARB_SEPOLIA_ACL           = 0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D;
    address private constant _ARB_SEPOLIA_COPROCESSOR   = 0x92C920834Ec8941d2C77D188936E1f7A6f49c127;
    address private constant _ARB_SEPOLIA_KMS_VERIFIER  = 0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A;

    constructor() {
        if (block.chainid == 421614) {
            FHE.setCoprocessor(
                CoprocessorConfig({
                    ACLAddress: _ARB_SEPOLIA_ACL,
                    CoprocessorAddress: _ARB_SEPOLIA_COPROCESSOR,
                    KMSVerifierAddress: _ARB_SEPOLIA_KMS_VERIFIER
                })
            );
        } else {
            FHE.setCoprocessor(ZamaConfig.getEthereumCoprocessorConfig());
        }
    }
}
