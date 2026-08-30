import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { db } from '@/offline/db'
import { saveGameResult } from '@/offline/results'
import {
  getLocalPersonalBests,
  getLocalRecentHighScores,
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

  it('gameLabel maps ids', () => {
    expect(gameLabel('perfect-second')).toContain('Sekunde')
    expect(gameLabel('what-is-missing')).toContain('fehlt')
    expect(gameLabel('schuetzenrunde')).toBe('Schützenrunde')
  })
})
