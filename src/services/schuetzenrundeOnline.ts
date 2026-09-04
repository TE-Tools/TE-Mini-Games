/**
 * Schützenrunde online – der Client zur serverseitigen Runde.
 *
 * Die Spielregeln liegen komplett in Postgres (Migration 007). Hier passiert
 * nichts als Aufrufen und Anzeigen: Der Browser kennt weder fremde Rollen noch
 * die Nachtaktionen der anderen, und die Phasenzeit entscheidet der Server.
 *
 * Aktualisiert wird über Supabase Realtime (Zustandszähler `sr_state` und der
 * Chat `sr_messages`). Fällt Realtime aus, greift das Nachfassen im Takt der
 * Seite – deshalb bleibt `fetchState` der einzige Lesepfad.
 */

import { supabase, isSupabaseConfigured } from '@/database/supabase'
import { onlineFehlerText } from './onlineFehler'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type OnlinePhase = 'lobby' | 'night' | 'day' | 'vote' | 'result' | 'over'

export interface OnlinePlayer {
  seat: number
  name: string
  is_bot: boolean
  alive: boolean
  zug_id: string
  acted: boolean
  /** Nur die eigene Rolle, Ausgeschiedene und am Ende alle. */
  role: string | null
}

export interface OnlineMessage {
  seat: number
  name: string
  is_bot: boolean
  text: string
  round: number
}

export interface OnlineVote {
  voter: string
  target: string | null
}

export interface OnlineState {
  match: {
    id: string
    code: string
    phase: OnlinePhase
    round: number
    size: number
    event: boolean
    timers: { night: number; day: number; vote: number; result: number }
    deadline: string | null
    winner: 'bruderschaft' | 'saboteure' | null
    king_seat: number | null
    shots_left: number
    is_host: boolean
    seats_taken: number
  }
  me: {
    seat: number
    role: string | null
    alive: boolean
    acted: boolean
    zug_id: string
    notes: string[]
  }
  players: OnlinePlayer[]
  log: string[]
  messages: OnlineMessage[]
  votes: OnlineVote[]
}

export interface OpenMatch {
  match_id: string
  code: string
  phase: OnlinePhase
  round: number
  size: number
  seats_taken: number
}

export const isOnlineAvailable = isSupabaseConfigured

function client() {
  if (!supabase) throw new Error('Onlinespiel braucht die Supabase-Verbindung.')
  return supabase
}

/** Supabase liefert Fehler als Objekt zurück – daraus einen lesbaren Satz machen. */
function fail(message: string | undefined, fallback: string): never {
  throw new Error(onlineFehlerText(message && message.length > 0 ? message : fallback))
}

async function rpc<T>(name: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await client().rpc(name, args)
  if (error) fail(error.message, fallback)
  return data as T
}

export async function createOnlineMatch(options: {
  size: number
  event: boolean
  zugId: string
  name?: string
}): Promise<{ match_id: string; code: string }> {
  return rpc(
    'sr_create_match',
    {
      p_size: options.size,
      p_event: options.event,
      p_zug: options.zugId,
      p_name: options.name ?? null,
    },
    'Die Runde konnte nicht eröffnet werden.',
  )
}

export async function joinOnlineMatch(
  code: string,
  name?: string,
): Promise<{ match_id: string; code: string; seat?: number }> {
  return rpc(
    'sr_join_match',
    { p_code: code.trim().toUpperCase(), p_name: name ?? null },
    'Beitreten hat nicht geklappt.',
  )
}

export async function leaveOnlineMatch(matchId: string): Promise<void> {
  await rpc('sr_leave_match', { p_match: matchId }, 'Verlassen hat nicht geklappt.')
}

export async function startOnlineMatch(matchId: string): Promise<void> {
  await rpc('sr_start_match', { p_match: matchId }, 'Die Runde konnte nicht starten.')
}

export async function sendNightAction(
  matchId: string,
  action: { targetSeat?: number | null; useShot?: boolean; spreadRumour?: boolean },
): Promise<void> {
  await rpc(
    'sr_night_action',
    {
      p_match: matchId,
      p_target: action.targetSeat ?? null,
      p_use_shot: action.useShot ?? false,
      p_rumour: action.spreadRumour ?? false,
    },
    'Die Nachtaktion kam nicht durch.',
  )
}

export async function sendReady(matchId: string): Promise<void> {
  await rpc('sr_ready', { p_match: matchId }, 'Das hat nicht geklappt.')
}

export async function sendVote(matchId: string, targetSeat: number | null): Promise<void> {
  await rpc('sr_vote', { p_match: matchId, p_target: targetSeat }, 'Die Stimme kam nicht an.')
}

export async function sendChat(matchId: string, text: string): Promise<void> {
  await rpc('sr_say', { p_match: matchId, p_text: text }, 'Die Nachricht kam nicht an.')
}

/**
 * Stößt die Uhr an. Entscheiden tut der Server: Erst wenn dort die Frist
 * abgelaufen ist, wird die Phase aufgelöst.
 */
export async function tickOnlineMatch(matchId: string): Promise<void> {
  await rpc('sr_tick', { p_match: matchId }, 'Die Uhr ließ sich nicht anstoßen.')
}

export async function fetchState(matchId: string): Promise<OnlineState> {
  return rpc('sr_get_state', { p_match: matchId }, 'Der Spielstand kam nicht an.')
}

export async function fetchOpenMatches(): Promise<OpenMatch[]> {
  return rpc('sr_my_matches', {}, 'Deine Runden ließen sich nicht laden.')
}

/**
 * Auf Änderungen der Runde hören. `onChange` läuft bei jeder Server-Änderung
 * und bei jeder Chatnachricht – der Aufrufer holt dann den Spielstand neu.
 */
export function subscribeToMatch(matchId: string, onChange: () => void): () => void {
  if (!supabase) return () => {}
  const sb = supabase
  const channel: RealtimeChannel = sb
    .channel(`sr:${matchId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sr_state', filter: `match_id=eq.${matchId}` },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'sr_messages', filter: `match_id=eq.${matchId}` },
      onChange,
    )
    .subscribe()

  return () => {
    void sb.removeChannel(channel)
  }
}
