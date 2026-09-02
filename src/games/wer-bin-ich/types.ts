/**
 * Wer bin ich? – gemeinsame Typen (ohne UI-Bezug).
 */

export type WbiPhase =
  /** Gerät weitergeben: Deckel liegt drauf. */
  | 'handoff'
  /** Der Dranseiende sieht die Wörter der anderen – seins bleibt verdeckt. */
  | 'reveal'
  /** Alle haben geschaut: jetzt wird gefragt und geraten. */
  | 'discussion'
  /** Der Dranseiende tippt seinen Tipp ein. */
  | 'guess'
  /** Auflösung für diesen Tipp. */
  | 'guess_result'
  /** Alle durch – wer hatte recht? */
  | 'round_result'

export interface WbiPlayer {
  id: string
  name: string
  /** Das Wort, das dieser Person auf der Stirn klebt. Sie selbst sieht es nicht. */
  word: string
  guess: string | null
  correct: boolean | null
}

export interface WbiState {
  phase: WbiPhase
  players: WbiPlayer[]
  /** Wer gerade das Gerät hat. */
  activePlayerIndex: number
  categoryId: string
  categoryLabel: string
  roundIndex: number
  seed: number
  /** Wer die Fragerunde eröffnet – zufällig gezogen. */
  starterIndex: number
}

export interface CreateWbiOptions {
  names: string[]
  categoryId: string
  seed?: number
  /** Eigene Wortliste statt des eingebauten Wortschatzes. */
  customWords?: string[]
  customCategoryLabel?: string
}
