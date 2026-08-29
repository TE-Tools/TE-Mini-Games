import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { isSupabaseConfigured } from '@/database/supabase'
import { getAuthConfigured } from '@/auth/authService'
import { processSyncQueue } from '@/services/sync'
import { db } from '@/offline/db'

describe('Supabase configuration', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('is not configured in test env without keys', () => {
    expect(isSupabaseConfigured).toBe(false)
    expect(getAuthConfigured()).toBe(false)
  })

  it('processSyncQueue stays idle without remote adapter', async () => {
    const result = await processSyncQueue()
    expect(result.status).toMatch(/idle|offline/)
  })
})

describe('Score plausibility helpers (documented ranges)', () => {
  it('valid score range is 0–1000', () => {
    const valid = (s: number) => s >= 0 && s <= 1000
    expect(valid(0)).toBe(true)
    expect(valid(1000)).toBe(true)
    expect(valid(1001)).toBe(false)
    expect(valid(-1)).toBe(false)
  })

  it('valid level range is 1–100', () => {
    const valid = (l: number) => l >= 1 && l <= 100
    expect(valid(1)).toBe(true)
    expect(valid(100)).toBe(true)
    expect(valid(0)).toBe(false)
  })
})
