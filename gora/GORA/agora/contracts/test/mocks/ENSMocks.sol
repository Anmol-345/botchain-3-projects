// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IENSRegistry} from "../../src/interfaces/IENSRegistry.sol";
import {IAddrResolver} from "../../src/interfaces/IAddrResolver.sol";
import {INameWrapper} from "../../src/interfaces/INameWrapper.sol";

/// @notice Mocks minimaux d'ENS pour les tests unitaires et l'intégration anvil.
///         Ils ne reproduisent que ce que GoraVault lit réellement :
///         resolver(node), addr(node), getData(id), ownerOf(id).
///         Sur Sepolia, ce sont les vrais contrats ENS qui répondent.

contract MockENSRegistry is IENSRegistry {
    mapping(bytes32 => address) private _resolvers;

    function setResolver(bytes32 node, address resolver_) external {
        _resolvers[node] = resolver_;
    }

    function resolver(bytes32 node) external view returns (address) {
        return _resolvers[node];
    }
}

contract MockAddrResolver is IAddrResolver {
    mapping(bytes32 => address payable) private _addrs;
    mapping(bytes32 => mapping(string => string)) private _texts;

    function setAddr(bytes32 node, address a) external {
        _addrs[node] = payable(a);
    }

    function addr(bytes32 node) external view returns (address payable) {
        return _addrs[node];
    }

    // text records — pour stealth-meta-address et gora-appointed-under (§4)
    function setText(bytes32 node, string calldata key, string calldata value) external {
        _texts[node][key] = value;
    }

    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return _texts[node][key];
    }
}

contract MockNameWrapper is INameWrapper {
    struct Data {
        address owner;
        uint32 fuses;
        uint64 expiry;
    }

    mapping(uint256 => Data) private _data;

    function setData(uint256 id, address owner_, uint32 fuses_, uint64 expiry_) external {
        _data[id] = Data(owner_, fuses_, expiry_);
    }

    function getData(uint256 id) external view returns (address, uint32, uint64) {
        Data memory d = _data[id];
        return (d.owner, d.fuses, d.expiry);
    }

    function ownerOf(uint256 id) external view returns (address) {
        return _data[id].owner;
    }
}
