/**
 * EMBERWAKE — Speichern ohne Beschädigungsrisiko.
 * Doppelpuffer mit Prüfsumme: Es gibt kein Zeitfenster, in dem beide Slots
 * ungültig sind (docs/design/emberwake/SAVE_SYSTEM.md).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryStore } from '@/games/emberwake/platform/Storage'
import { SaveManager, checksum } from '@/games/emberwake/save/SaveManager'
import { SAVE_SCHEMA_VERSION } from '@/games/emberwake/save/schema'

beforeEach(() => {
  // Der Notfall-Spiegel liegt im localStorage -- zwischen den Tests leeren.
  localStorage.clear()
})

describe('Emberwake – SaveManager', () => {
  it('legt ein neues Profil an, wenn nichts gespeichert ist', async () => {
    const sm = new SaveManager(new MemoryStore())
    const p = await sm.load()
    expect(p.lives).toBe(3)
    expect(p.unlockedLevelId).toBe(1)
  })

  it('schreibt und liest zurück', async () => {
    const store = new MemoryStore()
    const sm = new SaveManager(store)
    await sm.load()
    sm.data.lives = 5
    sm.data.unlockedLevelId = 3
    sm.requestSave()
    await sm.flush()

    const sm2 = new SaveManager(store)
    const p = await sm2.load()
    expect(p.lives).toBe(5)
    expect(p.unlockedLevelId).toBe(3)
  })

  it('wechselt zwischen Slot a und b', async () => {
    const store = new MemoryStore()
    const sm = new SaveManager(store)
    await sm.load()
    sm.data.lives = 4
    sm.requestSave()
    await sm.flush()
    expect(await store.get('profile:active')).toBe('b')
    sm.data.lives = 2
    sm.requestSave()
    await sm.flush()
    expect(await store.get('profile:active')).toBe('a')
  })

  it('verwirft einen Slot mit falscher Prüfsumme statt ihn zu glauben', async () => {
    const store = new MemoryStore()
    const sm = new SaveManager(store)
    await sm.load()
    sm.data.lives = 4
    sm.requestSave()
    await sm.flush()

    const env = (await store.get<{ data: { lives: number }; checksum: string }>('profile:b'))!
    env.data.lives = 99
    await store.set('profile:b', env)

    const sm2 = new SaveManager(store)
    const p = await sm2.load()
    expect(p.lives).not.toBe(99)
  })

  it('verweigert Spielstände aus der Zukunft', async () => {
    const store = new MemoryStore()
    const data = { lives: 3 }
    await store.set('profile:a', {
      version: SAVE_SCHEMA_VERSION + 1,
      checksum: checksum(data),
      savedAt: 0,
      gameVersion: 'x',
      data,
    })
    const sm = new SaveManager(store)
    await expect(sm.load()).rejects.toThrow('future-version')
  })

  it('überlebt Export und Import unverändert', async () => {
    const sm = new SaveManager(new MemoryStore())
    await sm.load()
    sm.data.lives = 2
    sm.data.levels[1] = {
      stars: 3,
      bestTime: 120,
      secret: true,
      completions: 1,
      attempts: 1,
      deaths: 0,
    }
    const json = sm.exportJson()

    const sm2 = new SaveManager(new MemoryStore())
    await sm2.load()
    const imported = sm2.importJson(json)
    expect(imported.lives).toBe(2)
    expect(imported.levels[1]?.stars).toBe(3)
  })
})
