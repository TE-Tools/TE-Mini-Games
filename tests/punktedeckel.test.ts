/**
 * Der Punktedeckel: Kommen die Ergebnisse der großen Spiele überhaupt an?
 *
 * ANLASS (24.09.2026, Thomas): "die XP unter Ranglisten ändern sich nicht."
 *
 * Der Server nahm nur Ergebnisse bis 1000 Punkte an. Trapbound zählt
 * 250 + Level * 12, Emberwake 300 + Level * 20, Schützenopoly das
 * Endvermögen -- alles darüber wurde abgewiesen und nach fünf Versuchen
 * weggeworfen, mitsamt seiner XP.
 *
 * Nachgemessen in der laufenden Datenbank: ein Spieler auf Trapbound-Level
 * 301, bester gespeicherter Wert 980 aus Level 36. Genau unter der Grenze.
 *
 * Der Test hält beides fest: was die Spiele wirklich zählen, und dass diese
 * Werte durch die Prüfung kommen. Wer eine Punkteformel anhebt, merkt hier,
 * ob die Grenze noch passt -- statt es Wochen später an einer Rangliste zu
 * sehen, die stehen bleibt.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { trapboundGame } from '@/games/trapbound'
import { emberwakeGame } from '@/games/emberwake'
import { START_KAPITAL } from '@/games/schuetzenopoly'
import { istHochladbarerPunktestand, MAX_RESULT_SCORE } from '@/services/remoteSync'

describe('Was die Spiele zählen', () => {
  it('zählt in Trapbound weit über tausend – dort fing der Fehler an', () => {
    const roh = { won: true, tode: 0, zeit: 20, kristall: true }
    const level36 = trapboundGame.calculateScore(36, roh)
    const level301 = trapboundGame.calculateScore(301, roh)
    const level400 = trapboundGame.calculateScore(400, roh)

    // Bis hierhin ging es gut -- deshalb steht live genau so ein Wert als Bestwert.
    expect(level36).toBeLessThan(1500)
    // Und ab hier kam nichts mehr an.
    expect(level301).toBeGreaterThan(1000)
    expect(level400).toBeGreaterThan(1000)

    // Jetzt kommt alles durch.
    expect(istHochladbarerPunktestand(level36)).toBe(true)
    expect(istHochladbarerPunktestand(level301)).toBe(true)
    expect(istHochladbarerPunktestand(level400)).toBe(true)
  })

  it('zählt in Emberwake ebenfalls über tausend', () => {
    const punkte = emberwakeGame.calculateScore(60, {
      won: true,
      time: 100,
      damageTaken: 0,
      secondary: true,
      secret: true,
    })
    expect(punkte).toBeGreaterThan(1000)
    expect(istHochladbarerPunktestand(punkte)).toBe(true)
  })

  it('lässt das Endvermögen bei Schützenopoly durch', () => {
    // Schon das Startkapital liegt über der alten Grenze -- hier wurde also
    // nie ein einziges Ergebnis hochgeladen.
    expect(START_KAPITAL).toBeGreaterThan(1000)
    expect(istHochladbarerPunktestand(START_KAPITAL)).toBe(true)
    expect(istHochladbarerPunktestand(48_500)).toBe(true)
  })

  it('weist Unsinn weiter ab – die Prüfung bleibt, nur die Grenze passt', () => {
    expect(istHochladbarerPunktestand(-1)).toBe(false)
    expect(istHochladbarerPunktestand(MAX_RESULT_SCORE + 1)).toBe(false)
    expect(istHochladbarerPunktestand(Number.NaN)).toBe(false)
    expect(istHochladbarerPunktestand('viele')).toBe(false)
  })

  it('hält dieselbe Grenze wie die Datenbank', async () => {
    // Die strengere von beiden gewinnt, und zwar stillschweigend -- deshalb
    // wird hier nachgesehen, ob in Migration 020 dieselbe Zahl steht.
    const sql = (
      (await import('../supabase/migrations/020_punkte_ohne_deckel.sql?raw')) as {
        default: string
      }
    ).default
    const treffer = [...sql.matchAll(/score\s*<=\s*(\d+)/g)].map((m) => Number(m[1]))
    expect(treffer.length).toBeGreaterThanOrEqual(2)
    for (const grenze of treffer) expect(grenze).toBe(MAX_RESULT_SCORE)
  })
})

describe('Nachreichen, was verloren ging', () => {
  beforeEach(async () => {
    const { db } = await import('@/offline/db')
    await db.gameResults.clear()
    await db.personalRecords.clear()
    await db.syncOutbox.clear()
    window.localStorage.clear()
  })

  it('stellt genau die Runden wieder in die Warteschlange, die der Deckel verschluckt hat', async () => {
    const { db, GUEST_USER_ID } = await import('@/offline/db')
    const { holeVerloreneErgebnisseNach } = await import('@/services/nachtragen')

    const runde = (id: string, score: number) => ({
      id,
      userId: GUEST_USER_ID,
      gameId: 'trapbound',
      level: 301,
      score,
      xp: 60,
      resultData: {},
      isPersonalRecord: false,
      stars: 0,
      createdAt: new Date().toISOString(),
      synced: 0,
    })
    // Zwei über der alten Grenze, eine darunter.
    await db.gameResults.bulkPut([runde('a', 4062), runde('b', 2500), runde('c', 800)])

    const ergebnis = await holeVerloreneErgebnisseNach()
    expect(ergebnis.ergebnisse).toBe(2)

    const warteschlange = await db.syncOutbox.toArray()
    expect(warteschlange.map((e) => e.payload.id).sort()).toEqual(['a', 'b'])
    // Die kleine Runde nicht: Die ist damals angekommen und käme sonst
    // nur noch einmal über die Leitung.
    expect(warteschlange.map((e) => e.payload.id)).not.toContain('c')
  })

  it('läuft nur einmal je Gerät', async () => {
    const { db, GUEST_USER_ID } = await import('@/offline/db')
    const { holeVerloreneErgebnisseNach } = await import('@/services/nachtragen')
    await db.gameResults.put({
      id: 'a',
      userId: GUEST_USER_ID,
      gameId: 'schuetzenopoly',
      level: 1,
      score: 48_500,
      xp: 120,
      resultData: {},
      isPersonalRecord: false,
      stars: 0,
      createdAt: new Date().toISOString(),
      synced: 0,
    })

    expect((await holeVerloreneErgebnisseNach()).ergebnisse).toBe(1)
    expect((await holeVerloreneErgebnisseNach()).ergebnisse).toBe(0)
    // Ausdrücklich noch einmal geht trotzdem.
    expect((await holeVerloreneErgebnisseNach(undefined, true)).ergebnisse).toBe(1)
  })
})
