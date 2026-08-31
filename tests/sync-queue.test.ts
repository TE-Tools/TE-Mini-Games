/**
 * Die Sync-Warteschlange arbeitet die ältesten Einträge zuerst ab. Ein Eintrag,
 * den der Server nie annehmen wird, darf deshalb nicht ewig liegen bleiben –
 * sonst hält er irgendwann alle späteren Spielergebnisse auf (genau das ist am
 * 30./31.08.2026 passiert).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { db } from '@/offline/db'
import { enqueueOutbox, outboxCount } from '@/offline/outbox'
import { registerSyncAdapter, processSyncQueue } from '@/services/sync'

describe('processSyncQueue', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('verwirft einen Eintrag, den die Datenbank dauerhaft ablehnt (Fremdschlüssel)', async () => {
    await enqueueOutbox('achievement', { achievementId: 'gibt-es-nicht' })
    registerSyncAdapter(async () => {
      throw Object.assign(new Error('violates foreign key constraint'), { code: '23503' })
    })

    const result = await processSyncQueue()
    expect(result.dropped).toBe(1)
    expect(await outboxCount()).toBe(0)
  })

  it('behält einen Eintrag, solange nur die Anmeldung fehlt', async () => {
    await enqueueOutbox('game_result', { score: 100, level: 1 })
    registerSyncAdapter(async () => {
      throw new Error('Not authenticated – keep item in outbox')
    })

    for (let i = 0; i < 10; i++) {
      const result = await processSyncQueue()
      expect(result.dropped).toBe(0)
    }
    expect(await outboxCount()).toBe(1)
  })

  it('ein Dauerfehler blockiert spätere Ergebnisse nicht', async () => {
    await enqueueOutbox('achievement', { achievementId: 'kaputt' })
    await enqueueOutbox('game_result', { score: 500, level: 3 })

    const seen: string[] = []
    registerSyncAdapter(async (item) => {
      seen.push(item.type)
      if (item.type === 'achievement') {
        throw Object.assign(new Error('violates foreign key constraint'), { code: '23503' })
      }
    })

    const result = await processSyncQueue()
    expect(seen).toContain('game_result')
    expect(result.processed).toBe(1)
    expect(result.dropped).toBe(1)
    expect(await outboxCount()).toBe(0)
  })

  it('gibt nach mehreren erfolglosen Versuchen auf', async () => {
    await enqueueOutbox('game_result', { score: 5000, level: 1 })
    registerSyncAdapter(async () => {
      throw new Error('Implausible score/level – rejected')
    })

    let dropped = 0
    for (let i = 0; i < 6; i++) {
      dropped += (await processSyncQueue()).dropped
    }
    expect(dropped).toBe(1)
    expect(await outboxCount()).toBe(0)
  })
})
