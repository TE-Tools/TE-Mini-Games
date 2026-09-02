/**
 * Stadt-Land-Fluss: die Wertung, wie sie am Küchentisch gilt.
 */
import { describe, it, expect } from 'vitest'
import {
  createSlfMatch,
  startWriting,
  submitAnswers,
  nextSlfRound,
  slfRangliste,
  ziehBuchstabe,
  werteSpalte,
  werteRunde,
  passtZumBuchstaben,
  normalisieren,
  BUCHSTABEN,
  PUNKTE_ALLEIN,
  PUNKTE_EINZIGARTIG,
  PUNKTE_GETEILT,
  MIN_SPIELER,
} from '@/games/stadt-land-fluss'
import { createRng } from '@/games/rng'
import type { SlfState } from '@/games/stadt-land-fluss'

const NAMEN = ['Anna', 'Ben', 'Cem']

function start(names = NAMEN, opts: Record<string, unknown> = {}): SlfState {
  return createSlfMatch({ names, spalten: ['stadt', 'land'], seed: 5, ...opts })
}

describe('Buchstaben', () => {
  it('zieht nie Q, X oder Y', () => {
    expect(BUCHSTABEN).not.toContain('Q')
    expect(BUCHSTABEN).not.toContain('X')
    expect(BUCHSTABEN).not.toContain('Y')
  })

  it('zieht in der nächsten Runde nicht denselben Buchstaben', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rng = createRng(`x${seed}`)
      expect(ziehBuchstabe(rng, ['A'])).not.toBe('A')
    }
  })

  it('prüft den Anfangsbuchstaben unabhängig von der Schreibweise', () => {
    expect(passtZumBuchstaben('berlin', 'B')).toBe(true)
    expect(passtZumBuchstaben('  Bonn', 'b')).toBe(true)
    expect(passtZumBuchstaben('Köln', 'B')).toBe(false)
    expect(passtZumBuchstaben('   ', 'B')).toBe(false)
  })
})

describe('Wertung einer Spalte', () => {
  it('gibt 20 Punkte, wenn nur einer überhaupt etwas hatte', () => {
    const p = werteSpalte(
      [
        { playerId: 'a', antwort: 'Bonn' },
        { playerId: 'b', antwort: '' },
        { playerId: 'c', antwort: '' },
      ],
      'B',
    )
    expect(p).toEqual({ a: PUNKTE_ALLEIN, b: 0, c: 0 })
  })

  it('gibt 10 Punkte für eine Antwort, die sonst keiner hatte', () => {
    const p = werteSpalte(
      [
        { playerId: 'a', antwort: 'Bonn' },
        { playerId: 'b', antwort: 'Bremen' },
      ],
      'B',
    )
    expect(p).toEqual({ a: PUNKTE_EINZIGARTIG, b: PUNKTE_EINZIGARTIG })
  })

  it('gibt 5 Punkte, wenn zwei dasselbe hatten – auch anders geschrieben', () => {
    const p = werteSpalte(
      [
        { playerId: 'a', antwort: 'Bremen' },
        { playerId: 'b', antwort: ' bremen ' },
        { playerId: 'c', antwort: 'Bonn' },
      ],
      'B',
    )
    expect(p.a).toBe(PUNKTE_GETEILT)
    expect(p.b).toBe(PUNKTE_GETEILT)
    expect(p.c).toBe(PUNKTE_EINZIGARTIG)
  })

  it('gibt null Punkte für den falschen Anfangsbuchstaben', () => {
    const p = werteSpalte(
      [
        { playerId: 'a', antwort: 'Köln' },
        { playerId: 'b', antwort: 'Bonn' },
      ],
      'B',
    )
    expect(p.a).toBe(0)
    // b war damit der Einzige mit einer gültigen Antwort.
    expect(p.b).toBe(PUNKTE_ALLEIN)
  })

  it('gibt allen null, wenn niemand etwas hatte', () => {
    expect(werteSpalte([{ playerId: 'a', antwort: '' }], 'B')).toEqual({ a: 0 })
  })

  it('zieht Umlaute und Schreibweisen zusammen', () => {
    expect(normalisieren('Köln')).toBe(normalisieren('koeln'))
    expect(normalisieren('Sankt Gallen')).toBe(normalisieren('sanktgallen'))
  })
})

