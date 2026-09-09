import type { GameDefinition } from '@/games/types'
import { DUMPLING_MAX_LEVEL } from './types'
import { createDumplingLevel } from './level'

/**
 * Die Wertung.
 *
 * Punkte gibt es für die eingesammelten Knödel, für die Restzeit (wer
 * schnell ist, plant besser) und für die längste Kette -- das ist der Zug,
 * bei dem nach dem Auflösen von allein weiter etwas zusammenfällt, und
 * genau danach sucht man in einem Drei-gewinnt-Spiel.
 */
export const squishyDumplingsGame: GameDefinition = {
  id: 'squishy-dumplings',
  name: 'Squishy Dumplings',
  description:
    'Schieb einen Knödel, bis drei gleiche in einer Reihe stehen. Sammle das Ziel, bevor die Zeit um ist – und hol dir neue Knödel für deine Sammlung.',
  icon: '🥟',
  maxLevel: DUMPLING_MAX_LEVEL,
  createLevel: (level, seed) => {
    void seed
    const cfg = createDumplingLevel(level)
    return {
      level: cfg.level,
      rows: cfg.rows,
      cols: cfg.cols,
      farben: cfg.farben,
      ziel: cfg.ziel,
      zeit: cfg.zeit,
      kaefige: cfg.kaefige,
      isGate: cfg.isGate,
      label: cfg.label,
    }
  },
  calculateScore: (level, rawResult) => {
    const raw = rawResult as {
      won?: boolean
      gesammelt?: number
      restzeit?: number
      besteKette?: number
    }
    if (!raw.won) return 0
    const gesammelt = Math.max(0, raw.gesammelt ?? 0)
    const restzeit = Math.max(0, Math.round(raw.restzeit ?? 0))
    const kette = Math.max(1, raw.besteKette ?? 1)
    return 300 + level * 6 + gesammelt * 4 + restzeit * 8 + (kette - 1) * 40
  },
  calculateXP: (level, score) => {
    if (score <= 0) return 0
    return 15 + Math.floor(level / 5) + Math.floor(score / 100)
  },
  calculateStars: (level, score) => {
    if (score <= 0) return 0
    const cfg = createDumplingLevel(level)
    const grund = 300 + level * 6 + cfg.ziel * 4
    if (score >= grund + 320) return 5
    if (score >= grund + 220) return 4
    if (score >= grund + 130) return 3
    if (score >= grund + 60) return 2
    return 1
  },
}
