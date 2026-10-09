# AskaS — Creator Content Platform on BOT Chain

AskaS lets creators publish paid content and fans unlock time-limited access by paying native BOT. All pricing, payments and access expiry are enforced on-chain by a single smart contract.

## Architecture

- `botchain-deploy/AskaS.sol` — single contract: posts, prices, durations, BOT payments to creators, access expiry tracking.
- `frontend/` — static site (ethers.js v5, no build step) deployed to Vercel.

## Contract

- `createPost(title, preview, body, price, duration)` — creator publishes paid content.
- `purchaseAccess(postId)` — pay exact BOT price; payment goes directly to the creator; access expiry is recorded on-chain (purchases extend existing access).
- `hasAccess(postId, user)` / `accessExpiryOf(postId, user)` — access checks.
- `getContent(postId)` — returns the locked body only for the creator or users with valid access.

## Network

BOT Chain Mainnet — Chain ID 677 (0x2a5), RPC https://rpc.botchain.ai, Explorer https://scan.botchain.ai.

Original concept based on AskaS (MIT License).
