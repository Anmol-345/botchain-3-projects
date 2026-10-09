/**
 * Le piège de rotation (§5.4) : « le bug le plus probable de tout le projet ».
 * Un nœud peut porter plusieurs SeatAssigned ; seul le dernier compte.
 */
import { describe, expect, it } from 'vitest'
import type { Hex } from 'viem'

import { deriveKeys, generateStealthAddress } from '../src/lib/stealth'
import { assignmentCounts, findMySeats, latestPerNode, type SeatAssignedEvent } from '../src/lib/scan'

const SIG_ALICE = ('0x' + '11'.repeat(64) + '1b') as Hex
const SIG_BOB = ('0x' + '22'.repeat(64) + '1b') as Hex

const NODE_1 = ('0x' + 'a1'.repeat(32)) as Hex
const NODE_2 = ('0x' + 'b2'.repeat(32)) as Hex

function ev(
  node: Hex,
  meta: string,
  _label: string, // conservé pour la lisibilité des cas de test — n'existe plus dans l'événement (§2)
  blockNumber: bigint,
  logIndex: number,
): SeatAssignedEvent {
  return { node, blockNumber, logIndex, ...generateStealthAddress(meta) }
}

describe('latestPerNode', () => {
  it('retient le plus récent par (blockNumber, logIndex), pas l’ordre du tableau', () => {
    const alice = deriveKeys(SIG_ALICE)
    const first = ev(NODE_1, alice.metaAddress, 'anakin.eth', 10n, 0)
    const rotated = ev(NODE_1, alice.metaAddress, 'anakin.eth', 20n, 3)
    const sameBlockLater = ev(NODE_1, alice.metaAddress, 'anakin.eth', 20n, 7)

    // ordre volontairement mélangé
    const latest = latestPerNode([sameBlockLater, first, rotated])
    expect(latest.get(NODE_1)!.stealthAddress).toBe(sameBlockLater.stealthAddress)
    expect(latest.size).toBe(1)
  })
})

describe('findMySeats après rotation', () => {
  it('le titulaire retrouve son poste avec la NOUVELLE adresse, jamais l’ancienne', () => {
    const alice = deriveKeys(SIG_ALICE)
    const bob = deriveKeys(SIG_BOB)

    const aliceV1 = ev(NODE_1, alice.metaAddress, 'anakin.eth', 100n, 0)
    const aliceV2 = ev(NODE_1, alice.metaAddress, 'anakin.eth', 200n, 0) // rotation
    const bobV1 = ev(NODE_2, bob.metaAddress, 'leia.eth', 150n, 0)

    const events = [aliceV1, bobV1, aliceV2]

    const aliceSeats = findMySeats(events, alice)
    expect(aliceSeats).toHaveLength(1)
    expect(aliceSeats[0].node).toBe(NODE_1)
    expect(aliceSeats[0].assignment.stealthAddress).toBe(aliceV2.stealthAddress)
    expect(aliceSeats[0].assignmentCount).toBe(2) // affiché comme « 1 rotation »

    const bobSeats = findMySeats(events, bob)
    expect(bobSeats).toHaveLength(1)
    expect(bobSeats[0].node).toBe(NODE_2)
    expect(bobSeats[0].assignmentCount).toBe(1)
  })

  it('un poste réattribué à quelqu’un d’autre disparaît pour l’ancien titulaire', () => {
    const alice = deriveKeys(SIG_ALICE)
    const bob = deriveKeys(SIG_BOB)

    // alice avait NODE_1, puis le parent l'a réattribué à bob
    const events = [
      ev(NODE_1, alice.metaAddress, 'anakin.eth', 100n, 0),
      ev(NODE_1, bob.metaAddress, 'leia.eth', 200n, 0),
    ]

    expect(findMySeats(events, alice)).toHaveLength(0)
    const bobSeats = findMySeats(events, bob)
    expect(bobSeats).toHaveLength(1)
    expect(bobSeats[0].node).toBe(NODE_1)
  })
})

describe('assignmentCounts', () => {
  it('compte tous les événements, pas seulement le dernier', () => {
    const alice = deriveKeys(SIG_ALICE)
    const events = [
      ev(NODE_1, alice.metaAddress, 'a', 1n, 0),
      ev(NODE_1, alice.metaAddress, 'a', 2n, 0),
      ev(NODE_1, alice.metaAddress, 'a', 3n, 0),
      ev(NODE_2, alice.metaAddress, 'a', 1n, 1),
    ]
    const counts = assignmentCounts(events)
    expect(counts.get(NODE_1)).toBe(3)
    expect(counts.get(NODE_2)).toBe(1)
  })
})
