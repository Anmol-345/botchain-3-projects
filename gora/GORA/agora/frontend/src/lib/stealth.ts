/**
 * Agora — module cryptographique pur (§5 du README).
 *
 * Aucune dépendance wallet, aucune dépendance réseau : tout est testable
 * en isolation. Ne pas toucher à l'UI tant que les tests de ce module
 * ne passent pas (§9, bloc 1).
 *
 * Courbe secp256k1, keccak256 partout, points compressés (33 octets)
 * sauf pour le calcul d'adresse.
 */
import { secp256k1 } from '@noble/curves/secp256k1'
import {
  bytesToHex,
  concat,
  getAddress,
  hexToBigInt,
  hexToBytes,
  keccak256,
  numberToHex,
  type Address,
  type Hex,
} from 'viem'

const Point = secp256k1.Point
type PointT = InstanceType<typeof Point>
const N = secp256k1.CURVE.n // ordre de la courbe

/** §5.2 — le message fixe signé une fois pour dériver toutes les clés. */
export const DERIVATION_MESSAGE = 'GORA key derivation v1'

/** Clé du text record ENS portant la méta-adresse (§4 — proposition, pas un ENSIP ratifié). */
export const META_ADDRESS_RECORD_KEY = 'stealth-meta-address'

export interface StealthKeys {
  /** clé de dépense privée */
  p: bigint
  /** clé de vue privée */
  v: bigint
  /** P = p·G, compressée, 33 octets */
  spendPub: Hex
  /** V = v·G, compressée, 33 octets */
  viewPub: Hex
  /** méta-adresse publiable : st:eth:0x‖P‖V */
  metaAddress: string
}

export interface StealthAnnouncement {
  /** l'adresse furtive inscrite dans le record addr du poste */
  stealthAddress: Address
  /** R = r·G, compressée, 33 octets */
  ephemeralPubKey: Hex
  /** premier octet de keccak256(S) — filtre rapide de détection */
  viewTag: number
}

// ——— helpers internes ————————————————————————————————————————

function bytesToBigint(b: Uint8Array): bigint {
  return hexToBigInt(bytesToHex(b))
}

function mod(a: bigint, m: bigint): bigint {
  const r = a % m
  return r >= 0n ? r : r + m
}

/** Aléa scalaire par rejet — crypto.getRandomValues, comme exigé §5.3. */
function randomScalar(): bigint {
  const buf = new Uint8Array(32)
  for (;;) {
    crypto.getRandomValues(buf)
    const k = bytesToBigint(buf)
    if (k > 0n && k < N) return k
  }
}

/** Adresse Ethereum d'un point public : keccak du point non compressé sans son préfixe. */
function pointToAddress(P: PointT): Address {
  const uncompressed = P.toBytes(false) // 65 octets, préfixe 0x04
  const hash = keccak256(uncompressed.slice(1))
  return getAddress(`0x${hash.slice(-40)}`)
}

/** keccak256(S_compressé) → (scalaire mod n, premier octet brut du hash). */
function sharedSecretScalar(S: PointT): { s: bigint; tag: number } {
  const hash = keccak256(S.toBytes(true))
  const s = mod(hexToBigInt(hash), N)
  if (s === 0n) throw new Error('shared secret scalar is zero — regénérer')
  return { s, tag: hexToBytes(hash)[0] }
}

// ——— §5.2 dérivation déterministe ———————————————————————————————

/**
 * Dérive les deux paires de clés depuis la signature EIP-191 du message fixe.
 * La signature DOIT être déterministe (RFC 6979) — à vérifier sur le wallet
 * visé avant tout le reste (§9, bloc 0).
 */
