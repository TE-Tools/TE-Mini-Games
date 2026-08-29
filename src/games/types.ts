/**
 * Shared game interface for MINI CHALLENGE.
 * Every game module must implement GameDefinition.
 * Adding a new game only requires registering it – no changes to existing games.
 */

export type GameId = 'perfect-second' | 'what-is-missing'

export interface GameLevelConfig {
  level: number
  /** Game-specific config; each game defines its own shape */
  [key: string]: unknown
}

export interface GameResult {
  gameId: GameId
  level: number
  score: number
  xp: number
  /** Game-specific result payload (e.g. deviation, missing object id) */
  resultData: Record<string, unknown>
  isPersonalRecord?: boolean
  stars?: number
  timestamp: number
}

export interface GameDefinition {
  id: GameId
  name: string
  description: string
  /** Emoji or icon identifier */
  icon: string
  maxLevel: number
  /** Create deterministic level config from level number + optional seed */
  createLevel: (level: number, seed?: string) => GameLevelConfig
  /** Calculate score from raw measurement / result */
  calculateScore: (level: number, rawResult: unknown) => number
  /** Calculate XP from score and level */
  calculateXP: (level: number, score: number) => number
  /** Optional: map score to star rating 1–5 */
  calculateStars?: (level: number, score: number) => number
}

export interface PlayerProgress {
  totalXp: number
  playerLevel: number
  streakDays: number
  lastPlayedAt: string | null
}

export interface GameProgress {
  gameId: GameId
  currentLevel: number
  highestLevel: number
  totalXp: number
}
