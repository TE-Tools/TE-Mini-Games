/**
 * Kopfrechnen -- Punkte, Sterne, XP.
 *
 * 100 Punkte je richtiger Aufgabe. Wer alle zehn hat, bekommt für die
 * übrige Zeit einen Zuschlag -- sonst lohnte es sich, bis zur letzten
 * Sekunde zu grübeln. XP und ein neues Level gibt es ab acht Richtigen;
 * bei zehn Aufgaben gegen die Uhr wäre "alles oder nichts" zu hart.
 */

import { MAX_LEVEL } from '@/progression/zones'
import { AUFGABEN_JE_RUNDE, NOETIG_ZUM_BESTEHEN } from './level'

export interface KopfrechnenScoreInput {
  correct: number
  /** Wie viele Sekunden am Ende noch übrig waren. */
  secondsLeft: number
  level: number
}

export interface KopfrechnenScoreResult {
  score: number
  stars: number
  xp: number
  passed: boolean
  timeBonus: number
}

/** Höchstens so viele Punkte kann die Restzeit bringen. */
export const MAX_ZEIT_BONUS = 250

export function calculateKopfrechnenScore(
  input: KopfrechnenScoreInput,
): KopfrechnenScoreResult {
  const level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(input.level)))
  const correct = Math.max(0, Math.min(AUFGABEN_JE_RUNDE, Math.floor(input.correct)))
  const passed = correct >= NOETIG_ZUM_BESTEHEN

  const timeBonus =
    correct === AUFGABEN_JE_RUNDE
      ? Math.min(MAX_ZEIT_BONUS, Math.max(0, Math.floor(input.secondsLeft)) * 5)
      : 0

  return {
    score: correct * 100 + timeBonus,
    stars: Math.max(0, Math.min(5, Math.floor(correct / 2))),
    xp: passed ? 50 + Math.floor(level / 2) : 0,
    passed,
    timeBonus,
  }
}
