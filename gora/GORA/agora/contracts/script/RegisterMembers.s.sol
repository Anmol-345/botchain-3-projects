// SPDX-License-Identifier: MIT
pragma solidity ~0.8.17;

import {Script, console2} from "forge-std/Script.sol";

import {ENSRegistry} from "@ensdomains/ens-contracts/contracts/registry/ENSRegistry.sol";
import {BaseRegistrarImplementation} from
    "@ensdomains/ens-contracts/contracts/ethregistrar/BaseRegistrarImplementation.sol";

/// @notice Enregistre les noms `.eth` des membres et les remet à Julie, résolveur
///         déjà posé — pour qu'elle puisse y publier les méta-adresses sans
///         transaction supplémentaire.
///
///         Ordre imposé par le BaseRegistrar : on enregistre pour soi (pour
///         pouvoir écrire le résolveur), puis `reclaim` bascule le propriétaire
///         registre, puis `transferFrom` bascule le jeton. Idempotent.
contract RegisterMembers is Script {
    bytes32 constant ETH_NODE = keccak256(abi.encodePacked(bytes32(0), keccak256("eth")));
    uint256 constant DURATION = 730 days;

    string[5] MEMBERS = ["anakin", "leia", "luc", "obi-wan", "padme"];

    function run() external {
        uint256 pk = vm.envUint("SETUP_KEY");
        address me = vm.addr(pk);
        address julie = vm.envAddress("JULIE_ADDRESS");

        ENSRegistry registry = ENSRegistry(vm.envAddress("ENS_REGISTRY"));
        BaseRegistrarImplementation base =
            BaseRegistrarImplementation(vm.envAddress("BASE_REGISTRAR"));
        address resolver = vm.envAddress("PUBLIC_RESOLVER");

        vm.startBroadcast(pk);

        for (uint256 i; i < 5; ++i) {
            uint256 id = uint256(keccak256(bytes(MEMBERS[i])));
            if (!base.available(id)) {
                console2.log("deja pris, ignore :", MEMBERS[i]);
                continue;
            }
            base.register(id, me, DURATION);
            registry.setResolver(
                keccak256(abi.encodePacked(ETH_NODE, keccak256(bytes(MEMBERS[i])))), resolver
            );
            base.reclaim(id, julie); // propriétaire côté registre
            base.transferFrom(me, julie, id); // propriétaire du jeton
            console2.log("enregistre :", MEMBERS[i]);
        }

        vm.stopBroadcast();
    }
}
