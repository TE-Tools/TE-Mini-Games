import type { GameDefinition, GameId } from './types'

/**
 * Central game registry.
 * New games are added here only – existing game code stays untouched.
 */
const registry = new Map<GameId, GameDefinition>()

export function registerGame(game: GameDefinition): void {
  if (registry.has(game.id)) {
    console.warn(`[games] Game "${game.id}" is already registered. Overwriting.`)
  }
  registry.set(game.id, game)
}

export function getGame(id: GameId): GameDefinition | undefined {
  return registry.get(id)
}

export function getAllGames(): GameDefinition[] {
  return Array.from(registry.values())
}

export function getGameIds(): GameId[] {
  return Array.from(registry.keys())
}
