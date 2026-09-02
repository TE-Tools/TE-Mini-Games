/**
 * Scharade: Vorrat, Treffer und der Wechsel zur nächsten Person.
 */
import { describe, it, expect } from 'vitest'
import {
  createScharadeMatch,
  currentWord,
  startTurn,
  markCorrect,
  markSkipped,
  endTurn,
  nextTurn,
  nextScharadeRound,
  scharadeRangliste,
  MIN_SPIELER,
} from '@/games/scharade'
import { scharadeGame } from '@/games/scharade'
import type { ScharadeState } from '@/games/scharade'
import { wordsForCategory } from '@/games/finde-den-imposter'

const NAMEN = ['Anna', 'Ben', 'Cem']

function start(names = NAMEN, opts: Record<string, unknown> = {}): ScharadeState {
  return createScharadeMatch({ names, categoryId: 'tiere', seed: 11, ...opts })
}

describe('Aufstellung', () => {
  it('braucht mindestens zwei Mitspielende', () => {
    expect(() => start(['Allein'])).toThrow(new RegExp(`Mindestens ${MIN_SPIELER}`))
  })

  it('mischt den ganzen Wortschatz der Kategorie als Vorrat', () => {
    const s = start()
    const pool = wordsForCategory('tiere').map((w) => w.word)
    expect(s.pool).toHaveLength(pool.length)
    expect([...s.pool].sort()).toEqual([...pool].sort())
  })

  it('mischt bei anderem Startwert anders', () => {
    expect(start(NAMEN, { seed: 1 }).pool.join()).not.toBe(start(NAMEN, { seed: 2 }).pool.join())
  })

  it('hält die Zeit in vernünftigen Grenzen', () => {
    expect(start(NAMEN, { seconds: 5 }).seconds).toBe(30)
    expect(start(NAMEN, { seconds: 9999 }).seconds).toBe(180)
  })
})

describe('Eine Runde', () => {
  it('zählt Treffer und Übersprungene getrennt', () => {
    let s = startTurn(start())
    const ersteWorte = [currentWord(s)]
    s = markCorrect(s)
    ersteWorte.push(currentWord(s))
    s = markSkipped(s)

    expect(s.roundCorrect).toEqual([ersteWorte[0]])
    expect(s.roundSkipped).toEqual([ersteWorte[1]])
    expect(s.players[0]).toMatchObject({ correct: 1, skipped: 1 })
  })

  it('zeigt nie zweimal hintereinander dasselbe Wort', () => {
    let s = startTurn(start())
    const gesehen: string[] = []
    for (let i = 0; i < 20; i++) {
      gesehen.push(currentWord(s))
      s = markCorrect(s)
    }
    for (let i = 1; i < gesehen.length; i++) {
      expect(gesehen[i]).not.toBe(gesehen[i - 1])
    }
  })

  it('geht nach der Uhr zur Auswertung und dann an die nächste Person', () => {
    let s = markCorrect(startTurn(start()))
    s = endTurn(s)
    expect(s.phase).toBe('round_result')
    s = nextTurn(s)
    expect(s.phase).toBe('handoff')
    expect(s.activePlayerIndex).toBe(1)
  })

  it('kommt nach der letzten Person zur Gesamtwertung', () => {
    let s = start()
    for (let i = 0; i < NAMEN.length; i++) {
      s = nextTurn(endTurn(startTurn(s)))
    }
    expect(s.phase).toBe('total')
  })

  it('leert die Rundenliste beim Start der nächsten Person', () => {
    let s = markCorrect(startTurn(start()))
    s = startTurn(nextTurn(endTurn(s)))
    expect(s.roundCorrect).toEqual([])
    expect(s.roundSkipped).toEqual([])
  })
})

describe('Wertung', () => {
  it('sortiert nach Treffern, bei Gleichstand nach weniger Übersprungenen', () => {
    let s = start()
    // Anna: 2 Treffer, Ben: 2 Treffer aber 1 uebersprungen, Cem: 1 Treffer
    s = markCorrect(markCorrect(startTurn(s)))
    s = startTurn(nextTurn(endTurn(s)))
    s = markSkipped(markCorrect(markCorrect(s)))
    s = startTurn(nextTurn(endTurn(s)))
    s = markCorrect(s)
    s = nextTurn(endTurn(s))

    const rang = scharadeRangliste(s)
    expect(rang.map((p) => p.name)).toEqual(['Anna', 'Ben', 'Cem'])
  })

  it('nimmt die Punkte in die nächste Runde mit', () => {
    let s = start()
    for (let i = 0; i < NAMEN.length; i++) {
      s = nextTurn(endTurn(markCorrect(startTurn(s))))
    }
    const r2 = nextScharadeRound(s)
    expect(r2.phase).toBe('handoff')
    expect(r2.roundIndex).toBe(1)
    expect(r2.players.every((p) => p.correct === 1)).toBe(true)
  })
})

describe('Keine Wertung in der App', () => {
  it('vergibt weder Punkte noch XP', () => {
    expect(scharadeGame.calculateScore(1, {})).toBe(0)
    expect(scharadeGame.calculateXP(1, 0)).toBe(0)
  })
})
