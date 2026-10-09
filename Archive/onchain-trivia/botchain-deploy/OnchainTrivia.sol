// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title Onchain Trivia - quiz scores & leaderboard on BOT Chain
/// @notice Adapted for BOT Chain. Inspired by "Onchain Trivia" (MIT), ETHGlobal Agentic Ethereum.
contract OnchainTrivia {
    address public owner;
    uint256 public constant LEADERBOARD_SIZE = 10;
    uint256 public constant MAX_TOTAL = 100;

    mapping(address => uint256) public bestScore;
    mapping(address => uint256) public bestTotal;
    mapping(address => uint256) public gamesPlayed;
    mapping(address => uint256) public lastPlayed;
    address[] private _players;

    address[LEADERBOARD_SIZE] public topPlayers;
    uint256[LEADERBOARD_SIZE] public topScores;
    uint256[LEADERBOARD_SIZE] public topTotals;

    event ScoreRecorded(
        address indexed player,
        uint256 score,
        uint256 total,
        uint256 gamesPlayed,
        uint256 timestamp
    );

    constructor() {
        owner = msg.sender;
    }

    /// @notice Record a completed quiz result. Keeps the caller's best score and
    ///         inserts them into the on-chain top-10 leaderboard when they qualify.
    function submitScore(uint256 score, uint256 total) external {
        require(total > 0 && total <= MAX_TOTAL && score <= total, "invalid score");

        gamesPlayed[msg.sender] += 1;
        lastPlayed[msg.sender] = block.timestamp;

        uint256 pct = (score * 100) / total;
        uint256 bestPct = bestTotal[msg.sender] == 0
            ? 0
            : (bestScore[msg.sender] * 100) / bestTotal[msg.sender];

        if (pct > bestPct || bestTotal[msg.sender] == 0) {
            bestScore[msg.sender] = score;
            bestTotal[msg.sender] = total;
            _insertLeaderboard(msg.sender, score, total);
        }

        emit ScoreRecorded(msg.sender, score, total, gamesPlayed[msg.sender], block.timestamp);
    }

    function getLeaderboard()
        external
        view
        returns (
            address[LEADERBOARD_SIZE] memory playersOut,
            uint256[LEADERBOARD_SIZE] memory scoresOut,
            uint256[LEADERBOARD_SIZE] memory totalsOut
        )
    {
        return (topPlayers, topScores, topTotals);
    }

    function getStats(address who)
        external
        view
        returns (uint256 best, uint256 bestOf, uint256 games, uint256 last)
    {
        return (bestScore[who], bestTotal[who], gamesPlayed[who], lastPlayed[who]);
    }

    function playerCount() external view returns (uint256) {
        return _players.length;
    }

    function _insertLeaderboard(address player, uint256 score, uint256 total) internal {
        bool seen;
        for (uint256 k = 0; k < _players.length; k++) {
            if (_players[k] == player) { seen = true; break; }
        }
        if (!seen) _players.push(player);

        uint256 pct = (score * 100) / total;
        uint256 i = 0;
        while (
            i < LEADERBOARD_SIZE &&
            topTotals[i] != 0 &&
            (topScores[i] * 100) / topTotals[i] >= pct
        ) i++;
        if (i < LEADERBOARD_SIZE) {
            for (uint256 j = LEADERBOARD_SIZE - 1; j > i; j--) {
                topScores[j] = topScores[j - 1];
                topPlayers[j] = topPlayers[j - 1];
                topTotals[j] = topTotals[j - 1];
            }
            topScores[i] = score;
            topPlayers[i] = player;
            topTotals[i] = total;
        }
    }
}
