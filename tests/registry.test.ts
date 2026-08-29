import { describe, it, expect, beforeEach } from 'vitest'
import { registerGame, getGame, getAllGames, getGameIds } from '@/games/registry'
import type { GameDefinition } from '@/games/types'

const mockGame: GameDefinition = {
  id: 'perfect-second',
  name: 'Die perfekte Sekunde',
  description: 'Test',
  icon: '⏱️',
  maxLevel: 100,
  createLevel: (level) => ({ level }),
  calculateScore: () => 1000,
  calculateXP: () => 100,
}

describe('Game registry', () => {
  beforeEach(() => {
    // Registry is a module-level Map; we re-register for isolation in tests
    registerGame(mockGame)
  })

  it('registers and retrieves a game', () => {
    const game = getGame('perfect-second')
    expect(game).toBeDefined()
    expect(game?.name).toBe('Die perfekte Sekunde')
  })

  it('returns all registered games', () => {
    const games = getAllGames()
    expect(games.length).toBeGreaterThanOrEqual(1)
    expect(games.some((g) => g.id === 'perfect-second')).toBe(true)
  })

  it('returns game ids', () => {
    const ids = getGameIds()
    expect(ids).toContain('perfect-second')
  })
})