export function deriveKeys(signature: Hex): StealthKeys {
  const sig = hexToBytes(signature)
  const p = mod(hexToBigInt(keccak256(concat([sig, new Uint8Array([0x01])]))), N)
  const v = mod(hexToBigInt(keccak256(concat([sig, new Uint8Array([0x02])]))), N)
  if (p === 0n || v === 0n) throw new Error('clé dérivée nulle — signature invalide')

  const spendPub = bytesToHex(Point.BASE.multiply(p).toBytes(true))
  const viewPub = bytesToHex(Point.BASE.multiply(v).toBytes(true))
  return { p, v, spendPub, viewPub, metaAddress: encodeMetaAddress(spendPub, viewPub) }
}

// ——— méta-adresse ————————————————————————————————————————————

/** st:eth:0x + P(33o) + V(33o) = 132 caractères hex après 0x (§4). */
export function encodeMetaAddress(spendPub: Hex, viewPub: Hex): string {
  return `st:eth:0x${spendPub.slice(2)}${viewPub.slice(2)}`
}

export function parseMetaAddress(meta: string): { spendPub: PointT; viewPub: PointT } {
  const m = /^st:eth:0x([0-9a-fA-F]{132})$/.exec(meta.trim())
  if (!m) throw new Error(`méta-adresse invalide : attendu st:eth:0x + 132 hex, reçu « ${meta} »`)
  const raw = hexToBytes(`0x${m[1]}`)
  // fromBytes valide que les points sont bien sur la courbe
  return { spendPub: Point.fromBytes(raw.slice(0, 33)), viewPub: Point.fromBytes(raw.slice(33, 66)) }
}

// ——— §5.3 nomination, côté de celui qui nomme ———————————————————————

/**
 * Génère une adresse furtive pour la méta-adresse donnée.
 *
 * L'aléa r vit uniquement dans la portée de cette fonction : il n'est ni
 * retourné, ni journalisé, ni stocké. Quiconque connaît r peut reconstituer
 * la correspondance (§5.3) — c'est aussi pourquoi cette dérivation ne peut
 * pas être faite par un contrat.
 */
export function generateStealthAddress(metaAddress: string): StealthAnnouncement {
  const { spendPub, viewPub } = parseMetaAddress(metaAddress)

  const r = randomScalar() // ← ne sort jamais d'ici
  const R = Point.BASE.multiply(r)
  const S = viewPub.multiply(r)
  const { s, tag } = sharedSecretScalar(S)
  const stealthPub = spendPub.add(Point.BASE.multiply(s))

  return {
    stealthAddress: pointToAddress(stealthPub),
    ephemeralPubKey: bytesToHex(R.toBytes(true)),
    viewTag: tag,
  }
  // r sort de portée ici. DÉTRUIRE r — non négociable (§5.3, étape 8).
}

// ——— §5.4 détection, côté signataire ————————————————————————————

/**
 * Teste si une annonce m'appartient. Renvoie le scalaire partagé s si oui
 * (nécessaire pour signer), null sinon.
 *
 * v·R = v·(r·G) = r·(v·G) = r·V : même point des deux côtés.
 */
export function detectStealthAddress(
  announcement: StealthAnnouncement,
  keys: Pick<StealthKeys, 'v' | 'spendPub'>,
): { s: bigint } | null {
  const R = Point.fromBytes(hexToBytes(announcement.ephemeralPubKey))
  const S = R.multiply(keys.v)
  const { s, tag } = sharedSecretScalar(S)

  if (tag !== announcement.viewTag) return null // filtre rapide, 1 octet

  const spendPub = Point.fromBytes(hexToBytes(keys.spendPub))
  const stealthPub = spendPub.add(Point.BASE.multiply(s))
  if (pointToAddress(stealthPub) !== getAddress(announcement.stealthAddress)) return null

  return { s }
}

// ——— §5.5 signature, côté signataire ————————————————————————————

/**
 * p_stealth = (p + s) mod n. Jamais persistée : recalculée à chaque session.
 * Cette clé SIGNE des messages EIP-712, elle n'émet jamais de transaction (§1).
 */
export function stealthPrivateKey(p: bigint, s: bigint): Hex {
  const k = mod(p + s, N)
  if (k === 0n) throw new Error('clé furtive nulle')
  return numberToHex(k, { size: 32 })
}
