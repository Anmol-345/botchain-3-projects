// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Le NameWrapper d'ENS. C'est lui qui porte les deux choses qu'ENS nu
///         n'a pas : une expiration par sous-nom, et des fuses.
///
///         GORA n'en lit que deux fonctions :
///           - getData(id).expiry  → la durée du mandat
///           - ownerOf(parentNode) → le droit de nommer
///
///         L'identifiant de jeton d'un nom wrappé est uint256(namehash(nom)).
interface INameWrapper {
    function getData(uint256 id)
        external
        view
        returns (address owner, uint32 fuses, uint64 expiry);

    function ownerOf(uint256 id) external view returns (address);
}
