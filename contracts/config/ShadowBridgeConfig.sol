// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE} from "@fhevm/solidity/lib/FHE.sol";
import {CoprocessorConfig} from "@fhevm/solidity/lib/Impl.sol";
import {ZamaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

// ShadowBridgeBaseConfig
// Extends Zama's canonical FHEVM config to also support Base Sepolia (chainId 84532).
//
// ZamaEthereumConfig supports: Ethereum mainnet (1), Sepolia (11155111), Hardhat (31337).
//
// For Sepolia and Hardhat: delegates to ZamaConfig.getEthereumCoprocessorConfig() so the
// hardhat-plugin-generated addresses are picked up automatically in the mock environment.
// Hardcoding local constants would bypass that injection and break KMSVerifier calls in tests.
//
// For Base Sepolia (84532): PLACEHOLDER — Zama has not yet deployed FHEVM there.
// Replace the addresses below with real Base Sepolia values when Zama publishes them.
abstract contract ShadowBridgeBaseConfig {
    // -------------------------------------------------------------------------
    // PLACEHOLDER — Base Sepolia (84532) — mirrors Sepolia until Zama deploys
    // -------------------------------------------------------------------------
    address private constant _BASE_SEPOLIA_ACL = 0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D;
    address private constant _BASE_SEPOLIA_COPROCESSOR = 0x92C920834Ec8941d2C77D188936E1f7A6f49c127;
    address private constant _BASE_SEPOLIA_KMS_VERIFIER = 0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A;

    constructor() {
        if (block.chainid == 84532) {
            // Base Sepolia — placeholder Sepolia addresses until Zama deploys there
            FHE.setCoprocessor(
                CoprocessorConfig({
                    ACLAddress: _BASE_SEPOLIA_ACL,
                    CoprocessorAddress: _BASE_SEPOLIA_COPROCESSOR,
                    KMSVerifierAddress: _BASE_SEPOLIA_KMS_VERIFIER
                })
            );
        } else {
            // For Sepolia (11155111), Hardhat (31337), and mainnet (1):
            // delegate to ZamaConfig so the @fhevm/hardhat-plugin's generated addresses
            // are picked up automatically in the mock/test environment.
            FHE.setCoprocessor(ZamaConfig.getEthereumCoprocessorConfig());
        }
    }
}
