/**
 * Seed d'un anvil local pour le développement du front :
 * déploie les mocks ENS + le coffre, crée les 5 postes, nomme 5 membres,
 * publie leurs méta-adresses en text records, et écrit .env.local.
 *
 * Usage : anvil doit tourner sur 8545, puis `npm run seed`.
 *
 * Les « membres » sont les wallets anvil 1..5 (mnemonic de test public) —
 * uniquement pour le développement local, rien de tout ceci ne touche Sepolia.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createPublicClient,
  createWalletClient,
  http,
  namehash,
  parseEther,
  type Abi,
  type Address,
  type Hex,
} from 'viem'
import { mnemonicToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'

import { DERIVATION_MESSAGE, deriveKeys, generateStealthAddress } from '../src/lib/stealth'

const RPC = 'http://127.0.0.1:8545'
const MNEMONIC = 'test test test test test test test test test test test junk'
const PARENT_NAME = 'treasury.gora.eth'
const MEMBER_NAMES = ['anakin.eth', 'leia.eth', 'luc.eth', 'obi-wan.eth', 'padme.eth']
const FAR_FUTURE = 2n ** 62n

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function artifact(file: string, name: string): { abi: Abi; bytecode: Hex } {
  const p = path.join(__dirname, '../../contracts/out', file, `${name}.json`)
  const j = JSON.parse(readFileSync(p, 'utf8'))
  return { abi: j.abi, bytecode: j.bytecode.object }
}

const publicClient = createPublicClient({ chain: foundry, transport: http(RPC) })
const admin = mnemonicToAccount(MNEMONIC, { addressIndex: 0 })
const members = [1, 2, 3, 4, 5].map((i) => mnemonicToAccount(MNEMONIC, { addressIndex: i }))
const adminWallet = createWalletClient({ account: admin, chain: foundry, transport: http(RPC) })

async function deploy(file: string, name: string, args: unknown[] = []): Promise<Address> {
  const { abi, bytecode } = artifact(file, name)
  const hash = await adminWallet.deployContract({ abi, bytecode, args })
  const rcpt = await publicClient.waitForTransactionReceipt({ hash })
  return rcpt.contractAddress!
}

async function write(address: Address, file: string, name: string, functionName: string, args: unknown[]) {
  const { abi } = artifact(file, name)
  const hash = await adminWallet.writeContract({ address, abi, functionName, args })
  await publicClient.waitForTransactionReceipt({ hash })
}

async function main() {
  const parentNode = namehash(PARENT_NAME)

  const registry = await deploy('ENSMocks.sol', 'MockENSRegistry')
  const resolver = await deploy('ENSMocks.sol', 'MockAddrResolver')
  const wrapper = await deploy('ENSMocks.sol', 'MockNameWrapper')

  await write(wrapper, 'ENSMocks.sol', 'MockNameWrapper', 'setData', [
    BigInt(parentNode),
    admin.address,
    0,
    FAR_FUTURE,
  ])

  const vault = await deploy('GoraVault.sol', 'GoraVault', [registry, wrapper, parentNode, 3n])
  const fund = await adminWallet.sendTransaction({ to: vault, value: parseEther('5') })
  await publicClient.waitForTransactionReceipt({ hash: fund })

  const now = BigInt(Math.floor(Date.now() / 1000))

  for (let i = 0; i < 5; i++) {
    const label = `seat-${i + 1}`
    const node = namehash(`${label}.${PARENT_NAME}`)
    // seat-5 expire dans 20 minutes — pour le compte à rebours de l'écran 5
    const expiry = i === 4 ? now + 1200n : FAR_FUTURE

    await write(wrapper, 'ENSMocks.sol', 'MockNameWrapper', 'setData', [BigInt(node), admin.address, 0, expiry])
    await write(registry, 'ENSMocks.sol', 'MockENSRegistry', 'setResolver', [node, resolver])

    // le membre publie sa méta-adresse sur SON nom (ce que fait l'écran 3)
    const sig = await members[i].signMessage({ message: DERIVATION_MESSAGE })
    const keys = deriveKeys(sig)
    const memberNode = namehash(MEMBER_NAMES[i])
    await write(registry, 'ENSMocks.sol', 'MockENSRegistry', 'setResolver', [memberNode, resolver])
    await write(resolver, 'ENSMocks.sol', 'MockAddrResolver', 'setText', [
      memberNode,
      'stealth-meta-address',
      keys.metaAddress,
    ])

    // le nommant dérive localement et inscrit (ce que fait l'écran 2).
    // AUCUN nom ne part avec le nœud — le registre des membres est publié
    // séparément, en vrac, sur le parent (§2).
    const ann = generateStealthAddress(keys.metaAddress)
    await write(resolver, 'ENSMocks.sol', 'MockAddrResolver', 'setAddr', [node, ann.stealthAddress])
    await write(vault, 'GoraVault.sol', 'GoraVault', 'assignSeat', [
      node,
      ann.ephemeralPubKey,
      ann.viewTag,
    ])
    console.log(`✓ ${label} pourvu (${ann.stealthAddress})`)
  }

  // le registre des membres — en vrac au niveau du parent, jamais poste par poste
  await write(registry, 'ENSMocks.sol', 'MockENSRegistry', 'setResolver', [parentNode, resolver])
  await write(resolver, 'ENSMocks.sol', 'MockAddrResolver', 'setText', [
    parentNode,
    'gora-members',
    MEMBER_NAMES.join(', '),
  ])
  console.log(`✓ registre des membres : ${MEMBER_NAMES.join(', ')}`)

  const env = `# généré par scripts/seed-anvil.ts — anvil local UNIQUEMENT
VITE_CHAIN_ID=31337
VITE_RPC_URL=${RPC}
VITE_VAULT_ADDRESS=${vault}
VITE_ENS_REGISTRY=${registry}
VITE_NAME_WRAPPER=${wrapper}
VITE_PUBLIC_RESOLVER=${resolver}
VITE_PARENT_NAME=${PARENT_NAME}
VITE_SEAT_COUNT=5
VITE_DEPLOY_BLOCK=0
`
  writeFileSync(path.join(__dirname, '../.env.local'), env)
  console.log(`\n.env.local écrit — vault : ${vault}`)
  console.log('membres = wallets anvil 1..5 (mnemonic de test), admin = wallet 0')
  spawnSync('true')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
