import { describe, it, expect, beforeEach } from 'vitest'
import appQuelle from '../src/app/App.tsx?raw'
import { registerGame, getGame, getAllGames, getGameIds } from '@/games/registry'
import { registerAllGames } from '@/games/register'
import { SPIELE_KACHELN } from '@/pages/spiele-katalog'
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

/**
 * Der Weg von der Startseite ins Spiel.
 *
 * Ein Spiel ist erst fertig, wenn es an vier Stellen eingetragen ist: in der
 * Kennungsliste, im Verzeichnis, als Kachel auf der Startseite und als Route.
 * Genau das ist am 10.09.2026 einmal schiefgegangen: Trapbound war überall
 * angemeldet, nur die Kachel fehlte -- das Spiel lief, war aber in der App
 * nicht zu finden. Ein Test, der nur die Registrierung prüft, hätte das
 * nicht gemerkt; deshalb wird hier auch die Kachel und die Route geprüft.
 */
describe('Jedes Spiel ist auch erreichbar', () => {
  registerAllGames()
  const spiele = getAllGames()
  // Der Quelltext von App.tsx kommt über Vite herein (wie in
  // tests/helles-design.test.ts) -- so braucht der Test keine Node-Typen,
  // die beim Bauen nicht zur Verfügung stehen.
  const app = appQuelle

  it('hat für jedes registrierte Spiel eine Kachel auf der Startseite', () => {
    const ohneKachel = spiele
      .filter((g) => !SPIELE_KACHELN.some((k) => k.id === g.id))
      .map((g) => g.id)
    expect(ohneKachel).toEqual([])
  })

  it('hat für jede Kachel ein registriertes Spiel', () => {
    const ohneSpiel = SPIELE_KACHELN.filter((k) => !getGame(k.id)).map((k) => k.id)
    expect(ohneSpiel).toEqual([])
  })

  it('hat für jede Kachel eine Route, die zu ihrem Pfad passt', () => {
    const ohneRoute = SPIELE_KACHELN.filter((k) => !app.includes(`path="${k.pfad}"`)).map(
      (k) => `${k.id} → ${k.pfad}`,
    )
    expect(ohneRoute).toEqual([])
  })

  it('gibt jeder Kachel Namen, Bild und Einordnung', () => {
    for (const k of SPIELE_KACHELN) {
      expect(k.name.length).toBeGreaterThan(2)
      expect(k.icon.length).toBeGreaterThan(0)
      expect(k.art.length).toBeGreaterThan(2)
      expect(k.pfad.startsWith('/play/')).toBe(true)
    }
    // Keine doppelten Kennungen und keine doppelten Pfade.
    expect(new Set(SPIELE_KACHELN.map((k) => k.id)).size).toBe(SPIELE_KACHELN.length)
    expect(new Set(SPIELE_KACHELN.map((k) => k.pfad)).size).toBe(SPIELE_KACHELN.length)
  })
})
