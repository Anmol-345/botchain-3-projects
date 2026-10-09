// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ZenoPayment {
    event PaymentSent(
        address indexed sender,
        address indexed to,
        uint256 amount,
        uint256 timestamp,
        string memo
    );

    function pay(address payable to, string calldata memo) external payable {
        require(msg.value > 0, "Amount must be > 0");
        require(to != address(0), "Invalid recipient");
        emit PaymentSent(msg.sender, to, msg.value, block.timestamp, memo);
        (bool success, ) = to.call{value: msg.value}("");
        require(success, "Transfer failed");
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {}
}
