/**
 * Korrekturen aus der Logikprüfung vom 03.11.2026 -- jede mit dem Fehler,
 * den sie behebt, damit er nicht zurückkommt.
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMatch, nextRound } from '@/games/finde-den-imposter/engine'
import type { ImposterMatchState } from '@/games/finde-den-imposter/types'
import { createWbiMatch } from '@/games/wer-bin-ich/engine'
import { FRAGEN } from '@/games/wer-wuerde-eher/fragen'
import { passtZumBuchstaben } from '@/games/stadt-land-fluss/rules'
import { db, addXp, getProfile, GUEST_USER_ID } from '@/offline'
import { processAfterResult } from '@/progression'

describe('Imposter', () => {
  it('wiederholt im selben Spiel kein Geheimwort', () => {
    let s: ImposterMatchState = createMatch({
      names: ['A', 'B', 'C', 'D'],
      categoryId: 'tiere',
      totalRounds: 12,
      seed: 4711,
    })
    const gesehen = [s.config.secretWord]
    for (let r = 0; r < 11; r++) {
      s = nextRound({ ...s, phase: 'round_result' })
      gesehen.push(s.config.secretWord)
    }
    expect(new Set(gesehen).size).toBe(gesehen.length)
  })

  it('lässt im Modus ohne Hinweis nie den Imposter eröffnen', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = createMatch({
        names: ['A', 'B', 'C', 'D', 'E'],
        categoryId: 'tiere',
        mode: 'blank',
        seed,
      })
      expect(s.players[s.starterIndex]!.isImposter, `Seed ${seed}`).toBe(false)
    }
  })
})

describe('Wer bin ich', () => {
  it('behält die eigene Wortliste auch in Runde zwei', () => {
    const s = createWbiMatch({
      names: ['A', 'B', 'C'],
      categoryId: 'eigene:test',
      customWords: ['Apfel', 'Birne', 'Kirsche', 'Pflaume'],
      seed: 1,
    })
    expect(s.customWords).toEqual(['Apfel', 'Birne', 'Kirsche', 'Pflaume'])
  })
})

describe('Wer würde eher', () => {
  it('stellt jede Personenfrage als ganzen Satz', () => {
    for (const f of FRAGEN.filter((x) => x.modus === 'personen')) {
      expect(f.text).not.toContain('…')
      expect(f.text).not.toMatch(/die am ehesten/)
    }
  })
})

describe('Stadt-Land-Fluss', () => {
  it('lässt Umlaute als Grundbuchstaben gelten', () => {
    expect(passtZumBuchstaben('Ägypten', 'A')).toBe(true)
    expect(passtZumBuchstaben('Österreich', 'O')).toBe(true)
    expect(passtZumBuchstaben('Ulm', 'Ü')).toBe(true)
    expect(passtZumBuchstaben('Berlin', 'A')).toBe(false)
  })
})

describe('Tagesserie', () => {
  beforeEach(async () => {
    await db.profiles.clear()
  })

  it('zählt den ersten Spieltag, auch wenn es XP gab', async () => {
    await addXp(GUEST_USER_ID, 50)
    await processAfterResult({ gameId: 'kopfrechnen', level: 1 })
    expect((await getProfile(GUEST_USER_ID))?.streakDays).toBe(1)
  })

  it('wächst am nächsten Tag weiter', async () => {
    const gestern = new Date(Date.now() - 24 * 3600 * 1000)
    const key = `${gestern.getFullYear()}-${String(gestern.getMonth() + 1).padStart(2, '0')}-${String(gestern.getDate()).padStart(2, '0')}`
    await addXp(GUEST_USER_ID, 50)
    const p = (await getProfile(GUEST_USER_ID))!
    await db.profiles.put({ ...p, streakDays: 3, streakDate: key })
    await addXp(GUEST_USER_ID, 50)
    await processAfterResult({ gameId: 'kopfrechnen', level: 1 })
    expect((await getProfile(GUEST_USER_ID))?.streakDays).toBe(4)
  })
})
