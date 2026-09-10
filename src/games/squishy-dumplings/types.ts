/**
 * Squishy Dumplings – ein Drei-gewinnt-Spiel mit Teigtaschen.
 *
 * Die Regeln, wie Thomas sie am 09.09.2026 beschrieben hat:
 *
 *   - Ein Feld voller Knödel. Man schiebt einen auf einen Nachbarplatz;
 *     entsteht dadurch eine Reihe aus drei gleichen (waagerecht oder
 *     senkrecht), verschwinden sie und von oben fallen neue nach.
 *   - Fallen dabei wieder drei gleiche zusammen, geht es weiter -- eine
 *     Kette. Ein Zug, der keine Reihe ergibt, gilt nicht.
 *   - Ziel ist eine bestimmte Anzahl gesammelter Knödel, und zwar in einer
 *     bestimmten Zeit. Ist die Zeit um, ist das Level verloren.
 *   - Später kommen Käfige dazu: Ein Knödel im Käfig lässt sich nicht
 *     schieben und zählt in keiner Reihe mit -- er zerreißt jede Linie.
 *     Er springt auf, wenn direkt daneben eine Reihe verschwindet. Alle
 *     Käfige offen ist Teil des Levelziels.
 *   - Es wird von Level zu Level schwerer: mehr Farben, höheres Ziel,
 *     weniger Zeit, mehr Käfige.
 *   - Für geschaffte Level gibt es neue Knödel zum Sammeln, die man als
 *     eigenen Avatar tragen kann.
 */

/** 0 = leeres Feld (nur während des Nachrutschens), 1..N = Farbe. */
export type Farbe = number

/**
 * Was ein Knödel Besonderes kann.
 *
 * Beide entstehen aus langen Reihen und behalten die Farbe, aus der sie
 * kommen -- sie zählen also ganz normal in jeder Reihe mit. Ihre Wirkung
 * kommt erst, wenn sie *noch einmal* in einer Reihe landen. Genau darum
 * lohnt es sich, sie liegenzulassen und den richtigen Platz zu suchen,
 * statt sie beim nächstbesten Dreier zu verheizen.
 *
 *   'keine'    Ein ganz gewöhnlicher Knödel.
 *   'gold'     Aus einer Fünferreihe: golden glänzend in seiner Farbe.
 *              Kommt er wieder in eine Reihe, platzen alle seiner Farbe.
 *   'diagonal' Aus einer Viererreihe. Kommt er wieder in eine Reihe, fegt
 *              er beide Diagonalen durch sein Feld leer.
 */
export type Spezial = 'keine' | 'gold' | 'diagonal'

export interface Zelle {
  farbe: Farbe
  /** Im goldenen Käfig: nicht schiebbar, zählt in keiner Reihe mit. */
  kaefig: boolean
  spezial: Spezial
}

/** Ein gewöhnlicher Knödel dieser Farbe. */
export function zelle(farbe: Farbe, kaefig = false): Zelle {
  return { farbe, kaefig, spezial: 'keine' }
}

export interface DumplingLevel {
  level: number
  rows: number
  cols: number
  /** Wie viele verschiedene Farben im Spiel sind. */
  farben: number
  /** So viele Knödel müssen eingesammelt werden. */
  ziel: number
  /** So viele Sekunden bleiben dafür. */
  zeit: number
  /** So viele Käfige liegen im Feld. */
  kaefige: number
  feld: Zelle[]
  /** Startwert des Zufalls für den Nachschub von oben. */
  saat: number
  isGate: boolean
  label: string
}

export interface DumplingState {
  level: number
  rows: number
  cols: number
  farben: number
  feld: Zelle[]
  ziel: number
  /** Wie viele Knödel schon eingesammelt sind. */
  gesammelt: number
  /** Wie viele Käfige noch zu sind. */
  kaefigeZu: number
  zuege: number
  /** Die längste Kette dieser Runde (1 = keine Kette). */
  besteKette: number
  /** Wie oft das Feld neu gemischt werden musste. */
  mischungen: number
  phase: 'play' | 'won' | 'lost'
  /** Fortlaufender Zustand des Zufalls -- damit bleibt alles nachrechenbar. */
  zufall: number
}

/** 300 Level, wie bei den anderen Spielen; jedes zwanzigste ist ein Tor. */
export const DUMPLING_MAX_LEVEL = 300

export const REIHEN = 7
export const SPALTEN = 6

/** Wie viele gleiche nebeneinander eine Reihe ergeben. */
export const REIHE_AB = 3

/** Ab so vielen in einer Reihe entsteht der Diagonale. */
export const DIAGONAL_AB = 4

/** Ab so vielen in einer Reihe entsteht der Goldene. */
export const GOLD_AB = 5

/**
 * Die Knödelfarben.
 *
 * Sechs Stück, deutlich unterscheidbar auch für rot-grün-schwache Augen:
 * Sie unterscheiden sich zusätzlich in der Helligkeit, und jede hat ein
 * eigenes Gesicht auf dem Spielfeld.
 */
export const FARB_HEX: readonly string[] = [
  '#000000', // 0 unbenutzt
  '#e0433f', // rot
  '#8e44ad', // lila
  '#7cb342', // grün
  '#29b6f6', // blau
  '#f9c22e', // gelb
  '#ec7fa9', // rosa
]

export const FARB_NAME: readonly string[] = ['', 'Rot', 'Lila', 'Grün', 'Blau', 'Gelb', 'Rosa']
