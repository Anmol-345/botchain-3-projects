/**
 * Écran 1 — l'organigramme. Public, sans wallet.
 *
 * Deux blocs volontairement DISJOINTS :
 *   - le registre des membres (qui fait partie du corps) — text record du parent ;
 *   - les postes (adresses, expirations, fuses) — sous-noms ENS.
 * Aucune donnée ne relie un membre à un poste, et c'est le sujet (§2).
 */
import { useQuery } from '@tanstack/react-query'
import { config } from '../config'
import { fetchMembers, fetchSeats, fetchVaultMeta, formatExpiry, fuseNames, shortAddr } from '../lib/chain'

export default function Organigramme() {
  const seats = useQuery({ queryKey: ['seats'], queryFn: fetchSeats, refetchInterval: 15_000 })
  const meta = useQuery({ queryKey: ['vaultMeta'], queryFn: fetchVaultMeta, refetchInterval: 15_000 })
  const members = useQuery({ queryKey: ['members'], queryFn: fetchMembers, refetchInterval: 15_000 })

  if (seats.isError)
    return (
      <p className="text-red-400">
        Failed to read chain: {(seats.error as Error).message}
      </p>
    )
  // Keep on DATA, not on isLoading: a query can be pending
  // without being "loading" (React Query v5), and data remains undefined.
  if (!seats.data) return <p className="text-white/50 italic">Reading namespace…</p>

  return (
    <div className="space-y-12">
      <div className="flex items-baseline gap-6">
        <h2 className="text-2xl font-light tracking-[0.2em] uppercase text-white/90">{config.parentName}</h2>
        {meta.data && (
          <p className="text-xs tracking-wide text-white/40">
            threshold {String(meta.data.threshold)} of {config.seatCount} ·{' '}
            {String(meta.data.activeSigners)} active signer(s) · nonce{' '}
            {String(meta.data.nonce)}
          </p>
        )}
      </div>

      <section>
        <h3 className="text-xs text-white/40 uppercase tracking-[0.2em] mb-4">
          The Body — GORA Members (Public)
        </h3>
        <div className="flex flex-wrap gap-3">
          {(members.data ?? []).length > 0 ? (
            members.data!.map((m) => (
              <span
                key={m}
                className="px-4 py-1.5 rounded-full bg-white/5 border border-white/20 text-white/80 text-sm shadow-[0_0_15px_rgba(255,255,255,0.05)] backdrop-blur-md"
              >
                {m}
              </span>
            ))
          ) : (
            <span className="text-sm text-white/40 italic">empty registry</span>
          )}
        </div>
        <p className="text-xs text-white/30 mt-4 max-w-xl leading-relaxed">
          Text record <span className="mono">gora-members</span> of the vault's name. We know who
          received power — not who holds which seat.
        </p>
      </section>

      <div className="grid border-t border-white/10">
        {seats.data.map((seat) => (
          <div
            key={seat.node}
            className={`px-4 py-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-white/10 transition-colors duration-500 hover:bg-white/[0.02] ${
              !seat.active ? 'opacity-40 grayscale' : ''
            }`}
          >
            <div className={`w-20 mono text-sm ${seat.active ? 'text-white/90 font-medium' : 'text-white/60'}`}>{seat.label}</div>
            <div className="flex-1 min-w-40 mono text-xs text-white/50">
              {seat.stealthAddress !== '0x0000000000000000000000000000000000000000'
                ? shortAddr(seat.stealthAddress)
                : '—'}
              {seat.rotations > 0 && (
                <span className="ml-2 text-white/30">
                  · {seat.rotations} rotation{seat.rotations > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="text-xs text-white/40">expires: {formatExpiry(seat.expiry)}</div>
            {seat.active ? (
              <div className="relative px-3 py-1 text-xs tracking-widest uppercase text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                <div className="absolute inset-0 border border-white/30 rounded-sm pointer-events-none shadow-[inset_0_0_10px_rgba(255,255,255,0.1)]" />
                <div className="absolute -top-1 -left-1 w-1.5 h-1.5 bg-white rotate-45 shadow-[0_0_8px_rgba(255,255,255,1)]" />
                <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-white rotate-45 shadow-[0_0_8px_rgba(255,255,255,1)]" />
                <div className="absolute -bottom-1 -left-1 w-1.5 h-1.5 bg-white rotate-45 shadow-[0_0_8px_rgba(255,255,255,1)]" />
                <div className="absolute -bottom-1 -right-1 w-1.5 h-1.5 bg-white rotate-45 shadow-[0_0_8px_rgba(255,255,255,1)]" />
                active
              </div>
            ) : (
              <div className="text-xs px-3 py-1 rounded-full border bg-white/5 border-white/10 text-white/40 tracking-wide uppercase">
                {seat.registered ? 'expired' : 'unregistered'}
              </div>
            )}
            <div className="w-full text-xs text-white/30 mt-1">
              fuses:{' '}
              {seat.fuses === 0 ? (
                <span title="PARENT_CANNOT_CONTROL unburned — deliberate: rotation and revocation remain parent operations (§4)">
                  none burned (deliberate — see §4)
                </span>
              ) : (
                fuseNames(seat.fuses).join(', ')
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-white/30 max-w-2xl leading-relaxed">
        Members at the top, addresses at the bottom — two public lists, no data to
        link them. A seat's address is the one resolved by its <span className="mono">addr</span> record;
        we know it signs for this seat, we cannot know who controls it.
      </p>
    </div>
  )
}
