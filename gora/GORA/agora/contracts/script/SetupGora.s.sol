// SPDX-License-Identifier: MIT
pragma solidity ~0.8.17;

import {Script, console2} from "forge-std/Script.sol";

import {ENSRegistry} from "@ensdomains/ens-contracts/contracts/registry/ENSRegistry.sol";
import {BaseRegistrarImplementation} from
    "@ensdomains/ens-contracts/contracts/ethregistrar/BaseRegistrarImplementation.sol";
import {NameWrapper} from "@ensdomains/ens-contracts/contracts/wrapper/NameWrapper.sol";
import {PublicResolver} from "@ensdomains/ens-contracts/contracts/resolvers/PublicResolver.sol";

import {GoraVault} from "../src/GoraVault.sol";

/// @notice Met en place l'organisation sur la pile ENS déployée par DeployENS :
///         gora.eth → treasury → 4 postes pré-créés, le coffre, et les
///         noms des membres. Tout finit entre les mains de Julie.
contract SetupGora is Script {
    bytes32 constant ETH_NODE = keccak256(abi.encodePacked(bytes32(0), keccak256("eth")));
    uint256 constant DURATION = 730 days;

    string[5] MEMBERS = ["anakin", "leia", "luc", "obi-wan", "padme"];

    function node(bytes32 parent, string memory label) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(parent, keccak256(bytes(label))));
    }

    function run() external {
        uint256 pk = vm.envUint("SETUP_KEY");
        address me = vm.addr(pk);
        address julie = vm.envAddress("JULIE_ADDRESS");

        ENSRegistry registry = ENSRegistry(vm.envAddress("ENS_REGISTRY"));
        NameWrapper wrapper = NameWrapper(vm.envAddress("NAME_WRAPPER"));
        PublicResolver resolver = PublicResolver(vm.envAddress("PUBLIC_RESOLVER"));
        BaseRegistrarImplementation base =
            BaseRegistrarImplementation(vm.envAddress("BASE_REGISTRAR"));

        string memory root = vm.envString("ROOT_LABEL");
        bytes32 rootNode = node(ETH_NODE, root);

        vm.startBroadcast(pk);

        // 1 — <root>.eth, puis wrap (c'est le wrap qui donne expiry et fuses)
        base.register(uint256(keccak256(bytes(root))), me, DURATION);
        base.setApprovalForAll(address(wrapper), true);
        wrapper.wrapETH2LD(root, me, 0, address(resolver));

        (,, uint64 parentExpiry) = wrapper.getData(uint256(rootNode));

        // 2 — treasury.gora.eth, gardé par le setup le temps de créer les postes
        wrapper.setSubnodeRecord(
            rootNode, "treasury", me, address(resolver), 0, 0, parentExpiry
        );
        bytes32 treasuryNode = node(rootNode, "treasury");

        // 3 — AUCUN poste n'est pré-créé, délibérément.
        //
        //     ENS interdit de raccourcir l'expiration d'un sous-nom
        //     (`_normaliseExpiry` : « Expiry cannot be less than old expiry »).
        //     Un poste pré-créé avec une longue échéance ne pourrait donc PLUS
        //     JAMAIS porter un mandat court — le curseur de durée de l'écran 2
        //     serait sans effet dessus, et la démo d'expiration impossible.
        //     Chaque poste est donc créé à la nomination, avec sa vraie durée.

        // 4 — le registre des membres, en vrac sur le parent (jamais poste par poste)
        resolver.setText(
            treasuryNode, "gora-members", "anakin.eth, leia.eth, luc.eth, obi-wan.eth, padme.eth"
        );

        // 5 — les noms des membres, pour que les méta-adresses aient où se publier.
        //     Idempotent : on saute ceux qui existent déjà (relance du script).
        for (uint256 i; i < 5; ++i) {
            uint256 id = uint256(keccak256(bytes(MEMBERS[i])));
            if (base.available(id)) {
                base.register(id, julie, DURATION);
            }
        }

        // 6 — le coffre : seuil 3 sur 5, autorité = le propriétaire de treasury
        GoraVault vault =
            new GoraVault(address(registry), address(wrapper), treasuryNode, 3);
        payable(address(vault)).transfer(0.05 ether);

        // 7 — tout passe à Julie : treasury (l'autorité de nomination), la racine,
        //     et les noms des membres
        wrapper.safeTransferFrom(me, julie, uint256(treasuryNode), 1, "");
        wrapper.safeTransferFrom(me, julie, uint256(rootNode), 1, "");

        vm.stopBroadcast();

        console2.log("VAULT=%s", address(vault));
        console2.log("TREASURY_NODE=%s", vm.toString(treasuryNode));
        console2.log("PARENT_EXPIRY=%s", vm.toString(uint256(parentExpiry)));
        console2.log("BLOCK=%s", vm.toString(block.number));
    }
}
