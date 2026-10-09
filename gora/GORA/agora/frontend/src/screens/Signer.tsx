/**
 * Écran 4 — Signer. Transactions en attente, signature EIP-712 avec la clé
 * furtive recalculée, exécution par n'importe quel wallet dès le seuil atteint.
 *
 * L'exécution par un wallet quelconque n'est pas un détail : c'est l'invariant
 * du §1 — une adresse furtive signe, elle n'émet jamais de transaction.
 */
import { useEffect, useState } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatEther, parseEther, recoverAddress, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import { config } from '../config'
import { vaultAbi } from '../abi'
import { fetchVaultMeta, publicClient, shortAddr } from '../lib/chain'
import { stealthPrivateKey } from '../lib/stealth'
import {
  addSignature,
  importPending,
  loadPending,
  pruneStaleNonce,
  removePending,
  upsertPending,
  type PendingTx,
} from '../lib/pending'
import { useSession } from '../session'

export default function Signer() {
  const { isConnected } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const session = useSession()
  const queryClient = useQueryClient()

  const meta = useQuery({ queryKey: ['vaultMeta'], queryFn: fetchVaultMeta, refetchInterval: 10_000 })
  const [txs, setTxs] = useState<PendingTx[]>([])
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('0.01')
  const [calldata, setCalldata] = useState('0x')
  const [importJson, setImportJson] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = () => setTxs(loadPending())
  useEffect(refresh, [])
  // Prune stale nonces when vault metadata loads
  useEffect(() => {
    if (meta.data) pruneStaleNonce(meta.data.nonce)
  }, [meta.data?.nonce])

  const threshold = meta.data ? Number(meta.data.threshold) : Infinity

  function propose() {
    setError(null)
    try {
      if (!meta.data) throw new Error('vault metadata not loaded')
      const toAddr = to.trim()
      if (!toAddr.startsWith('0x') || toAddr.length !== 42) throw new Error('Invalid recipient address.')
      const dataHex = calldata.trim() || '0x'
      if (!/^0x[0-9a-fA-F]*$/.test(dataHex)) throw new Error('Calldata must be a hex string starting with 0x.')
      const tx: PendingTx = {
        id: crypto.randomUUID(),
        to: toAddr as `0x${string}`,
        value: parseEther(amount || '0').toString(),
        data: dataHex as `0x${string}`,
        nonce: meta.data.nonce.toString(),
        createdAt: Date.now(),
        signatures: [],
      }
      upsertPending(tx)
      refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function sign(tx: PendingTx) {
    setError(null)
    if (!session.keys || session.seats.length === 0) {
      setError('First detect your seat on the "My Role" screen — the signature key is recalculated each session, never stored.')
      return
    }
    setBusy(tx.id)
    try {
      const digest = await publicClient.readContract({
        address: config.vault,
        abi: vaultAbi,
        functionName: 'executeDigest',
        args: [tx.to, BigInt(tx.value), tx.data, BigInt(tx.nonce)],
      })

      // Une clé de vue peut détenir PLUSIEURS postes (démo à peu de wallets) :
      // chaque poste a sa propre adresse furtive, donc sa propre signature.
      const signed: string[] = []
      for (const seat of session.seats) {
        const account = privateKeyToAccount(stealthPrivateKey(session.keys!.p, seat.s))
        if (tx.signatures.some((s) => s.signer.toLowerCase() === account.address.toLowerCase())) {
          continue
        }
        const sig = await account.sign({ hash: digest })
        addSignature(tx.id, account.address, sig)
        signed.push(shortAddr(account.address))
      }
      refresh()
      setNotice(
        signed.length === 0
          ? 'Your seats have already signed this transaction.'
          : `Signed from ${signed.length} seat(s): ${signed.join(', ')} — addresses that link nothing to your name.`,
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function execute(tx: PendingTx) {
    setError(null)
    setBusy(tx.id)
    try {
      const digest = await publicClient.readContract({
        address: config.vault,
        abi: vaultAbi,
        functionName: 'executeDigest',
        args: [tx.to, BigInt(tx.value), tx.data, BigInt(tx.nonce)],
      })
      // tri par adresse recouvrée croissante — exigé par l'anti-doublon du contrat (§6.4)
      const withAddr = await Promise.all(
        tx.signatures.map(async (s) => ({
          sig: s.sig,
          addr: (await recoverAddress({ hash: digest, signature: s.sig })).toLowerCase(),
        })),
      )
      withAddr.sort((a, b) => (a.addr < b.addr ? -1 : 1))

      const h = await writeContractAsync({
        address: config.vault,
        abi: vaultAbi,
        functionName: 'execute',
        args: [tx.to, BigInt(tx.value), tx.data, BigInt(tx.nonce), withAddr.map((s) => s.sig as Hex)],
      })
      await publicClient.waitForTransactionReceipt({ hash: h })
      removePending(tx.id)
      refresh()
      setNotice('Executed. The wallet that paid the gas can be anyone — no signer address emitted a transaction.')
      queryClient.invalidateQueries({ queryKey: ['vaultMeta'] })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-16 max-w-2xl">
      <section className="space-y-6">
        <h2 className="text-2xl font-light tracking-[0.2em] uppercase text-white/90">
          Propose a Transaction{' '}
          {meta.data && (
            <span className="text-sm tracking-widest text-white/40 ml-2">
              (nonce: {String(meta.data.nonce)}, threshold: {String(meta.data.threshold)})
            </span>
          )}
        </h2>
        <div className="flex gap-4 flex-wrap items-end pt-2">
          <label className="block text-sm flex-1 min-w-64">
            <span className="text-white/50 tracking-wide">Recipient</span>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="0x…"
              className="mt-2 w-full border-b border-white/20 bg-transparent px-0 py-2 mono text-sm text-white/90 focus:border-white/60 focus:outline-none transition-colors placeholder:text-white/20"
            />
          </label>
          <label className="block text-sm">
            <span className="text-white/50 tracking-wide">Amount (BOT)</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-2 w-28 border-b border-white/20 bg-transparent px-0 py-2 mono text-sm text-white/90 focus:border-white/60 focus:outline-none transition-colors placeholder:text-white/20"
            />
          </label>
          <button
            onClick={propose}
            className="px-6 py-2 rounded-full border border-white/20 bg-white/5 text-sm tracking-wide text-white/70 hover:bg-white/20 hover:text-white hover:border-white/80 transition-all duration-500 shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,245,190,0.7)] hover:scale-105"
          >
            Propose
          </button>
        </div>
        <label className="block text-sm max-w-lg">
          <span className="text-white/50 tracking-wide">Calldata (optional, hex)</span>
          <input
            value={calldata}
            onChange={(e) => setCalldata(e.target.value)}
            placeholder="0x"
            className="mt-2 w-full border-b border-white/20 bg-transparent px-0 py-2 mono text-sm text-white/90 focus:border-white/60 focus:outline-none transition-colors placeholder:text-white/20"
          />
          <span className="text-xs text-white/30 mt-1 block">Leave as 0x for plain BOT transfers. For contract calls, paste the encoded calldata.</span>
        </label>
      </section>

      <section className="space-y-6 border-t border-white/10 pt-12">
        <h3 className="text-sm font-light tracking-[0.2em] uppercase text-white/80">Pending</h3>
        {txs.length === 0 && <p className="text-sm text-white/40 italic">Nothing pending.</p>}
        {txs.map((tx) => (
          <div key={tx.id} className="border-l-2 border-white/30 bg-white/5 px-6 py-5 backdrop-blur-md space-y-4">
            <p className="mono text-sm text-white/90">
              {formatEther(BigInt(tx.value))} BOT → {shortAddr(tx.to)}{' '}
              <span className="text-white/40 ml-2">(nonce {tx.nonce})</span>
            </p>
            <p className="text-xs text-white/40 tracking-wide">
              {tx.signatures.length} / {String(meta.data?.threshold ?? '?')} signature(s):{' '}
              {tx.signatures.map((s) => shortAddr(s.signer)).join(', ') || '—'}
            </p>
            <div className="flex gap-3 flex-wrap">
              <button
                disabled={busy === tx.id}
                onClick={() => sign(tx)}
                className="px-4 py-1.5 rounded-full border border-white/20 bg-transparent text-sm tracking-wide text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40"
              >
                {session.seats.length > 1
                  ? `Sign with my ${session.seats.length} seats`
                  : 'Sign with my stealth key'}
              </button>
              <button
                disabled={busy === tx.id || tx.signatures.length < threshold || !isConnected}
                onClick={() => execute(tx)}
                className="px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-colors text-sm tracking-wide disabled:opacity-40 shadow-[0_0_15px_rgba(52,211,153,0.1)]"
                title="Any connected wallet can execute and pay for gas — including a non-signer wallet. This is the invariant of §1."
              >
                Execute ({tx.signatures.length}/{threshold})
              </button>
              <button
                onClick={() => {
                  removePending(tx.id)
                  refresh()
                }}
                className="px-4 py-1.5 rounded-full border border-white/5 text-white/40 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 transition-colors text-sm tracking-wide"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-6 border-t border-white/10 pt-12">
        <h3 className="text-sm font-light tracking-[0.2em] uppercase text-white/80">Share Between Browsers</h3>
        <p className="text-sm text-white/40 leading-relaxed">
          No backend: copy this JSON to the other browser (multi-signer demo).
        </p>
        <div className="flex gap-4 flex-wrap items-end">
          <button
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(loadPending()))
              setNotice('Copied to clipboard.')
            }}
            className="px-6 py-2 rounded-full border border-white/20 bg-transparent text-sm tracking-wide text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            Export (copy)
          </button>
          <input
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder="paste exported JSON…"
            className="flex-1 min-w-60 border-b border-white/20 bg-transparent px-0 py-2 mono text-sm text-white/90 focus:border-white/60 focus:outline-none transition-colors placeholder:text-white/20"
          />
          <button
            onClick={() => {
              try {
                const n = importPending(importJson)
                setImportJson('')
                refresh()
                setNotice(`${n} item(s) merged.`)
              } catch (e) {
                setError((e as Error).message)
              }
            }}
            className="px-6 py-2 rounded-full border border-white/20 bg-transparent text-sm tracking-wide text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            Import
          </button>
        </div>
      </section>

      {notice && <p className="border-l-2 border-emerald-500/50 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200/80 backdrop-blur-md leading-relaxed">{notice}</p>}
      {error && <p className="border-l-2 border-red-500/50 bg-red-500/5 px-4 py-3 text-sm text-red-200/80 backdrop-blur-md leading-relaxed">{error}</p>}
    </div>
  )
}
