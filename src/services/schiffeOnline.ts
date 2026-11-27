/**
 * Online-Partien für Schiffe versenken.
 *
 * Der Server hält die Flotten und wertet jeden Schuss aus (Migration 035)
 * -- wie bei den Kartenspielen, nicht wie bei Schach und Dame. Ein Zugbuch,
 * das jeder selbst nachrechnet, müsste jedem beide Flotten verraten. Darum
 * kommt aus `sv_get_state` nur die eigene Sicht: die eigene Flotte, die
 * Schüsse beider Seiten mit Ergebnis, von der fremden Flotte nur, was schon
 * versenkt ist. Was im Browser ankommt, darf man sich ansehen.
 *
 * Solange die Migration nicht eingespielt ist, kommt aus jedem Aufruf die
 * freundliche Meldung aus `onlineFehler.ts` („noch nicht eingerichtet“).
 *
 * Entwurf: docs/design/schiffe-versenken/README.md
 */

import { supabase, isSupabaseConfigured } from '@/database/supabase'
import { onlineFehlerText } from './onlineFehler'
import { raumFunktionen } from './raeume'
import type { Schiff, SchiffeRegeln, Schuss } from '@/games/schiffe-versenken'

export const isSchiffeOnlineAvailable = isSupabaseConfigured

export interface SchiffeSitz {
  seat: number
  name: string
  is_you: boolean
  /** Hat seine Flotte schon gemeldet -- nur beim Aufstellen von Belang. */
  bereit: boolean
}

export interface SchiffeMatch {
  id: string
  code: string
  phase: 'lobby' | 'aufstellen' | 'spiel' | 'ende'
  /** Die wievielte Partie an diesem Tisch (Revanchen zählen mit). */
  partie: number
  /** Welcher Sitz den ersten Schuss hat -- erst ab dem Start gesetzt. */
  beginner: number | null
  /** Die Hausregeln des Tisches. Ungeprüft -- die Seite liest sie mit `regelnAus`. */
  regeln: unknown
  is_public: boolean
  is_host: boolean
  size: number
}

export interface SchiffeOnlineState {
  match: SchiffeMatch
  me: { seat: number }
  players: SchiffeSitz[]
  /** Die eigene Aufstellung, solange die Partie noch nicht läuft. Ungeprüft. */
  flotte: unknown
  /** Die eigene Sicht auf die Partie (`sv_sicht`). Ungeprüft -- die Seite liest sie mit `sichtAus`. */
  sicht: unknown
}

export interface SchiffeOpenMatch {
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

const raum = raumFunktionen('sv', client)
export const herzschlagSchiffe = raum.herzschlag
export const fetchOeffentlicheSchiffeRaeume = raum.oeffentlicheRaeume

export async function createSchiffeMatch(
  name: string | undefined,
  regeln: SchiffeRegeln,
  oeffentlich = false,
): Promise<{ match_id: string; code: string }> {
  const rows = await rpc<{ match_id: string; code: string }[]>('sv_create_match', {
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

export const joinSchiffeMatch = (code: string, name?: string) =>
  rpc<string>('sv_join_match', { p_code: code.trim().toUpperCase(), p_name: name ?? null })

export const leaveSchiffeMatch = (matchId: string) =>
  rpc<void>('sv_leave_match', { p_match: matchId })

/** Starten -- oder nach einer Partie die Revanche. Danach stellen beide auf. */
export const startSchiffeMatch = (matchId: string) => rpc<void>('sv_start', { p_match: matchId })

/** Die eigene Flotte melden. Der Server prüft sie nach den Regeln des Tisches. */
export const setzeSchiffeFlotte = (matchId: string, flotte: readonly Schiff[]) =>
  rpc<void>('sv_flotte_setzen', { p_match: matchId, p_flotte: flotte })

/** Ein Schuss. Zurück kommt der Schuss mit dem Ergebnis, das der Server ausgerechnet hat. */
export const schiesseOnline = (matchId: string, feld: number) =>
  rpc<Schuss>('sv_schiessen', { p_match: matchId, p_feld: feld })

export const gibSchiffeAuf = (matchId: string) => rpc<void>('sv_aufgeben', { p_match: matchId })

export const fetchSchiffeState = (matchId: string) =>
  rpc<SchiffeOnlineState>('sv_get_state', { p_match: matchId })

export const fetchMySchiffeMatches = () => rpc<SchiffeOpenMatch[]>('sv_my_matches', {})

/** Auf Änderungen horchen: Der Server zählt bei jeder Aktion eine Version hoch. */
export function subscribeToSchiffeMatch(matchId: string, onChange: () => void): () => void {
  if (!supabase || !isSupabaseConfigured) return () => undefined
  const sb = supabase
  const channel = sb
    .channel(`sv:${matchId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sv_state', filter: `match_id=eq.${matchId}` },
      () => onChange(),
    )
    .subscribe()
  return () => {
    void sb.removeChannel(channel)
  }
}
