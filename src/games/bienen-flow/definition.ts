import type { GameDefinition } from '@/games/types'
import { BIENEN_MAX_LEVEL } from './types'
import { createBienenLevel } from './level'

/**
 * Die Wertung rechnet mit den toten Blöcken.
 *
 * Tot ist ein Block, dessen Farbe es im Bild nicht mehr gibt -- er kann nie
 * voll werden und belegt seinen Platz bis zum Schluss. Genau das ist der
 * Fehler, den das Spiel bestraft. Die Zahl der Züge taugt als Maß nicht:
 * Wer gewinnt, schiebt ungefähr gleich viele Blöcke hoch.
 */
export const bienenFlowGame: GameDefinition = {
  id: 'bienen-flow',
  name: 'Bienen-Flow',
  description:
    'Schieb Blöcke auf die Plätze, die Bienen holen die Pixel. Nur was von außen zugänglich ist – und es muss genau aufgehen.',
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
    const raw = rawResult as { won?: boolean; tote?: number; slotCount?: number }
    if (!raw.won) return 0
    const plaetze = raw.slotCount ?? 5
    const sauber = Math.max(0, plaetze - 1 - (raw.tote ?? plaetze - 1))
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
