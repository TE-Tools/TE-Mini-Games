import type { GameDefinition } from '@/games/types'

/**
 * Punkte gibt es hier reichlich – aber nur innerhalb der Partie am Tisch.
 * In die App-Rangliste fließen sie nicht ein: Wer mit wem gespielt hat,
 * entscheidet über die Punktzahl weit mehr als das eigene Können.
 */
export const stadtLandFlussGame: GameDefinition = {
  id: 'stadt-land-fluss',
  name: 'Stadt-Land-Fluss',
  description: 'Ein Buchstabe, fünf Spalten, die Uhr läuft. Wer hatte etwas, das sonst keiner hatte?',
  icon: '\u{270F}\u{FE0F}',
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
