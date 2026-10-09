// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {GoraVault} from "../src/GoraVault.sol";

/// @notice Déploiement piloté par l'environnement — aucune adresse inventée,
///         aucune valeur codée en dur (voir .env.example à la racine).
///
///   PARENT_NODE = $(cast namehash treasury.gora.eth)
///   forge script script/Deploy.s.sol --rpc-url botchain --broadcast
contract Deploy is Script {
    function run() external {
        address ensRegistry = vm.envAddress("ENS_REGISTRY");
        address nameWrapper = vm.envAddress("NAME_WRAPPER");
        bytes32 parentNode = vm.envBytes32("PARENT_NODE");
        uint256 threshold = vm.envUint("THRESHOLD");

        vm.startBroadcast();
        GoraVault vault = new GoraVault(ensRegistry, nameWrapper, parentNode, threshold);
        vm.stopBroadcast();

        console2.log("GoraVault :", address(vault));
        console2.log("parentNode    :", vm.toString(parentNode));
        console2.log("threshold     :", threshold);
        console2.log("");
        console2.log("Reporter l'adresse dans app/.env (VITE_VAULT_ADDRESS) avec le bloc de deploiement (VITE_DEPLOY_BLOCK).");
    }
}
