/**
 * Session en mémoire du signataire : clés dérivées + postes détectés.
 *
 * RIEN n'est persisté (§5.5 : « jamais persistée, recalculée à la volée à
 * chaque session »). Fermer l'onglet efface tout ; se reconnecter recalcule.
 */
import { createContext, useContext, useState, type ReactNode } from 'react'
import type { StealthKeys } from './lib/stealth'
import type { DetectedSeat } from './lib/scan'

interface Session {
  keys: StealthKeys | null
  seats: DetectedSeat[]
  setKeys: (k: StealthKeys | null) => void
  setSeats: (s: DetectedSeat[]) => void
}

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [keys, setKeys] = useState<StealthKeys | null>(null)
  const [seats, setSeats] = useState<DetectedSeat[]>([])
  return (
    <SessionContext.Provider value={{ keys, seats, setKeys, setSeats }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): Session {
  const s = useContext(SessionContext)
  if (!s) throw new Error('useSession hors du SessionProvider')
  return s
}
