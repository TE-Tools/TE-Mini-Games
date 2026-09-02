/**
 * Shared game interface for TE-Mini Games.
 * Every game module must implement GameDefinition.
 * Adding a new game only requires registering it – no changes to existing games.
 */

export type GameId =
  | 'perfect-second'
  | 'what-is-missing'
  | 'schuetzenrunde'
  | 'finde-den-imposter'
  | 'reihenfolge'
  | 'kopfrechnen'

export interface GameLevelConfig {
  level: number
  /** Human-readable short description of this level's difficulty. */
  label?: string
  [key: string]: unknown
}

export interface GameResult {
  gameId: GameId
  level: number
  score: number
  xp: number
  stars?: number
  isPersonalRecord?: boolean
  resultData: Record<string, unknown>
  timestamp?: number
}

export interface GameDefinition {
  id: GameId
  name: string
  description: string
  icon: string
  /** Max level available offline. */
  maxLevel: number
  createLevel: (level: number, seed?: string | number | null) => GameLevelConfig
  calculateScore: (level: number, rawResult: unknown) => number
  calculateXP: (level: number, score: number) => number
  calculateStars?: (level: number, score: number) => number
}
