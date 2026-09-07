import type { GameDefinition } from '@/games/types'
import { BIENEN_MAX_LEVEL } from './types'
import { createBienenLevel } from './level'

/**
 * Die Wertung rechnet mit den verstopften Plätzen.
 *
 * Warum nicht mit Zügen: Wer gewinnt, hat ungefähr gleich viele Blöcke
 * hochgeschickt, egal wie gut er gespielt hat. Verstopfte Plätze messen
 * dagegen genau das, worum es geht -- jeder davon ist ein Block, der nicht
 * aufging. Wer sauber rechnet, kommt mit null durch und steht bei fünf
 * Sternen; wer sich viermal verzählt, gewinnt gerade noch.
 */
export const bienenFlowGame: GameDefinition = {
  id: 'bienen-flow',
  name: 'Bienen-Flow',
  description:
    'Schicke Pollenblöcke los, bis das Bild voll ist. Es muss genau aufgehen – jeder Block zu viel verstopft einen Platz.',
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
    const raw = rawResult as { won?: boolean; verstopft?: number; slotCount?: number }
    if (!raw.won) return 0
    const plaetze = raw.slotCount ?? 5
    const sauber = Math.max(0, plaetze - 1 - (raw.verstopft ?? plaetze - 1))
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
