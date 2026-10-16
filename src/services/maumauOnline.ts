/**
 * Online-Runden für Mau-Mau und Letzte Karte.
 *
 * Gemischt wird auf dem Server (Migration 023), und der Server prüft jeden
 * Zug. Das ist hier nicht Vorsicht, sondern notwendig: Bei einem
 * Kartenspiel ist das Blatt das Spiel. Wer die Reihenfolge des Stapels
 * kennt, kennt jede fremde Hand -- ein Startwert, aus dem alle Clients
 * dieselbe Mischung rechnen (der Weg von Schützenopoly), wäre hier also
 * das Falscheste.
 *
 * Deshalb kommt von `mm_get_state` auch nur, was man sehen darf: die
 * eigene Hand ganz, von den anderen die Anzahl. Verdeckte Karten erreichen
 * den Browser gar nicht -- was dort ankommt, kann man sich ansehen.
 *
 * Entwurf: docs/design/kartenspiele-online/README.md
 */

import { supabase, isSupabaseConfigured } from '@/database/supabase'
import { onlineFehlerText } from './onlineFehler'
import { raumFunktionen, type OeffentlicherRaum } from './raeume'
import type { AktiveRegeln, Karte, Konter, Spielart } from '@/games/maumau'

export const isMauMauOnlineAvailable = isSupabaseConfigured

/** Welche Kachel -- davon hängt ab, welche Blätter in Frage kommen. */
export type MauSpiel = 'maumau' | 'letzte-karte'

export interface MauOnlineSpieler {
  seat: number
  name: string
  is_you: boolean
  /** Wie viele Karten -- die Karten selbst nur am Ende der Partie. */
  karten: number
  mau: boolean
  platz: number | null
  /** Erst nach der Partie gesetzt: Dann liegen alle Hände offen. */
  hand: Karte[] | null
  punkte: number
}

export interface MauOnlineMatch {
  id: string
  code: string
  spiel: MauSpiel
  phase: 'lobby' | 'spiel' | 'ende'
  regeln: AktiveRegeln
  is_host: boolean
  is_public: boolean
  size: number
  /** Sitzplatznummer, nicht Index -- null im Vorraum. */
  am_zug: number | null
  richtung: 1 | -1
  oberste: Karte | null
  wunsch: string | null
  strafe: number
  /** Nur die Anzahl: Wer weiss, was oben liegt, weiss alles. */
  stapel: number
  ablage: number
  letzter_leger: number | null
  sieger: number | null
  protokoll: string[]
}

export interface MauOnlineState {
  match: MauOnlineMatch
  me: {
    seat: number
    hand: Karte[]
    mau: boolean
    /** Die eben gezogene Karte, die noch gelegt werden darf. */
    gezogene: Karte | null
  }
  players: MauOnlineSpieler[]
}

export interface MauOffeneRunde {
  match_id: string
  code: string
  spiel: MauSpiel
  phase: string
  size: number
}

/** Was sich an den Regeln einzeln umlegen lässt (wie im Solospiel). */
export interface MauHausregeln {
  konter?: Partial<Konter>
  ziehenBisPassend?: boolean
  haendeWandern?: boolean
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

/* Räume: Lebenszeichen und öffentlich schalten wie bei allen Spielen. */
const raum = raumFunktionen('mm', client)
export const herzschlagMauMau = raum.herzschlag
export const oeffentlichSchaltenMauMau = raum.oeffentlichSchalten

/**
 * Die öffentlichen Räume -- je Kachel getrennt.
 *
 * Beide Kacheln teilen sich die Tabellen (eine Engine), aber nicht die
 * Liste: Ein Raum für „Letzte Karte" hat in der Mau-Mau-Lobby nichts zu
 * suchen, dort liegt ein anderes Blatt.
 */
export const fetchOeffentlicheMauMauRaeume = () =>
  rpc<OeffentlicherRaum[]>('mm_public_matches', { p_spiel: 'maumau' })
export const fetchOeffentlicheLetzteKarteRaeume = () =>
  rpc<OeffentlicherRaum[]>('mm_public_matches', { p_spiel: 'letzte-karte' })

export async function createMauMauMatch(
  spiel: MauSpiel,
  art: Spielart,
  hausregeln: MauHausregeln,
  name?: string,
  oeffentlich = false,
): Promise<{ match_id: string; code: string }> {
  const rows = await rpc<{ match_id: string; code: string }[]>('mm_create_match', {
    p_spiel: spiel,
    p_art: art,
    p_hausregeln: hausregeln,
    p_name: name ?? null,
  })
  const first = Array.isArray(rows)
    ? rows[0]
    : (rows as unknown as { match_id: string; code: string })
  if (!first) throw new Error('Die Runde konnte nicht eröffnet werden.')
  if (oeffentlich) await raum.oeffentlichSchalten(first.match_id, true)
  return first
}

export const setzeMauRegeln = (matchId: string, art: Spielart, hausregeln: MauHausregeln) =>
  rpc<void>('mm_set_regeln', { p_match: matchId, p_art: art, p_hausregeln: hausregeln })

export const joinMauMauMatch = (code: string, name?: string) =>
  rpc<string>('mm_join_match', { p_code: code.trim().toUpperCase(), p_name: name ?? null })

export const leaveMauMauMatch = (matchId: string) =>
  rpc<void>('mm_leave_match', { p_match: matchId })

export const startMauMauMatch = (matchId: string) => rpc<void>('mm_start', { p_match: matchId })

export const legenOnline = (matchId: string, karte: string, wunsch?: string | null) =>
  rpc<void>('mm_legen', { p_match: matchId, p_karte: karte, p_wunsch: wunsch ?? null })

export const ziehenOnline = (matchId: string) => rpc<void>('mm_ziehen', { p_match: matchId })

export const behaltenOnline = (matchId: string) => rpc<void>('mm_behalten', { p_match: matchId })

export const mauSagenOnline = (matchId: string) => rpc<void>('mm_mau', { p_match: matchId })

export const fetchMauMauState = (matchId: string) =>
  rpc<MauOnlineState>('mm_get_state', { p_match: matchId })

export const fetchMeineMauMauRunden = (spiel: MauSpiel) =>
  rpc<MauOffeneRunde[]>('mm_my_matches', { p_spiel: spiel })

/**
 * Auf Änderungen horchen. Der Server zählt bei jedem Zug eine Version
 * hoch; wir holen daraufhin den ganzen Zustand neu. Einzelne Felder
 * durchzureichen wäre schneller, aber jede Abweichung zwischen dem, was
 * ankommt, und dem, was gilt, wäre ein Fehler, den man nicht sieht.
 */
export function subscribeToMauMauMatch(matchId: string, onChange: () => void): () => void {
  if (!supabase || !isSupabaseConfigured) return () => undefined
  const sb = supabase
  const channel = sb
    .channel(`mm:${matchId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'mm_state', filter: `match_id=eq.${matchId}` },
      () => onChange(),
    )
    .subscribe()
  return () => {
    void sb.removeChannel(channel)
  }
}
