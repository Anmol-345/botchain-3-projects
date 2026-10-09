# GORA — runbook

How to run, test and deploy on **BOT Chain**. The concept is in [README.md](README.md).

## Prerequisites

Foundry (`forge` / `anvil` / `cast`) and Node ≥ 20.

For BOT Chain specifically:
- BOT on the deployer wallet — mainnet BOT via [B DEX](https://dex.botchain.ai), Bohr testnet BOT via the [faucet](https://faucet.botchain.ai/basic).
- An RPC URL. Public endpoints are fine for the demo (`https://rpc.botchain.ai` for mainnet, `https://rpc.bohr.life` for Bohr). If you have a private RPC, put it first in `VITE_RPC_URL` — the frontend supports comma-separated fallbacks.

## Networks

| | Chain ID | RPC | Explorer |
|---|---|---|---|
| **Mainnet** | 677 | https://rpc.botchain.ai | https://scan.botchain.ai |
| **Bohr testnet** | 968 | https://rpc.bohr.life | https://scan.bohr.life |
| Anvil (local) | 31337 | http://127.0.0.1:8545 | — |

## Tests — before touching anything, and after

```bash
# crypto + scan (13 tests) : derivation, generation/detection, rotation trap
cd frontend && npm test

# contract (16 tests) : §6.5 + rotation + expiration + replay
cd contracts && forge test

# end-to-end (7 steps) : the whole demo §10 on a throwaway anvil
cd frontend && npm run test:e2e
```

## Local development (no chain, no real wallet)

```bash
# terminal 1
anvil

# terminal 2
cd frontend && npm run seed     # mocks + vault + 5 members, writes .env.local
cd frontend && npm run dev      # http://localhost:5173
```

Local members are the anvil wallets 1..5 (well-known test mnemonic
`test test … junk`), admin is wallet 0. Import those keys into a **dev-only**
MetaMask profile, RPC `http://127.0.0.1:8545`, chain ID 31337.

## Deploying to BOT Chain

The vault reads ENS live. BOT Chain has no ENS deployment yet, so we deploy the
**official `@ensdomains/ens-contracts` 1.7.0 unchanged** first, then plug those
addresses into GORA's setup. Same recipe the project already used on Sepolia,
just pointing at a different RPC.

### Step 1 — populate the root `.env`

Copy `.env.example` to `.env` at the repo root and fill:

```
SETUP_KEY=0x…                        # deployer private key (NOT the day-to-day wallet)
JULIE_ADDRESS=0x…                    # final owner of gora.eth / treasury.gora.eth
BOTCHAIN_RPC_URL=https://rpc.botchain.ai
BOHR_RPC_URL=https://rpc.bohr.life
ROOT_LABEL=gora
THRESHOLD=3
```

Load them into the shell before running forge:

```bash
set -a; source .env; set +a
```

### Step 2 — recommended dry run on Bohr testnet

Prove the whole flow works on the testnet before spending real BOT.

```bash
cd contracts
forge script script/DeployENS.s.sol  --rpc-url bohr --broadcast --slow
# → copy the printed ENS_REGISTRY, NAME_WRAPPER, PUBLIC_RESOLVER, BASE_REGISTRAR
#   back into .env before the next step
forge script script/SetupGora.s.sol  --rpc-url bohr --broadcast --slow
# → copy the printed VAULT and BLOCK into frontend/.env.bohr
```

Then run the frontend against Bohr:

```bash
cd ../frontend
npm run dev:bohr
```

### Step 3 — mainnet deploy on BOT Chain

Only after Bohr is green. Same two scripts, `--rpc-url botchain` instead:

```bash
cd contracts
forge script script/DeployENS.s.sol  --rpc-url botchain --broadcast --slow
# copy ENS_REGISTRY, NAME_WRAPPER, PUBLIC_RESOLVER, BASE_REGISTRAR into .env
forge script script/SetupGora.s.sol  --rpc-url botchain --broadcast --slow
# copy VAULT and BLOCK into frontend/.env.botchain
```

`script/Deploy.s.sol` only redeploys the vault against an existing ENS stack —
use it if you need to redeploy just the vault later.

### Step 4 — run the frontend

```bash
cd frontend
npm run dev:botchain      # local dev pointed at mainnet
npm run build:botchain    # production build (Vercel uses this via vercel.json)
```

For MetaMask, add BOT Chain as a custom network with the values from the table
above.

## What SetupGora does

Idempotent script that stages the org on top of the ENS stack from Step 1:

1. registers `gora.eth` on the `.eth` BaseRegistrar for 2 years, wraps it
2. creates `treasury.gora.eth` under it (fuses zero — `PARENT_CANNOT_CONTROL`
   is deliberately **not** burned, see README §4)
3. registers `anakin.eth`, `leia.eth`, `luc.eth`, `obi-wan.eth`, `padme.eth` so
   the members have somewhere to publish their stealth meta-addresses
4. writes the `gora-members` text record on the treasury name
5. deploys `GoraVault(registry, wrapper, treasuryNode, 3)` and funds it with
   0.05 BOT
6. hands ownership of `gora.eth` and `treasury.gora.eth` to `JULIE_ADDRESS`

Seats are **not** pre-created — see the ENS rule below.

## ⚠️ ENS rule to remember: an expiry never shrinks

`NameWrapper._normaliseExpiry`: *"Expiry cannot be less than old expiry"*.
A subname created with a distant expiry can **never again** carry a short
mandate. Direct consequence: **never pre-create seats**, or the duration slider
on screen 2 has no effect and the 60-second-expiry demo becomes impossible.
Each seat is created at the moment of appointment.

Good news for the pitch: a mandate can be **extended** but not retroactively
**shortened**. To remove someone early, call `removeSeat` — early revocation is
an explicit act, expiration is not.

## Demo run-through (README §10) — technical reminders

- Appointment via screen 2 does: read text record → local derivation (banner
  about destroying r) → `setSubnodeRecord` → `setAddr` → `assignSeat`.
- Rotation: the ↻ button on screen 2. Greyed out if there are pending
  signatures on the current nonce.
- Screen 4 executes from **any** connected wallet — for the demo, execute from
  a wallet that isn't a signer, and say so aloud.
- Cross-browser: pending signature bundles move via JSON export/import on
  screen 4. No backend.

## Recording the video

As soon as appointment + detection work on Bohr (§9 block 3 in the README) —
not at the end. A mediocre video beats a nonexistent one.

## Archived — the original Sepolia deployment

The first deployment of this project was on Sepolia for ETHGlobal Lisbon. Kept
here as a historical reference; not used by the current build.

| Contract | Sepolia address |
|---|---|
| AgoraVault (predecessor) | `0x27D07B7A7b2dDf846E15e8300dA16c79eBdeE925` |
| ENSRegistry | `0x20dFEF7402f7B3F1B1b45791f3a227Ff661dBc80` |
| NameWrapper | `0x83d948EF99319d896f1Bba9f793506f6879B16FA` |
| PublicResolver | `0xCbb6c8f15523DC5D7a45aF062E2C340fe67d98Ef` |
| BaseRegistrar | `0xc73F975Ab7258E0c594449beff5bBE8a56e28453` |

Names: `agora.eth` → `treasury.agora.eth` → `seat-1…5`. The migration to BOT
Chain keeps every design choice; only the chain and the brand changed
(`agora` → `gora`, `AgoraVault` → `GoraVault`, EIP-712 domain `"Agora"` →
`"GORA"`, derivation message `"GORA key derivation v1"`).
