/**
 * Écran 5 — Le défi. L'écran de démo (§7).
 * Les membres à gauche (registre du parent), les adresses à droite (postes).
 * Faites correspondre — il n'existe aucune donnée publique pour le faire.
 */
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchMembers, fetchSeats, formatExpiry, shortAddr } from '../lib/chain'

export default function Defi() {
  const seats = useQuery({ queryKey: ['seats'], queryFn: fetchSeats, refetchInterval: 10_000 })
  const members = useQuery({ queryKey: ['members'], queryFn: fetchMembers, refetchInterval: 10_000 })
  const [challenged, setChallenged] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  if (seats.isLoading) return <p className="text-white/50 italic">Reading…</p>

  const active = (seats.data ?? []).filter((s) => s.active)
  const names = members.data ?? []
  // sorted by hex address — the display order must betray nothing of the seats' order
  const addresses = active.map((s) => s.stealthAddress).sort()

  const nextExpiry = active.reduce<bigint | null>(
    (min, s) => (min === null || s.expiry < min ? s.expiry : min),
    null,
  )
  const secondsLeft = nextExpiry ? Number(nextExpiry) - Math.floor(now / 1000) : null

  return (
    <div className="space-y-16 max-w-3xl">
      <h2 className="text-2xl font-light tracking-[0.2em] uppercase text-white/90">The Challenge</h2>

      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-xs text-white/40 uppercase tracking-[0.2em] mb-4">The Members (Public)</h3>
          {names.map((n) => (
            <div key={n} className="border-b border-white/10 py-3 text-white/80 tracking-wide">
              {n}
            </div>
          ))}
          {names.length === 0 && <p className="text-sm text-white/40 italic">empty registry</p>}
        </div>
        <div className="space-y-4">
          <h3 className="text-xs text-white/40 uppercase tracking-[0.2em] mb-4">The Signing Addresses</h3>
          {addresses.map((a) => (
            <div key={a} className="border-b border-white/10 py-3 mono text-sm text-white/60">
              {shortAddr(a)}
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => setChallenged(true)}
        className="px-6 py-2 rounded-full border border-white/20 bg-white/5 text-sm tracking-wide text-white/70 hover:bg-white/20 hover:text-white hover:border-white/80 transition-all duration-500 shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,245,190,0.7)] hover:scale-105"
      >
        Match them
      </button>

      {challenged && (
        <div className="border-l-2 border-white/30 bg-white/5 px-6 py-5 backdrop-blur-md text-white/80">
          <p className="font-light tracking-wide text-lg text-white/90">
            There is no public data allowing this matching.
          </p>
          <p className="text-sm text-white/40 mt-3 leading-relaxed">
            Each address is P + keccak(r·V)·G for a randomness r destroyed at appointment. The
            chain contains the announcements (R, viewTag) — you would need a member's private
            view key to link anything. And {names.length || 'n'} members for{' '}
            {addresses.length || 'n'} seats means {factorielle(addresses.length)} possible
            assignments. The body is public. The allocation is not.
          </p>
        </div>
      )}

      {secondsLeft !== null && (
        <div className="border-t border-white/10 pt-12">
          <h3 className="text-xs text-white/40 uppercase tracking-[0.2em] mb-4">
            Next Term Expiry
          </h3>
          {secondsLeft > 0 ? (
            <p className="text-5xl font-light tracking-wider text-white/90 tabular-nums">
              {secondsLeft > 86400
                ? `${Math.floor(secondsLeft / 86400)} d ${Math.floor((secondsLeft % 86400) / 3600)} h`
                : new Date(secondsLeft * 1000).toISOString().slice(11, 19)}
            </p>
          ) : (
            <p className="text-5xl font-light text-red-400">expired</p>
          )}
          <p className="text-sm text-white/40 mt-4 leading-relaxed">
            No one will revoke anything: power extinguishes itself ({formatExpiry(nextExpiry!)}).
          </p>
        </div>
      )}
    </div>
  )
}

function factorielle(n: number): string {
  if (n <= 0) return '1'
  if (n > 20) return `${n}! (>2.4 quintillion)`
  let f = 1n
  for (let i = 2; i <= n; i++) f *= BigInt(i)
  return f.toLocaleString()
}
