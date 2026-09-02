/**
 * Wer bin ich? – die Regel, um die sich alles dreht: Jeder sieht die
 * Begriffe der anderen, seinen eigenen nie.
 */
import { describe, it, expect } from 'vitest'
import {
  createWbiMatch,
  openReveal,
  confirmReveal,
  startGuessing,
  submitGuess,
  nextGuesser,
  nextWbiRound,
  othersFor,
  wbiStarter,
  gleich,
  MIN_SPIELER,
  MAX_SPIELER,
} from '@/games/wer-bin-ich'
import { werBinIchGame } from '@/games/wer-bin-ich'
import type { WbiState } from '@/games/wer-bin-ich'
import { wordsForCategory } from '@/games/finde-den-imposter'

const NAMEN = ['Anna', 'Ben', 'Cem', 'Dana']

function start(names = NAMEN, opts: Record<string, unknown> = {}): WbiState {
  return createWbiMatch({ names, categoryId: 'tiere', seed: 42, ...opts })
}

/** Das Gerät einmal herumreichen. */
function alleGesehen(state: WbiState): WbiState {
  let s = state
  for (let i = 0; i < s.players.length; i++) s = confirmReveal(openReveal(s))
  return s
}

describe('Aufstellung', () => {
  it('braucht mindestens zwei und höchstens zwölf Mitspielende', () => {
    expect(() => start(['A'])).toThrow(new RegExp(`Mindestens ${MIN_SPIELER}`))
    expect(() => start(Array.from({ length: MAX_SPIELER + 1 }, (_, i) => `S${i}`))).toThrow(
      new RegExp(`Maximal ${MAX_SPIELER}`),
    )
  })

  it('weist doppelte Namen ab', () => {
    expect(() => start(['Anna', 'anna', 'Ben'])).toThrow(/doppelt/i)
  })

  it('gibt jedem ein eigenes Wort aus der Kategorie', () => {
    const s = start()
    const pool = wordsForCategory('tiere').map((w) => w.word)
    expect(new Set(s.players.map((p) => p.word)).size).toBe(s.players.length)
    for (const p of s.players) expect(pool).toContain(p.word)
  })

  it('zieht bei anderem Startwert andere Wörter', () => {
    const varianten = new Set(
      Array.from({ length: 20 }, (_, i) =>
        start(NAMEN, { seed: i })
          .players.map((p) => p.word)
          .join('|'),
      ),
    )
    expect(varianten.size).toBeGreaterThan(1)
  })

  it('benennt jemanden, der die Fragerunde eröffnet', () => {
    const s = start()
    expect(s.players).toContain(wbiStarter(s))
  })
})

describe('Das eigene Wort bleibt verdeckt', () => {
  it('zeigt beim Herumreichen immer alle anderen, nie sich selbst', () => {
    let s = start()
    for (let i = 0; i < s.players.length; i++) {
      s = openReveal(s)
      const sichtbar = othersFor(s)
      expect(sichtbar).toHaveLength(s.players.length - 1)
      expect(sichtbar.map((p) => p.id)).not.toContain(s.players[s.activePlayerIndex]!.id)
      s = confirmReveal(s)
    }
  })

  it('geht nach der letzten Person in die Fragerunde', () => {
    expect(alleGesehen(start()).phase).toBe('discussion')
  })
})

describe('Raten', () => {
  it('reicht das Gerät reihum weiter und löst am Ende auf', () => {
    let s = startGuessing(alleGesehen(start()))
    expect(s.phase).toBe('guess')
    for (let i = 0; i < s.players.length; i++) {
      const dran = s.players[s.activePlayerIndex]!
      s = submitGuess(s, dran.word)
      expect(s.phase).toBe('guess_result')
      s = nextGuesser(s)
    }
    expect(s.phase).toBe('round_result')
    expect(s.players.every((p) => p.correct)).toBe(true)
  })

  it('erkennt einen falschen Tipp als falsch', () => {
    const s = submitGuess(startGuessing(alleGesehen(start())), 'ganz bestimmt falsch')
    expect(s.players[0]!.correct).toBe(false)
    expect(s.players[0]!.guess).toBe('ganz bestimmt falsch')
  })

  it('lässt einen leeren Tipp nicht als richtig durchgehen', () => {
    const s = submitGuess(startGuessing(alleGesehen(start())), '   ')
    expect(s.players[0]!.correct).toBe(false)
  })

  it('ist bei Groß-/Kleinschreibung und Umlauten nachsichtig', () => {
    expect(gleich('Löwe', 'loewe')).toBe(true)
    expect(gleich('  MAUS ', 'maus')).toBe(true)
    expect(gleich('Straße', 'strasse')).toBe(true)
    expect(gleich('Hund', 'Katze')).toBe(false)
  })
})

describe('Nächste Runde', () => {
  it('teilt neu aus und leert die Tipps', () => {
    let s = startGuessing(alleGesehen(start()))
    for (let i = 0; i < 4; i++) s = nextGuesser(submitGuess(s, 'daneben'))
    const alteWorte = s.players.map((p) => p.word)

    const r2 = nextWbiRound(s)
    expect(r2.phase).toBe('handoff')
    expect(r2.roundIndex).toBe(1)
    expect(r2.players.every((p) => p.guess === null && p.correct === null)).toBe(true)
    expect(r2.players.map((p) => p.name)).toEqual(s.players.map((p) => p.name))
    expect(new Set(r2.players.map((p) => p.word)).size).toBe(4)
    expect(r2.players.map((p) => p.word)).not.toEqual(alteWorte)
  })
})

describe('Eigene Wortliste', () => {
  it('zieht die Begriffe aus der eigenen Liste', () => {
    const eigene = ['Oma Erna', 'Onkel Kurt', 'Tante Rita', 'Nachbar Klaus']
    const s = createWbiMatch({
      names: NAMEN,
      categoryId: 'eigene:familie',
      customWords: eigene,
      customCategoryLabel: 'Familie',
      seed: 3,
    })
    expect(s.categoryLabel).toBe('Familie')
    for (const p of s.players) expect(eigene).toContain(p.word)
  })

  it('kommt auch mit weniger Wörtern als Mitspielenden zurecht', () => {
    const s = createWbiMatch({
      names: NAMEN,
      categoryId: 'eigene:klein',
      customWords: ['A', 'B'],
      seed: 1,
    })
    expect(s.players).toHaveLength(4)
    for (const p of s.players) expect(['A', 'B']).toContain(p.word)
  })
})

describe('Keine Wertung', () => {
  it('vergibt weder Punkte noch XP noch Sterne', () => {
    expect(werBinIchGame.calculateScore(1, {})).toBe(0)
    expect(werBinIchGame.calculateXP(1, 0)).toBe(0)
    expect(werBinIchGame.calculateStars?.(1, 0)).toBe(0)
  })
})
