/**
 * Die Stellschrauben von Texas Hold'em an einer Stelle.
 *
 * Gespielt wird ein Sit-and-Go: Alle fangen mit demselben Stapel an, die
 * Blinds steigen, und es läuft, bis einer alles hat. Das gibt der Partie
 * ein Ende -- ein Cash Game hätte keins, und ohne Ende gibt es kein
 * Ergebnis, das man aufschreiben könnte.
 *
 * Gespielt wird mit Spielgeld. Es gibt nichts zu kaufen und nichts zu
 * gewinnen; die Zahlen auf dem Tisch bedeuten nichts ausserhalb der Partie.
 */

export const START_CHIPS = 1000

export const MIN_SPIELER = 2
export const MAX_SPIELER = 6

/**
 * Die Blindstufen. Alle `HAENDE_JE_STUFE` Hände geht es eine weiter.
 *
 * Sie steigen, weil sonst nichts passiert: Wer immer nur die besten Blätter
 * spielt, sitzt eine Partie ohne steigende Blinds beliebig lange aus. Mit
 * ihnen kostet Warten etwas, und das ist der Motor des Turniers.
 */
export const BLIND_STUFEN: readonly { klein: number; gross: number }[] = [
  { klein: 10, gross: 20 },
  { klein: 15, gross: 30 },
  { klein: 25, gross: 50 },
  { klein: 50, gross: 100 },
  { klein: 75, gross: 150 },
  { klein: 100, gross: 200 },
  { klein: 150, gross: 300 },
  { klein: 250, gross: 500 },
  { klein: 400, gross: 800 },
  { klein: 600, gross: 1200 },
]

export const HAENDE_JE_STUFE = 8

/** Wie lange der Rechner „überlegt“, damit man seinen Zug mitbekommt. */
export const KI_PAUSE_MS = 900
