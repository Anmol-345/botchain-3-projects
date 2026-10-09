/**
 * Screen 3 — My Role.
 *
 * Connect → sign derivation message → scan SeatAssigned events →
 * keep the most recent per node (§5.4) → detect → "you hold seat-N".
 *
 * Also handles:
 *  - ENS name registration (for new users without a name on this network)
 *  - Publishing the stealth meta-address text record
 *  - Wallet determinism test (§5.2)
 */
import { useState } from 'react'
import { useAccount, useSignMessage, useWriteContract } from 'wagmi'
import { keccak256, namehash, parseEther, toBytes } from 'viem'

import { config } from '../config'
import { baseRegistrarAbi, resolverAbi, wrapperAbi } from '../abi'
import { fetchSeatEvents, formatExpiry, publicClient, shortAddr } from '../lib/chain'
import { DERIVATION_MESSAGE, META_ADDRESS_RECORD_KEY, deriveKeys } from '../lib/stealth'
import { findMySeats } from '../lib/scan'
import { useSession } from '../session'
import { useQuery } from '@tanstack/react-query'
import { vaultAbi } from '../abi'
import { registryAbi } from '../abi'

const REGISTRATION_DURATION = 730n * 24n * 3600n // 2 years in seconds

export default function MonPoste() {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { writeContractAsync } = useWriteContract()
  const session = useSession()

  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [determinism, setDeterminism] = useState<'ok' | 'ko' | null>(null)
  const [publishName, setPublishName] = useState('')
  const [published, setPublished] = useState(false)

  // ENS name registration state
  const [registerLabel, setRegisterLabel] = useState('')
  const [registerStatus, setRegisterStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'registering' | 'done'>('idle')
  const [registerError, setRegisterError] = useState<string | null>(null)

  const seatDetails = useQuery({
    queryKey: ['myseats', session.seats.map((s) => s.node).join()],
    enabled: session.seats.length > 0,
    queryFn: async () =>
      Promise.all(
        session.seats.map(async (s) => {
          const [, , , expiry] = await publicClient.readContract({
            address: config.vault,
            abi: vaultAbi,
            functionName: 'seatInfo',
            args: [s.node],
          })
          return { node: s.node, expiry }
        }),
      ),
  })

  if (!isConnected) {
    return (
      <div className="border-l-2 border-white/20 bg-white/5 px-4 py-6 text-sm text-white/60 max-w-xl backdrop-blur-md">
        Connect your wallet. You have received nothing — no token, no message, no transaction. If a
        seat awaits you, it will be <em className="text-white/80 not-italic">calculated</em>, not found in a history.
      </div>
    )
  }

  async function testDeterminism() {
    setError(null)
    setBusy('testing determinism — signing the same message twice…')
    try {
      const sig1 = await signMessageAsync({ message: DERIVATION_MESSAGE })
      const sig2 = await signMessageAsync({ message: DERIVATION_MESSAGE })
      setDeterminism(sig1 === sig2 ? 'ok' : 'ko')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function detect() {
    setError(null)
    setBusy('derivation signature…')
    try {
      const sig = await signMessageAsync({ message: DERIVATION_MESSAGE })
      const keys = deriveKeys(sig)
      session.setKeys(keys)

      setBusy('scanning SeatAssigned events…')
      const events = await fetchSeatEvents()
      const seats = findMySeats(events, keys)
      session.setSeats(seats)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function publishMeta() {
    if (!session.keys) return
    setError(null)
    setBusy(`writing text record ${META_ADDRESS_RECORD_KEY}…`)
    try {
      const name = publishName.trim()
      if (!name.endsWith('.eth')) throw new Error('Name must end with .eth (e.g. alice.eth)')

      // Resolve which resolver this name uses
      const node = namehash(name)
      let resolverAddr = await publicClient.readContract({
        address: config.ensRegistry,
        abi: registryAbi,
        functionName: 'resolver',
        args: [node],
      })
      // Fall back to the public resolver if none is set
      if (resolverAddr === '0x0000000000000000000000000000000000000000') {
        resolverAddr = config.publicResolver
      }

      const h = await writeContractAsync({
        address: resolverAddr,
        abi: resolverAbi,
        functionName: 'setText',
        args: [node, META_ADDRESS_RECORD_KEY, session.keys.metaAddress],
      })
      await publicClient.waitForTransactionReceipt({ hash: h })
      setPublished(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function checkAvailability() {
    const label = registerLabel.trim().replace(/\.eth$/i, '')
    if (!label) return
    setRegisterError(null)
    setRegisterStatus('checking')
    try {
      if (config.baseRegistrar === '0x0000000000000000000000000000000000000000') {
        throw new Error('VITE_BASE_REGISTRAR is not configured for this network.')
      }
      const labelHash = BigInt(keccak256(toBytes(label)))
      const available = await publicClient.readContract({
        address: config.baseRegistrar,
        abi: baseRegistrarAbi,
        functionName: 'available',
        args: [labelHash],
      })
      setRegisterStatus(available ? 'available' : 'taken')
    } catch (e) {
      setRegisterError((e as Error).message)
      setRegisterStatus('idle')
    }
  }

  async function registerName() {
    if (!address) return
    const label = registerLabel.trim().replace(/\.eth$/i, '')
    setRegisterError(null)
    setRegisterStatus('registering')
    try {
      const labelHash = BigInt(keccak256(toBytes(label)))

      // Step 1: register on BaseRegistrar
      const h1 = await writeContractAsync({
        address: config.baseRegistrar,
        abi: baseRegistrarAbi,
        functionName: 'register',
        args: [labelHash, address, REGISTRATION_DURATION],
      })
      await publicClient.waitForTransactionReceipt({ hash: h1 })

      // Step 2: approve NameWrapper to wrap it
      const h2 = await writeContractAsync({
        address: config.baseRegistrar,
        abi: baseRegistrarAbi,
        functionName: 'setApprovalForAll',
        args: [config.nameWrapper, true],
      })
      await publicClient.waitForTransactionReceipt({ hash: h2 })

      // Step 3: wrap the name
      const h3 = await writeContractAsync({
        address: config.nameWrapper,
        abi: wrapperAbi,
        functionName: 'wrapETH2LD',
        args: [label, address, 0, config.publicResolver],
      })
      await publicClient.waitForTransactionReceipt({ hash: h3 })

      setRegisterStatus('done')
      setPublishName(`${label}.eth`)
    } catch (e) {
      setRegisterError((e as Error).message)
      setRegisterStatus('available')
    }
  }

  return (
    <div className="space-y-16 max-w-2xl">
      {/* ── Derive & Scan ───────────────────────────────────────── */}
      <section className="space-y-6">
        <h2 className="text-2xl font-light tracking-[0.2em] uppercase text-white/90">My Role</h2>
        <div className="flex gap-4 flex-wrap">
          <button
            disabled={!!busy}
            onClick={detect}
            className="px-6 py-2 rounded-full border border-white/20 bg-white/5 text-sm tracking-wide text-white/70 hover:bg-white/20 hover:text-white hover:border-white/80 transition-all duration-500 shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,245,190,0.7)] hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none"
          >
            {busy ?? 'Derive my keys and scan'}
          </button>
          <button
            disabled={!!busy}
            onClick={testDeterminism}
            className="px-6 py-2 rounded-full border border-white/10 bg-transparent text-sm tracking-wide text-white/40 hover:bg-white/5 hover:text-white/70 hover:border-white/30 transition-colors disabled:opacity-40"
            title="§5.2 — if the wallet does not sign deterministically, all access is lost."
          >
            Test wallet determinism
          </button>
        </div>

        {determinism === 'ok' && (
          <p className="border-l-2 border-emerald-500/50 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200/80 backdrop-blur-md">
            ✓ Two identical signatures — this wallet signs deterministically (RFC 6979). Safe to use.
          </p>
        )}
        {determinism === 'ko' && (
          <p className="border-l-2 border-red-500/50 bg-red-500/5 px-4 py-3 text-sm text-red-200/80 backdrop-blur-md font-medium">
            ✗ Different signatures! This wallet is not suitable: derived keys would change every session. Do NOT publish a meta-address from it (§5.2).
          </p>
        )}
      </section>

      {/* ── Register an ENS name ────────────────────────────────── */}
      <section className="space-y-6 border-t border-white/10 pt-12">
        <div>
          <h3 className="text-sm font-light tracking-[0.2em] uppercase text-white/80 mb-2">
            Register an ENS Name
          </h3>
          <p className="text-sm text-white/40 max-w-xl leading-relaxed">
            You need an <span className="mono text-white/60">.eth</span> name to publish your stealth meta-address. If you don't have one on this network, register it here (2-year term, free except gas).
          </p>
        </div>
        <div className="flex gap-3 items-end flex-wrap max-w-md">
          <label className="flex-1 text-sm">
            <span className="text-white/50 tracking-wide">Label</span>
            <div className="flex items-center gap-1 mt-2 border-b border-white/20 pb-2">
              <input
                value={registerLabel}
                onChange={(e) => { setRegisterLabel(e.target.value); setRegisterStatus('idle') }}
                placeholder="yourname"
                className="flex-1 bg-transparent mono text-sm text-white/90 focus:outline-none placeholder:text-white/20"
              />
              <span className="text-white/30 mono text-sm">.eth</span>
            </div>
          </label>
          <button
            disabled={!!busy || !registerLabel.trim() || registerStatus === 'checking'}
            onClick={checkAvailability}
            className="px-5 py-2 rounded-full border border-white/20 bg-white/5 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40"
          >
            Check
          </button>
        </div>

        {registerStatus === 'available' && (
          <div className="flex items-center gap-4 flex-wrap">
            <p className="text-emerald-400 text-sm">✓ <span className="mono">{registerLabel.replace(/\.eth$/i,'')}.eth</span> is available.</p>
            <button
              disabled={!!busy || registerStatus !== 'available'}
              onClick={registerName}
              className="px-6 py-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-sm tracking-wide disabled:opacity-40"
            >
              Register (3 transactions)
            </button>
          </div>
        )}
        {registerStatus === 'taken' && (
          <p className="text-amber-400 text-sm">✗ <span className="mono">{registerLabel.replace(/\.eth$/i,'')}.eth</span> is already taken. Try another name.</p>
        )}
        {registerStatus === 'registering' && (
          <p className="text-white/50 text-sm italic">Registering… confirm each MetaMask prompt.</p>
        )}
        {registerStatus === 'done' && (
          <p className="text-emerald-400 text-sm">✓ <span className="mono">{registerLabel.replace(/\.eth$/i,'')}.eth</span> registered and wrapped. You can now publish your meta-address below.</p>
        )}
        {registerError && (
          <p className="border-l-2 border-red-500/50 bg-red-500/5 px-4 py-3 text-sm text-red-200/80 backdrop-blur-md">{registerError}</p>
        )}
      </section>

      {/* ── Meta-address ────────────────────────────────────────── */}
      {session.keys && (
        <section className="space-y-6 border-t border-white/10 pt-12">
          <h3 className="text-sm font-light tracking-[0.2em] uppercase text-white/80">My Meta-Address</h3>
          <p className="text-xs text-white/40 leading-relaxed max-w-xl">
            This is your public stealth identity. It reveals no private keys. Share it with your org admin or publish it to your ENS name so you can be appointed.
          </p>
          <p className="mono text-xs break-all text-white/60 bg-white/5 border border-white/10 rounded-lg p-4 backdrop-blur-md">
            {session.keys.metaAddress}
          </p>
          <button
            onClick={() => navigator.clipboard.writeText(session.keys!.metaAddress)}
            className="px-4 py-1.5 rounded-full border border-white/10 bg-transparent text-xs text-white/40 hover:text-white/70 hover:border-white/30 transition-colors"
          >
            Copy to clipboard
          </button>

          <div className="flex gap-4 items-end flex-wrap pt-4">
            <label className="block text-sm flex-1 min-w-60">
              <span className="text-white/50 tracking-wide">Publish it on my ENS name (text record)</span>
              <input
                value={publishName}
                onChange={(e) => { setPublishName(e.target.value); setPublished(false) }}
                placeholder="yourname.eth"
                className="mt-2 w-full border-b border-white/20 bg-transparent px-0 py-2 mono text-sm text-white/90 focus:border-white/60 focus:outline-none transition-colors placeholder:text-white/20"
              />
            </label>
            <button
              disabled={!!busy || !publishName.trim()}
              onClick={publishMeta}
              className="px-6 py-2 rounded-full border border-white/20 bg-white/5 text-sm tracking-wide text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40 shadow-[0_0_15px_rgba(255,255,255,0.05)]"
            >
              Publish
            </button>
          </div>
          {published && (
            <p className="text-emerald-400 text-sm">
              ✓ Meta-address published on <span className="mono">{publishName}</span>. The org admin can now appoint you.
            </p>
          )}
        </section>
      )}

      {/* ── Detected Seats ──────────────────────────────────────── */}
      {session.keys && (
        <section className="space-y-6 border-t border-white/10 pt-12">
          <h3 className="text-sm font-light tracking-[0.2em] uppercase text-white/80">Detected Seats</h3>
          {session.seats.length === 0 ? (
            <p className="text-sm text-white/40 italic">
              No seat detected. If you were just appointed, click "Derive my keys and scan" again in a few seconds.
            </p>
          ) : (
            session.seats.map((s) => {
              const detail = seatDetails.data?.find((d) => d.node === s.node)
              return (
                <div key={s.node} className="border-l-2 border-white/30 bg-white/5 px-6 py-5 backdrop-blur-md">
                  <p className="font-light tracking-wide text-white/90 text-lg">
                    You hold a seat in <span className="mono">{config.parentName}</span>
                    {detail && <span className="text-sm text-white/50 ml-2">— expires: {formatExpiry(detail.expiry)}</span>}
                  </p>
                  <p className="mono text-xs text-white/40 mt-3">
                    current stealth address: {shortAddr(s.assignment.stealthAddress)}
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    {s.assignmentCount === 1
                      ? 'never rotated'
                      : `${s.assignmentCount - 1} rotation(s) — same seat, different key: the mandate survives`}
                  </p>
                  <p className="text-xs text-white/30 mt-3 leading-relaxed max-w-xl">
                    Nothing was sent to you. This seat was <em className="text-white/50 not-italic">calculated</em> from your view key and public announcements. Your signing key is in memory only — it is never written anywhere.
                  </p>
                </div>
              )
            })
          )}
        </section>
      )}

      {error && <p className="border-l-2 border-red-500/50 bg-red-500/5 px-4 py-3 text-sm text-red-200/80 backdrop-blur-md leading-relaxed">{error}</p>}

      <p className="text-xs text-white/30 pt-12 border-t border-white/10">
        connected wallet: <span className="mono text-white/50">{address && shortAddr(address)}</span> — this
        wallet does not sign vault transactions; it is only used to derive keys.
      </p>
    </div>
  )
}
