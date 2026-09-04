/**
 * Online-Runden für "Wer bin ich?".
 *
 * Alles läuft über die serverseitigen Funktionen aus Migration 013 -- die
 * Tabellen selbst sind für Clients gesperrt. Der Grund ist das Spiel selbst:
 * Kennte der Browser das eigene Wort, könnte man einfach nachsehen. Deshalb
 * zieht der Server die Wörter und streicht in `wbi_get_state` jedem Aufrufer
 * sein eigenes heraus.
 */

import { supabase, isSupabaseConfigured } from '@/database/supabase'
import { onlineFehlerText } from './onlineFehler'

export const isWerBinIchOnlineAvailable = isSupabaseConfigured

export interface WbiOnlinePlayer {
  seat: number
  name: string
  is_you: boolean
  /** Das eigene Wort ist bis zur Auflösung null – genau darum geht es. */
  word: string | null
  has_guessed: boolean
  guess: string | null
  correct: boolean | null
}

export interface WbiOnlineMatch {
  id: string
  code: string
  phase: 'lobby' | 'ask' | 'guess' | 'result'
  round: number
  category_id: string
  category_label: string
  starter_seat: number | null
  is_host: boolean
  size: number
  open_guesses: number
}

export interface WbiOnlineMe {
  seat: number
  name: string
  guess: string | null
  correct: boolean | null
  /** Erst nach dem eigenen Tipp bzw. in der Auflösung gefüllt. */
  word: string | null
}

export interface WbiOnlineState {
  match: WbiOnlineMatch
  me: WbiOnlineMe
  players: WbiOnlinePlayer[]
}

export interface WbiOpenMatch {
  match_id: string
  code: string
  phase: string
  round: number
  size: number
}

function client() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Für Online-Runden fehlt die Verbindung zum Konto-Server.')
  }
  return supabase
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(name, args)
  if (error) throw new Error(onlineFehlerText(error))
  return data as T
}

export async function createWbiMatchOnline(opts: {
  categoryId: string
  name?: string
}): Promise<{ match_id: string; code: string }> {
  const rows = await rpc<{ match_id: string; code: string }[]>('wbi_create_match', {
    p_category: opts.categoryId,
    p_name: opts.name ?? null,
  })
  const first = Array.isArray(rows)
    ? rows[0]
    : (rows as unknown as { match_id: string; code: string })
  if (!first) throw new Error('Die Runde konnte nicht eröffnet werden.')
  return first
}

export async function joinWbiMatch(code: string, name?: string): Promise<string> {
  return rpc<string>('wbi_join_match', { p_code: code.trim().toUpperCase(), p_name: name ?? null })
}

export const leaveWbiMatch = (matchId: string) => rpc<void>('wbi_leave_match', { p_match: matchId })
export const startWbiMatch = (matchId: string) => rpc<void>('wbi_start_match', { p_match: matchId })
export const toWbiGuessPhase = (matchId: string) => rpc<void>('wbi_to_guess', { p_match: matchId })
export const guessWbiOnline = (matchId: string, guess: string) =>
  rpc<void>('wbi_guess', { p_match: matchId, p_guess: guess })
export const nextWbiRoundOnline = (matchId: string) =>
  rpc<void>('wbi_next_round', { p_match: matchId })

export async function fetchWbiState(matchId: string): Promise<WbiOnlineState> {
  return rpc<WbiOnlineState>('wbi_get_state', { p_match: matchId })
}

export async function fetchMyWbiMatches(): Promise<WbiOpenMatch[]> {
  return rpc<WbiOpenMatch[]>('wbi_my_matches', {})
}

/** Auf Änderungen horchen – wie beim Imposter über einen reinen Zähler. */
export function subscribeToWbiMatch(matchId: string, onChange: () => void): () => void {
  if (!supabase || !isSupabaseConfigured) return () => undefined
  const sb = supabase
  const channel = sb
    .channel(`wbi:${matchId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'wbi_state', filter: `match_id=eq.${matchId}` },
      () => onChange(),
    )
    .subscribe()
  return () => {
    void sb.removeChannel(channel)
  }
}
