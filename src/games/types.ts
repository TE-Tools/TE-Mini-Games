/**
 * Shared game interface for TE-Mini Games.
 * Every game module must implement GameDefinition.
 * Adding a new game only requires registering it – no changes to existing games.
 */

export type GameId = 'perfect-second' | 'what-is-missing'

export interface GameLevelConfig {
  level: number
  /** Human-readable short description of this level's difficulty. */
  label?: string
}

export interface GameDefinition {
  id: GameId
  name: string
  description: string
  /** Max level available offline. */
  maxLevel: number
  getLevelConfig: (level: number) => GameLevelConfig
}