describe('Wertung einer Runde', () => {
  it('summiert über alle Spalten', () => {
    const w = werteRunde(
      {
        a: { stadt: 'Bonn', land: 'Belgien' },
        b: { stadt: 'Bonn', land: '' },
      },
      ['stadt', 'land'],
      'B',
    )
    // Stadt: beide "Bonn" -> je 5. Land: nur a -> 20.
    expect(w.summe.a).toBe(PUNKTE_GETEILT + PUNKTE_ALLEIN)
    expect(w.summe.b).toBe(PUNKTE_GETEILT)
    expect(w.proSpalte.land!.a).toBe(PUNKTE_ALLEIN)
  })
})

describe('Ablauf am einen Gerät', () => {
  it('reicht das Gerät reihum weiter und wertet am Ende aus', () => {
    let s = start()
    expect(s.phase).toBe('handoff')
    for (let i = 0; i < NAMEN.length; i++) {
      s = startWriting(s)
      expect(s.phase).toBe('write')
      s = submitAnswers(s, { stadt: `${s.buchstabe}stadt${i}`, land: `${s.buchstabe}land` })
    }
    expect(s.phase).toBe('result')
    expect(s.wertung).not.toBeNull()
    // Alle drei hatten dasselbe Land -> je 5; die Städte waren verschieden -> je 10.
    for (const p of s.players) expect(p.roundScore).toBe(PUNKTE_EINZIGARTIG + PUNKTE_GETEILT)
  })

  it('schreibt die Gesamtpunkte über mehrere Runden fort', () => {
    let s = start()
    for (let runde = 0; runde < 2; runde++) {
      for (let i = 0; i < NAMEN.length; i++) {
        s = submitAnswers(startWriting(s), { stadt: `${s.buchstabe}x${i}`, land: '' })
      }
      if (runde === 0) s = nextSlfRound(s)
    }
    for (const p of s.players) expect(p.totalScore).toBe(2 * PUNKTE_EINZIGARTIG)
  })

  it('startet die nächste Runde leer und mit neuem Buchstaben', () => {
    let s = start()
    // Der Buchstabe wird gezogen -- die Antworten müssen zu ihm passen,
    // sonst gibt es null Punkte und der Test prüft nichts.
    const alt = s.buchstabe
    for (let i = 0; i < NAMEN.length; i++) {
      s = submitAnswers(startWriting(s), { stadt: `${alt}onnstadt` })
    }
    const r2 = nextSlfRound(s)
    expect(r2.phase).toBe('handoff')
    expect(r2.buchstabe).not.toBe(alt)
    expect(r2.players.every((p) => Object.keys(p.answers).length === 0 && !p.submitted)).toBe(true)
    expect(r2.players.every((p) => p.totalScore > 0)).toBe(true)
  })

  it('sortiert die Rangliste nach Gesamtpunkten', () => {
    let s = start()
    const b = s.buchstabe
    s = submitAnswers(startWriting(s), { stadt: `${b}onn`, land: `${b}elgien` })
    s = submitAnswers(startWriting(s), { stadt: `${b}onn`, land: '' })
    s = submitAnswers(startWriting(s), { stadt: '', land: '' })
    const rang = slfRangliste(s)
    expect(rang[0]!.totalScore).toBeGreaterThanOrEqual(rang[1]!.totalScore)
    expect(rang[2]!.totalScore).toBe(0)
  })

  it('braucht mindestens zwei Mitspielende und eine Spalte', () => {
    expect(() => start(['Allein'])).toThrow(new RegExp(`Mindestens ${MIN_SPIELER}`))
    expect(() => start(NAMEN, { spalten: [] })).toThrow(/Spalte/)
  })
})
