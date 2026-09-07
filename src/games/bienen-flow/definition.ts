import type { GameDefinition } from '@/games/types'
import { BIENEN_MAX_LEVEL } from './types'
import { createBienenLevel } from './level'

/**
 * Die Wertung rechnet mit der vollsten Leiste, nicht mit den Zügen.
 *
 * Warum: Jeder Pollen muss genau einmal angetippt werden -- wer gewinnt,
 * braucht also immer gleich viele Züge, egal wie gut er spielt. Die Zahl
 * taugt als Maß nicht. Wie voll die Wabenleiste im schlimmsten Moment war,
 * sagt dagegen genau das, worum das Spiel geht: Wer Dreier sofort schließt,
 * kommt nie über zwei belegte Plätze; wer sich verzettelt, steht kurz vor
 * dem Verlieren.
 */
export const bienenFlowGame: GameDefinition = {
  id: 'bienen-flow',
  name: 'Bienen-Flow',
  description:
    'Tippe freiliegende Pollen an – die Biene trägt sie in die Wabe. Drei gleiche verschmelzen. Ist die Wabe voll, ist Schluss.',
  icon: '🐝',
  maxLevel: BIENEN_MAX_LEVEL,
  createLevel: (level, seed) => {
    void seed
    const cfg = createBienenLevel(level)
    return {
      level: cfg.level,
      rows: cfg.rows,
      cols: cfg.cols,
      slotCount: cfg.slotCount,
      colorCount: cfg.colorCount,
      isGate: cfg.isGate,
      label: cfg.label,
    }
  },
  calculateScore: (level, rawResult) => {
    const raw = rawResult as { won?: boolean; peakSlots?: number; slotCount?: number }
    if (!raw.won) return 0
    const plaetze = raw.slotCount ?? 7
    const spitze = raw.peakSlots ?? plaetze - 1
    const sauber = Math.max(0, plaetze - 1 - spitze)
    return 400 + level * 8 + sauber * 70
  },
  calculateXP: (level, score) => {
    if (score <= 0) return 0
    return 15 + Math.floor(level / 5) + Math.floor(score / 100)
  },
  calculateStars: (level, score) => {
    if (score <= 0) return 0
    const grund = 400 + level * 8
    if (score >= grund + 240) return 5
    if (score >= grund + 170) return 4
    if (score >= grund + 100) return 3
    if (score >= grund + 40) return 2
    return 1
  },
}
