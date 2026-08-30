import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { db } from '@/offline/db'
import { saveGameResult } from '@/offline/results'
import {
  getLocalPersonalBests,
  getLocalRecentHighScores,
  getLocalTotalsByGame,
  getRemoteXpTotals,
  gameLabel,
} from '@/services/leaderboard'
import { getOrCreateGuestProfile } from '@/offline/profile'

describe('Leaderboard local', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await getOrCreateGuestProfile()
  })

  it('lists personal bests after results', async () => {
    await saveGameResult({
      gameId: 'perfect-second',
      level: 1,
      score: 900,
      xp: 50,
      resultData: {},
      isPersonalRecord: true,
    })
    await saveGameResult({
      gameId: 'perfect-second',
      level: 1,
      score: 500,
      xp: 10,
      resultData: {},
      isPersonalRecord: false,
    })
    const bests = await getLocalPersonalBests()
    expect(bests.length).toBeGreaterThanOrEqual(1)
    expect(bests[0]?.bestScore).toBe(900)
  })

  it('ranks recent high scores', async () => {
    await saveGameResult({
      gameId: 'what-is-missing',
      level: 2,
      score: 1000,
      xp: 50,
      resultData: {},
    })
    await saveGameResult({
      gameId: 'perfect-second',
      level: 1,
      score: 100,
      xp: 0,
      resultData: {},
    })
    const top = await getLocalRecentHighScores(10)
    expect(top[0]?.score).toBe(1000)
    expect(top[0]?.rank).toBe(1)
  })

  it('carries the xp of each result along (Thomas: "dann bitte die XP als Rangliste")', async () => {
    await saveGameResult({
      gameId: 'perfect-second',
      level: 47,
      score: 100,
      xp: 19,
      resultData: {},
    })
    const top = await getLocalRecentHighScores(10)
    expect(top[0]?.xp).toBe(19)
  })

  it('sums score and xp per game across every round, not just the best (Thomas: "alle Punkte insgesamt ... für das jeweilige Spiel")', async () => {
    await saveGameResult({ gameId: 'perfect-second', level: 1, score: 900, xp: 120, resultData: {} })
    await saveGameResult({ gameId: 'perfect-second', level: 47, score: 100, xp: 19, resultData: {} })
    await saveGameResult({ gameId: 'what-is-missing', level: 1, score: 1000, xp: 50, resultData: {} })

    const totals = await getLocalTotalsByGame()
    const ps = totals.find((t) => t.gameId === 'perfect-second')
    const wim = totals.find((t) => t.gameId === 'what-is-missing')

    expect(ps?.totalScore).toBe(900 + 100)
    expect(ps?.totalXp).toBe(120 + 19)
    expect(ps?.playCount).toBe(2)
    expect(wim?.totalScore).toBe(1000)
  })

  it('getRemoteXpTotals stays empty without a configured Supabase project (no network call)', async () => {
    const top = await getRemoteXpTotals('perfect-second')
    expect(top).toEqual([])
  })

  it('gameLabel maps ids', () => {
    expect(gameLabel('perfect-second')).toContain('Sekunde')
    expect(gameLabel('what-is-missing')).toContain('fehlt')
    expect(gameLabel('schuetzenrunde')).toBe('Schützenrunde')
  })
})
