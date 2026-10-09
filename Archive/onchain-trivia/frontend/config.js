const CONFIG = {
  CHAIN_ID: 677,
  CHAIN_ID_HEX: '0x2a5',
  RPC_URL: 'https://rpc.botchain.ai',
  EXPLORER: 'https://scan.botchain.ai',
  CHAIN_NAME: 'BOT Chain',
  CURRENCY: 'BOT',
  CONTRACT_ADDRESS: '0x11FF181bA5bE4160e2934d27184b1b46581f5493',
  ABI: [
    'function submitScore(uint256 score, uint256 total)',
    'function getLeaderboard() view returns (address[10], uint256[10], uint256[10])',
    'function getStats(address who) view returns (uint256 best, uint256 bestOf, uint256 games, uint256 last)',
    'function playerCount() view returns (uint256)',
    'function bestScore(address) view returns (uint256)',
    'function gamesPlayed(address) view returns (uint256)'
  ]
};
