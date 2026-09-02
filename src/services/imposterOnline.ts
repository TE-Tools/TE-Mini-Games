/**
 * Online-Runden für "Finde den Imposter".
 *
 * Alles läuft über die serverseitigen Funktionen aus Migration 011 -- die
 * Tabellen selbst sind für Clients gesperrt. Der Grund ist das Spiel selbst:
 * Würde der Browser das geheime Wort kennen, könnte man als Imposter einfach
 * nachsehen. Deshalb zieht der Server das Wort und gibt jedem über
 * `fdi_get_state` nur das zurück, was er wissen darf.
 */

import { supabase, isSupabaseConfigured } from '@/database/supabase'

export const isImposterOnlineAvailable = isSupabaseConfigured

export interface OnlinePlayer {
  seat: number
  name: string
  has_voted: boolean
  is_you: boolean
  /** Erst im Ergebnis gefüllt. */
  is_imposter: boolean | null
  last_chance_guess: string | null
}

export interface OnlineMatch {
  id: string
  code: string
  phase: 'lobby' | 'discussion' | 'accuse' | 'last_chance' | 'result'
  round: number
  category_id: string
  category_label: string
  mode: 'classic' | 'double'
  imposter_count: number
  /** Wer die Runde eröffnet – zufällig gezogen, sobald ausgeteilt ist. */
  starter_seat: number | null
  accused_seat: number | null
  correct_accusation: boolean | null
  last_chance_success: boolean | null
  is_host: boolean
  size: number
  /** Erst im Ergebnis gefüllt. */
  secret_word: string | null
}

export interface OnlineMe {
  seat: number
  name: string
  is_imposter: boolean
  vote_seat: number | null
  /** Nur für Nicht-Imposter. */
  word: string | null
  /** Nur für Imposter. */
  helper_word: string | null
}

export interface OnlineState {
  match: OnlineMatch
  me: OnlineMe
  players: OnlinePlayer[]
}

export interface OpenMatch {
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
  if (error) throw new Error(error.message)
  return data as T
}

export async function createOnlineMatch(opts: {
  categoryId: string
  mode: 'classic' | 'double'
  name?: string
}): Promise<{ match_id: string; code: string }> {
  const rows = await rpc<{ match_id: string; code: string }[]>('fdi_create_match', {
    p_category: opts.categoryId,
    p_mode: opts.mode,
    p_name: opts.name ?? null,
  })
  const first = Array.isArray(rows) ? rows[0] : (rows as unknown as { match_id: string; code: string })
  if (!first) throw new Error('Die Runde konnte nicht eröffnet werden.')
  return first
}

export async function joinOnlineMatch(code: string, name?: string): Promise<string> {
  return rpc<string>('fdi_join_match', { p_code: code.trim().toUpperCase(), p_name: name ?? null })
}

export const leaveOnlineMatch = (matchId: string) => rpc<void>('fdi_leave_match', { p_match: matchId })
export const startOnlineMatch = (matchId: string) => rpc<void>('fdi_start_match', { p_match: matchId })
export const toAccusePhase = (matchId: string) => rpc<void>('fdi_to_accuse', { p_match: matchId })
export const voteOnline = (matchId: string, seat: number) =>
  rpc<void>('fdi_vote', { p_match: matchId, p_seat: seat })
export const lastChanceOnline = (matchId: string, guess: string) =>
  rpc<void>('fdi_last_chance', { p_match: matchId, p_guess: guess })
export const nextRoundOnline = (matchId: string) => rpc<void>('fdi_next_round', { p_match: matchId })

export async function fetchOnlineState(matchId: string): Promise<OnlineState> {
  return rpc<OnlineState>('fdi_get_state', { p_match: matchId })
}

export async function fetchMyOnlineMatches(): Promise<OpenMatch[]> {
  return rpc<OpenMatch[]>('fdi_my_matches', {})
}

/**
 * Auf Änderungen horchen. Der Server zählt bei jedem Zug `fdi_state.version`
 * hoch -- das ist das einzige, was Mitglieder direkt lesen dürfen. Kommt eine
 * Änderung, holt die Seite den Spielstand neu.
 */
export function subscribeToOnlineMatch(matchId: string, onChange: () => void): () => void {
  if (!supabase || !isSupabaseConfigured) return () => undefined
  const sb = supabase
  const channel = sb
    .channel(`fdi:${matchId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'fdi_state', filter: `match_id=eq.${matchId}` },
      () => onChange(),
    )
    .subscribe()
  return () => {
    void sb.removeChannel(channel)
  }
}
