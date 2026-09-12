import type { GameDefinition } from '@/games/types'
import { SUDOKU_MAX_LEVEL, levelName, raetsel, technikName } from './levels'
import { alsText } from './gitter'
import { berechnePunkte, sterneFuer, xpFuer, type SudokuErgebnis } from './wertung'

export const sudokuGame: GameDefinition = {
  id: 'sudoku',
  name: 'Sudoku',
  description:
    'Neun mal neun, jede Ziffer einmal. Leicht, Mittel und Schwer zu je fünfzig Rätseln -- ganz hinten solche, an denen man Stunden sitzt.',
  icon: '🔢',
  maxLevel: SUDOKU_MAX_LEVEL,
  createLevel: (level, seed) => {
    void seed
    const r = raetsel(level)
    return {
      level: r.nr,
      label: levelName(r.nr),
      schwierigkeit: r.schwierigkeit,
      stufe: r.stufe,
      vorgabe: alsText(r.vorgabe),
      technik: technikName(r.technik),
      anzahlVorgaben: r.anzahlVorgaben,
    }
  },
  calculateScore: (level, rawResult) => {
    const raw = (rawResult ?? {}) as Partial<SudokuErgebnis>
    return berechnePunkte(level, {
      geloest: raw.geloest ?? false,
      sekunden: raw.sekunden ?? 0,
      fehler: raw.fehler ?? 0,
      tipps: raw.tipps ?? 0,
    })
  },
  calculateXP: (level, score) => xpFuer(level, score),
  calculateStars: (level, score) => sterneFuer(level, score),
}
