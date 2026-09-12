/**
 * Was alle Online-Räume gemeinsam haben -- egal ob Kniffel oder Imposter.
 *
 * Seit Migration 018 werden Räume nach zwanzig Minuten ohne Lebenszeichen
 * gelöscht, und ein Gastgeber kann seinen Raum öffentlich machen. Die fünf
 * Spiele haben je eigene Funktionen dafür (sr_*, fdi_*, wbi_*, slf_*,
 * kniffel_*), aber dieselbe Form. Hier steht das Gemeinsame: die Fristen,
 * der Wortlaut, die Erkennung eines verschwundenen Raums.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { onlineFehlerText } from './onlineFehler'

/** Nach so vielen Minuten ohne Lebenszeichen ist ein Raum weg (Migration 018). */
export const RAUM_FRIST_MINUTEN = 20

/** So oft schickt ein offener Raum ein Lebenszeichen. */
export const HERZSCHLAG_MS = 60 * 1000

/** So oft wird die Liste der öffentlichen Räume in der Lobby erneuert. */
export const OEFFENTLICH_ERNEUERN_MS = 10 * 1000

export const RAUM_GESCHLOSSEN_TEXT = `Der Raum wurde geschlossen – ${RAUM_FRIST_MINUTEN} Minuten lang war niemand mehr darin.`

/** Ein öffentlicher Raum, wie ihn `*_public_matches` liefert. */
export interface OeffentlicherRaum {
  match_id: string
  code: string
  /** Wer den Raum eröffnet hat. */
  host_name: string
  /** Wie viele schon drin sind. */
  size: number
  /** Wie viele hineinpassen -- null, wenn das Spiel keine Grenze kennt. */
  plaetze: number | null
  /** Die Namen aller, die schon drin sind, der Gastgeber zuerst. */
  spieler: string[]
  created_at: string
}

/** Der Suchparameter, mit dem eine Spielseite direkt in einen Raum führt. */
export const RAUM_PARAM = 'raum'

/**
 * Der Server meldet einen gelöschten Raum je nach Funktion anders: "Runde
 * nicht gefunden", "Du bist in dieser Runde nicht dabei" oder die Rechte-
 * Übersetzung aus onlineFehler. Alle drei heißen für den Spieler dasselbe.
 */
const RAUM_WEG = /nicht gefunden|nicht dabei|gibt es nicht|noch in dieser Runde dabei/i

export function istRaumWeg(fehler: unknown): boolean {
  const text = fehler instanceof Error ? fehler.message : String(fehler ?? '')
  return RAUM_WEG.test(text)
}

/**
 * Die drei Aufrufe, die jedes Spiel gleich hat -- mit dem Präfix seiner
 * Funktionen (`kniffel`, `fdi`, …). Die Spiele-Dienste binden das ein,
 * statt es fünfmal zu schreiben.
 */
export function raumFunktionen(praefix: string, client: () => SupabaseClient) {
  async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await client().rpc(name, args)
    if (error) throw new Error(onlineFehlerText(error))
    return data as T
  }
  return {
    /** Lebenszeichen -- hält den Raum offen, solange jemand darin ist. */
    herzschlag: (matchId: string) =>
      rpc<void>(`${praefix}_heartbeat`, { p_match: matchId }).catch(() => undefined),
    /** Nur der Gastgeber, nur im Vorraum. */
    oeffentlichSchalten: (matchId: string, oeffentlich: boolean) =>
      rpc<void>(`${praefix}_set_public`, { p_match: matchId, p_public: oeffentlich }),
    /** Alle öffentlichen Räume dieses Spiels, die noch im Vorraum stehen. */
    oeffentlicheRaeume: () => rpc<OeffentlicherRaum[]>(`${praefix}_public_matches`, {}),
  }
}
