/**
 * Écran 2 — Nommer. Visible seulement si le wallet connecté possède le nom parent.
 *
 * Nomination : lecture de la méta-adresse → dérivation locale (r détruit) →
 * [création du sous-nom si besoin] → setAddr → assignSeat.
 * Rotation : mêmes étapes sur un poste occupé, sans toucher au nom ni à l'expiry.
 *
 * La liste des membres est gérée SÉPARÉMENT (text record du parent) : aucun nom
 * ne circule jamais avec un nœud de poste — c'est le cœur de la promesse (§2).
 */
import { useMemo, useState } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { namehash, type Hex } from 'viem'

import { config, parentNode, seatName } from '../config'
import { resolverAbi, vaultAbi, wrapperAbi } from '../abi'
import {
  MEMBERS_RECORD_KEY,
  fetchMembers,
  fetchSeats,
  fetchVaultMeta,
  publicClient,
  resolveMetaAddress,
  formatExpiry,
} from '../lib/chain'
import {
  META_ADDRESS_RECORD_KEY,
  generateStealthAddress,
  type StealthAnnouncement,
} from '../lib/stealth'
import { hasPendingOnNonce } from '../lib/pending'
import { recallNomination, rememberNomination, exportNominations, importNominations } from '../lib/nominations'

const DURATIONS = [
  { label: '24 h', seconds: 86_400n },
  { label: '7 d', seconds: 604_800n },
  { label: '30 d', seconds: 2_592_000n },
  { label: '1 yr', seconds: 31_536_000n },
  { label: '60 s (demo)', seconds: 60n },
]

