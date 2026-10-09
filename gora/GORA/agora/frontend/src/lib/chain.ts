/** Lectures on-chain partagées par les écrans. */
import { createPublicClient, namehash, type Address, type Hex } from 'viem'
import { config, parentNode, seatNodes, seatLabels } from '../config'
import { chain, transport } from '../wagmi'
import { registryAbi, resolverAbi, seatAssignedEvent, vaultAbi, wrapperAbi } from '../abi'
import type { SeatAssignedEvent } from './scan'

// batch multicall : les 5 seatInfo + les lectures du coffre partent en UNE requête.
// Sur un RPC public, c'est la différence entre une démo fluide et un écran figé.
export const publicClient = createPublicClient({
  chain,
  transport,
  batch: { multicall: true },
})

/** Les fuses du NameWrapper qu'on sait nommer (§4). */
const FUSE_NAMES: [number, string][] = [
  [1, 'CANNOT_UNWRAP'],
  [2, 'CANNOT_BURN_FUSES'],
  [4, 'CANNOT_TRANSFER'],
  [8, 'CANNOT_SET_RESOLVER'],
  [16, 'CANNOT_SET_TTL'],
  [32, 'CANNOT_CREATE_SUBDOMAIN'],
  [64, 'CANNOT_APPROVE'],
  [0x10000, 'PARENT_CANNOT_CONTROL'],
  [0x20000, 'IS_DOT_ETH'],
  [0x40000, 'CAN_EXTEND_EXPIRY'],
]

export function fuseNames(fuses: number): string[] {
  return FUSE_NAMES.filter(([bit]) => (fuses & bit) !== 0).map(([, name]) => name)
}

export interface SeatView {
  label: string
  node: Hex
  registered: boolean
  stealthAddress: Address
  fuses: number
  expiry: bigint
  active: boolean
  rotations: number // nombre d'événements - 1
}

export async function fetchSeatEvents(): Promise<SeatAssignedEvent[]> {
  const logs = await publicClient.getLogs({
    address: config.vault,
    event: seatAssignedEvent,
    fromBlock: config.deployBlock,
  })
  return logs.map((l) => ({
    node: l.args.node!,
    stealthAddress: l.args.stealthAddress!,
    ephemeralPubKey: l.args.ephemeralPubKey! as Hex,
    viewTag: l.args.viewTag!,
    blockNumber: l.blockNumber,
    logIndex: l.logIndex,
  }))
}

/** Clé du text record du nom PARENT portant la liste des membres. */
export const MEMBERS_RECORD_KEY = 'gora-members'

/**
 * La liste des membres — publiée en vrac au niveau du coffre, jamais poste
 * par poste : le corps est public, l'assignation membre↔poste ne l'est pas (§2).
 */
export async function fetchMembers(): Promise<string[]> {
  const resolverAddr = await publicClient.readContract({
    address: config.ensRegistry,
    abi: registryAbi,
    functionName: 'resolver',
    args: [parentNode],
  })
  if (resolverAddr === '0x0000000000000000000000000000000000000000') return []
  const raw = await publicClient.readContract({
    address: resolverAddr,
    abi: resolverAbi,
    functionName: 'text',
    args: [parentNode, MEMBERS_RECORD_KEY],
  })
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function fetchSeats(): Promise<SeatView[]> {
  const events = await fetchSeatEvents()
  const byNode = new Map<Hex, SeatAssignedEvent[]>()
  for (const ev of events) {
    const arr = byNode.get(ev.node) ?? []
    arr.push(ev)
    byNode.set(ev.node, arr)
  }

  const views = await Promise.all(
    seatNodes.map(async (node, i): Promise<SeatView> => {
      const [registered, stealthAddress, fuses, expiry, active] = await publicClient.readContract({
        address: config.vault,
        abi: vaultAbi,
        functionName: 'seatInfo',
        args: [node],
      })
      const evs = byNode.get(node) ?? []
      return {
        label: seatLabels[i],
        node,
        registered,
        stealthAddress,
        fuses,
        expiry,
        active,
        rotations: Math.max(0, evs.length - 1),
      }
    }),
  )
  return views
}

export async function fetchVaultMeta() {
  const [threshold, nonce, activeSigners, parentOwner, parentData, emergencyQueuedAt, emergencyDelay] = await Promise.all([
    publicClient.readContract({ address: config.vault, abi: vaultAbi, functionName: 'threshold' }),
    publicClient.readContract({ address: config.vault, abi: vaultAbi, functionName: 'nonce' }),
    publicClient.readContract({ address: config.vault, abi: vaultAbi, functionName: 'activeSignerCount' }),
    publicClient.readContract({
      address: config.nameWrapper,
      abi: wrapperAbi,
      functionName: 'ownerOf',
      args: [BigInt(parentNode)],
    }),
    publicClient.readContract({
      address: config.nameWrapper,
      abi: wrapperAbi,
      functionName: 'getData',
      args: [BigInt(parentNode)],
    }),
    publicClient.readContract({ address: config.vault, abi: vaultAbi, functionName: 'emergencyQueuedAt' }),
    publicClient.readContract({ address: config.vault, abi: vaultAbi, functionName: 'EMERGENCY_DELAY' }),
  ])
  return {
    threshold,
    nonce,
    activeSigners,
    parentOwner,
    parentExpiry: parentData[2],
    emergencyQueuedAt,
    emergencyDelay,
  }
}

/**
 * Lit la méta-adresse d'un nom.
 * - entrée « st:eth:0x… » : utilisée telle quelle (secours démo, et mode anvil) ;
 * - entrée « anakin.eth » : lecture du text record via le résolveur du nom.
 */
export async function resolveMetaAddress(input: string): Promise<string> {
  const trimmed = input.trim()
  if (trimmed.startsWith('st:eth:0x')) return trimmed

  const node = namehash(trimmed)
  const resolverAddr = await publicClient.readContract({
    address: config.ensRegistry,
    abi: registryAbi,
    functionName: 'resolver',
    args: [node],
  })
  if (resolverAddr === '0x0000000000000000000000000000000000000000') {
    throw new Error(`${trimmed} has no resolver — does the name exist on this network? Make sure you registered it and set a resolver first.`)
  }
  const meta = await publicClient.readContract({
    address: resolverAddr,
    abi: resolverAbi,
    functionName: 'text',
    args: [node, 'stealth-meta-address'],
  })
  if (!meta) {
    throw new Error(
      `${trimmed} has no "stealth-meta-address" text record. The future signer must publish their meta-address first on the "My Role" screen.`,
    )
  }
  return meta
}

export function formatExpiry(expiry: bigint): string {
  if (expiry === 0n) return '—'
  if (expiry > 32_503_680_000n) return 'distant'
  return new Date(Number(expiry) * 1000).toLocaleString('en-GB', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function shortAddr(a: string): string {
  return `${a.slice(0, 8)}…${a.slice(-6)}`
}
