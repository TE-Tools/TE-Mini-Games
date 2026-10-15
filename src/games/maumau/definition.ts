import type { GameDefinition } from '@/games/types'

/**
 * Zwei Kacheln, eine Engine.
 *
 * Mau-Mau ist ein altes Spiel ohne Besitzer; das bunte Blatt mit den
 * Aktionskarten ist dieselbe Familie. Beide laufen über dieselbe Engine
 * (`src/games/maumau/`) und unterscheiden sich nur in den Regeln, die in
 * `regeln.ts` als Daten stehen.
 */
export const mauMauGame: GameDefinition = {
  id: 'maumau',
  name: 'Mau-Mau',
  description: 'Farbe oder Zahl – und wer die vorletzte Karte legt, sagt Mau.',
  icon: '\u{1F0A1}',
  maxLevel: 1,
  createLevel: (level, seed) => ({
    level: 1,
    seed: seed ?? null,
    label: 'Runde',
    requestedLevel: level,
  }),
  calculateScore: (_level, rawResult) => {
    const r = rawResult as
      { platz?: number; eigenePunkte?: number; fremdePunkte?: number } | undefined
    return rundenPunkte(r?.platz ?? 0, r?.eigenePunkte ?? 0, r?.fremdePunkte ?? 0)
  },
  calculateXP: (_level, score) => Math.round(score / 4),
  calculateStars: () => 0,
}

export const letzteKarteGame: GameDefinition = {
  id: 'letzte-karte',
  name: 'Letzte Karte',
  description: 'Vier Farben, Aktionskarten – und im Extremspiel wandern die Hände.',
  icon: '\u{1F3B4}',
  maxLevel: 1,
  createLevel: (level, seed) => ({
    level: 1,
    seed: seed ?? null,
    label: 'Runde',
    requestedLevel: level,
  }),
  calculateScore: mauMauGame.calculateScore,
  calculateXP: mauMauGame.calculateXP,
  calculateStars: () => 0,
}

/**
 * Was eine Runde wert ist.
 *
 * Wer gewinnt, bekommt die Punkte, die die anderen noch auf der Hand
 * haben -- so wird es am Küchentisch auch gezählt. Wer verliert, bekommt
 * den Rest von sechzig: Mit zwei Karten in der Hand verloren zu haben
 * ist etwas anderes, als mit elf.
 */
export function rundenPunkte(platz: number, eigenePunkte: number, fremdePunkte: number): number {
  if (platz === 1) return 100 + Math.round(fremdePunkte)
  // Zehn für die gespielte Runde, auch wenn die Hand voll blieb: Eine
  // glatte Null nimmt dem Abend den Rest.
  return Math.max(10, 60 - Math.round(eigenePunkte))
}

/** XP für eine Runde: die Punkte zählen, ein Sieg gibt etwas dazu. */
export function rundenXp(punkte: number, gewonnen: boolean): number {
  return Math.min(200, Math.round(punkte / 4) + (gewonnen ? 30 : 0))
}
