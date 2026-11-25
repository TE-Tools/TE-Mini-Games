/**
 * Wo der Tag der Tagesaufgaben und das zuletzt gefeierte Level liegen.
 *
 * Im localStorage, nicht in IndexedDB: Es ist ein kleiner Zettel pro Gerät,
 * der um Mitternacht ohnehin verfällt, und es braucht dafür keine neue
 * Datenbankversion. Ohne Speicher (privater Modus) gilt der Stand nur für
 * die Sitzung -- verloren geht dabei nichts, denn die XP stehen im Profil.
 *
 * Ein Konto braucht keine eigene Tabelle: Die Aufgaben-XP laufen über
 * `addXp` und damit über denselben Abgleich wie jede andere XP.
 */

import type { Tagesstand } from './tagesaufgaben'

const AUFGABEN_SCHLUESSEL = 'te-mini-games:tagesaufgaben'
const LEVEL_SCHLUESSEL = 'te-mini-games:gefeiertes-level'

/** Ersatz, falls localStorage fehlt oder wirft. */
const fluechtig = new Map<string, string>()

function lies(schluessel: string): string | null {
  try {
    return window.localStorage.getItem(schluessel)
  } catch {
    return fluechtig.get(schluessel) ?? null
  }
}

function schreib(schluessel: string, wert: string): void {
  try {
    window.localStorage.setItem(schluessel, wert)
  } catch {
    fluechtig.set(schluessel, wert)
  }
}

function istTagesstand(x: unknown): x is Tagesstand {
  if (!x || typeof x !== 'object') return false
  const s = x as Record<string, unknown>
  return (
    typeof s['datum'] === 'string' &&
    Array.isArray(s['zuege']) &&
    Array.isArray(s['erledigt']) &&
    typeof s['alleBelohnt'] === 'boolean'
  )
}

export function leseTagesstand(userId: string): Tagesstand | null {
  const roh = lies(`${AUFGABEN_SCHLUESSEL}:${userId}`)
  if (!roh) return null
  try {
    const wert: unknown = JSON.parse(roh)
    return istTagesstand(wert) ? wert : null
  } catch {
    return null
  }
}

export function schreibeTagesstand(userId: string, stand: Tagesstand): void {
  schreib(`${AUFGABEN_SCHLUESSEL}:${userId}`, JSON.stringify(stand))
}

export function leseGefeiertesLevel(userId: string): number | null {
  const roh = lies(`${LEVEL_SCHLUESSEL}:${userId}`)
  const n = roh === null ? NaN : Number(roh)
  return Number.isFinite(n) ? n : null
}

export function schreibeGefeiertesLevel(userId: string, level: number): void {
  schreib(`${LEVEL_SCHLUESSEL}:${userId}`, String(level))
}

/**
 * Ob ein Aufstieg zu feiern ist, rein gerechnet.
 *
 * - Noch nie etwas gemerkt: nichts feiern, nur merken. Sonst feierte das
 *   erste Spiel nach dem Einbau ein Level, das jemand längst hatte.
 * - Höher als gemerkt: feiern, das neue Level merken (zwei auf einmal sind
 *   eine Feier, mit dem neuen Level).
 * - Niedriger (Daten zurückgesetzt): ohne Feier herabsetzen, damit der
 *   nächste echte Aufstieg wieder zählt.
 */
export function aufstiegPruefen(
  gemerkt: number | null,
  jetzt: number,
): { feiern: number | null; merken: number } {
  if (gemerkt === null) return { feiern: null, merken: jetzt }
  if (jetzt > gemerkt) return { feiern: jetzt, merken: jetzt }
  return { feiern: null, merken: jetzt }
}
