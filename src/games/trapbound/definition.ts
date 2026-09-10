import type { GameDefinition } from '@/games/types'
import { LEVEL_ANZAHL, levelDaten } from './levels'

/**
 * Die Wertung.
 *
 * Punkte für den Abschluss, Abzug für jeden Tod, Zuschlag für Tempo und für
 * den Kristall. Ein Fallenspiel belohnt nicht Geschicklichkeit im ersten
 * Versuch -- sterben gehört dazu -- aber wer ein Level kennt, soll es sauber
 * und schnell abliefern können.
 */
export const trapboundGame: GameDefinition = {
  id: 'trapbound',
  name: 'Trapbound',
  description:
    'Kurze Level, freundlicher Anblick, gemeine Fallen. Lauf nach rechts – wenn du dich traust.',
  icon: '🕳️',
  maxLevel: LEVEL_ANZAHL,
  createLevel: (level, seed) => {
    void seed
    const l = levelDaten(Math.max(1, Math.min(LEVEL_ANZAHL, level)))
    return {
      level: l.nr,
      welt: l.welt,
      abschnitt: l.abschnitt,
      name: l.name,
      label: l.name,
      objekte: l.objekte.length,
    }
  },
  calculateScore: (level, rawResult) => {
    const raw = rawResult as { won?: boolean; tode?: number; zeit?: number; kristall?: boolean }
    if (!raw.won) return 0
    const tode = Math.max(0, raw.tode ?? 0)
    const zeit = Math.max(1, raw.zeit ?? 60)
    const flott = Math.max(0, Math.round((30 - zeit) * 6))
    return 250 + level * 12 + Math.max(0, 200 - tode * 25) + flott + (raw.kristall ? 150 : 0)
  },
  calculateXP: (level, score) => {
    if (score <= 0) return 0
    return 12 + Math.floor(level / 3) + Math.floor(score / 100)
  },
  calculateStars: (level, score) => {
    if (score <= 0) return 0
    const grund = 250 + level * 12
    if (score >= grund + 380) return 5
    if (score >= grund + 280) return 4
    if (score >= grund + 180) return 3
    if (score >= grund + 90) return 2
    return 1
  },
}
