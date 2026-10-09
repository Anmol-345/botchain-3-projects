/**
 * Transactions en attente de signatures — stockage local + export/import JSON
 * pour circuler entre navigateurs. Pas de backend (§7, écran 4).
 */
import type { Address, Hex } from 'viem'

export interface PendingTx {
  id: string
  to: Address
  value: string // wei, en string pour survivre à JSON
  data: Hex
  nonce: string
  createdAt: number
  signatures: { signer: Address; sig: Hex }[]
}

const KEY = 'gora-pending-v1'

function isValidTx(t: unknown): t is PendingTx {
  if (!t || typeof t !== 'object') return false
  const tx = t as Record<string, unknown>
  return (
    typeof tx.id === 'string' &&
    typeof tx.to === 'string' &&
    typeof tx.value === 'string' &&
    typeof tx.data === 'string' &&
    typeof tx.nonce === 'string' &&
    typeof tx.createdAt === 'number' &&
    Array.isArray(tx.signatures)
  )
}

export function loadPending(): PendingTx[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter(isValidTx)
  } catch {
    return []
  }
}

export function savePending(txs: PendingTx[]) {
  localStorage.setItem(KEY, JSON.stringify(txs))
}

export function upsertPending(tx: PendingTx) {
  const txs = loadPending()
  const i = txs.findIndex((t) => t.id === tx.id)
  if (i >= 0) txs[i] = tx
  else txs.push(tx)
  savePending(txs)
}

export function removePending(id: string) {
  savePending(loadPending().filter((t) => t.id !== id))
}

export function addSignature(id: string, signer: Address, sig: Hex) {
  const txs = loadPending()
  const tx = txs.find((t) => t.id === id)
  if (!tx) return
  if (!tx.signatures.some((s) => s.signer.toLowerCase() === signer.toLowerCase())) {
    tx.signatures.push({ signer, sig })
  }
  savePending(txs)
}

/**
 * Removes all pending transactions whose nonce is strictly less than the
 * on-chain nonce — they can never be executed.
 */
export function pruneStaleNonce(onChainNonce: bigint) {
  savePending(loadPending().filter((t) => BigInt(t.nonce) >= onChainNonce))
}

/** Fusionne un export venu d'un autre navigateur (id identique → union des signatures). */
export function importPending(json: string): number {
  let incoming: unknown[]
  try {
    incoming = JSON.parse(json)
    if (!Array.isArray(incoming)) throw new Error()
  } catch {
    throw new Error('Invalid format — expected a JSON array.')
  }
  const valid = incoming.filter(isValidTx)
  const txs = loadPending()
  let merged = 0
  for (const inc of valid) {
    const existing = txs.find((t) => t.id === inc.id)
    if (!existing) {
      txs.push(inc)
      merged++
    } else {
      for (const s of inc.signatures) {
        if (!existing.signatures.some((e) => e.signer.toLowerCase() === s.signer.toLowerCase())) {
          existing.signatures.push(s)
          merged++
        }
      }
    }
  }
  savePending(txs)
  return merged
}

/** Y a-t-il des signatures en attente sur ce nonce ? (grise le bouton de rotation, §7) */
export function hasPendingOnNonce(nonce: bigint): boolean {
  return loadPending().some((t) => BigInt(t.nonce) === nonce && t.signatures.length > 0)
}
