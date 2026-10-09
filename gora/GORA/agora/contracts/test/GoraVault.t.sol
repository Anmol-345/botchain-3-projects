// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {GoraVault} from "../src/GoraVault.sol";
import {MockENSRegistry, MockAddrResolver, MockNameWrapper} from "./mocks/ENSMocks.sol";

/// Tests du §6.5, plus ce qu'un juge essaierait de casser.
contract GoraVaultTest is Test {
    MockENSRegistry internal registry;
    MockAddrResolver internal resolver;
    MockNameWrapper internal wrapper;
    GoraVault internal vault;

    address internal admin = makeAddr("admin"); // propriétaire du nom parent
    address internal stranger = makeAddr("stranger"); // n'importe qui — paie le gas d'execute

    bytes32 internal constant PARENT_NODE = keccak256("treasury.gora.eth");
    uint256 internal constant THRESHOLD = 3;
    uint64 internal constant FAR_FUTURE = type(uint64).max;

    // 5 postes, 5 clés « furtives » (pour le contrat, une clé est une clé —
    // la furtivité est une propriété du protocole off-chain, testée côté TS)
    bytes32[5] internal nodes;
    uint256[5] internal pks;
    address[5] internal signers;

    bytes internal ephemeralKey; // 33 octets, contenu indifférent pour le contrat

    function setUp() public {
        registry = new MockENSRegistry();
        resolver = new MockAddrResolver();
        wrapper = new MockNameWrapper();

        // le parent appartient à admin — c'est TOUT son droit de nommer
        wrapper.setData(uint256(PARENT_NODE), admin, 0, FAR_FUTURE);

        vault = new GoraVault(address(registry), address(wrapper), PARENT_NODE, THRESHOLD);
        vm.deal(address(vault), 10 ether);

        ephemeralKey = new bytes(33);
        ephemeralKey[0] = 0x02;

        for (uint256 i; i < 5; ++i) {
            nodes[i] = keccak256(abi.encodePacked("seat-", i));
            pks[i] = 0xA11CE + i;
            signers[i] = vm.addr(pks[i]);
            _wireSeat(nodes[i], signers[i], FAR_FUTURE);
            vm.prank(admin);
            vault.assignSeat(nodes[i], ephemeralKey, uint8(i));
        }
    }

    /// Câble un poste comme le ferait le vrai ENS : expiry dans le wrapper,
    /// résolveur dans le registre, adresse dans le résolveur.
    function _wireSeat(bytes32 node, address a, uint64 expiry) internal {
        wrapper.setData(uint256(node), admin, 0, expiry);
        registry.setResolver(node, address(resolver));
        resolver.setAddr(node, a);
    }

    /// Signe le digest avec `count` clés, signatures triées par adresse croissante.
    function _sign(bytes32 digest, uint256 count) internal view returns (bytes[] memory sigs) {
        // tri des (pk, addr) par adresse croissante
        uint256[] memory sortedPks = new uint256[](5);
        address[] memory sortedAddrs = new address[](5);
        for (uint256 i; i < 5; ++i) {
            sortedPks[i] = pks[i];
            sortedAddrs[i] = signers[i];
        }
        for (uint256 i; i < 5; ++i) {
            for (uint256 j = i + 1; j < 5; ++j) {
                if (sortedAddrs[j] < sortedAddrs[i]) {
                    (sortedAddrs[i], sortedAddrs[j]) = (sortedAddrs[j], sortedAddrs[i]);
                    (sortedPks[i], sortedPks[j]) = (sortedPks[j], sortedPks[i]);
                }
            }
        }
        sigs = new bytes[](count);
        for (uint256 i; i < count; ++i) {
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(sortedPks[i], digest);
            sigs[i] = abi.encodePacked(r, s, v);
        }
    }

    function _digestFor(address to, uint256 value) internal view returns (bytes32) {
        return vault.executeDigest(to, value, "", vault.nonce());
    }

    // ——— exécution ————————————————————————————————————————

    function test_Execute_HappyPath_AnyoneCanSubmit() public {
        address to = makeAddr("recipient");
        bytes32 digest = _digestFor(to, 1 ether);
        bytes[] memory sigs = _sign(digest, 3);

        // un parfait inconnu soumet et paie le gas — l'invariant du §1
        vm.prank(stranger);
        vault.execute(to, 1 ether, "", 0, sigs);

        assertEq(to.balance, 1 ether);
        assertEq(vault.nonce(), 1);
    }

    function test_RevertWhen_ThresholdNotMet() public {
        address to = makeAddr("recipient");
        bytes32 digest = _digestFor(to, 1 ether);
        bytes[] memory sigs = _sign(digest, 2); // 2 < 3

        vm.expectRevert(abi.encodeWithSelector(GoraVault.ThresholdNotMet.selector, 2, 3));
        vault.execute(to, 1 ether, "", 0, sigs);
    }

    function test_RevertWhen_DuplicateSignature() public {
        address to = makeAddr("recipient");
        bytes32 digest = _digestFor(to, 1 ether);
        bytes[] memory sigs = _sign(digest, 3);
        sigs[2] = sigs[1]; // doublon — casse aussi l'ordre strict croissant

        vm.expectRevert();
        vault.execute(to, 1 ether, "", 0, sigs);
    }

    function test_RevertWhen_SignaturesUnsorted() public {
        address to = makeAddr("recipient");
        bytes32 digest = _digestFor(to, 1 ether);
        bytes[] memory sigs = _sign(digest, 3);
        (sigs[0], sigs[1]) = (sigs[1], sigs[0]); // ordre décroissant quelque part

        vm.expectRevert();
        vault.execute(to, 1 ether, "", 0, sigs);
    }

    function test_RevertWhen_NonSignerSignature() public {
        address to = makeAddr("recipient");
        bytes32 digest = _digestFor(to, 1 ether);

        bytes[] memory sigs = _sign(digest, 2);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBAD, digest); // clé hors du corps
        // insérer en respectant le tri
        bytes[] memory all = new bytes[](3);
        address bad = vm.addr(0xBAD);
        // reconstruire trié : on re-signe tout proprement
        all = _insertSorted(digest, sigs, 0xBAD, bad);

        vm.expectRevert(abi.encodeWithSelector(GoraVault.NotASigner.selector, bad));
        vault.execute(to, 1 ether, "", 0, all);
        // silence les warnings
        v;
        r;
        s;
    }

    function _insertSorted(bytes32 digest, bytes[] memory sigs, uint256 extraPk, address extraAddr)
        internal
        view
        returns (bytes[] memory out)
    {
        // recouvre les adresses des sigs existantes pour insérer au bon rang
        out = new bytes[](sigs.length + 1);
        (uint8 ev_, bytes32 er, bytes32 es) = vm.sign(extraPk, digest);
        bytes memory extraSig = abi.encodePacked(er, es, ev_);
        uint256 k;
        bool placed;
        for (uint256 i; i < sigs.length; ++i) {
            address a = _recover(digest, sigs[i]);
            if (!placed && extraAddr < a) {
                out[k++] = extraSig;
                placed = true;
            }
            out[k++] = sigs[i];
        }
        if (!placed) out[k] = extraSig;
    }

    function _recover(bytes32 digest, bytes memory sig) internal pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = _split(sig);
        return ecrecover(digest, v, r, s);
    }

    function _split(bytes memory sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        assembly {
            r := mload(add(sig, 0x20))
            s := mload(add(sig, 0x40))
            v := byte(0, mload(add(sig, 0x60)))
        }
    }

    function test_RevertWhen_BadNonce_NoReplay() public {
        address to = makeAddr("recipient");
        bytes32 digest = _digestFor(to, 1 ether);
        bytes[] memory sigs = _sign(digest, 3);

        vault.execute(to, 1 ether, "", 0, sigs);

        // rejouer le même lot : le nonce a avancé
        vm.expectRevert(GoraVault.BadNonce.selector);
        vault.execute(to, 1 ether, "", 0, sigs);
    }

    // ——— expiration (§2 : « un poste périmé ne signe plus ») ——————————

    function test_RevertWhen_AssignExpiredSeat() public {
        bytes32 node = keccak256("seat-expired");
        _wireSeat(node, makeAddr("late"), uint64(block.timestamp + 1 hours));
        vm.warp(block.timestamp + 2 hours);

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(GoraVault.SeatExpired.selector, node));
        vault.assignSeat(node, ephemeralKey, 0);
    }

    function test_ExpiredSeat_StopsSigning_WithoutAnyRevocation() public {
        // seat-0 expire dans 60 secondes — la scène finale de la démo (§10, point 9)
        wrapper.setData(uint256(nodes[0]), admin, 0, uint64(block.timestamp + 60));

        assertTrue(vault.isActiveSigner(signers[0]));
        vm.warp(block.timestamp + 61);
        // personne n'a rien révoqué : le pouvoir s'est éteint tout seul
        assertFalse(vault.isActiveSigner(signers[0]));

        address to = makeAddr("recipient");
        bytes32 digest = _digestFor(to, 1 ether);
        bytes[] memory sigs = _sign(digest, 3);

        // si le lot contient la signature du poste expiré, il est rejeté
        bool containsExpired;
        for (uint256 i; i < sigs.length; ++i) {
            if (_recover(digest, sigs[i]) == signers[0]) containsExpired = true;
        }
        if (containsExpired) {
            vm.expectRevert(abi.encodeWithSelector(GoraVault.NotASigner.selector, signers[0]));
            vault.execute(to, 1 ether, "", 0, sigs);
        }

        assertEq(vault.activeSignerCount(), 4);
    }

    // ——— nomination ————————————————————————————————————————

    function test_RevertWhen_NotParentOwner() public {
        bytes32 node = keccak256("seat-new");
        _wireSeat(node, makeAddr("x"), FAR_FUTURE);

        vm.prank(stranger);
        vm.expectRevert(GoraVault.NotNameOwner.selector);
        vault.assignSeat(node, ephemeralKey, 0);
    }

    function test_ParentOwnershipIsLive_NotCached() public {
        // le droit de nommer suit la propriété ENS du nom, en direct :
        // si le nom parent change de main, l'ancien admin perd tout, sans appel au contrat
        wrapper.setData(uint256(PARENT_NODE), stranger, 0, FAR_FUTURE);

        bytes32 node = keccak256("seat-new");
        _wireSeat(node, makeAddr("x"), FAR_FUTURE);

        vm.prank(admin);
        vm.expectRevert(GoraVault.NotNameOwner.selector);
        vault.assignSeat(node, ephemeralKey, 0);

        vm.prank(stranger); // le nouveau propriétaire du nom, lui, peut
        vault.assignSeat(node, ephemeralKey, 0);
    }

    function test_RevertWhen_SeatHasNoAddrRecord() public {
        bytes32 node = keccak256("seat-empty");
        wrapper.setData(uint256(node), admin, 0, FAR_FUTURE);
        registry.setResolver(node, address(resolver)); // résolveur présent, addr absent

        vm.prank(admin);
        vm.expectRevert(GoraVault.SeatHasNoAddrRecord.selector);
        vault.assignSeat(node, ephemeralKey, 0);
    }

    function test_RevertWhen_BadEphemeralKeyLength() public {
        vm.prank(admin);
        vm.expectRevert(GoraVault.BadEphemeralKeyLength.selector);
        vault.assignSeat(nodes[0], hex"0202", 0);
    }

    // ——— rotation (§5.7) — « le meilleur rapport temps/points du projet » ———

    function test_Rotation_OldAddressRejected_NewAccepted() public {
        uint256 newPk = 0xF00D;
        address newAddr = vm.addr(newPk);

        // rotation = setAddr + assignSeat sur le même nœud. Rien d'autre.
        resolver.setAddr(nodes[0], newAddr);
        vm.prank(admin);
        vault.assignSeat(nodes[0], ephemeralKey, 42);

        // pas de doublon dans la liste des postes
        assertEq(vault.seatCount(), 5);

        // l'ancienne adresse a cessé d'être signataire À LA TRANSACTION PRÈS
        assertFalse(vault.isActiveSigner(signers[0]));
        assertTrue(vault.isActiveSigner(newAddr));

        // et la nouvelle clé signe : on remplace pks[0] et on exécute
        pks[0] = newPk;
        signers[0] = newAddr;
        address to = makeAddr("recipient");
        bytes32 digest = _digestFor(to, 1 ether);
        bytes[] memory sigs = _sign(digest, 3);
        vm.prank(stranger);
        vault.execute(to, 1 ether, "", 0, sigs);
        assertEq(to.balance, 1 ether);
    }

    // ——— révocation anticipée ————————————————————————————————

    function test_RemoveSeat() public {
        vm.prank(admin);
        vault.removeSeat(nodes[2]);

        assertEq(vault.seatCount(), 4);
        assertFalse(vault.isActiveSigner(signers[2]));
        assertFalse(vault.isSeat(nodes[2]));

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(GoraVault.UnknownSeat.selector, nodes[2]));
        vault.removeSeat(nodes[2]);
    }

    function test_RevertWhen_RemoveSeat_NotParentOwner() public {
        vm.prank(stranger);
        vm.expectRevert(GoraVault.NotNameOwner.selector);
        vault.removeSeat(nodes[0]);
    }

    // ——— lecture ————————————————————————————————————————————

    function test_SeatInfo() public {
        (bool registered, address a, uint32 fuses, uint64 expiry, bool active) = vault.seatInfo(nodes[1]);
        assertTrue(registered);
        assertEq(a, signers[1]);
        assertEq(fuses, 0);
        assertEq(expiry, FAR_FUTURE);
        assertTrue(active);

        wrapper.setData(uint256(nodes[1]), admin, 0, uint64(block.timestamp + 10));
        vm.warp(block.timestamp + 11);
        (,,,, bool activeAfter) = vault.seatInfo(nodes[1]);
        assertFalse(activeAfter);
    }
}
