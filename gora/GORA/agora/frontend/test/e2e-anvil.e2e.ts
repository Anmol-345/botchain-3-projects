/**
 * Intégration bout-en-bout sur anvil — la répétition générale de la démo (§10).
 *
 * Nomination réelle → détection réelle → signature réelle → exécution par un
 * non-signataire → rotation → expiration. Chaque étape assertée.
 *
 * Les mocks remplacent ENS (le contrat ne lit que resolver/addr/getData/ownerOf) ;
 * sur Sepolia, les vrais contrats ENS répondent aux mêmes appels.
 *
 * Lancement : npm run test:e2e  (démarre son propre anvil sur le port 8546)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  hashTypedData,
  http,
  namehash,
  parseAbiItem,
  parseEther,
  recoverAddress,
  type Abi,
  type Address,
  type Hex,
} from 'viem'
import { mnemonicToAccount, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'

import {
  DERIVATION_MESSAGE,
  deriveKeys,
  generateStealthAddress,
  stealthPrivateKey,
  type StealthKeys,
} from '../src/lib/stealth'
import { findMySeats, type SeatAssignedEvent } from '../src/lib/scan'

const RPC = 'http://127.0.0.1:8546'
const MNEMONIC = 'test test test test test test test test test test test junk'
const PARENT_NAME = 'treasury.gora.eth'
const MEMBER_NAMES = ['anakin.eth', 'leia.eth', 'luc.eth', 'obi-wan.eth', 'padme.eth']
const FAR_FUTURE = 2n ** 63n

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function artifact(file: string, name: string): { abi: Abi; bytecode: Hex } {
  const p = path.join(__dirname, '../../contracts/out', file, `${name}.json`)
  const j = JSON.parse(readFileSync(p, 'utf8'))
  return { abi: j.abi, bytecode: j.bytecode.object }
}

const seatAssignedEvent = parseAbiItem(
  'event SeatAssigned(bytes32 indexed node, address indexed stealthAddress, bytes ephemeralPubKey, uint8 viewTag)',
)

let anvil: ChildProcessWithoutNullStreams
const publicClient = createPublicClient({ chain: foundry, transport: http(RPC) })
const testClient = createTestClient({ chain: foundry, mode: 'anvil', transport: http(RPC) })

// wallets : 0 = admin (propriétaire du nom parent), 1..5 = les membres, 9 = l'inconnu qui paie le gas
const admin = mnemonicToAccount(MNEMONIC, { addressIndex: 0 })
const members = [1, 2, 3, 4, 5].map((i) => mnemonicToAccount(MNEMONIC, { addressIndex: i }))
const stranger = mnemonicToAccount(MNEMONIC, { addressIndex: 9 })

const wallet = (account: typeof admin) =>
  createWalletClient({ account, chain: foundry, transport: http(RPC) })

let registry: Address, resolver: Address, wrapper: Address, vault: Address
let vaultAbi: Abi, registryAbi: Abi, resolverAbi: Abi, wrapperAbi: Abi

const parentNode = namehash(PARENT_NAME)
const seatNodes = [1, 2, 3, 4, 5].map((i) => namehash(`seat-${i}.${PARENT_NAME}`))

// état partagé entre les étapes (les `it` d'un fichier vitest s'exécutent en séquence)
const memberKeys: StealthKeys[] = []
const stealthAccounts: PrivateKeyAccount[] = [] // compte furtif COURANT de chaque membre

async function deploy(file: string, name: string, args: unknown[] = []): Promise<Address> {
  const { abi, bytecode } = artifact(file, name)
  const hash = await wallet(admin).deployContract({ abi, bytecode, args })
  const rcpt = await publicClient.waitForTransactionReceipt({ hash })
  return rcpt.contractAddress!
}

async function write(address: Address, abi: Abi, functionName: string, args: unknown[], account = admin) {
  const hash = await wallet(account).writeContract({ address, abi, functionName, args })
  return publicClient.waitForTransactionReceipt({ hash })
}

async function read<T>(address: Address, abi: Abi, functionName: string, args: unknown[] = []): Promise<T> {
  return publicClient.readContract({ address, abi, functionName, args }) as Promise<T>
}

async function scanEvents(): Promise<SeatAssignedEvent[]> {
  const logs = await publicClient.getLogs({ address: vault, event: seatAssignedEvent, fromBlock: 0n })
  return logs.map((l) => ({
    node: l.args.node!,
    stealthAddress: l.args.stealthAddress!,
    ephemeralPubKey: l.args.ephemeralPubKey! as Hex,
    viewTag: l.args.viewTag!,
    blockNumber: l.blockNumber,
    logIndex: l.logIndex,
  }))
}

async function execDigest(to: Address, value: bigint, nonce: bigint): Promise<Hex> {
  return read<Hex>(vault, vaultAbi, 'executeDigest', [to, value, '0x', nonce])
}

/** Signe le digest avec les comptes furtifs donnés, trie par adresse croissante. */
async function signSorted(digest: Hex, accounts: PrivateKeyAccount[]): Promise<Hex[]> {
  const signed = await Promise.all(
    accounts.map(async (a) => ({ addr: a.address.toLowerCase(), sig: await a.sign({ hash: digest }) })),
  )
  signed.sort((x, y) => (x.addr < y.addr ? -1 : 1))
  return signed.map((s) => s.sig)
}

