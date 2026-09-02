/**
 * Wer würde eher?: heimlich abstimmen, gemeinsam aufdecken.
 */
import { describe, it, expect } from 'vitest'
import {
  createWweeMatch,
  currentFrage,
  openVote,
  vote,
  nextFrage,
  auszaehlen,
  nameOf,
  FRAGEN,
  fragenFuer,
  MIN_SPIELER,
} from '@/games/wer-wuerde-eher'
import type { WweeState } from '@/games/wer-wuerde-eher'

const NAMEN = ['Anna', 'Ben', 'Cem', 'Dana']

function start(names = NAMEN, opts: Record<string, unknown> = {}): WweeState {
  return createWweeMatch({ names, seed: 9, rounds: 3, ...opts })
}

describe('Fragen', () => {
  it('hat von beiden Sorten reichlich', () => {
    expect(fragenFuer(['personen']).length).toBeGreaterThanOrEqual(100)
    expect(fragenFuer(['entweder']).length).toBeGreaterThanOrEqual(60)
  })

  it('gibt jeder Frage eine eigene Kennung', () => {
    expect(new Set(FRAGEN.map((f) => f.id)).size).toBe(FRAGEN.length)
  })

  it('gibt Entweder-oder-Fragen immer zwei Möglichkeiten', () => {
    for (const f of fragenFuer(['entweder'])) {
      expect(f.a, f.id).toBeTruthy()
      expect(f.b, f.id).toBeTruthy()
      expect(f.a).not.toBe(f.b)
    }
  })

  it('formuliert Personenfragen als Frage', () => {
    for (const f of fragenFuer(['personen'])) {
      expect(f.text.startsWith('Wer würde am ehesten'), f.text).toBe(true)
      expect(f.text.endsWith('?'), f.text).toBe(true)
    }
  })

  it('nimmt nur die gewählte Sorte in die Partie', () => {
    const s = start(NAMEN, { modi: ['entweder'], rounds: 8 })
    expect(s.fragen.every((f) => f.modus === 'entweder')).toBe(true)
  })

  it('stellt keine Frage zweimal in einer Partie', () => {
    const s = start(NAMEN, { rounds: 25 })
    expect(new Set(s.fragen.map((f) => f.id)).size).toBe(s.fragen.length)
  })
})

describe('Abstimmen', () => {
  it('deckt erst auf, wenn alle dran waren', () => {
    let s = openVote(start())
    for (let i = 0; i < NAMEN.length - 1; i++) {
      s = vote(s, 'p0')
      expect(s.phase).toBe('handoff')
      s = openVote(s)
    }
    s = vote(s, 'p0')
    expect(s.phase).toBe('result')
  })

  it('zählt die Stimmen aus und findet die Mehrheit', () => {
    let s = openVote(start())
    for (const ziel of ['p1', 'p1', 'p2', 'p1']) {
      s = vote(s, ziel)
      if (s.phase === 'handoff') s = openVote(s)
    }
    const { counts, sieger } = auszaehlen(s)
    expect(counts).toEqual({ p1: 3, p2: 1 })
    expect(sieger).toEqual(['p1'])
    expect(nameOf(s, 'p1')).toBe('Ben')
  })

  it('meldet bei Gleichstand mehrere', () => {
    let s = openVote(start())
    for (const ziel of ['p0', 'p0', 'p1', 'p1']) {
      s = vote(s, ziel)
      if (s.phase === 'handoff') s = openVote(s)
    }
    expect(auszaehlen(s).sieger.sort()).toEqual(['p0', 'p1'])
  })

  it('merkt sich, wer was gestimmt hat', () => {
    let s = openVote(start())
    for (const ziel of ['p1', 'p2', 'p3', 'p0']) {
      s = vote(s, ziel)
      if (s.phase === 'handoff') s = openVote(s)
    }
    expect(s.votes).toEqual({ p0: 'p1', p1: 'p2', p2: 'p3', p3: 'p0' })
  })

  it('leert die Stimmen für die nächste Frage', () => {
    let s = openVote(start())
    for (let i = 0; i < NAMEN.length; i++) {
      s = vote(s, 'p0')
      if (s.phase === 'handoff') s = openVote(s)
    }
    const naechste = nextFrage(s)
    expect(naechste.phase).toBe('handoff')
    expect(naechste.votes).toEqual({})
    expect(naechste.activePlayerIndex).toBe(0)
    expect(naechste.frageIndex).toBe(1)
    expect(currentFrage(naechste).id).not.toBe(currentFrage(s).id)
  })

  it('ist nach der letzten Frage vorbei', () => {
    let s = start(NAMEN, { rounds: 1 })
    s = openVote(s)
    for (let i = 0; i < NAMEN.length; i++) {
      s = vote(s, 'p0')
      if (s.phase === 'handoff') s = openVote(s)
    }
    expect(nextFrage(s).phase).toBe('done')
  })
})

describe('Aufstellung', () => {
  it('braucht mindestens drei Mitspielende', () => {
    expect(() => start(['Anna', 'Ben'])).toThrow(new RegExp(`Mindestens ${MIN_SPIELER}`))
  })

  it('weist doppelte Namen ab', () => {
    expect(() => start(['Anna', 'anna', 'Ben'])).toThrow(/doppelt/i)
  })
})
