/**
 * Agora — scan des événements SeatAssigned (§5.4, §5.6).
 *
 * Pur : prend des événements déjà récupérés, ne parle pas au réseau.
 * Le scan naïf suffit ici — une poignée d'événements sur un seul contrat,
 * pas d'optimisation d'index (§5.6).
 */
import type { Address, Hex } from 'viem'
import { detectStealthAddress, type StealthAnnouncement, type StealthKeys } from './stealth'

export interface SeatAssignedEvent extends StealthAnnouncement {
  /** namehash du poste (seat-N.treasury.gora.eth) */
  node: Hex
  blockNumber: bigint
  logIndex: number
}
// NOTE : aucun nom de membre dans l'événement — délibéré. Le lier au nœud
// relierait publiquement un membre à une adresse (§2). La liste des membres
// vit dans le text record `gora-members` du nom parent.

export interface DetectedSeat {
  node: Hex
  assignment: SeatAssignedEvent
  /** scalaire partagé — permet de recalculer p_stealth = (p + s) mod n */
  s: bigint
  /** nombre total d'événements vus sur ce nœud (1 = jamais tourné) */
  assignmentCount: number
}

/**
 * ⚠️ Le piège de rotation (§5.4) : un poste peut porter plusieurs événements
 * SeatAssigned — un par nomination ou rotation. Il faut retenir LE PLUS
 * RÉCENT par nœud, sinon un titulaire dont l'adresse a tourné recalcule
 * une clé périmée et sa signature est rejetée.
 *
 * L'ordre chronologique est (blockNumber, logIndex), pas l'ordre du tableau.
 */
export function latestPerNode(events: SeatAssignedEvent[]): Map<Hex, SeatAssignedEvent> {
  const latest = new Map<Hex, SeatAssignedEvent>()
  for (const ev of events) {
    const prev = latest.get(ev.node)
    if (
      !prev ||
      ev.blockNumber > prev.blockNumber ||
      (ev.blockNumber === prev.blockNumber && ev.logIndex > prev.logIndex)
    ) {
      latest.set(ev.node, ev)
    }
  }
  return latest
}

/** Nombre d'événements par nœud — affiché comme « rotations » sur l'écran 1. */
export function assignmentCounts(events: SeatAssignedEvent[]): Map<Hex, number> {
  const counts = new Map<Hex, number>()
  for (const ev of events) counts.set(ev.node, (counts.get(ev.node) ?? 0) + 1)
  return counts
}

/**
 * Trouve mes postes parmi les événements. Ne teste que la dernière
 * affectation de chaque nœud — les précédentes sont périmées par définition.
 */
export function findMySeats(
  events: SeatAssignedEvent[],
  keys: Pick<StealthKeys, 'v' | 'spendPub'>,
): DetectedSeat[] {
  const counts = assignmentCounts(events)
  const seats: DetectedSeat[] = []
  for (const [node, assignment] of latestPerNode(events)) {
    const hit = detectStealthAddress(assignment, keys)
    if (hit) seats.push({ node, assignment, s: hit.s, assignmentCount: counts.get(node) ?? 1 })
  }
  return seats
}

/** L'adresse furtive active d'un signataire donné, ou null. */
export function myActiveAddress(seats: DetectedSeat[]): Address | null {
  return seats.length > 0 ? seats[0].assignment.stealthAddress : null
}
