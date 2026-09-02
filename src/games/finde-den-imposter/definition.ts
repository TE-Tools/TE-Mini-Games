import type { GameDefinition } from '@/games/types'

/**
 * Bewusst ohne Punkte, XP und Sterne (02.09.2026, Thomas: "Punkte-System und
 * Ranglisten für das Spiel lieber aus"). Das Spiel ist ein Partyspiel am Tisch
 * -- wer gewonnen hat, sieht man dort, dafür braucht es keine Wertung. Die
 * Registry verlangt die drei Funktionen, sie geben deshalb konstant 0 zurück,
 * und die Seite speichert gar kein Ergebnis.
 */
export const findeDenImposterGame: GameDefinition = {
  id: 'finde-den-imposter',
  name: 'Finde den Imposter',
  description:
    'Partyspiel: Einer kennt das geheime Wort nicht. Reihum reden, gemeinsam raten, letzte Chance.',
  icon: '\u{1F608}',
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