beforeAll(async () => {
  anvil = spawn('anvil', ['--port', '8546', '--silent'], { env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` } })
  // attendre que le RPC réponde
  for (let i = 0; ; i++) {
    try {
      await publicClient.getBlockNumber()
      break
    } catch {
      if (i > 100) throw new Error('anvil ne démarre pas')
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  registry = await deploy('ENSMocks.sol', 'MockENSRegistry')
  resolver = await deploy('ENSMocks.sol', 'MockAddrResolver')
  wrapper = await deploy('ENSMocks.sol', 'MockNameWrapper')
  ;({ abi: registryAbi } = artifact('ENSMocks.sol', 'MockENSRegistry'))
  ;({ abi: resolverAbi } = artifact('ENSMocks.sol', 'MockAddrResolver'))
  ;({ abi: wrapperAbi } = artifact('ENSMocks.sol', 'MockNameWrapper'))

  // le nom parent appartient à admin — c'est tout son droit de nommer
  await write(wrapper, wrapperAbi, 'setData', [BigInt(parentNode), admin.address, 0, FAR_FUTURE])

  vault = await deploy('GoraVault.sol', 'GoraVault', [registry, wrapper, parentNode, 3n])
  ;({ abi: vaultAbi } = artifact('GoraVault.sol', 'GoraVault'))

  // le coffre reçoit des fonds
  const hash = await wallet(admin).sendTransaction({ to: vault, value: parseEther('5') })
  await publicClient.waitForTransactionReceipt({ hash })
}, 120_000)

afterAll(() => {
  anvil?.kill()
})

describe('GORA bout-en-bout sur anvil', () => {
  it('§5.2 — la dérivation des clés est déterministe pour les 5 membres', async () => {
    for (const m of members) {
      const sig1 = await m.signMessage({ message: DERIVATION_MESSAGE })
      const sig2 = await m.signMessage({ message: DERIVATION_MESSAGE })
      expect(sig1).toBe(sig2) // RFC 6979 — la contrainte impérative du §5.2
      memberKeys.push(deriveKeys(sig1))
    }
    expect(memberKeys).toHaveLength(5)
  })

  it('§5.3 — le propriétaire du nom parent nomme les 5 postes', async () => {
    for (let i = 0; i < 5; i++) {
      const node = seatNodes[i]
      // ce que fait le NameWrapper réel à la création du sous-nom wrappé :
      await write(wrapper, wrapperAbi, 'setData', [BigInt(node), admin.address, 0, FAR_FUTURE])
      await write(registry, registryAbi, 'setResolver', [node, resolver])

      // dérivation locale côté nommant — r vit et meurt dans generateStealthAddress
      const ann = generateStealthAddress(memberKeys[i].metaAddress)
      await write(resolver, resolverAbi, 'setAddr', [node, ann.stealthAddress])
      await write(vault, vaultAbi, 'assignSeat', [node, ann.ephemeralPubKey, ann.viewTag])
    }
    expect(await read<bigint>(vault, vaultAbi, 'seatCount')).toBe(5n)
    expect(await read<bigint>(vault, vaultAbi, 'activeSignerCount')).toBe(5n)
  })

  it('§5.4 — chaque membre détecte son poste, rien que le sien, sans avoir rien reçu', async () => {
    const events = await scanEvents()
    expect(events).toHaveLength(5)

    for (let i = 0; i < 5; i++) {
      const seats = findMySeats(events, memberKeys[i])
      expect(seats, `${MEMBER_NAMES[i]} doit détecter exactement 1 poste`).toHaveLength(1)
      expect(seats[0].node).toBe(seatNodes[i])

      // recalcul de p_stealth — l'adresse de la clé DOIT être l'adresse annoncée
      const pk = stealthPrivateKey(memberKeys[i].p, seats[0].s)
      const acct = privateKeyToAccount(pk)
      expect(acct.address).toBe(seats[0].assignment.stealthAddress)
      stealthAccounts.push(acct)
    }
  })

  it('§6.4 — le digest EIP-712 calculé en TS est identique à celui du contrat', async () => {
    const to = stranger.address
    const digestSol = await execDigest(to, parseEther('1'), 0n)
    const digestTs = hashTypedData({
      domain: { name: 'GORA', version: '1', chainId: foundry.id, verifyingContract: vault },
      types: {
        Execute: [
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'dataHash', type: 'bytes32' },
          { name: 'nonce', type: 'uint256' },
        ],
      },
      primaryType: 'Execute',
      message: { to, value: parseEther('1'), dataHash: hashTypedDataDataHash(), nonce: 0n },
    })
    expect(digestTs).toBe(digestSol)

    function hashTypedDataDataHash(): Hex {
      // keccak256 des données vides — data = "0x"
      return '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'
    }
  })

  it('§10.4 — 3 signatures sur 5, exécutées par un wallet qui n’est PAS signataire', async () => {
    const to = '0x00000000000000000000000000000000DemoBeef'.toLowerCase() as Address
    const recipient = '0x000000000000000000000000000000000000bEEF' as Address
    void to
    const before = await publicClient.getBalance({ address: recipient })

    const digest = await execDigest(recipient, parseEther('1'), 0n)
    const sigs = await signSorted(digest, [stealthAccounts[0], stealthAccounts[1], stealthAccounts[2]])

    // vérification de recouvrement locale avant envoi (ce que fera le front)
    for (const sig of sigs) {
      const rec = await recoverAddress({ hash: digest, signature: sig })
      expect(stealthAccounts.map((a) => a.address)).toContain(rec)
    }

    await write(vault, vaultAbi, 'execute', [recipient, parseEther('1'), '0x', 0n, sigs], stranger)

    expect(await publicClient.getBalance({ address: recipient })).toBe(before + parseEther('1'))
    expect(await read<bigint>(vault, vaultAbi, 'nonce')).toBe(1n)
  })

  it('§5.7 — rotation : l’ancienne adresse meurt, le mandat survit, la nouvelle clé signe', async () => {
    const oldAddress = stealthAccounts[0].address

    // rotation de seat-1 = setAddr + assignSeat sur le même nœud, rien d'autre
    const ann = generateStealthAddress(memberKeys[0].metaAddress)
    await write(resolver, resolverAbi, 'setAddr', [seatNodes[0], ann.stealthAddress])
    await write(vault, vaultAbi, 'assignSeat', [seatNodes[0], ann.ephemeralPubKey, ann.viewTag])

    // pas de poste dupliqué, ancienne adresse morte À LA TRANSACTION PRÈS
    expect(await read<bigint>(vault, vaultAbi, 'seatCount')).toBe(5n)
    expect(await read<boolean>(vault, vaultAbi, 'isActiveSigner', [oldAddress])).toBe(false)
    expect(await read<boolean>(vault, vaultAbi, 'isActiveSigner', [ann.stealthAddress])).toBe(true)

    // alice rescanne : même poste, nouvelle adresse, 2 événements sur le nœud (§5.4)
    const events = await scanEvents()
    const seats = findMySeats(events, memberKeys[0])
    expect(seats).toHaveLength(1)
    expect(seats[0].node).toBe(seatNodes[0])
    expect(seats[0].assignment.stealthAddress).toBe(ann.stealthAddress)
    expect(seats[0].assignmentCount).toBe(2)

    // et la clé recalculée signe
    stealthAccounts[0] = privateKeyToAccount(stealthPrivateKey(memberKeys[0].p, seats[0].s))
    expect(stealthAccounts[0].address).toBe(ann.stealthAddress)

    const recipient = '0x000000000000000000000000000000000000bEEF' as Address
    const digest = await execDigest(recipient, parseEther('1'), 1n)
    const sigs = await signSorted(digest, [stealthAccounts[0], stealthAccounts[3], stealthAccounts[4]])
    await write(vault, vaultAbi, 'execute', [recipient, parseEther('1'), '0x', 1n, sigs], stranger)
    expect(await read<bigint>(vault, vaultAbi, 'nonce')).toBe(2n)
  })

  it('§10.9 — expiration : personne ne révoque, le pouvoir s’éteint tout seul', async () => {
    const block = await publicClient.getBlock()

    // seat-2 (bob) expire dans 30 secondes
    await write(wrapper, wrapperAbi, 'setData', [BigInt(seatNodes[1]), admin.address, 0, block.timestamp + 30n])
    expect(await read<boolean>(vault, vaultAbi, 'isActiveSigner', [stealthAccounts[1].address])).toBe(true)

    // on laisse passer 60 secondes — AUCUNE transaction de révocation
    await testClient.increaseTime({ seconds: 60 })
    await testClient.mine({ blocks: 1 })

    expect(await read<boolean>(vault, vaultAbi, 'isActiveSigner', [stealthAccounts[1].address])).toBe(false)
    expect(await read<bigint>(vault, vaultAbi, 'activeSignerCount')).toBe(4n)

    // un lot contenant la signature du poste expiré est rejeté
    const recipient = '0x000000000000000000000000000000000000bEEF' as Address
    const digest = await execDigest(recipient, parseEther('1'), 2n)
    const withExpired = await signSorted(digest, [stealthAccounts[1], stealthAccounts[2], stealthAccounts[3]])
    await expect(
      write(vault, vaultAbi, 'execute', [recipient, parseEther('1'), '0x', 2n, withExpired], stranger),
    ).rejects.toThrow(/NotASigner/)

    // sans lui, avec 3 postes encore actifs, tout passe
    const valid = await signSorted(digest, [stealthAccounts[0], stealthAccounts[2], stealthAccounts[3]])
    await write(vault, vaultAbi, 'execute', [recipient, parseEther('1'), '0x', 2n, valid], stranger)
    expect(await read<bigint>(vault, vaultAbi, 'nonce')).toBe(3n)
  })
})
