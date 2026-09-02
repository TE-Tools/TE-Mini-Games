/**
 * Finde den Imposter – shared types (UI-independent).
 */

export type ImposterPhase =
  | 'setup'
  | 'secret_handoff'
  | 'secret_reveal'
  | 'discussion'
  /** Gemeinsame Anklage: eine Liste aller Namen, einer wird angetippt. */
  | 'accuse'
  | 'last_chance'
  | 'round_result'

export type ImposterModeId =
  | 'classic'
  | 'double'
  | 'blank'
  | 'duel'
  | 'categories_only'
  | 'speed'
  | 'chaos'

export interface ImposterPlayer {
  id: string
  name: string
  isImposter: boolean
  /** Geheimes Wort -- nur für Nicht-Imposter. */
  word: string | null
  lastChanceGuess: string | null
}

export interface ImposterRoundConfig {
  mode: ImposterModeId
  categoryId: string
  categoryLabel: string
  secretWord: string
  /**
   * Ein einzelnes Hilfswort, das nur die Imposter sehen -- jede Runde ein
   * anderes, damit sich die Runden nicht gleich anfühlen (02.09.2026,
   * Thomas' Wunsch). Vorher waren es fünf Wörter auf einmal.
   */
  helperWord: string
  playerCount: number
  imposterCount: number
  roundIndex: number
  totalRounds: number
}

export interface ImposterMatchState {
  phase: ImposterPhase
  players: ImposterPlayer[]
  config: ImposterRoundConfig
  /** Wer gerade sein Geheimnis sieht. */
  activePlayerIndex: number
  /**
   * Wer die Runde eröffnet -- zufällig gezogen (02.09.2026, Thomas: "jetzt
   * fängt Spieler X an, das soll random sein"). Danach redet die Gruppe frei;
   * wie viele Wortrunden sie macht, klärt sie selbst.
   */
  starterIndex: number
  /** True, solange der „Gib das Gerät an X"-Deckel liegt (nur bei den Geheimnissen). */
  handoffCover: boolean
  discussionSeconds: number
  /** Die gemeinsam angeklagte Person (leer, solange nicht angeklagt wurde). */
  accusedId: string | null
  /** War die Anklage ein echter Imposter? */
  correctAccusation: boolean
  /** Hat der Imposter bei der letzten Chance das Wort erraten? */
  lastChanceSuccess: boolean | null
  seed: number
  finished: boolean
}

export interface CategoryDef {
  id: string
  label: string
  /** Optional short description for UI. */
  description?: string
}

export interface WordEntry {
  word: string
  categoryId: string
  /** Optional easy synonyms / related (not shown by default). */
  related?: string[]
}

export interface CreateMatchOptions {
  names: string[]
  categoryId: string
  mode?: ImposterModeId
  totalRounds?: number
  /** Override automatic imposter count. */
  imposterCount?: number
  seed?: number
  discussionSeconds?: number
}
