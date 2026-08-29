import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { db, GUEST_USER_ID } from '@/offline/db'
import { getOrCreateGuestProfile, addXp } from '@/offline/profile'
import {
  getOrCreateGameProgress,
  recordLevelComplete,
  getGameProgress,
} from '@/offline/progress'
import { saveGameResult, getPersonalRecord, getRecentResults } from '@/offline/results'
import { enqueueOutbox, getPendingOutbox, markOutboxSuccess, outboxCount } from '@/offline/outbox'
import { processSyncQueue, getSyncPendingCount } from '@/services/sync'

describe('Offline profile', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('creates guest profile with defaults', async () => {
    const profile = await getOrCreateGuestProfile()
    expect(profile.id).toBe(GUEST_USER_ID)
    expect(profile.totalXp).toBe(0)
    expect(profile.playerLevel).toBe(1)
    expect(profile.displayName).toBe('Gast')
  })

  it('returns same profile on second call', async () => {
    const a = await getOrCreateGuestProfile()
    const b = await getOrCreateGuestProfile()
    expect(a.id).toBe(b.id)
    expect(a.createdAt).toBe(b.createdAt)
  })

  it('adds XP and updates player level', async () => {
    await getOrCreateGuestProfile()
    const updated = await addXp(GUEST_USER_ID, 500)
    expect(updated.totalXp).toBe(500)
    expect(updated.playerLevel).toBe(2)
  })
})

describe('Offline game progress', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('creates default progress at level 1', async () => {
    const progress = await getOrCreateGameProgress('perfect-second')
    expect(progress.currentLevel).toBe(1)
    expect(progress.highestLevel).toBe(1)
    expect(progress.gameId).toBe('perfect-second')
  })

  it('advances level on complete', async () => {
    await recordLevelComplete('perfect-second', 1, 50)
    const progress = await getGameProgress('perfect-second')
    expect(progress?.currentLevel).toBe(2)
    expect(progress?.highestLevel).toBe(2)
    expect(progress?.totalXp).toBe(50)
  })
})

describe('Offline results and records', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('saves result and creates personal record', async () => {
    const result = await saveGameResult({
      gameId: 'perfect-second',
      level: 1,
      score: 900,
      xp: 90,
      resultData: { deviation: 0.05, measurement: 3.05 },
      stars: 4,
    })
    expect(result.id).toBeTruthy()
    expect(result.synced).toBe(0)

    const record = await getPersonalRecord('perfect-second', 1)
    expect(record?.bestScore).toBe(900)

    const recent = await getRecentResults('perfect-second')
    expect(recent).toHaveLength(1)
  })

  it('keeps better personal record', async () => {
    await saveGameResult({
      gameId: 'perfect-second',
      level: 1,
      score: 700,
      xp: 70,
      resultData: { deviation: 0.2 },
    })
    await saveGameResult({
      gameId: 'perfect-second',
      level: 1,
      score: 950,
      xp: 95,
      resultData: { deviation: 0.02 },
    })
    const record = await getPersonalRecord('perfect-second', 1)
    expect(record?.bestScore).toBe(950)
  })
})

describe('Sync outbox', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('enqueues and lists pending items', async () => {
    await enqueueOutbox('game_result', { score: 100 })
    const pending = await getPendingOutbox()
    expect(pending).toHaveLength(1)
    expect(pending[0]?.type).toBe('game_result')
  })

  it('removes item on success', async () => {
    const item = await enqueueOutbox('progress', { level: 2 })
    await markOutboxSuccess(item.id)
    expect(await outboxCount()).toBe(0)
  })

  it('processSyncQueue is idle without remote adapter', async () => {
    await enqueueOutbox('game_result', { score: 1 })
    const result = await processSyncQueue()
    expect(result.processed).toBe(0)
    expect(result.remaining).toBe(1)
    expect(await getSyncPendingCount()).toBe(1)
  })
})
