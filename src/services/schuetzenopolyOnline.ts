/**
 * Online-Partien für Schützenopoly.
 *
 * Der Server führt ein Zugbuch, keine Regel (Migration 019). Er kennt den
 * Startwert des Zufalls, die Sitzordnung und wer am Zug ist -- alles andere
 * rechnet jeder Mitspieler selbst aus, indem er das Zugbuch durch dieselbe
 * Engine spielt (`src/games/schuetzenopoly/online.ts`).
 *
 * Anders als beim Kniffel steht die Wertung damit nur einmal da. Beim
 * Kniffel *ist* der Würfel das Spiel, deshalb rechnet dort der Server. Hier
 * hängen Würfel und Kartenstapel am Startwert, den der Server vergibt --
 * aussuchen kann sich niemand etwas, und die Regeln bleiben an einer Stelle.
 */

import { supabase, isSupabaseConfigured } from '@/database/supabase'
import { onlineFehlerText } from './onlineFehler'
import { raumFunktionen } from './raeume'
import type { OnlineAktion, ZugbuchEintrag } from '@/games/schuetzenopoly'

export const isSchuetzenopolyOnlineAvailable = isSupabaseConfigured

export interface SchopolySitz {
  seat: number
  name: string
  is_you: boolean
}

export interface SchopolyMatch {
  id: string
  code: string
  phase: 'lobby' | 'spiel' | 'ende'
  /** Erst ab dem Start gesetzt -- vorher soll ihn niemand kennen. */
  seed: number | null
  runden_limit: number
  am_zug: number
  is_public: boolean
  is_host: boolean
  size: number
  /** Die höchste Nummer im Zugbuch. */
  zug_nr: number
}

export interface SchopolyOnlineState {
  match: SchopolyMatch
  me: { seat: number }
  players: SchopolySitz[]
  zuege: ZugbuchEintrag[]
}

export interface SchopolyOpenMatch {
  match_id: string
  code: string
  phase: string
  runde: number
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

/* Räume: Lebenszeichen, öffentlich schalten, öffentliche Räume (Migration 018/019). */
const raum = raumFunktionen('schopoly', client)
export const herzschlagSchopoly = raum.herzschlag
export const fetchOeffentlicheSchopolyRaeume = raum.oeffentlicheRaeume

export async function createSchopolyMatch(
  name?: string,
  oeffentlich = false,
): Promise<{ match_id: string; code: string }> {
  const rows = await rpc<{ match_id: string; code: string }[]>('schopoly_create_match', {
    p_name: name ?? null,
  })
  const erster = Array.isArray(rows)
    ? rows[0]
    : (rows as unknown as { match_id: string; code: string })
  if (!erster) throw new Error('Die Partie konnte nicht eröffnet werden.')
  if (oeffentlich) await raum.oeffentlichSchalten(erster.match_id, true)
  return erster
}

export const joinSchopolyMatch = (code: string, name?: string) =>
  rpc<string>('schopoly_join_match', {
    p_code: code.trim().toUpperCase(),
    p_name: name ?? null,
  })

export const leaveSchopolyMatch = (matchId: string) =>
  rpc<void>('schopoly_leave_match', { p_match: matchId })

export const startSchopolyMatch = (matchId: string, runden: number) =>
  rpc<void>('schopoly_start', { p_match: matchId, p_runden: runden })

/**
 * Eine Aktion anhängen.
 *
 * `amZug` ist der Sitz, der nach dieser Aktion dran ist -- das weiß nur, wer
 * die Regeln kennt, also wir. Der Server glaubt es, die Mitspieler nicht:
 * Sie spielen das Zugbuch selbst nach.
 */
export const sendeAktion = (
  matchId: string,
  aktion: OnlineAktion,
  amZug: number,
  ende = false,
): Promise<number> =>
  rpc<number>('schopoly_aktion', {
    p_match: matchId,
    p_aktion: aktion,
    p_am_zug: amZug,
    p_ende: ende,
  })

export const fetchSchopolyState = (matchId: string, ab = 0) =>
  rpc<SchopolyOnlineState>('schopoly_get_state', { p_match: matchId, p_ab: ab })

export const fetchMySchopolyMatches = () => rpc<SchopolyOpenMatch[]>('schopoly_my_matches', {})

/**
 * Auf Änderungen horchen. Der Server zählt bei jeder Aktion eine Version
 * hoch; daraufhin holen wir die neuen Einträge des Zugbuchs.
 */
export function subscribeToSchopolyMatch(matchId: string, onChange: () => void): () => void {
  if (!supabase || !isSupabaseConfigured) return () => undefined
  const sb = supabase
  const channel = sb
    .channel(`schopoly:${matchId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'schopoly_state', filter: `match_id=eq.${matchId}` },
      () => onChange(),
    )
    .subscribe()
  return () => {
    void sb.removeChannel(channel)
  }
}
