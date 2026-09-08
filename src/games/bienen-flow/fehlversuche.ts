/**
 * Wie oft ein Level schon schiefgegangen ist – und der Bonus-Platz daraus.
 *
 * Thomas am 08.09.2026: "Sollte man 10 mal versagt haben an einem Level,
 * soll ein Bonus-Platz kommen, also 6. Platz zum Reinlegen." Ein sechster
 * Platz nimmt genau den Druck weg, an dem man hängengeblieben ist: Man darf
 * einen wartenden Block mehr parken, ohne dass die Kolonie steht.
 *
 * Der Zähler steht bewusst nur auf diesem Gerät (localStorage) und nicht im
 * Konto: Er gehört zum Sitzen an genau diesem Level, nicht zum Spielstand.
 * Beim Sieg wird er gelöscht -- wer das Level noch einmal spielt, spielt es
 * wieder mit fünf Plätzen.
 */

import { SLOT_COUNT } from './types'

const SCHLUESSEL = 'bienen-flow:fehlversuche'

/** Ab so vielen Fehlversuchen gibt es den zusätzlichen Platz. */
export const BONUS_AB = 10

/** Der Bonus-Platz ist genau einer. */
export const BONUS_PLAETZE = 1

function speicher(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    // Safari im privaten Modus wirft beim bloßen Zugriff.
    return null
  }
}

function lies(): Record<string, number> {
  const s = speicher()
  if (!s) return {}
  try {
    const roh = s.getItem(SCHLUESSEL)
    if (!roh) return {}
    const daten: unknown = JSON.parse(roh)
    if (!daten || typeof daten !== 'object') return {}
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(daten as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = Math.floor(v)
    }
    return out
  } catch {
    return {}
  }
}

function schreib(daten: Record<string, number>): void {
  const s = speicher()
  if (!s) return
  try {
    s.setItem(SCHLUESSEL, JSON.stringify(daten))
  } catch {
    // Voller Speicher darf das Spiel nicht anhalten.
  }
}

export function fehlversuche(level: number): number {
  return lies()[String(level)] ?? 0
}

/** Nach einer verlorenen Runde: hochzählen und den neuen Stand zurückgeben. */
export function zaehleFehlversuch(level: number): number {
  const daten = lies()
  const neu = (daten[String(level)] ?? 0) + 1
  daten[String(level)] = neu
  schreib(daten)
  return neu
}

/** Nach dem Sieg: Das Level ist geschafft, der Zähler kann weg. */
export function loescheFehlversuche(level: number): void {
  const daten = lies()
  if (daten[String(level)] === undefined) return
  delete daten[String(level)]
  schreib(daten)
}

/** Wie viele Plätze dieses Level gerade hat: fünf, nach zehn Pleiten sechs. */
export function plaetzeFuer(level: number): number {
  return fehlversuche(level) >= BONUS_AB ? SLOT_COUNT + BONUS_PLAETZE : SLOT_COUNT
}
