// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Le registre ENS. On n'en lit qu'une chose : quel résolveur sert un nœud.
interface IENSRegistry {
    function resolver(bytes32 node) external view returns (address);
}
