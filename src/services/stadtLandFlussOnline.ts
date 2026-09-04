/**
 * Online-Runden für "Stadt-Land-Fluss".
 *
 * Gewertet wird auf dem Server (Migration 014) -- wer sich selbst zählt,
 * zählt sich gern zu viel. Ebenso hält der Server die Antworten der anderen
 * zurück, solange geschrieben wird; sonst schriebe man einfach ab.
 */

import { supabase, isSupabaseConfigured } from '@/database/supabase'
import { onlineFehlerText } from './onlineFehler'

export const isSlfOnlineAvailable = isSupabaseConfigured

export interface SlfOnlinePlayer {
  seat: number
  name: string
  is_you: boolean
  submitted: boolean
  /** Fremde Antworten erst in der Auswertung. */
  answers: Record<string, string>
  round_score: number
  total_score: number
}

export interface SlfOnlineMatch {
  id: string
  code: string
  phase: 'lobby' | 'write' | 'result'
  round: number
  letter: string | null
  columns: string[]
  seconds: number
  /** Wann spätestens Schluss ist – Serverzeit. */
  deadline: string | null
  /** Hat schon jemand „fertig" gedrückt? */
  stopped: boolean
  is_host: boolean
  size: number
  open_writers: number
}

export interface SlfOnlineMe {
  seat: number
  name: string
  submitted: boolean
  answers: Record<string, string>
  round_score: number
  total_score: number
}

export interface SlfOnlineState {
  match: SlfOnlineMatch
  me: SlfOnlineMe
  players: SlfOnlinePlayer[]
}

export interface SlfOpenMatch {
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

export async function createSlfMatchOnline(opts: {
  columns: string[]
  seconds: number
  name?: string
}): Promise<{ match_id: string; code: string }> {
  const rows = await rpc<{ match_id: string; code: string }[]>('slf_create_match', {
    p_columns: opts.columns,
    p_seconds: opts.seconds,
    p_name: opts.name ?? null,
  })
  const first = Array.isArray(rows)
    ? rows[0]
    : (rows as unknown as { match_id: string; code: string })
  if (!first) throw new Error('Die Runde konnte nicht eröffnet werden.')
  return first
}

export async function joinSlfMatch(code: string, name?: string): Promise<string> {
  return rpc<string>('slf_join_match', { p_code: code.trim().toUpperCase(), p_name: name ?? null })
}

export const leaveSlfMatch = (matchId: string) => rpc<void>('slf_leave_match', { p_match: matchId })
export const startSlfRound = (matchId: string) => rpc<void>('slf_start_round', { p_match: matchId })
export const submitSlfAnswers = (matchId: string, answers: Record<string, string>) =>
  rpc<void>('slf_submit', { p_match: matchId, p_answers: answers })
export const tickSlf = (matchId: string) => rpc<void>('slf_tick', { p_match: matchId })

export async function fetchSlfState(matchId: string): Promise<SlfOnlineState> {
  return rpc<SlfOnlineState>('slf_get_state', { p_match: matchId })
}

export async function fetchMySlfMatches(): Promise<SlfOpenMatch[]> {
  return rpc<SlfOpenMatch[]>('slf_my_matches', {})
}

export function subscribeToSlfMatch(matchId: string, onChange: () => void): () => void {
  if (!supabase || !isSupabaseConfigured) return () => undefined
  const sb = supabase
  const channel = sb
    .channel(`slf:${matchId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'slf_state', filter: `match_id=eq.${matchId}` },
      () => onChange(),
    )
    .subscribe()
  return () => {
    void sb.removeChannel(channel)
  }
}
