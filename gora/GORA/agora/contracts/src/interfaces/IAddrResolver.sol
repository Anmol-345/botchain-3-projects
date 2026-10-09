// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Résolveur d'adresse ENSIP-1. Lecture synchrone et on-chain — c'est la
///         raison pour laquelle GORA ne peut pas utiliser de résolveur
///         CCIP-Read : un OffchainLookup ne se résout pas dans un `view`
///         appelé depuis execute(). Voir §5.7 du README.
interface IAddrResolver {
    function addr(bytes32 node) external view returns (address payable);
}
