/**
 * Carnet PRIVÉ du nommant : qui a été nommé sur quel poste.
 *
 * Vit uniquement dans le localStorage du navigateur de l'admin — jamais
 * on-chain, jamais partagé. C'est la matérialisation honnête de la limite §2.
 * Inclut export/import JSON pour survivre à un effacement de localStorage.
 */
import type { Hex } from 'viem'

const KEY = 'gora-nominations-v1'

type Book = Record<Hex, string> // node → nom du membre ("anakin.eth")

function load(): Book {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function rememberNomination(node: Hex, memberName: string) {
  const book = load()
  book[node] = memberName
  localStorage.setItem(KEY, JSON.stringify(book))
}

export function recallNomination(node: Hex): string | null {
  return load()[node] ?? null
}

export function forgetNomination(node: Hex) {
  const book = load()
  delete book[node]
  localStorage.setItem(KEY, JSON.stringify(book))
}

export function allNominations(): { node: Hex; member: string }[] {
  const book = load()
  return Object.entries(book).map(([node, member]) => ({ node: node as Hex, member }))
}

/** Exports the full address book as a JSON string for backup. */
export function exportNominations(): string {
  return JSON.stringify(load(), null, 2)
}

/** Merges an imported JSON backup into the current book. Returns number of entries merged. */
export function importNominations(json: string): number {
  let incoming: Book
  try {
    incoming = JSON.parse(json)
    if (typeof incoming !== 'object' || Array.isArray(incoming)) throw new Error()
  } catch {
    throw new Error('Invalid nominations backup — expected a JSON object.')
  }
  const book = load()
  let count = 0
  for (const [node, member] of Object.entries(incoming)) {
    if (!book[node as Hex]) count++
    book[node as Hex] = member
  }
  localStorage.setItem(KEY, JSON.stringify(book))
  return count
}
