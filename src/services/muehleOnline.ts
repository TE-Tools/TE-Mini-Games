/**
 * Online-Partien für Mühle.
 *
 * Der Server führt ein Zugbuch, keine Regel (Migration 034) -- wie bei Dame und
 * Schach. Er weiß, wer mitspielt, wer Weiß hat, wer am Zug ist und welche
 * Hausregeln am Tisch gelten. Ob ein Zug erlaubt ist, rechnet jeder
 * Mitspieler selbst aus (`src/games/muehle/online.ts`).
 *
 * Solange die Migration nicht eingespielt ist, kommt aus jedem Aufruf die
 * freundliche Meldung aus `onlineFehler.ts` („noch nicht eingerichtet“) --
 * die Seite zeigt sie und bricht nicht.
 */

import { supabase, isSupabaseConfigured } from '@/database/supabase'
import { onlineFehlerText } from './onlineFehler'
import { raumFunktionen } from './raeume'
import type { MuehleAktion, MuehleEintrag, MuehleRegeln } from '@/games/muehle'

export const isMuehleOnlineAvailable = isSupabaseConfigured

export interface MuehleSitz {
  seat: number
  name: string
  is_you: boolean
}

export interface MuehleMatch {
  id: string
  code: string
  phase: 'lobby' | 'spiel' | 'ende'
  /** Welcher Sitz Weiß spielt -- erst ab dem Start gesetzt. */
  weiss: number | null
  /** Die wievielte Partie an diesem Tisch (Revanchen zählen mit). */
  partie: number
  am_zug: number
  /** Die Hausregeln des Tisches, wie der Gastgeber sie gewählt hat. Ungeprüft. */
  regeln: unknown
  is_public: boolean
  is_host: boolean
  size: number
  zug_nr: number
}

export interface MuehleOnlineState {
  match: MuehleMatch
  me: { seat: number }
  players: MuehleSitz[]
  zuege: MuehleEintrag[]
}

export interface MuehleOpenMatch {
  match_id: string
  code: string
  phase: string
  size: number
}

function client() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Für Online-Partien fehlt die Verbindung zum Konto-Server.')
  }
  return supabase
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(name, args)
  if (error) throw new Error(onlineFehlerText(error))
  return data as T
}

const raum = raumFunktionen('muehle', client)
export const herzschlagMuehle = raum.herzschlag
export const fetchOeffentlicheMuehleRaeume = raum.oeffentlicheRaeume

export async function createMuehleMatch(
  name: string | undefined,
  regeln: MuehleRegeln,
  oeffentlich = false,
): Promise<{ match_id: string; code: string }> {
  const rows = await rpc<{ match_id: string; code: string }[]>('muehle_create_match', {
    p_name: name ?? null,
    p_regeln: regeln,
  })
  const erster = Array.isArray(rows)
    ? rows[0]
    : (rows as unknown as { match_id: string; code: string })
  if (!erster) throw new Error('Der Tisch konnte nicht eröffnet werden.')
  if (oeffentlich) await raum.oeffentlichSchalten(erster.match_id, true)
  return erster
}

export const joinMuehleMatch = (code: string, name?: string) =>
  rpc<string>('muehle_join_match', { p_code: code.trim().toUpperCase(), p_name: name ?? null })

export const leaveMuehleMatch = (matchId: string) =>
  rpc<void>('muehle_leave_match', { p_match: matchId })

/** Starten -- oder nach einer Partie die Revanche mit getauschten Farben. */
export const startMuehleMatch = (matchId: string) => rpc<void>('muehle_start', { p_match: matchId })

export const sendeMuehleAktion = (matchId: string, aktion: MuehleAktion, ende = false) =>
  rpc<number>('muehle_aktion', { p_match: matchId, p_aktion: aktion, p_ende: ende })

export const fetchMuehleState = (matchId: string, ab = 0) =>
  rpc<MuehleOnlineState>('muehle_get_state', { p_match: matchId, p_ab: ab })

export const fetchMyMuehleMatches = () => rpc<MuehleOpenMatch[]>('muehle_my_matches', {})

/** Auf Änderungen horchen: Der Server zählt bei jeder Aktion eine Version hoch. */
export function subscribeToMuehleMatch(matchId: string, onChange: () => void): () => void {
  if (!supabase || !isSupabaseConfigured) return () => undefined
  const sb = supabase
  const channel = sb
    .channel(`muehle:${matchId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'muehle_state', filter: `match_id=eq.${matchId}` },
      () => onChange(),
    )
    .subscribe()
  return () => {
    void sb.removeChannel(channel)
  }
}
