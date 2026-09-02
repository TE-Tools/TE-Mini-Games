/**
 * Regeln von "Finde den Imposter" gegen die Spezifikation nachgerechnet.
 *
 * Das Handoff-Paket (02.09.2026) kam ohne Tests -- typecheck und build waren
 * grün, aber ob die Regeln stimmen, sagt das nicht. Diese Datei prüft genau
 * das, was in INTEGRATE.md und STATUS.md als Regelwerk beschrieben ist.
 */
import { describe, it, expect } from 'vitest'
import {
  createMatch,
  openSecret,
  confirmSecret,
  openHint,
  submitHint,
  endDiscussion,
  openVote,
  submitVote,
  openLastChance,
  submitLastChance,
  nextRound,
  ranking,
  createRng,
} from '@/games/finde-den-imposter/engine'
import { defaultImposterCount } from '@/games/finde-den-imposter/modes'
import { findeDenImposterGame } from '@/games/finde-den-imposter'
import type { ImposterMatchState } from '@/games/finde-den-imposter/types'

const NAMES6 = ['Anna', 'Ben', 'Cem', 'Dana', 'Elif', 'Finn']

function start(names = NAMES6, opts: Record<string, unknown> = {}): ImposterMatchState {
  return createMatch({ names, categoryId: 'tiere', seed: 42, totalRounds: 2, ...opts })
}

/** Alle Geheimnisse durchklicken, bis die Hinweisphase beginnt. */
function allSecrets(state: ImposterMatchState): ImposterMatchState {
  let s = state
  for (let i = 0; i < s.players.length; i++) s = confirmSecret(openSecret(s))
  return s
}

/** Jeder gibt einen Hinweis. */
function allHints(state: ImposterMatchState): ImposterMatchState {
  let s = state
  for (let i = 0; i < s.players.length; i++) s = submitHint(openHint(s), `Hinweis ${i}`)
  return s
}

