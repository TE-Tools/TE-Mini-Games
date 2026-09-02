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
  /** Nur im Duell-Modus gesetzt: 1 oder 2. Sonst null. */
  team: 1 | 2 | null
  lastChanceGuess: string | null
  /** Hat diese Person bei ihrer letzten Chance getroffen? */
  lastChanceCorrect: boolean | null
}

/** Was ein Imposter beim Aufdecken zu sehen bekommt. */
export type ImposterSees =
  /** Ein einzelnes Wort aus derselben Kategorie (Klassisch, Doppel, Duell). */
  | 'helper'
  /** Nur der Name der Kategorie. */
  | 'category'
  /** Gar nichts. */
  | 'nothing'

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
  /** Was die Imposter in dieser Runde sehen -- hängt am Modus. */
  imposterSees: ImposterSees
  /**
   * Ob die Kategorie überhaupt angezeigt wird. Im Modus "Leer" bleibt sie
   * verborgen, sonst wäre er nicht härter als "Nur Kategorie".
   */
  showCategory: boolean
  /** Tempo-Modus: Sekunden, bis automatisch getippt wird. Sonst null. */
  timerSeconds: number | null
  /** Chaos-Modus: Kennung der für diese Runde gezogenen Sonderregel. */
  specialRule: string | null
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
  /**
   * Duell: pro Team eine Anklage. Index 0 ist Team 1, Index 1 ist Team 2.
   * In allen anderen Modi bleiben beide leer.
   */
  teamAccused: (string | null)[]
  /**
   * Wer noch seine letzte Chance vor sich hat. Im Duell können das zwei
   * Personen nacheinander sein, sonst höchstens eine.
   */
  lastChanceQueue: string[]
  /** War die Anklage ein echter Imposter? (Duell: mindestens eine davon.) */
  correctAccusation: boolean
  /** Hat der Imposter bei der letzten Chance das Wort erraten? */
  lastChanceSuccess: boolean | null
  /** Wörter einer eigenen Kategorie -- null, wenn eine eingebaute läuft. */
  customWords: string[] | null
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
  /**
   * Eigene Kategorie: die Wörter kommen dann nicht aus dem eingebauten
   * Wortschatz, sondern von hier (siehe customCategories.ts).
   */
  customWords?: string[]
  /** Anzeigename der eigenen Kategorie. */
  customCategoryLabel?: string
}
