/**
 * Kopfrechnen -- zehn Aufgaben gegen die Uhr, Schwierigkeit über die
 * Levelkarte 1–500.
 *
 * Der Aufbau folgt dem, was man im Kopf noch schafft:
 *   1–24     Plus und Minus bis 20
 *   25–74    dazu das kleine Einmaleins
 *   75–149   dazu Teilen (immer glatt) und Zahlen bis 100
 *   150–299  zwei Rechenschritte, Zahlen bis 500
 *   ab 300   drei Zahlen, auch mit negativem Zwischenergebnis
 *
 * Alle Aufgaben kommen aus dem Startwert, damit dasselbe Level immer
 * dieselben Aufgaben zeigt.
 */

import { MAX_LEVEL, clampMapLevel } from '@/progression/zones'
import { createRng, intBetween } from '@/games/rng'

export interface RechenAufgabe {
  /** So steht sie auf dem Bildschirm, z. B. "7 · 8". */
  text: string
  answer: number
}

export interface KopfrechnenLevel {
  level: number
  tasks: RechenAufgabe[]
  /** Zeit für die ganze Runde. */
  seconds: number
  seed: string
}

/** Zehn Aufgaben je Runde -- kurz genug für "nur noch eine Runde". */
export const AUFGABEN_JE_RUNDE = 10

/** So viele der zehn müssen stimmen, damit das Level als geschafft gilt. */
export const NOETIG_ZUM_BESTEHEN = 8

export type Stufe = 'grund' | 'malnehmen' | 'teilen' | 'zweischritt' | 'dreizahlen'

export function stufeForLevel(level: number): Stufe {
  const L = clampMapLevel(level)
  if (L < 25) return 'grund'
  if (L < 75) return 'malnehmen'
  if (L < 150) return 'teilen'
  if (L < 300) return 'zweischritt'
  return 'dreizahlen'
}

/** 0 im Level 1, 1 im Level 500. */
function fortschritt(level: number): number {
  return (clampMapLevel(level) - 1) / (MAX_LEVEL - 1)
}

export function secondsForLevel(level: number): number {
  return Math.round(90 - 45 * fortschritt(level))
}

function plusMinus(rng: () => number, max: number): RechenAufgabe {
  const a = intBetween(rng, 2, max)
  const b = intBetween(rng, 2, max)
  if (rng() < 0.5) return { text: `${a} + ${b}`, answer: a + b }
  // Minus nie unter null: das kommt erst bei den drei Zahlen.
  const gross = Math.max(a, b)
  const klein = Math.min(a, b)
  return { text: `${gross} − ${klein}`, answer: gross - klein }
}

function malnehmen(rng: () => number, max: number): RechenAufgabe {
  const a = intBetween(rng, 2, max)
  const b = intBetween(rng, 2, 10)
  return { text: `${a} · ${b}`, answer: a * b }
}

function teilen(rng: () => number, max: number): RechenAufgabe {
  // Rückwärts gebaut, damit es immer glatt aufgeht.
  const b = intBetween(rng, 2, 12)
  const ergebnis = intBetween(rng, 2, max)
  return { text: `${b * ergebnis} : ${b}`, answer: ergebnis }
}

function zweiSchritte(rng: () => number, max: number): RechenAufgabe {
  const a = intBetween(rng, 2, max)
  const b = intBetween(rng, 2, 12)
  const c = intBetween(rng, 2, 9)
  if (rng() < 0.5) return { text: `${a} + ${b} · ${c}`, answer: a + b * c }
  return { text: `${b} · ${c} − ${a}`, answer: b * c - a }
}

function dreiZahlen(rng: () => number, max: number): RechenAufgabe {
  const a = intBetween(rng, 10, max)
  const b = intBetween(rng, 10, max)
  const c = intBetween(rng, 2, 12)
  const w = rng()
  if (w < 0.34) return { text: `${a} + ${b} − ${c}`, answer: a + b - c }
  // Hier darf das Ergebnis auch negativ werden -- ab dieser Stufe gehört das
  // dazu.
  if (w < 0.67) return { text: `${a} − ${b} + ${c}`, answer: a - b + c }
  // Rückwärts gebaut, damit die Klammer glatt aufgeht: Wer im Kopf runden
  // soll, hält sich selbst für zu dumm, obwohl die Aufgabe schuld ist.
  const summe = intBetween(rng, 2, Math.max(3, Math.floor(max / c)))
  const teil = intBetween(rng, 1, summe * c - 1)
  return { text: `(${teil} + ${summe * c - teil}) : ${c}`, answer: summe }
}

function aufgabeFor(stufe: Stufe, level: number, rng: () => number): RechenAufgabe {
  const L = clampMapLevel(level)
  switch (stufe) {
    case 'grund':
      return plusMinus(rng, 20)
    case 'malnehmen':
      return rng() < 0.5 ? plusMinus(rng, 50) : malnehmen(rng, 10)
    case 'teilen': {
      const w = rng()
      if (w < 0.35) return malnehmen(rng, 12)
      if (w < 0.7) return teilen(rng, 12)
      return plusMinus(rng, 100)
    }
    case 'zweischritt':
      return rng() < 0.6 ? zweiSchritte(rng, 100) : plusMinus(rng, 500)
    case 'dreizahlen':
    default:
      return rng() < 0.6 ? dreiZahlen(rng, Math.min(1000, 200 + L)) : zweiSchritte(rng, 200)
  }
}

export function createKopfrechnenLevel(level: number, seed?: string): KopfrechnenLevel {
  const L = clampMapLevel(level)
  const startwert = seed ?? `kopfrechnen-${L}`
  const rng = createRng(startwert)
  const stufe = stufeForLevel(L)

  const tasks: RechenAufgabe[] = []
  const gesehen = new Set<string>()
  // Zweimal dieselbe Aufgabe in einer Runde wäre geschenkt -- notfalls
  // brechen wir nach genug Versuchen ab, damit hier nie eine Schleife hängt.
  for (let versuch = 0; tasks.length < AUFGABEN_JE_RUNDE && versuch < 200; versuch++) {
    const a = aufgabeFor(stufe, L, rng)
    if (gesehen.has(a.text)) continue
    gesehen.add(a.text)
    tasks.push(a)
  }
  while (tasks.length < AUFGABEN_JE_RUNDE) tasks.push(aufgabeFor(stufe, L, rng))

  return { level: L, tasks, seconds: secondsForLevel(L), seed: startwert }
}
