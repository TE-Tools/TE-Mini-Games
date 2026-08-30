import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { db } from '@/offline/db'
import {
  createFamilySession,
  saveFamilyPlayerResult,
  getFamilyResults,
  rankFamilyResults,
  getFamilySession,
} from '@/offline/family'

describe('Family mode', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('creates session with players', async () => {
    const s = await createFamilySession('perfect-second', ['Thomas', 'Marina', 'Phillip'])
    expect(s.playerNames).toHaveLength(3)
    expect(s.status).toBe('playing')
    expect(s.currentPlayerIndex).toBe(0)
  })

  it('rejects fewer than 2 players', async () => {
    await expect(createFamilySession('perfect-second', ['OnlyOne'])).rejects.toThrow()
  })

  it('records results and finishes session', async () => {
    const s = await createFamilySession('what-is-missing', ['A', 'B'])
    await saveFamilyPlayerResult(s.id, 0, 'A', 1000, { correct: true })
    let updated = await getFamilySession(s.id)
    expect(updated?.currentPlayerIndex).toBe(1)
    expect(updated?.status).toBe('playing')

    await saveFamilyPlayerResult(s.id, 1, 'B', 0, { correct: false })
    updated = await getFamilySession(s.id)
    expect(updated?.status).toBe('finished')

    const results = await getFamilyResults(s.id)
    expect(results).toHaveLength(2)

    const standings = rankFamilyResults(results)
    expect(standings[0]?.playerName).toBe('A')
    expect(standings[0]?.rank).toBe(1)
    expect(standings[1]?.playerName).toBe('B')
  })

  it('ranks higher score first', () => {
    const standings = rankFamilyResults([
      {
        id: '1',
        sessionId: 's',
        playerName: 'Low',
        playerIndex: 0,
        score: 100,
        resultData: {},
        createdAt: '',
      },
      {
        id: '2',
        sessionId: 's',
        playerName: 'High',
        playerIndex: 1,
        score: 900,
        resultData: {},
        createdAt: '',
      },
    ])
    expect(standings[0]?.playerName).toBe('High')
    expect(standings[1]?.playerName).toBe('Low')
  })

  it('includes measured seconds in standings when present', () => {
    const standings = rankFamilyResults([
      {
        id: '1',
        sessionId: 's',
        playerName: 'Anna',
        playerIndex: 0,
        score: 800,
        resultData: { actualTime: 1.02, targetTime: 1 },
        createdAt: '',
      },
    ])
    expect(standings[0]?.actualTime).toBe(1.02)
    expect(standings[0]?.targetTime).toBe(1)
  })
})
