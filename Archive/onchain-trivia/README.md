# Onchain Trivia — BOT Chain

A trivia game where your final score is recorded permanently on **BOT Chain Mainnet** (chainId 677).

- **Live site**: https://onchain-trivia-botchain-amber-56c3.vercel.app
- **Contract**: `0x11FF181bA5bE4160e2934d27184b1b46581f5493`
- **Explorer**: https://scan.botchain.ai/address/0x11FF181bA5bE4160e2934d27184b1b46581f5493

## How it works

Connect wallet → play an 8-question quiz → get your score → submit it in one on-chain transaction → appear on the on-chain top-10 leaderboard.

## Structure

- `botchain-deploy/` — `OnchainTrivia.sol`, compile/deploy/smoke-test scripts (ethers v5, solc)
- `frontend/` — static site (index.html, app.js, config.js), ethers.js v5 via CDN

## Attribution

Inspired by "Onchain Trivia" (MIT License) — ETHGlobal Agentic Ethereum submission by gskril & Esk3nder: https://github.com/gskril/agentic-ethereum