export default function Nommer() {
  const { address, isConnected } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const queryClient = useQueryClient()

  const meta = useQuery({ queryKey: ['vaultMeta'], queryFn: fetchVaultMeta })
  const seats = useQuery({ queryKey: ['seats'], queryFn: fetchSeats })
  const members = useQuery({ queryKey: ['members'], queryFn: fetchMembers })

  const [signerName, setSignerName] = useState('')
  const [seatLabel, setSeatLabel] = useState('seat-1')
  const [durationIdx, setDurationIdx] = useState(0)
  const [newMember, setNewMember] = useState('')
  const [bulkMembers, setBulkMembers] = useState('')
  const [pubName, setPubName] = useState('')
  const [pubMeta, setPubMeta] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<StealthAnnouncement | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [importBook, setImportBook] = useState('')

  const isParentOwner =
    isConnected && meta.data && address?.toLowerCase() === meta.data.parentOwner.toLowerCase()

  const rotationLocked = useMemo(
    () => (meta.data ? hasPendingOnNonce(meta.data.nonce) : false),
    [meta.data],
  )

  if (!isConnected) return <Gate>Connect the wallet that owns {config.parentName}.</Gate>
  if (meta.isError || seats.isError)
    return (
      <Gate>
        Failed to read chain:{' '}
        {((meta.error ?? seats.error) as Error)?.message ?? 'unknown error'}
      </Gate>
    )
  // Keep on DATA, not on isLoading (cf. Organigramme).
  if (!meta.data || !seats.data) return <p className="text-white/50 italic">Reading…</p>
  if (!isParentOwner)
    return (
      <Gate>
        This wallet does not own <span className="mono">{config.parentName}</span> in the
        NameWrapper. The right to appoint IS the ownership of the name — there is no other
        admin list to consult.
      </Gate>
    )

  /** Writes the list of members to the parent's text record — separate action, in bulk. */
  async function writeMembers(names: string[]) {
    setError(null)
    setBusy('updating members registry…')
    try {
      const h = await writeContractAsync({
        address: config.publicResolver,
        abi: resolverAbi,
        functionName: 'setText',
        args: [parentNode, MEMBERS_RECORD_KEY, names.join(', ')],
      })
      await publicClient.waitForTransactionReceipt({ hash: h })
      queryClient.invalidateQueries({ queryKey: ['members'] })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function run(rotation: boolean, targetLabel: string, memberOverride?: string) {
    setError(null)
    setDone(null)
    setPreview(null)
    try {
      const label = targetLabel
      const node = namehash(seatName(label))
      const seat = seats.data!.find((s) => s.label === label)!
      const member = (memberOverride ?? signerName).trim()
      if (!member) throw new Error('Signer ENS name (or meta-address) is required')

      // 1 — Signer's meta-address (text record, or direct st:eth: fallback)
      setBusy('reading meta-address…')
      const metaAddr = await resolveMetaAddress(member)

      // 2 — LOCAL derivation. r is born and dies in this tab.
      const ann = generateStealthAddress(metaAddr)
      setPreview(ann)

      // 3 — Create wrapped subnode if necessary (appointment only)
      // An appointment ALWAYS grants a term: we write the chosen expiry, whether
      // the seat is new, expired, or being handed to someone else. Without this,
      // an expired seat could never be reused — ENS lets you extend an expiry,
      // never shorten it, so the seat would stay dead forever. A rotation never
      // touches the term (§5.7).
      if (!rotation) {
        const expiry = BigInt(Math.floor(Date.now() / 1000)) + DURATIONS[durationIdx].seconds
        const capped = expiry > meta.data!.parentExpiry ? meta.data!.parentExpiry : expiry
        setBusy(`creating ${seatName(label)} (expires ${formatExpiry(capped)})…`)
        const h = await writeContractAsync({
          address: config.nameWrapper,
          abi: wrapperAbi,
          functionName: 'setSubnodeRecord',
          args: [parentNode, label, address!, config.publicResolver, 0n, 0, capped],
        })
        await publicClient.waitForTransactionReceipt({ hash: h })
      }

      // 4 — Write stealth address to addr record
      setBusy('setAddr — writing stealth address…')
      const h2 = await writeContractAsync({
        address: config.publicResolver,
        abi: resolverAbi,
        functionName: 'setAddr',
        args: [node, ann.stealthAddress],
      })
      await publicClient.waitForTransactionReceipt({ hash: h2 })

      // 5 — On-chain announcement: address, R, viewTag. Never r, never S, never s.
      //     And NEVER the member's name: the event links nothing to nobody (§2).
      setBusy('assignSeat — announcing to vault…')
      const h3 = await writeContractAsync({
        address: config.vault,
        abi: vaultAbi,
        functionName: 'assignSeat',
        args: [node, ann.ephemeralPubKey as Hex, ann.viewTag],
      })
      await publicClient.waitForTransactionReceipt({ hash: h3 })

      // 6 — Appointer's PRIVATE address book (localStorage only — the limit §2, assumed)
      rememberNomination(node, member)

      setDone(
        rotation
          ? `Rotation of ${label} completed. The old address is no longer a signer. The holder won't notice a thing: same seat, same expiry.`
          : `Appointment made on ${label}. The holder can now detect their seat — without receiving anything. Add them to the members registry if they aren't there yet.`,
      )
      queryClient.invalidateQueries({ queryKey: ['seats'] })
      queryClient.invalidateQueries({ queryKey: ['vaultMeta'] })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-16 max-w-2xl">
      <section className="space-y-8">
        <h2 className="text-2xl font-light tracking-[0.2em] uppercase text-white/90">Appoint a Signer</h2>

        <label className="block text-sm">
          <span className="text-white/50 tracking-wide">
            Signer's ENS Name (or fallback st:eth:… meta-address)
          </span>
          <input
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="anakin.eth"
            className="mt-2 w-full border-b border-white/20 bg-transparent px-0 py-2 mono text-sm text-white/90 focus:border-white/60 focus:outline-none transition-colors placeholder:text-white/20"
          />
        </label>

        <div className="flex gap-8 flex-wrap">
          <label className="block text-sm flex-1 min-w-[200px]">
            <span className="text-white/50 tracking-wide">Seat</span>
            <select
              value={seatLabel}
              onChange={(e) => setSeatLabel(e.target.value)}
              className="mt-2 w-full border-b border-white/20 bg-transparent px-0 py-2 text-white/90 focus:border-white/60 focus:outline-none transition-colors appearance-none"
            >
              {seats.data!.map((s) => (
                <option key={s.label} value={s.label} className="bg-[#050810] text-white/80">
                  {s.label} {s.active ? '— occupied' : s.expiry === 0n ? '— to create' : '— available'}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm w-full">
            <span className="text-white/50 tracking-wide block mb-3">
              Term duration <span className="text-white/30 text-xs">(capped: {meta.data ? formatExpiry(meta.data.parentExpiry) : '…'})</span>
            </span>
            <div className="flex gap-3 flex-wrap">
              {DURATIONS.map((d, i) => (
                <button
                  key={d.label}
                  onClick={() => setDurationIdx(i)}
                  className={`px-4 py-1.5 rounded-full text-sm transition-all duration-300 ${
                    i === durationIdx 
                      ? 'bg-white/10 border border-white/40 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)] backdrop-blur-md' 
                      : 'border border-white/10 text-white/40 hover:bg-white/5 hover:text-white/70'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </label>
        </div>

        <button
          disabled={!!busy}
          onClick={() => run(false, seatLabel)}
          className="px-6 py-2 rounded-full border border-white/20 bg-white/5 text-sm tracking-wide text-white/70 hover:bg-white/20 hover:text-white hover:border-white/80 transition-all duration-500 shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,245,190,0.7)] hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none"
        >
          {busy ?? 'Appoint'}
        </button>
      </section>

      {preview && busy && (
        <div className="border-l-2 border-amber-500/50 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/80 backdrop-blur-md leading-relaxed">
          The randomness that links this name to the address{' '}
          <span className="mono text-amber-200">{preview.stealthAddress}</span> only exists in this tab and
          will be destroyed. It is neither logged, transmitted, nor written on-chain.
        </div>
      )}

      {done && <p className="border-l-2 border-emerald-500/50 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200/80 backdrop-blur-md leading-relaxed">{done}</p>}
      {error && <p className="border-l-2 border-red-500/50 bg-red-500/5 px-4 py-3 text-sm text-red-200/80 backdrop-blur-md leading-relaxed">{error}</p>}

      <EmergencyPanel meta={meta.data} writeContractAsync={writeContractAsync} />

      <section className="space-y-6 border-t border-white/10 pt-12">
        <div>
          <h3 className="text-sm font-light tracking-[0.2em] uppercase text-white/80 mb-2">Publish a Member's Meta-Address</h3>
          <p className="text-sm text-white/40 max-w-xl leading-relaxed">
            The future signer derives their keys on the "My Role" screen and sends you their
            meta-address <span className="mono text-white/60">st:eth:0x…</span> (public, reveals
            no private keys). You write it here on a name you own — after which you can
            appoint them using their ENS name.
          </p>
        </div>
        <div className="space-y-4 max-w-md">
          <input
            value={pubName}
            onChange={(e) => setPubName(e.target.value)}
            placeholder="anakin.eth"
            className="w-full border-b border-white/20 bg-transparent px-0 py-2 mono text-sm text-white/90 focus:border-white/60 focus:outline-none transition-colors placeholder:text-white/20"
          />
          <input
            value={pubMeta}
            onChange={(e) => setPubMeta(e.target.value)}
            placeholder="st:eth:0x…"
            className="w-full border-b border-white/20 bg-transparent px-0 py-2 mono text-sm text-white/90 focus:border-white/60 focus:outline-none transition-colors placeholder:text-white/20"
          />
          <button
            disabled={!!busy || !pubName.trim() || !pubMeta.trim().startsWith('st:eth:0x')}
            onClick={async () => {
              setError(null)
              setDone(null)
              setBusy('publishing meta-address…')
              try {
                const h = await writeContractAsync({
                  address: config.publicResolver,
                  abi: resolverAbi,
                  functionName: 'setText',
                  args: [namehash(pubName.trim()), META_ADDRESS_RECORD_KEY, pubMeta.trim()],
                })
                await publicClient.waitForTransactionReceipt({ hash: h })
                setDone(`Meta-address published on ${pubName.trim()}. You can now appoint them.`)
                setPubMeta('')
              } catch (e) {
                setError((e as Error).message)
              } finally {
                setBusy(null)
              }
            }}
            className="px-6 py-2 mt-4 rounded-full border border-white/20 bg-white/5 text-sm tracking-wide text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40 shadow-[0_0_15px_rgba(255,255,255,0.05)]"
          >
            Publish on this name
          </button>
        </div>
      </section>

      <section className="space-y-6 border-t border-white/10 pt-12">
        <div>
          <h3 className="text-sm font-light tracking-[0.2em] uppercase text-white/80 mb-2">Members Registry (Public, Bulk)</h3>
          <p className="text-sm text-white/40 max-w-xl leading-relaxed">
            Published in a text record on the vault's name — never seat by seat. We know{' '}
            <em className="text-white/60 not-italic">who</em> is a member; we don't know <em className="text-white/60 not-italic">who holds which seat</em>.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {(members.data ?? []).map((m) => (
            <span
              key={m}
              className="px-4 py-1.5 rounded-full bg-white/5 border border-white/20 text-white/80 text-sm shadow-[0_0_15px_rgba(255,255,255,0.05)] backdrop-blur-md flex items-center gap-2"
            >
              {m}
              <button
                className="text-white/30 hover:text-white transition-colors"
                title="Remove from registry"
                onClick={() => writeMembers((members.data ?? []).filter((x) => x !== m))}
              >
                ✕
              </button>
            </span>
          ))}
          {(members.data ?? []).length === 0 && (
            <span className="text-sm text-white/40 italic">empty registry</span>
          )}
        </div>
        <div className="flex gap-4 items-end max-w-md pt-4">
          <input
            value={newMember}
            onChange={(e) => setNewMember(e.target.value)}
            placeholder="anakin.eth"
            className="w-full border-b border-white/20 bg-transparent px-0 py-2 mono text-sm text-white/90 focus:border-white/60 focus:outline-none transition-colors placeholder:text-white/20"
          />
          <button
            disabled={!!busy || !newMember.trim()}
            onClick={() => {
              const list = [...(members.data ?? []), newMember.trim()]
              setNewMember('')
              writeMembers(Array.from(new Set(list)))
            }}
            className="px-6 py-2 rounded-full border border-white/20 bg-white/5 text-sm tracking-wide text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40 whitespace-nowrap shadow-[0_0_15px_rgba(255,255,255,0.05)]"
          >
            Add
          </button>
        </div>

        <details className="text-sm mt-4">
          <summary className="cursor-pointer text-white/50 hover:text-white/80 transition-colors tracking-wide">
            Replace the entire list in a single transaction
          </summary>
          <div className="mt-4 flex gap-4 items-end flex-wrap max-w-md">
            <input
              value={bulkMembers}
              onChange={(e) => setBulkMembers(e.target.value)}
              placeholder="anakin.eth, leia.eth, luc.eth, obi-wan.eth, padme.eth"
              className="w-full border-b border-white/20 bg-transparent px-0 py-2 mono text-sm text-white/90 focus:border-white/60 focus:outline-none transition-colors placeholder:text-white/20"
            />
            <button
              disabled={!!busy || !bulkMembers.trim()}
              onClick={() => {
                const list = bulkMembers
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
                setBulkMembers('')
                writeMembers(Array.from(new Set(list)))
              }}
              className="px-6 py-2 rounded-full border border-white/20 bg-white/5 text-sm tracking-wide text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40 whitespace-nowrap shadow-[0_0_15px_rgba(255,255,255,0.05)]"
            >
              Replace
            </button>
          </div>
        </details>
      </section>

      <section className="space-y-3 border-t border-white/10 pt-12">
        <h3 className="text-sm font-light tracking-[0.2em] uppercase text-white/80 mb-4">Rotate an Address (§5.7)</h3>
        <p className="text-sm text-white/40 max-w-xl leading-relaxed mb-6">
          Same node, new randomness: setAddr + assignSeat. The seat and its expiry do not
          change; the old address stops being a signer up to the transaction. The holder
          is retrieved via your local address book — data that only exists in this
          browser (§2).
        </p>
        {rotationLocked && (
          <div className="border-l-2 border-amber-500/50 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/80 backdrop-blur-md mb-6 leading-relaxed">
            Signatures are pending on the current nonce: rotating now would invalidate them.
            Execute or delete the pending transaction first.
          </div>
        )}
        <div className="flex gap-3 flex-wrap">
          {seats.data!
            .filter((s) => s.active)
            .map((s) => {
              const remembered = recallNomination(s.node)
              return (
                <button
                  key={s.label}
                  disabled={!!busy || rotationLocked || !remembered}
                  title={
                    remembered
                      ? `Holder (local book): ${remembered}`
                      : 'Holder unknown in this browser — re-appoint via the form above'
                  }
                  onClick={() => run(true, s.label, remembered!)}
                  className="px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm tracking-wide text-white/70 hover:bg-white/10 hover:text-white hover:border-white/40 transition-colors disabled:opacity-40"
                >
                  ↻ {s.label}
                </button>
              )
            })}
        </div>
      </section>

      <section className="space-y-4 border-t border-white/10 pt-12">
        <h3 className="text-sm font-light tracking-[0.2em] uppercase text-white/80 mb-2">Address Book Backup</h3>
        <p className="text-sm text-white/40 max-w-xl leading-relaxed">
          Your private address book (node → member) lives only in this browser's localStorage. Export it before clearing browser data — losing it disables the rotation buttons.
        </p>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => { navigator.clipboard.writeText(exportNominations()); setDone('Address book copied to clipboard.') }}
            className="px-5 py-2 rounded-full border border-white/20 bg-white/5 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            Export (copy)
          </button>
        </div>
        <div className="flex gap-3 items-end flex-wrap max-w-md pt-2">
          <input
            value={importBook}
            onChange={(e) => setImportBook(e.target.value)}
            placeholder="paste exported JSON…"
            className="flex-1 border-b border-white/20 bg-transparent px-0 py-2 mono text-sm text-white/90 focus:border-white/60 focus:outline-none transition-colors placeholder:text-white/20"
          />
          <button
            disabled={!importBook.trim()}
            onClick={() => {
              try {
                const n = importNominations(importBook)
                setImportBook('')
                setDone(`${n} nomination(s) merged into address book.`)
              } catch (e) {
                setError((e as Error).message)
              }
            }}
            className="px-5 py-2 rounded-full border border-white/20 bg-white/5 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40"
          >
            Import
          </button>
        </div>
      </section>
    </div>
  )
}

function Gate({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-white/20 bg-white/5 px-4 py-6 text-sm text-white/60 max-w-xl backdrop-blur-md">
      {children}
    </div>
  )
}

// ─── Emergency Panel ───────────────────────────────────────────────────────────
// Shown to the parent-name owner on Screen 2. Provides queue / cancel / execute
// for the 72-hour time-locked emergency withdrawal added to GoraVault.

import { useEffect, useState as _useState } from 'react'
import { config as _config } from '../config'
import { vaultAbi as _vaultAbi } from '../abi'
import { publicClient as _publicClient } from '../lib/chain'

function EmergencyPanel({
  meta,
  writeContractAsync,
}: {
  meta: { activeSigners: bigint; emergencyQueuedAt: bigint } | undefined
  writeContractAsync: ReturnType<typeof import('wagmi').useWriteContract>['writeContractAsync']
}) {
  const [now, setNow] = _useState(Math.floor(Date.now() / 1000))
  const [busy, setBusy] = _useState(false)
  const [err, setErr] = _useState<string | null>(null)
  const [msg, setMsg] = _useState<string | null>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  if (!meta) return null

  const DELAY = 72 * 3600 // 72 hours in seconds
  const queuedAt = Number(meta.emergencyQueuedAt)
  const isQueued = queuedAt > 0
  const executeAfter = queuedAt + DELAY
  const canExecute = isQueued && now >= executeAfter
  const remaining = isQueued ? Math.max(0, executeAfter - now) : 0
  const activeSigners = Number(meta.activeSigners)

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${h}h ${m}m ${sec}s`
  }

  async function action(fn: 'emergencyQueue' | 'emergencyWithdraw' | 'emergencyCancel') {
    setErr(null); setMsg(null); setBusy(true)
    try {
      const h = await writeContractAsync({
        address: _config.vault,
        abi: _vaultAbi,
        functionName: fn,
        args: [],
      })
      await _publicClient.waitForTransactionReceipt({ hash: h })
      setMsg(
        fn === 'emergencyQueue'    ? 'Emergency queued. Come back in 72 hours to withdraw.' :
        fn === 'emergencyWithdraw' ? 'Emergency withdrawal executed. Funds sent to your wallet.' :
                                     'Emergency cancelled.',
      )
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-4 border-t border-red-500/20 pt-12">
      <h3 className="text-sm font-light tracking-[0.2em] uppercase text-red-400/70 mb-2">Emergency Withdrawal</h3>
      <p className="text-sm text-white/40 max-w-xl leading-relaxed">
        Last resort only. If all active signers expire and the vault is frozen, the parent-name
        owner can queue a withdrawal. There is a <strong className="text-white/60">72-hour delay</strong> so signers
        can react. After the delay, the full vault balance is sent to this wallet.
      </p>

      {activeSigners > 0 && !isQueued && (
        <p className="text-xs text-amber-400/70 border-l-2 border-amber-500/30 pl-3">
          ⚠ There are {activeSigners} active signer(s) — emergency is not needed. Only use this if the vault is genuinely frozen.
        </p>
      )}

      <div className="flex gap-3 flex-wrap items-center">
        {!isQueued ? (
          <button
            disabled={busy}
            onClick={() => action('emergencyQueue')}
            className="px-5 py-2 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm tracking-wide disabled:opacity-40"
          >
            Queue emergency withdrawal
          </button>
        ) : (
          <>
            <div className="text-sm text-white/60">
              {canExecute ? (
                <span className="text-emerald-400">Delay elapsed — ready to execute.</span>
              ) : (
                <span>Time remaining: <span className="mono text-white/80">{fmt(remaining)}</span></span>
              )}
            </div>
            <button
              disabled={busy || !canExecute}
              onClick={() => action('emergencyWithdraw')}
              className="px-5 py-2 rounded-full border border-red-500/40 bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors text-sm tracking-wide disabled:opacity-40"
            >
              Execute withdrawal
            </button>
            <button
              disabled={busy}
              onClick={() => action('emergencyCancel')}
              className="px-5 py-2 rounded-full border border-white/10 text-white/40 hover:text-white/70 hover:border-white/30 transition-colors text-sm tracking-wide disabled:opacity-40"
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {msg && <p className="text-emerald-400 text-sm">{msg}</p>}
      {err && <p className="text-red-400 text-sm">{err}</p>}
    </section>
  )
}
