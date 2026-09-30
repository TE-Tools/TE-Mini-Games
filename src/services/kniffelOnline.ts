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
import { enqueueOutbox } from '@/offline/outbox'
import { getMyUsername } from '@/auth/authService'
import { onlineFehlerText } from './onlineFehler'
import { raumFunktionen } from './raeume'
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

/* Räume: Lebenszeichen, öffentlich schalten, öffentliche Räume (Migration 018). */
const raum = raumFunktionen('kniffel', client)
export const herzschlagKniffel = raum.herzschlag
export const fetchOeffentlicheKniffelRaeume = raum.oeffentlicheRaeume

export async function createKniffelMatch(
  name?: string,
  oeffentlich = false,
): Promise<{ match_id: string; code: string }> {
  const rows = await rpc<{ match_id: string; code: string }[]>('kniffel_create_match', {
    p_name: name ?? null,
  })
  const first = Array.isArray(rows)
    ? rows[0]
    : (rows as unknown as { match_id: string; code: string })
  if (!first) throw new Error('Die Runde konnte nicht eröffnet werden.')
  if (oeffentlich) await raum.oeffentlichSchalten(first.match_id, true)
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

/* ===================== Bestenliste (Migration 021) ==================== */

export interface KniffelBestenEintrag {
  username: string
  siege: number
  partien: number
  /** Die höchste Punktzahl, mit der dieser Spieler eine Partie gewonnen hat. */
  bester_sieg: number
  /** Die höchste Punktzahl überhaupt -- auch aus verlorenen Partien. */
  bestes_spiel: number
  schnitt: number
  zuletzt: string | null
  /* Dieselben drei Zahlen, aber nur aus Online-Partien (Migration 022). */
  siege_online: number
  partien_online: number
  bester_sieg_online: number
}

export interface KniffelMeinePartie {
  code: string
  punkte: number
  gewonnen: boolean
  mitspieler: number
  /** Lief diese Partie gegen den Rechner? */
  gegen_computer: boolean
  /** Gegen welche Stufe -- nur bei Partien gegen den Rechner gesetzt. */
  ki_stufe: 'leicht' | 'normal' | 'schwer' | null
  beendet_at: string
}

/**
 * Die Bestenliste. Eine Abfrage für beide Listen: "wer gewinnt oft" sortiert
 * nach Siegen, "wer gewinnt hoch" nach dem besten Sieg. Zwei Abfragen auf
 * dieselben Zahlen wären zwei Gelegenheiten, sie verschieden zu zählen.
 *
 * Gezählt werden Online-Partien und Partien gegen den Rechner (Migration
 * 022). Die Online-Zahlen kommen zusätzlich getrennt mit, weil nur sie
 * nachprüfbar sind -- die Liste kann darauf umschalten.
 */
export async function fetchKniffelBestenliste(limit = 20): Promise<KniffelBestenEintrag[]> {
  if (!supabase || !isSupabaseConfigured) return []
  const sb = supabase
  const spalten = 'username, siege, partien, bester_sieg, bestes_spiel, schnitt, zuletzt'
  const { data, error } = await sb
    .from('kniffel_bestenliste')
    .select(`${spalten}, siege_online, partien_online, bester_sieg_online`)
    .order('siege', { ascending: false })
    .limit(limit)
  if (!error && data) return data as KniffelBestenEintrag[]

  // Datenbank noch auf dem Stand von 021: Dort gibt es die drei
  // Online-Spalten nicht -- dort ist aber auch jede Zeile online, also
  // sind die Gesamtzahlen genau die Online-Zahlen.
  const alt = await sb
    .from('kniffel_bestenliste')
    .select(spalten)
    .order('siege', { ascending: false })
    .limit(limit)
  if (alt.error || !alt.data) return []
  return (
    alt.data as Omit<
      KniffelBestenEintrag,
      'siege_online' | 'partien_online' | 'bester_sieg_online'
    >[]
  ).map((e) => ({
    ...e,
    siege_online: e.siege,
    partien_online: e.partien,
    bester_sieg_online: e.bester_sieg,
  }))
}

/**
 * Eine beendete Partie gegen den Rechner melden.
 *
 * ANLASS (30.09.2026, Thomas): "Bitte auch gegen Computer mit auswerten."
 *
 * Anders als online hat der Server hier nichts gesehen -- er bekommt eine
 * Meldung. Deshalb geht sie durch `kniffel_melde_solo` (Migration 022) und
 * nicht als Zeile in die Tabelle: Dort wird geprüft, was prüfbar ist, und
 * der Server entscheidet aus den beiden Punktzahlen selbst, wer gewonnen
 * hat.
 *
 * Der Weg führt über die Warteschlange, nicht direkt: Eine Partie gegen den
 * Rechner kann man im Zug oder im Keller spielen. `partieId` ist dabei die
 * Kennung, an der der Server einen zweiten Versuch als denselben erkennt.
 */
export async function meldeKniffelSoloPartie(partie: {
  partieId: string
  punkte: number
  besterGegner: number
  mitspieler: number
  stufe: 'leicht' | 'normal' | 'schwer' | null
}): Promise<void> {
  if (!isSupabaseConfigured) return
  // Eine Partie allein am Tisch zählt der Server nicht; dann bleibt sie
  // auch der Warteschlange erspart.
  if (partie.mitspieler < 2) return
  await enqueueOutbox('kniffel_partie', { ...partie })
}

/**
 * Unter welchem Namen man selbst in der Bestenliste steht.
 *
 * Das ist der Benutzername aus dem Konto, nicht der Anzeigename: Die View
 * gruppiert über `profiles.username`, und der ist kleingeschrieben. Wer
 * hier den Anzeigenamen hineingibt, findet seine eigene Zeile nicht.
 */
export async function fetchMeinBestenlistenName(): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  return getMyUsername().catch(() => null)
}

/** Die eigenen letzten Partien -- damit man sieht, was gezählt wurde. */
export async function fetchMeineKniffelPartien(limit = 10): Promise<KniffelMeinePartie[]> {
  if (!supabase || !isSupabaseConfigured) return []
  try {
    return await rpc<KniffelMeinePartie[]>('kniffel_meine_partien', { p_limit: limit })
  } catch {
    return []
  }
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
