/**
 * Toute la configuration vient de l'environnement — AUCUNE valeur codée en dur
 * dans le code (critère de qualification de la track). Voir .env.example.
 */
import { namehash, type Address } from 'viem'

function env(key: string, fallback?: string): string {
  const v = import.meta.env[key] ?? fallback
  if (v === undefined) throw new Error(`variable d'environnement manquante : ${key}`)
  return v
}

/**
 * VITE_RPC_URL accepte plusieurs URL séparées par des virgules : la première
 * est primaire, les suivantes servent de secours automatique. Indispensable en
 * démo — les RPC publics limitent (eth_getLogs notamment) et lâchent sans
 * prévenir.
 */
const rpcUrls = env('VITE_RPC_URL')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

export const config = {
  chainId: Number(env('VITE_CHAIN_ID', '31337')),
  rpcUrls,
  rpcUrl: rpcUrls[0],
  vault: env('VITE_VAULT_ADDRESS') as Address,
  ensRegistry: env('VITE_ENS_REGISTRY') as Address,
  nameWrapper: env('VITE_NAME_WRAPPER') as Address,
  publicResolver: env('VITE_PUBLIC_RESOLVER') as Address,
  baseRegistrar: env('VITE_BASE_REGISTRAR', '0x0000000000000000000000000000000000000000') as Address,
  /** le coffre : treasury.gora.eth */
  parentName: env('VITE_PARENT_NAME'),
  seatCount: Number(env('VITE_SEAT_COUNT', '5')),
  deployBlock: BigInt(env('VITE_DEPLOY_BLOCK', '0')),
} as const

export const parentNode = namehash(config.parentName)

export const seatLabels = Array.from({ length: config.seatCount }, (_, i) => `seat-${i + 1}`)

export const seatName = (label: string) => `${label}.${config.parentName}`
export const seatNodes = seatLabels.map((l) => namehash(seatName(l)))

export const isAnvil = config.chainId === 31337
