/**
 * Finde den Imposter – shared types (UI-independent).
 */

export type ImposterPhase =
  | 'setup'
  | 'secret_handoff'
  | 'secret_reveal'
  | 'hints'
  | 'discussion'
  | 'vote'
  | 'last_chance'
  | 'round_result'
  | 'match_result'

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
  /** Secret word only for non-imposters (classic). */
  word: string | null
  hint: string | null
  voteForId: string | null
  lastChanceGuess: string | null
  /** Points earned this round. */
  roundPoints: number
  /** Cumulative match points. */
  totalPoints: number
}

export interface ImposterRoundConfig {
  mode: ImposterModeId
  categoryId: string
  categoryLabel: string
  secretWord: string
  /** Extra decoy words shown only to imposters (optional help). */
  decoys: string[]
  playerCount: number
  imposterCount: number
  roundIndex: number
  totalRounds: number
}

export interface ImposterMatchState {
  phase: ImposterPhase
  players: ImposterPlayer[]
  config: ImposterRoundConfig
  /** Whose secret is being revealed / who is entering a hint / who is voting. */
  activePlayerIndex: number
  /** True while the “give device to X” cover is shown. */
  handoffCover: boolean
  discussionSeconds: number
  /** Majority-voted player ids (may be empty). */
  votedOutIds: string[]
  /** Whether any voted-out player was actually an imposter. */
  correctAccusation: boolean
  /** Imposter last-chance succeeded. */
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
