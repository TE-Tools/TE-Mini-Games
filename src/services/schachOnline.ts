/**
 * Online-Partien für Schach.
 *
 * Der Server führt ein Zugbuch, keine Regel (Migration 031). Er weiß, wer
 * mitspielt, wer Weiß hat und wer am Zug ist -- ob ein Zug erlaubt ist,
 * rechnet jeder Mitspieler selbst aus (`src/games/schach/online.ts`).
 */

import { supabase, isSupabaseConfigured } from '@/database/supabase'
import { onlineFehlerText } from './onlineFehler'
import { raumFunktionen } from './raeume'
import type { SchachAktion, SchachEintrag } from '@/games/schach'

export const isSchachOnlineAvailable = isSupabaseConfigured

export interface SchachSitz {
  seat: number
  name: string
  is_you: boolean
}

export interface SchachMatch {
  id: string
  code: string
  phase: 'lobby' | 'spiel' | 'ende'
  /** Welcher Sitz Weiß spielt -- erst ab dem Start gesetzt. */
  weiss: number | null
  /** Die wievielte Partie an diesem Tisch (Revanchen zählen mit). */
  partie: number
  am_zug: number
  is_public: boolean
  is_host: boolean
  size: number
  zug_nr: number
}

export interface SchachOnlineState {
  match: SchachMatch
  me: { seat: number }
  players: SchachSitz[]
  zuege: SchachEintrag[]
}

export interface SchachOpenMatch {
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

const raum = raumFunktionen('schach', client)
export const herzschlagSchach = raum.herzschlag
export const fetchOeffentlicheSchachRaeume = raum.oeffentlicheRaeume

export async function createSchachMatch(
  name?: string,
  oeffentlich = false,
): Promise<{ match_id: string; code: string }> {
  const rows = await rpc<{ match_id: string; code: string }[]>('schach_create_match', {
    p_name: name ?? null,
  })
  const erster = Array.isArray(rows)
    ? rows[0]
    : (rows as unknown as { match_id: string; code: string })
  if (!erster) throw new Error('Der Tisch konnte nicht eröffnet werden.')
  if (oeffentlich) await raum.oeffentlichSchalten(erster.match_id, true)
  return erster
}

export const joinSchachMatch = (code: string, name?: string) =>
  rpc<string>('schach_join_match', { p_code: code.trim().toUpperCase(), p_name: name ?? null })

export const leaveSchachMatch = (matchId: string) =>
  rpc<void>('schach_leave_match', { p_match: matchId })

/** Starten -- oder nach einer Partie die Revanche mit getauschten Farben. */
export const startSchachMatch = (matchId: string) => rpc<void>('schach_start', { p_match: matchId })

export const sendeSchachAktion = (matchId: string, aktion: SchachAktion, ende = false) =>
  rpc<number>('schach_aktion', { p_match: matchId, p_aktion: aktion, p_ende: ende })

export const fetchSchachState = (matchId: string, ab = 0) =>
  rpc<SchachOnlineState>('schach_get_state', { p_match: matchId, p_ab: ab })

export const fetchMySchachMatches = () => rpc<SchachOpenMatch[]>('schach_my_matches', {})

/** Auf Änderungen horchen: Der Server zählt bei jeder Aktion eine Version hoch. */
export function subscribeToSchachMatch(matchId: string, onChange: () => void): () => void {
  if (!supabase || !isSupabaseConfigured) return () => undefined
  const sb = supabase
  const channel = sb
    .channel(`schach:${matchId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'schach_state', filter: `match_id=eq.${matchId}` },
      () => onChange(),
    )
    .subscribe()
  return () => {
    void sb.removeChannel(channel)
  }
}
