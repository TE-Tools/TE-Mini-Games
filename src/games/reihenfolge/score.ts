/**
 * Reihenfolge merken -- Punkte, Sterne, XP.
 *
 * Die ganze Folge richtig = 1000 Punkte. Wer vorher danebengreift, bekommt
 * anteilig Punkte für das, was er geschafft hat -- aber **keine XP** und
 * kein neues Level. So bleibt der Rekord ehrlich: XP gibt es nur für eine
 * fehlerfreie Runde, genau wie bei "Was fehlt?".
 */

import { MAX_LEVEL } from '@/progression/zones'

export interface ReihenfolgeScoreInput {
  /** Wie viele Schritte richtig wiederholt wurden. */
  correctSteps: number
  /** Wie lang die Folge war. */
  sequenceLength: number
  level: number
}

export interface ReihenfolgeScoreResult {
  score: number
  stars: number
  xp: number
  complete: boolean
}

export function calculateReihenfolgeScore(
  input: ReihenfolgeScoreInput,
): ReihenfolgeScoreResult {
  const level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(input.level)))
  const laenge = Math.max(1, Math.floor(input.sequenceLength))
  const richtig = Math.max(0, Math.min(laenge, Math.floor(input.correctSteps)))
  const complete = richtig >= laenge

  if (complete) {
    return { score: 1000, stars: 5, xp: 50 + Math.floor(level / 2), complete: true }
  }

  const anteil = richtig / laenge
  return {
    score: Math.floor(900 * anteil),
    stars: Math.min(4, Math.floor(anteil * 5)),
    xp: 0,
    complete: false,
  }
}
