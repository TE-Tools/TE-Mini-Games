/**
 * Reihenfolge merken -- Schwierigkeit über die Levelkarte 1–500.
 *
 * Drei Stellschrauben, alle steigen mit dem Level:
 *   - wie viele Felder es gibt (4 → 6 → 9),
 *   - wie lang die Folge ist,
 *   - wie schnell sie vorgespielt wird.
 *
 * Die Folge wird aus dem Startwert gezogen, damit dasselbe Level immer
 * dieselbe Folge zeigt -- nur so lässt sich das Ganze testen.
 */

import { MAX_LEVEL, clampMapLevel } from '@/progression/zones'
import { createRng, intBetween } from '@/games/rng'

export interface ReihenfolgeLevel {
  level: number
  /** Wie viele Felder auf dem Brett liegen. */
  padCount: number
  /** Wie viele Schritte die Folge hat. */
  sequenceLength: number
  /** Wie lange ein Feld aufleuchtet (ms). */
  showMs: number
  /** Pause zwischen zwei Feldern (ms). */
  gapMs: number
  /** Die Folge selbst, als Feld-Nummern von 0 an. */
  sequence: number[]
  seed: string
}

/** Ab wann das Brett wächst. */
export const PAD_STUFEN = [
  { abLevel: 1, pads: 4 },
  { abLevel: 50, pads: 6 },
  { abLevel: 150, pads: 9 },
] as const

export const MAX_SEQUENCE = 24

export function padCountForLevel(level: number): number {
  const L = clampMapLevel(level)
  let pads = 4
  for (const stufe of PAD_STUFEN) if (L >= stufe.abLevel) pads = stufe.pads
  return pads
}

export function sequenceLengthForLevel(level: number): number {
  const L = clampMapLevel(level)
  return Math.min(MAX_SEQUENCE, 3 + Math.floor((L - 1) / 12))
}

/** 0 im Level 1, 1 im Level 500 -- die Grundlage aller Tempokurven. */
function fortschritt(level: number): number {
  return (clampMapLevel(level) - 1) / (MAX_LEVEL - 1)
}

export function showMsForLevel(level: number): number {
  return Math.round(700 - 400 * fortschritt(level))
}

export function gapMsForLevel(level: number): number {
  return Math.round(250 - 150 * fortschritt(level))
}

export function createReihenfolgeLevel(level: number, seed?: string): ReihenfolgeLevel {
  const L = clampMapLevel(level)
  const startwert = seed ?? `reihenfolge-${L}`
  const rng = createRng(startwert)
  const padCount = padCountForLevel(L)
  const sequenceLength = sequenceLengthForLevel(L)

  const sequence: number[] = []
  for (let i = 0; i < sequenceLength; i++) {
    let naechstes = intBetween(rng, 0, padCount - 1)
    // Dasselbe Feld zweimal hintereinander sieht aus wie ein Aussetzer und
    // ist am Handy kaum vom Doppeltippen zu unterscheiden.
    if (i > 0 && naechstes === sequence[i - 1]) {
      naechstes = (naechstes + 1 + Math.floor(rng() * (padCount - 1))) % padCount
    }
    sequence.push(naechstes)
  }

  return {
    level: L,
    padCount,
    sequenceLength,
    showMs: showMsForLevel(L),
    gapMs: gapMsForLevel(L),
    sequence,
    seed: startwert,
  }
}
