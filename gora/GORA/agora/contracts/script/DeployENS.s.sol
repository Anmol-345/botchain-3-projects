// SPDX-License-Identifier: MIT
pragma solidity ~0.8.17;

import {Script, console2} from "forge-std/Script.sol";

import {ENSRegistry} from "@ensdomains/ens-contracts/contracts/registry/ENSRegistry.sol";
import {ReverseRegistrar} from "@ensdomains/ens-contracts/contracts/reverseRegistrar/ReverseRegistrar.sol";
import {BaseRegistrarImplementation} from
    "@ensdomains/ens-contracts/contracts/ethregistrar/BaseRegistrarImplementation.sol";
import {StaticMetadataService} from "@ensdomains/ens-contracts/contracts/wrapper/StaticMetadataService.sol";
import {NameWrapper} from "@ensdomains/ens-contracts/contracts/wrapper/NameWrapper.sol";
import {IMetadataService} from "@ensdomains/ens-contracts/contracts/wrapper/IMetadataService.sol";
import {IBaseRegistrar} from "@ensdomains/ens-contracts/contracts/ethregistrar/IBaseRegistrar.sol";
import {PublicResolver} from "@ensdomains/ens-contracts/contracts/resolvers/PublicResolver.sol";
import {ENS} from "@ensdomains/ens-contracts/contracts/registry/ENS.sol";
import {INameWrapper} from "@ensdomains/ens-contracts/contracts/wrapper/INameWrapper.sol";

/// @notice Déploie la pile ENS OFFICIELLE (sources @ensdomains/ens-contracts,
///         inchangées) sur le réseau visé.
///
///         Pourquoi : en juillet 2026, le déploiement ENS canonique de Sepolia
///         est figé par la migration v2 — le NameWrapper n'est plus contrôleur
///         du BaseRegistrar (`controllers(nameWrapper) == false`), donc aucun
///         nouveau `.eth` wrappé n'y est enregistrable. On redéploie les mêmes
///         contrats pour disposer d'un ENS fonctionnel.
///
///         forge script script/DeployENS.s.sol --rpc-url sepolia --broadcast
contract DeployENS is Script {
    bytes32 constant ETH_LABEL = keccak256("eth");
    bytes32 constant REVERSE_LABEL = keccak256("reverse");
    bytes32 constant ADDR_LABEL = keccak256("addr");

    function run() external {
        uint256 pk = vm.envUint("SETUP_KEY");
        address me = vm.addr(pk);

        vm.startBroadcast(pk);

        // 1 — le registre
        ENSRegistry registry = new ENSRegistry();

        // 2 — reverse : addr.reverse doit exister AVANT NameWrapper/PublicResolver,
        //     dont les constructeurs passent par ReverseClaimer.
        registry.setSubnodeOwner(bytes32(0), REVERSE_LABEL, me);
        bytes32 reverseNode = keccak256(abi.encodePacked(bytes32(0), REVERSE_LABEL));
        ReverseRegistrar reverseRegistrar = new ReverseRegistrar(ENS(address(registry)));
        registry.setSubnodeOwner(reverseNode, ADDR_LABEL, address(reverseRegistrar));

        // 3 — le registrar .eth
        bytes32 ethNode = keccak256(abi.encodePacked(bytes32(0), ETH_LABEL));
        BaseRegistrarImplementation base =
            new BaseRegistrarImplementation(ENS(address(registry)), ethNode);
        registry.setSubnodeOwner(bytes32(0), ETH_LABEL, address(base));

        // 4 — le NameWrapper : c'est lui qui porte expiry et fuses
        StaticMetadataService metadata = new StaticMetadataService("");
        NameWrapper wrapper = new NameWrapper(
            ENS(address(registry)), IBaseRegistrar(address(base)), IMetadataService(address(metadata))
        );

        // 5 — autorisations : le wrapper doit pouvoir enregistrer, et nous aussi
        base.addController(address(wrapper));
        base.addController(me);

        // 6 — le résolveur public
        PublicResolver resolver = new PublicResolver(
            ENS(address(registry)), INameWrapper(address(wrapper)), address(0), address(reverseRegistrar)
        );
        reverseRegistrar.setDefaultResolver(address(resolver));

        vm.stopBroadcast();

        console2.log("ENS_REGISTRY=%s", address(registry));
        console2.log("NAME_WRAPPER=%s", address(wrapper));
        console2.log("PUBLIC_RESOLVER=%s", address(resolver));
        console2.log("BASE_REGISTRAR=%s", address(base));
        console2.log("REVERSE_REGISTRAR=%s", address(reverseRegistrar));
    }
}
