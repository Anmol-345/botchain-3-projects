/**
 * Tests du bloc 1 (§9) : la cryptographie, isolée.
 * « Ne pas toucher à l'UI tant que ce test ne passe pas. »
 */
import { describe, expect, it } from 'vitest'
import { privateKeyToAccount } from 'viem/accounts'
import { getAddress, hashTypedData, recoverAddress, type Hex } from 'viem'

import {
  DERIVATION_MESSAGE,
  deriveKeys,
  detectStealthAddress,
  encodeMetaAddress,
  generateStealthAddress,
  parseMetaAddress,
  stealthPrivateKey,
} from '../src/lib/stealth'

// Une signature EIP-191 fixe (65 octets) simulant personal_sign du message fixe.
// N'importe quelle valeur de 65 octets convient : on teste la dérivation, pas le wallet.
const FAKE_SIG = ('0x' + 'ab'.repeat(64) + '1b') as Hex
const OTHER_SIG = ('0x' + 'cd'.repeat(64) + '1c') as Hex

describe('§5.2 dérivation déterministe', () => {
  it('même signature → mêmes clés, signatures différentes → clés différentes', () => {
    const a = deriveKeys(FAKE_SIG)
    const b = deriveKeys(FAKE_SIG)
    const c = deriveKeys(OTHER_SIG)
    expect(a.p).toBe(b.p)
    expect(a.v).toBe(b.v)
    expect(a.metaAddress).toBe(b.metaAddress)
    expect(a.p).not.toBe(c.p)
  })

  it('clé de dépense ≠ clé de vue', () => {
    const k = deriveKeys(FAKE_SIG)
    expect(k.p).not.toBe(k.v)
    expect(k.spendPub).not.toBe(k.viewPub)
  })

  it('le message de dérivation est celui du README', () => {
    expect(DERIVATION_MESSAGE).toBe('GORA key derivation v1')
  })
})

describe('méta-adresse (§4)', () => {
  it('aller-retour encode/parse', () => {
    const k = deriveKeys(FAKE_SIG)
    expect(k.metaAddress.startsWith('st:eth:0x')).toBe(true)
    expect(k.metaAddress.length).toBe('st:eth:0x'.length + 132)
    const parsed = parseMetaAddress(k.metaAddress)
    expect(encodeMetaAddress(k.spendPub, k.viewPub)).toBe(k.metaAddress)
    // les points reparsés retombent sur les mêmes octets compressés
    expect(Buffer.from(parsed.spendPub.toBytes(true)).toString('hex')).toBe(k.spendPub.slice(2))
  })

  it('rejette les formats invalides', () => {
    expect(() => parseMetaAddress('st:eth:0x1234')).toThrow()
    expect(() => parseMetaAddress('0x' + 'aa'.repeat(66))).toThrow()
    // 132 hex mais point hors courbe (préfixe 0x05 invalide pour un point compressé)
    expect(() => parseMetaAddress('st:eth:0x' + '05' + '00'.repeat(32) + '02' + '00'.repeat(32))).toThrow()
  })
})

describe('§5.3 + §5.4 aller-retour génération → détection', () => {
  it("le titulaire détecte l'adresse générée pour lui, et personne d'autre", () => {
    const alice = deriveKeys(FAKE_SIG)
    const eve = deriveKeys(OTHER_SIG)

    const ann = generateStealthAddress(alice.metaAddress)

    const hitAlice = detectStealthAddress(ann, alice)
    expect(hitAlice).not.toBeNull()

    const hitEve = detectStealthAddress(ann, eve)
    expect(hitEve).toBeNull()
  })

  it("deux générations pour la même méta-adresse donnent deux adresses différentes (c'est la rotation)", () => {
    const alice = deriveKeys(FAKE_SIG)
    const a1 = generateStealthAddress(alice.metaAddress)
    const a2 = generateStealthAddress(alice.metaAddress)
    expect(a1.stealthAddress).not.toBe(a2.stealthAddress)
    // et Alice détecte les deux
    expect(detectStealthAddress(a1, alice)).not.toBeNull()
    expect(detectStealthAddress(a2, alice)).not.toBeNull()
  })
})

describe('§5.5 la clé furtive contrôle bien l’adresse furtive', () => {
  it('adresse(point) == adresse(clé privée recalculée) — le test le plus important du module', () => {
    const alice = deriveKeys(FAKE_SIG)
    const ann = generateStealthAddress(alice.metaAddress)
    const hit = detectStealthAddress(ann, alice)!
    expect(hit).not.toBeNull()

    const pk = stealthPrivateKey(alice.p, hit.s)
    const account = privateKeyToAccount(pk)
    // l'adresse dérivée de la clé privée doit être EXACTEMENT l'adresse annoncée
    expect(account.address).toBe(getAddress(ann.stealthAddress))
  })

  it('une signature EIP-712 de cette clé se recouvre vers l’adresse furtive', async () => {
    const alice = deriveKeys(FAKE_SIG)
    const ann = generateStealthAddress(alice.metaAddress)
    const hit = detectStealthAddress(ann, alice)!
    const account = privateKeyToAccount(stealthPrivateKey(alice.p, hit.s))

    // le type Execute exact du contrat (§6.4)
    const digest = hashTypedData({
      domain: {
        name: 'GORA',
        version: '1',
        chainId: 11155111,
        verifyingContract: '0x0000000000000000000000000000000000000001',
      },
      types: {
        Execute: [
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'dataHash', type: 'bytes32' },
          { name: 'nonce', type: 'uint256' },
        ],
      },
      primaryType: 'Execute',
      message: {
        to: '0x000000000000000000000000000000000000bEEF',
        value: 1000000000000000n,
        dataHash: ('0x' + '00'.repeat(32)) as Hex,
        nonce: 0n,
      },
    })

    const signature = await account.sign({ hash: digest })
    const recovered = await recoverAddress({ hash: digest, signature })
    expect(recovered).toBe(getAddress(ann.stealthAddress))
  })
})
