/**
 * Regeln von "Finde den Imposter" nachgerechnet.
 *
 * Ablauf seit dem 02.09.2026 (Thomas' Vorgaben): reihum wird laut gesprochen
 * statt getippt, danach tippt die Runde gemeinsam auf einen Namen. Kein
 * Punktesystem, keine Rangliste. Imposter sehen genau EIN Hilfswort, das
 * jede Runde wechselt.
 */
import { describe, it, expect } from 'vitest'
import {
  createMatch,
  openSecret,
  confirmSecret,
  passTurn,
  endDiscussion,
  accuse,
  submitLastChance,
  nextRound,
  accusedPlayer,
  imposters,
  createRng,
} from '@/games/finde-den-imposter/engine'
import { defaultImposterCount } from '@/games/finde-den-imposter/modes'
import { findeDenImposterGame } from '@/games/finde-den-imposter'
import { wordsForCategory } from '@/games/finde-den-imposter/data/words'
import type { ImposterMatchState } from '@/games/finde-den-imposter/types'

const NAMES6 = ['Anna', 'Ben', 'Cem', 'Dana', 'Elif', 'Finn']

function start(names = NAMES6, opts: Record<string, unknown> = {}): ImposterMatchState {
  return createMatch({ names, categoryId: 'tiere', seed: 42, totalRounds: 2, ...opts })
}

/** Gerät herumreichen, bis alle ihr Geheimnis gesehen haben. */
function allSecrets(state: ImposterMatchState): ImposterMatchState {
  let s = state
  for (let i = 0; i < s.players.length; i++) s = confirmSecret(openSecret(s))
  return s
}

/** Reihum: jeder sagt sein Wort laut. */
function allTurns(state: ImposterMatchState): ImposterMatchState {
  let s = state
  for (let i = 0; i < s.players.length; i++) s = passTurn(s)
  return s
}

/** Bis zur gemeinsamen Anklage durchspielen. */
function bisAnklage(state = start()): ImposterMatchState {
  return endDiscussion(allTurns(allSecrets(state)))
}

