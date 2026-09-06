/**
 * Online-Runden für Kniffel.
 *
 * Gewürfelt wird auf dem Server (Migration 017). Das ist hier nicht
 * Vorsicht, sondern notwendig: Beim Kniffel *ist* der Würfel das Spiel.
 * Würfelte der Client, könnte sich jeder seinen Kniffel schreiben -- und
 * anders als bei einer falschen Punktzahl fiele das niemandem auf.
 *
 * Aus demselben Grund rechnet auch die Wertung der Server.
 */

import { supabase, isSupabaseConfigured } from '@/database/supabase'
import { onlineFehlerText } from './onlineFehler'
import type { Block } from '@/games/kniffel'

export const isKniffelOnlineAvailable = isSupabaseConfigured

export interface KniffelOnlinePlayer {
  seat: number
  name: string
  is_you: boolean
  /** Nur die beschriebenen Felder stehen drin. */
  block: Partial<Block>
  punkte: number
  fertig: boolean
}

export interface KniffelOnlineMatch {
  id: string
  code: string
  phase: 'lobby' | 'spiel' | 'ende'
  am_zug: number
  runde: number
  wuerfel: number[]
  gehalten: boolean[]
  wurf_nummer: number
  is_host: boolean
  size: number
}

export interface KniffelOnlineState {
  match: KniffelOnlineMatch
  me: { seat: number }
  players: KniffelOnlinePlayer[]
}

export interface KniffelOpenMatch {
  match_id: string
  code: string
  phase: string
  runde: number
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

export async function createKniffelMatch(
  name?: string,
): Promise<{ match_id: string; code: string }> {
  const rows = await rpc<{ match_id: string; code: string }[]>('kniffel_create_match', {
    p_name: name ?? null,
  })
  const first = Array.isArray(rows)
    ? rows[0]
    : (rows as unknown as { match_id: string; code: string })
  if (!first) throw new Error('Die Runde konnte nicht eröffnet werden.')
  return first
}

export async function joinKniffelMatch(code: string, name?: string): Promise<string> {
  return rpc<string>('kniffel_join_match', {
    p_code: code.trim().toUpperCase(),
    p_name: name ?? null,
  })
}

export const leaveKniffelMatch = (matchId: string) =>
  rpc<void>('kniffel_leave_match', { p_match: matchId })

export const startKniffelMatch = (matchId: string) =>
  rpc<void>('kniffel_start', { p_match: matchId })

export const wuerfelnOnline = (matchId: string, gehalten: boolean[]) =>
  rpc<void>('kniffel_wuerfeln', { p_match: matchId, p_gehalten: gehalten })

export const haltenOnline = (matchId: string, gehalten: boolean[]) =>
  rpc<void>('kniffel_halten', { p_match: matchId, p_gehalten: gehalten })

export const eintragenOnline = (matchId: string, feld: string) =>
  rpc<void>('kniffel_eintragen', { p_match: matchId, p_feld: feld })

export async function fetchKniffelState(matchId: string): Promise<KniffelOnlineState> {
  return rpc<KniffelOnlineState>('kniffel_get_state', { p_match: matchId })
}

export async function fetchMyKniffelMatches(): Promise<KniffelOpenMatch[]> {
  return rpc<KniffelOpenMatch[]>('kniffel_my_matches', {})
}

/**
 * Auf Änderungen horchen. Der Server zählt bei jedem Zug eine Version
 * hoch; wir holen daraufhin den ganzen Zustand neu. Einzelne Felder
 * durchzureichen wäre schneller, aber jede Abweichung zwischen dem, was
 * ankommt, und dem, was gilt, wäre ein Fehler, den man nicht sieht.
 */
export function subscribeToKniffelMatch(matchId: string, onChange: () => void): () => void {
  if (!supabase || !isSupabaseConfigured) return () => undefined
  const sb = supabase
  const channel = sb
    .channel(`kniffel:${matchId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'kniffel_state', filter: `match_id=eq.${matchId}` },
      () => onChange(),
    )
    .subscribe()
  return () => {
    void sb.removeChannel(channel)
  }
}
