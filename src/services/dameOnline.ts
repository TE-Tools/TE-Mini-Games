/**
 * Online-Partien für Dame.
 *
 * Der Server führt ein Zugbuch, keine Regel (Migration 033) -- wie beim
 * Schach. Er weiß, wer mitspielt, wer Weiß hat, wer am Zug ist und welche
 * Hausregeln am Tisch gelten. Ob ein Zug erlaubt ist, rechnet jeder
 * Mitspieler selbst aus (`src/games/dame/online.ts`).
 *
 * Solange die Migration nicht eingespielt ist, kommt aus jedem Aufruf die
 * freundliche Meldung aus `onlineFehler.ts` („noch nicht eingerichtet“) --
 * die Seite zeigt sie und bricht nicht.
 */

import { supabase, isSupabaseConfigured } from '@/database/supabase'
import { onlineFehlerText } from './onlineFehler'
import { raumFunktionen } from './raeume'
import type { DameAktion, DameEintrag, DameRegeln } from '@/games/dame'

export const isDameOnlineAvailable = isSupabaseConfigured

export interface DameSitz {
  seat: number
  name: string
  is_you: boolean
}

export interface DameMatch {
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

export interface DameOnlineState {
  match: DameMatch
  me: { seat: number }
  players: DameSitz[]
  zuege: DameEintrag[]
}

export interface DameOpenMatch {
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

const raum = raumFunktionen('dame', client)
export const herzschlagDame = raum.herzschlag
export const fetchOeffentlicheDameRaeume = raum.oeffentlicheRaeume

export async function createDameMatch(
  name: string | undefined,
  regeln: DameRegeln,
  oeffentlich = false,
): Promise<{ match_id: string; code: string }> {
  const rows = await rpc<{ match_id: string; code: string }[]>('dame_create_match', {
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

export const joinDameMatch = (code: string, name?: string) =>
  rpc<string>('dame_join_match', { p_code: code.trim().toUpperCase(), p_name: name ?? null })

export const leaveDameMatch = (matchId: string) =>
  rpc<void>('dame_leave_match', { p_match: matchId })

/** Starten -- oder nach einer Partie die Revanche mit getauschten Farben. */
export const startDameMatch = (matchId: string) => rpc<void>('dame_start', { p_match: matchId })

export const sendeDameAktion = (matchId: string, aktion: DameAktion, ende = false) =>
  rpc<number>('dame_aktion', { p_match: matchId, p_aktion: aktion, p_ende: ende })

export const fetchDameState = (matchId: string, ab = 0) =>
  rpc<DameOnlineState>('dame_get_state', { p_match: matchId, p_ab: ab })

export const fetchMyDameMatches = () => rpc<DameOpenMatch[]>('dame_my_matches', {})

/** Auf Änderungen horchen: Der Server zählt bei jeder Aktion eine Version hoch. */
export function subscribeToDameMatch(matchId: string, onChange: () => void): () => void {
  if (!supabase || !isSupabaseConfigured) return () => undefined
  const sb = supabase
  const channel = sb
    .channel(`dame:${matchId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'dame_state', filter: `match_id=eq.${matchId}` },
      () => onChange(),
    )
    .subscribe()
  return () => {
    void sb.removeChannel(channel)
  }
}