/** Alle stimmen für targetId (wer selbst dran ist, weicht aus). */
function allVoteFor(state: ImposterMatchState, targetId: string): ImposterMatchState {
  let s = endDiscussion(state)
  for (let i = 0; i < s.players.length; i++) {
    const voter = s.players[s.activePlayerIndex]!
    const ziel = voter.id === targetId
      ? s.players.find((p) => p.id !== voter.id)!.id
      : targetId
    s = submitVote(openVote(s), ziel)
  }
  return s
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
    const imposter = s.players.filter((p) => p.isImposter)
    const dorf = s.players.filter((p) => !p.isImposter)
    expect(imposter.length).toBeGreaterThanOrEqual(1)
    expect(imposter.every((p) => p.word === null)).toBe(true)
    expect(dorf.every((p) => p.word === s.config.secretWord)).toBe(true)
  })

  it('gleicher Seed ergibt dieselbe Runde', () => {
    const a = start(NAMES6, { seed: 7 })
    const b = start(NAMES6, { seed: 7 })
    expect(b.config.secretWord).toBe(a.config.secretWord)
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

describe('Ablauf', () => {
  it('führt von Geheimnissen über Hinweise zur Diskussion', () => {
    const s = allHints(allSecrets(start()))
    expect(s.phase).toBe('discussion')
    expect(s.players.every((p) => p.hint)).toBe(true)
  })

  it('niemand kann für sich selbst stimmen', () => {
    let s = endDiscussion(allHints(allSecrets(start())))
    s = openVote(s)
    const ich = s.players[s.activePlayerIndex]!
    const unveraendert = submitVote(s, ich.id)
    expect(unveraendert.players[unveraendert.activePlayerIndex]!.voteForId).toBeNull()
  })

  it('Hinweise werden auf 40 Zeichen gekürzt und leere abgelehnt', () => {
    let s = openHint(allSecrets(start()))
    expect(submitHint(s, '   ')).toBe(s)
    s = submitHint(s, 'x'.repeat(60))
    expect(s.players[0]!.hint).toHaveLength(40)
  })
})

describe('Punkte', () => {
  it('enttarnter Imposter, letzte Chance daneben: Dorf 2+1, Imposter 0', () => {
    const s0 = allHints(allSecrets(start()))
    const imposter = s0.players.find((p) => p.isImposter)!
    let s = allVoteFor(s0, imposter.id)
    expect(s.phase).toBe('last_chance')
    expect(s.correctAccusation).toBe(true)

    s = submitLastChance(openLastChance(s), 'völlig falsches Wort')
    expect(s.lastChanceSuccess).toBe(false)
    expect(s.phase).toBe('round_result')
    for (const p of s.players) {
      expect(p.roundPoints).toBe(p.isImposter ? 0 : 3)
    }
  })

  it('enttarnter Imposter errät das Wort: er bekommt 3, das Dorf behält seine 2', () => {
    // Bewusst so festgehalten: Das Dorf hat den Imposter korrekt enttarnt und
    // behält dafür seine 2 Punkte -- die gelungene letzte Chance bringt dem
    // Imposter etwas obendrauf, nimmt dem Dorf aber nichts weg. Genau so steht
    // es in INTEGRATE.md ("Dorf +2, +1 wenn Last Chance scheitert") und im
    // Kopfkommentar von scoring.ts.
    const s0 = allHints(allSecrets(start()))
    const imposter = s0.players.find((p) => p.isImposter)!
    let s = allVoteFor(s0, imposter.id)
    s = submitLastChance(openLastChance(s), s.config.secretWord)
    expect(s.lastChanceSuccess).toBe(true)
    const geraten = s.players.find((p) => p.id === imposter.id)!
    expect(geraten.roundPoints).toBe(3)
    expect(s.players.filter((p) => !p.isImposter).every((p) => p.roundPoints === 2)).toBe(true)
  })

  it('bei zwei Imposter bekommt der Mitwisser 1 Punkt für die gelungene letzte Chance', () => {
    const s0 = allHints(allSecrets(start(NAMES6, { mode: 'double' })))
    expect(s0.config.imposterCount).toBe(2)
    const beide = s0.players.filter((p) => p.isImposter)
    let s = allVoteFor(s0, beide[0]!.id)
    s = submitLastChance(openLastChance(s), s.config.secretWord)
    const rater = s.players.find((p) => p.lastChanceGuess)!
    const mitwisser = s.players.find((p) => p.isImposter && !p.lastChanceGuess)!
    expect(rater.roundPoints).toBe(3)
    expect(mitwisser.roundPoints).toBe(1)
  })

  it('Raten ist unabhängig von Groß-/Kleinschreibung', () => {
    const s0 = allHints(allSecrets(start()))
    const imposter = s0.players.find((p) => p.isImposter)!
    let s = allVoteFor(s0, imposter.id)
    s = submitLastChance(openLastChance(s), s.config.secretWord.toUpperCase())
    expect(s.lastChanceSuccess).toBe(true)
  })

  it('falsch beschuldigt: Imposter überleben und bekommen je 2', () => {
    const s0 = allHints(allSecrets(start()))
    const unschuldig = s0.players.find((p) => !p.isImposter)!
    const s = allVoteFor(s0, unschuldig.id)
    expect(s.phase).toBe('round_result')
    expect(s.correctAccusation).toBe(false)
    for (const p of s.players) {
      expect(p.roundPoints).toBe(p.isImposter ? 2 : 0)
    }
  })
})

describe('Mehrere Runden', () => {
  it('nimmt die Gesamtpunkte mit und verteilt die Rollen neu', () => {
    const s0 = allHints(allSecrets(start()))
    const unschuldig = s0.players.find((p) => !p.isImposter)!
    const nachRunde1 = allVoteFor(s0, unschuldig.id)
    const summeVorher = nachRunde1.players.map((p) => p.totalPoints)

    const runde2 = nextRound(nachRunde1)
    expect(runde2.phase).toBe('secret_handoff')
    expect(runde2.config.roundIndex).toBe(1)
    expect(runde2.players.map((p) => p.totalPoints)).toEqual(summeVorher)
    expect(runde2.players.every((p) => p.hint === null && p.voteForId === null)).toBe(true)
  })

  it('endet nach der letzten Runde im Endstand, absteigend sortiert', () => {
    const s0 = allHints(allSecrets(start(NAMES6, { totalRounds: 1 })))
    const unschuldig = s0.players.find((p) => !p.isImposter)!
    const fertig = nextRound(allVoteFor(s0, unschuldig.id))
    expect(fertig.phase).toBe('match_result')
    expect(fertig.finished).toBe(true)
    const tabelle = ranking(fertig).map((p) => p.totalPoints)
    expect([...tabelle].sort((a, b) => b - a)).toEqual(tabelle)
  })
})

describe('Einbindung in die App', () => {
  it('ist als Spiel registriert und liefert Punkte/XP/Sterne', () => {
    expect(findeDenImposterGame.id).toBe('finde-den-imposter')
    expect(findeDenImposterGame.calculateScore(1, { score: 5000 })).toBe(1000)
    expect(findeDenImposterGame.calculateScore(1, { score: -5 })).toBe(0)
    expect(findeDenImposterGame.calculateStars!(1, 800)).toBe(5)
    expect(findeDenImposterGame.calculateXP(1, 0)).toBe(0)
  })
})