describe('Aufstellung', () => {
  it('braucht mindestens 3 und höchstens 12 Mitspielende', () => {
    expect(() => start(['A', 'B'])).toThrow(/Mindestens 3/)
    expect(() => start(Array.from({ length: 13 }, (_, i) => `S${i}`))).toThrow(/Maximal 12/)
    expect(start(['A', 'B', 'C']).players).toHaveLength(3)
  })

  it('weist doppelte Namen ab (auch mit anderer Groß-/Kleinschreibung)', () => {
    expect(() => start(['Anna', 'anna', 'Ben'])).toThrow(/doppelt/i)
  })

  it('Imposter-Anzahl: bis 8 einer, ab 9 zwei; Doppel-Modus ab 6 zwei', () => {
    expect(defaultImposterCount(8)).toBe(1)
    expect(defaultImposterCount(9)).toBe(2)
    expect(defaultImposterCount(5, 'double')).toBe(1)
    expect(defaultImposterCount(6, 'double')).toBe(2)
  })

  it('Imposter kennen das Wort nicht, alle anderen schon', () => {
    const s = start()
    expect(imposters(s).length).toBeGreaterThanOrEqual(1)
    expect(imposters(s).every((p) => p.word === null)).toBe(true)
    expect(s.players.filter((p) => !p.isImposter).every((p) => p.word === s.config.secretWord)).toBe(true)
  })

  it('gleicher Seed ergibt dieselbe Runde', () => {
    const a = start(NAMES6, { seed: 7 })
    const b = start(NAMES6, { seed: 7 })
    expect(b.config.secretWord).toBe(a.config.secretWord)
    expect(b.config.helperWord).toBe(a.config.helperWord)
    expect(b.players.map((p) => p.isImposter)).toEqual(a.players.map((p) => p.isImposter))
  })

  it('der Zufallsgenerator liefert Werte zwischen 0 und 1', () => {
    const rng = createRng(123)
    for (let i = 0; i < 200; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('Hilfswort', () => {
  it('ist genau eines, stammt aus derselben Kategorie und ist nicht das geheime Wort', () => {
    const s = start()
    expect(typeof s.config.helperWord).toBe('string')
    expect(s.config.helperWord.length).toBeGreaterThan(0)
    expect(s.config.helperWord.toLowerCase()).not.toBe(s.config.secretWord.toLowerCase())
    const kategorie = wordsForCategory('tiere').map((w) => w.word)
    expect(kategorie).toContain(s.config.helperWord)
  })

  it('wechselt über die Runden, damit sich nicht alles gleich anfühlt', () => {
    // Über mehrere Startwerte betrachtet darf nicht immer dasselbe Paar kommen.
    const paare = new Set<string>()
    for (let seed = 1; seed <= 12; seed++) {
      const s = start(NAMES6, { seed })
      paare.add(`${s.config.secretWord}|${s.config.helperWord}`)
    }
    expect(paare.size).toBeGreaterThan(1)
  })
})

describe('Ablauf', () => {
  it('führt von den Geheimnissen direkt zur Reihum-Phase (ohne Tippen)', () => {
    const s = allSecrets(start())
    expect(s.phase).toBe('turns')
    expect(s.handoffCover).toBe(false)
  })

  it('reicht reihum weiter und merkt sich, wer schon dran war', () => {
    let s = allSecrets(start())
    expect(s.players[0]!.hasSpoken).toBe(false)
    s = passTurn(s)
    expect(s.players[0]!.hasSpoken).toBe(true)
    expect(s.activePlayerIndex).toBe(1)
    expect(s.phase).toBe('turns')
  })

  it('geht nach der letzten Person ins Gespräch', () => {
    const s = allTurns(allSecrets(start()))
    expect(s.phase).toBe('discussion')
    expect(s.players.every((p) => p.hasSpoken)).toBe(true)
  })

  it('zeigt zum Anklagen alle Mitspielenden – niemand ist ausgenommen', () => {
    const s = bisAnklage()
    expect(s.phase).toBe('accuse')
    expect(s.players).toHaveLength(6)
  })
})

describe('Anklage', () => {
  it('trifft es einen Imposter, bekommt genau der die letzte Chance', () => {
    const s0 = bisAnklage()
    const imposter = imposters(s0)[0]!
    const s = accuse(s0, imposter.id)
    expect(s.phase).toBe('last_chance')
    expect(s.correctAccusation).toBe(true)
    expect(accusedPlayer(s)!.id).toBe(imposter.id)
    expect(s.players[s.activePlayerIndex]!.id).toBe(imposter.id)
  })

  it('trifft es eine unschuldige Person, ist die Runde sofort vorbei', () => {
    const s0 = bisAnklage()
    const unschuldig = s0.players.find((p) => !p.isImposter)!
    const s = accuse(s0, unschuldig.id)
    expect(s.phase).toBe('round_result')
    expect(s.correctAccusation).toBe(false)
    expect(s.lastChanceSuccess).toBeNull()
    expect(accusedPlayer(s)!.name).toBe(unschuldig.name)
  })

  it('ignoriert einen unbekannten Namen', () => {
    const s0 = bisAnklage()
    expect(accuse(s0, 'gibt-es-nicht')).toBe(s0)
  })
})

describe('Letzte Chance', () => {
  it('richtig geraten dreht die Runde', () => {
    const s0 = bisAnklage()
    let s = accuse(s0, imposters(s0)[0]!.id)
    s = submitLastChance(s, s.config.secretWord)
    expect(s.lastChanceSuccess).toBe(true)
    expect(s.phase).toBe('round_result')
  })

  it('erkennt das Wort unabhängig von Groß-/Kleinschreibung', () => {
    const s0 = bisAnklage()
    let s = accuse(s0, imposters(s0)[0]!.id)
    s = submitLastChance(s, s.config.secretWord.toUpperCase())
    expect(s.lastChanceSuccess).toBe(true)
  })

  it('daneben geraten heißt: das Dorf hat gewonnen', () => {
    const s0 = bisAnklage()
    let s = accuse(s0, imposters(s0)[0]!.id)
    s = submitLastChance(s, 'völlig falsches Wort')
    expect(s.lastChanceSuccess).toBe(false)
    expect(s.phase).toBe('round_result')
  })

  it('leere Eingabe zählt nicht als Treffer', () => {
    const s0 = bisAnklage()
    let s = accuse(s0, imposters(s0)[0]!.id)
    s = submitLastChance(s, '   ')
    expect(s.lastChanceSuccess).toBe(false)
  })
})

describe('Nächste Runde', () => {
  it('startet frisch mit neuem Wort und neu verteilten Rollen', () => {
    const s0 = bisAnklage()
    const fertig = accuse(s0, s0.players.find((p) => !p.isImposter)!.id)
    const r2 = nextRound(fertig)
    expect(r2.phase).toBe('secret_handoff')
    expect(r2.config.roundIndex).toBe(1)
    expect(r2.players.every((p) => !p.hasSpoken && p.lastChanceGuess === null)).toBe(true)
    expect(r2.accusedId).toBeNull()
    expect(r2.players.map((p) => p.name)).toEqual(s0.players.map((p) => p.name))
  })

  it('lässt sich beliebig oft weiterspielen', () => {
    let s = accuse(bisAnklage(), 'p0')
    for (let i = 0; i < 4; i++) {
      s = nextRound(s)
      expect(s.phase).toBe('secret_handoff')
      s = endDiscussion(allTurns(allSecrets(s)))
      s = accuse(s, s.players[0]!.id)
      if (s.phase === 'last_chance') s = submitLastChance(s, 'daneben')
      expect(s.phase).toBe('round_result')
    }
  })
})

describe('Keine Wertung', () => {
  it('vergibt weder Punkte noch XP noch Sterne', () => {
    expect(findeDenImposterGame.calculateScore(1, { score: 999 })).toBe(0)
    expect(findeDenImposterGame.calculateXP(1, 999)).toBe(0)
    expect(findeDenImposterGame.calculateStars!(1, 999)).toBe(0)
  })

  it('führt keine Punktefelder mehr mit', () => {
    const s = start()
    const felder = Object.keys(s.players[0]!)
    expect(felder).not.toContain('roundPoints')
    expect(felder).not.toContain('totalPoints')
  })
})
