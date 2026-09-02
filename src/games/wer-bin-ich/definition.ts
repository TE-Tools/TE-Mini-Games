import type { GameDefinition } from '@/games/types'

/**
 * Wie beim Imposter bewusst ohne Punkte, XP und Sterne: ein Partyspiel am
 * Tisch, wer richtig lag sieht man dort. Die Registry verlangt die drei
 * Funktionen, sie geben deshalb konstant 0 zurück, und die Seite speichert
 * gar kein Ergebnis.
 */
export const werBinIchGame: GameDefinition = {
  id: 'wer-bin-ich',
  name: 'Wer bin ich?',
  description:
    'Jeder kennt alle – nur sich selbst nicht. Fragen stellen, bis der Groschen fällt.',
  icon: '\u{1F914}',
  maxLevel: 1,
  createLevel: (level, seed) => ({
    level: 1,
    seed: seed ?? null,
    label: 'Partyrunde',
    requestedLevel: level,
  }),
  calculateScore: () => 0,
  calculateXP: () => 0,
  calculateStars: () => 0,
}
