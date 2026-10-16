/**
 * Online-Turniere für Texas Hold'em.
 *
 * Gemischt wird auf dem Server (Migration 024), und der Server prüft
 * jeden Einsatz und rechnet den Showdown aus. Zwei verdeckte Karten sind
 * beim Hold'em das ganze Spiel -- mischte der Client, kennte er jede
 * fremde Hand.
 *
 * Von `th_get_state` kommt darum nur, was man sehen darf: die eigenen
 * zwei Karten, und fremde erst beim Showdown und nur von denen, die bis
 * dahin mitgegangen sind. Wer wegwirft, zeigt nicht.
 *
 * Balancing bleibt in config.ts: Startchips, Blindstufen und Hände je
 * Stufe gehen beim Eröffnen mit und stehen dann in der Partie. Der Server
 * prüft nur, dass nichts Unsinniges dabei ist.
 *
 * Entwurf: docs/design/kartenspiele-online/README.md
 */

import { supabase, isSupabaseConfigured } from '@/database/supabase'
import { onlineFehlerText } from './onlineFehler'
import { raumFunktionen, type OeffentlicherRaum } from './raeume'
import {
  BLIND_STUFEN,
  HAENDE_JE_STUFE,
  START_CHIPS,
  type Aktion,
  type Karte,
  type Phase,
  type SpielerStatus,
} from '@/games/texas-holdem'

export const isTexasOnlineAvailable = isSupabaseConfigured

/** Ein Handwert, wie der Server ihn zurückgibt -- ohne die fünf Karten. */
export interface OnlineHandwert {
  klasse: number
  werte: number[]
}

export interface TexasOnlineSpieler {
  seat: number
  name: string
  is_you: boolean
  chips: number
  einsatz: number
  gesamt: number
  status: SpielerStatus
  gehandelt: boolean
  platz: number | null
  /** Nur die eigenen -- und beim Showdown die der Mitgegangenen. */
  karten: Karte[] | null
}

export interface TexasOnlineErgebnis {
  anteile: { seat: number; betrag: number; hand: OnlineHandwert | null }[]
  /** Wurden die Karten gezeigt, oder haben alle anderen weggeworfen? */
  gezeigt: boolean
  board: Karte[]
}

export interface TexasOnlineMatch {
  id: string
  code: string
  phase: 'lobby' | 'spiel' | 'ende'
  is_host: boolean
  is_public: boolean
  size: number
  aufbau: {
    start_chips: number
    haende_je_stufe: number
    blinds: { klein: number; gross: number }[]
  }
  /** Wo die laufende Hand steht -- preflop bis showdown. */
  runde: Phase
  hand_nr: number
  blind_stufe: number
  blinds: { klein: number; gross: number } | null
  board: Karte[]
  pot: number
  hoechster: number
  /** Sitzplatznummern, nicht Indizes. */
  am_zug: number | null
  dealer: number | null
  sieger: number | null
  ergebnis: TexasOnlineErgebnis | null
  protokoll: string[]
}

/** Was jetzt geht -- gerechnet vom Server, der es ohnehin entscheidet. */
export interface OnlineMoeglichkeiten {
  folden: boolean
  schieben: boolean
  mitgehen: number | null
  erhoehen: { min: number; max: number } | null
}

export interface TexasOnlineState {
  match: TexasOnlineMatch
  me: {
    seat: number
    karten: Karte[]
    moeglichkeiten: OnlineMoeglichkeiten
  }
  players: TexasOnlineSpieler[]
}

export interface TexasOffeneRunde {
  match_id: string
  code: string
  phase: string
  hand_nr: number
  size: number
}

function client() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Für Online-Turniere fehlt die Verbindung zum Konto-Server.')
  }
  return supabase
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(name, args)
  if (error) throw new Error(onlineFehlerText(error))
  return data as T
}

const raum = raumFunktionen('th', client)
export const herzschlagTexas = raum.herzschlag
export const fetchOeffentlicheTexasRaeume = () => rpc<OeffentlicherRaum[]>('th_public_matches', {})

/**
 * Der Aufbau, mit dem ein Tisch eröffnet wird.
 *
 * Kommt aus config.ts und nicht aus SQL: Die Balancingwerte liegen
 * ausschliesslich dort (AGENTS.md). Der Server prüft sie nur.
 */
export function aufbauAusConfig(): TexasOnlineMatch['aufbau'] {
  return {
    start_chips: START_CHIPS,
    haende_je_stufe: HAENDE_JE_STUFE,
    blinds: BLIND_STUFEN.map((b) => ({ klein: b.klein, gross: b.gross })),
  }
}

export async function createTexasMatch(
  name?: string,
  oeffentlich = false,
): Promise<{ match_id: string; code: string }> {
  const rows = await rpc<{ match_id: string; code: string }[]>('th_create_match', {
    p_aufbau: aufbauAusConfig(),
    p_name: name ?? null,
  })
  const first = Array.isArray(rows)
    ? rows[0]
    : (rows as unknown as { match_id: string; code: string })
  if (!first) throw new Error('Der Tisch konnte nicht eröffnet werden.')
  if (oeffentlich) await raum.oeffentlichSchalten(first.match_id, true)
  return first
}

export const joinTexasMatch = (code: string, name?: string) =>
  rpc<string>('th_join_match', { p_code: code.trim().toUpperCase(), p_name: name ?? null })

export const leaveTexasMatch = (matchId: string) =>
  rpc<void>('th_leave_match', { p_match: matchId })

export const startTexasMatch = (matchId: string) => rpc<void>('th_start', { p_match: matchId })

export const handelnOnline = (matchId: string, aktion: Aktion) =>
  rpc<void>('th_handeln', { p_match: matchId, p_aktion: aktion })

export const naechsteHandOnline = (matchId: string) =>
  rpc<void>('th_naechste_hand', { p_match: matchId })

export const fetchTexasState = (matchId: string) =>
  rpc<TexasOnlineState>('th_get_state', { p_match: matchId })

export const fetchMeineTexasRunden = () => rpc<TexasOffeneRunde[]>('th_my_matches', {})

/**
 * Auf Änderungen horchen. Der Server zählt bei jedem Zug eine Version
 * hoch; wir holen daraufhin den ganzen Zustand neu.
 */
export function subscribeToTexasMatch(matchId: string, onChange: () => void): () => void {
  if (!supabase || !isSupabaseConfigured) return () => undefined
  const sb = supabase
  const channel = sb
    .channel(`th:${matchId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'th_state', filter: `match_id=eq.${matchId}` },
      () => onChange(),
    )
    .subscribe()
  return () => {
    void sb.removeChannel(channel)
  }
}
