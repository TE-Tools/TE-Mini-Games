/**
 * Regeln von "Finde den Imposter" nachgerechnet.
 *
 * Ablauf seit dem 02.09.2026 (Thomas' Vorgaben): nachdem jeder sein Wort
 * gesehen hat, sagt ein Bildschirm nur noch, wer zufällig anfängt -- danach
 * redet die Gruppe frei und tippt gemeinsam auf einen Namen. Kein
 * Weiterklicken pro Person, kein Punktesystem, keine Rangliste. Imposter
 * sehen genau EIN Hilfswort, das jede Runde wechselt.
 */
import { describe, it, expect } from 'vitest'
import {
  createMatch,
  openSecret,
  confirmSecret,
  endDiscussion,
  accuse,
  submitLastChance,
  nextRound,
  accusedPlayer,
  starterPlayer,
  teamMembers,
  teamCaught,
  imposters,
  createRng,
} from '@/games/finde-den-imposter/engine'
import { defaultImposterCount, CHAOS_RULES } from '@/games/finde-den-imposter/modes'
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

/** Bis zur gemeinsamen Anklage durchspielen. */
function bisAnklage(state = start()): ImposterMatchState {
  return endDiscussion(allSecrets(state))
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
  it('geht nach dem letzten Geheimnis direkt ins Gespräch – ohne Weiterklicken', () => {
    const s = allSecrets(start())
    expect(s.phase).toBe('discussion')
    expect(s.handoffCover).toBe(false)
  })

  it('benennt eine Person aus der Runde, die anfängt', () => {
    const s = allSecrets(start())
    expect(s.starterIndex).toBeGreaterThanOrEqual(0)
    expect(s.starterIndex).toBeLessThan(s.players.length)
    expect(s.players).toContain(starterPlayer(s))
  })

  it('würfelt die anfangende Person aus – nicht immer dieselbe', () => {
    const gezogen = new Set<number>()
    for (let seed = 1; seed <= 40; seed++) {
      gezogen.add(allSecrets(start(NAMES6, { seed })).starterIndex)
    }
    expect(gezogen.size).toBeGreaterThan(1)
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
    expect(r2.players.every((p) => p.lastChanceGuess === null)).toBe(true)
    expect(r2.accusedId).toBeNull()
    expect(r2.players.map((p) => p.name)).toEqual(s0.players.map((p) => p.name))
  })

  it('lässt sich beliebig oft weiterspielen', () => {
    let s = accuse(bisAnklage(), 'p0')
    for (let i = 0; i < 4; i++) {
      s = nextRound(s)
      expect(s.phase).toBe('secret_handoff')
      s = endDiscussion(allSecrets(s))
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

/* ============================ Die weiteren Modi =========================== */

describe('Modus „Leer"', () => {
  it('zeigt dem Imposter weder Hilfswort noch Kategorie', () => {
    const s = start(NAMES6, { mode: 'blank' })
    expect(s.config.imposterSees).toBe('nothing')
    expect(s.config.showCategory).toBe(false)
  })

  it('lässt die Unschuldigen das Wort trotzdem sehen', () => {
    const s = start(NAMES6, { mode: 'blank' })
    for (const p of s.players) {
      expect(p.word).toBe(p.isImposter ? null : s.config.secretWord)
    }
  })
})

describe('Modus „Nur Kategorie"', () => {
  it('gibt dem Imposter die Kategorie, aber kein Hilfswort', () => {
    const s = start(NAMES6, { mode: 'categories_only' })
    expect(s.config.imposterSees).toBe('category')
    expect(s.config.showCategory).toBe(true)
  })
})

describe('Modus „Tempo"', () => {
  it('bringt eine Uhr mit, die anderen Modi nicht', () => {
    expect(start(NAMES6, { mode: 'speed' }).config.timerSeconds).toBe(90)
    expect(start(NAMES6, { mode: 'classic' }).config.timerSeconds).toBeNull()
  })
})

describe('Modus „Chaos"', () => {
  it('zieht jede Runde eine Sonderregel und sagt sie an', () => {
    const s = start(NAMES6, { mode: 'chaos' })
    expect(s.config.specialRule).toBeTruthy()
    expect(CHAOS_RULES.map((r) => r.id)).toContain(s.config.specialRule)
  })

  it('zieht über viele Startwerte hinweg verschiedene Regeln', () => {
    const gezogen = new Set<string | null>()
    for (let seed = 1; seed <= 60; seed++) {
      gezogen.add(start(NAMES6, { mode: 'chaos', seed }).config.specialRule)
    }
    expect(gezogen.size).toBeGreaterThan(1)
  })

  it('zieht in kleinen Runden keine Regel, die mehr Leute braucht', () => {
    const klein = ['A', 'B', 'C']
    for (let seed = 1; seed <= 60; seed++) {
      const s = start(klein, { mode: 'chaos', seed })
      expect(s.config.imposterCount).toBe(1)
      const regel = CHAOS_RULES.find((r) => r.id === s.config.specialRule)!
      expect(regel.minPlayers).toBeLessThanOrEqual(3)
    }
  })

  it('wechselt die Regel von Runde zu Runde', () => {
    let s = start(NAMES6, { mode: 'chaos' })
    const regeln = new Set<string | null>([s.config.specialRule])
    for (let i = 0; i < 12; i++) {
      s = accuse(bisAnklage(s), s.players[0]!.id)
      if (s.phase === 'last_chance') s = submitLastChance(s, 'daneben')
      s = nextRound(s)
      regeln.add(s.config.specialRule)
    }
    expect(regeln.size).toBeGreaterThan(1)
  })
})

describe('Modus „Duell"', () => {
  const NAMES8 = [...NAMES6, 'Gina', 'Hans']

  it('braucht mindestens sechs Mitspielende', () => {
    expect(() => start(['A', 'B', 'C', 'D'], { mode: 'duel' })).toThrow(/mindestens 6/)
  })

  it('teilt in zwei möglichst gleich große Teams', () => {
    const s = start(NAMES8, { mode: 'duel' })
    expect(teamMembers(s, 1)).toHaveLength(4)
    expect(teamMembers(s, 2)).toHaveLength(4)
    expect(s.players.every((p) => p.team === 1 || p.team === 2)).toBe(true)
  })

  it('setzt in jedes Team genau einen Imposter – über viele Startwerte', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = start(NAMES8, { mode: 'duel', seed })
      expect(teamMembers(s, 1).filter((p) => p.isImposter)).toHaveLength(1)
      expect(teamMembers(s, 2).filter((p) => p.isImposter)).toHaveLength(1)
    }
  })

  it('wertet erst aus, wenn beide Teams getippt haben', () => {
    const s0 = bisAnklage(start(NAMES8, { mode: 'duel' }))
    const nachTeam1 = accuse(s0, teamMembers(s0, 1)[0]!.id)
    expect(nachTeam1.phase).toBe('accuse')
    expect(nachTeam1.teamAccused[0]).toBeTruthy()
    expect(nachTeam1.teamAccused[1]).toBeNull()

    const fertig = accuse(nachTeam1, teamMembers(s0, 2)[0]!.id)
    expect(fertig.phase).not.toBe('accuse')
  })

  it('lässt ein Team nicht zweimal tippen', () => {
    const s0 = bisAnklage(start(NAMES8, { mode: 'duel' }))
    const einmal = accuse(s0, teamMembers(s0, 1)[0]!.id)
    const nochmal = accuse(einmal, teamMembers(s0, 1)[1]!.id)
    expect(nochmal.teamAccused[0]).toBe(einmal.teamAccused[0])
  })

  it('gibt beiden erwischten Imposter nacheinander die letzte Chance', () => {
    const s0 = bisAnklage(start(NAMES8, { mode: 'duel' }))
    const i1 = teamMembers(s0, 1).find((p) => p.isImposter)!
    const i2 = teamMembers(s0, 2).find((p) => p.isImposter)!

    let s = accuse(accuse(s0, i1.id), i2.id)
    expect(s.phase).toBe('last_chance')
    expect(s.lastChanceQueue).toEqual([i1.id, i2.id])

    s = submitLastChance(s, 'daneben')
    expect(s.phase).toBe('last_chance')
    expect(s.lastChanceQueue).toEqual([i2.id])

    s = submitLastChance(s, s.config.secretWord)
    expect(s.phase).toBe('round_result')
    expect(s.players.find((p) => p.id === i1.id)!.lastChanceCorrect).toBe(false)
    expect(s.players.find((p) => p.id === i2.id)!.lastChanceCorrect).toBe(true)
  })

  it('hält fest, welches Team seinen Imposter erwischt hat', () => {
    const s0 = bisAnklage(start(NAMES8, { mode: 'duel' }))
    const i1 = teamMembers(s0, 1).find((p) => p.isImposter)!
    const daneben2 = teamMembers(s0, 2).find((p) => !p.isImposter)!

    const s = accuse(accuse(s0, i1.id), daneben2.id)
    expect(teamCaught(s, 1)).toBe(true)
    expect(teamCaught(s, 2)).toBe(false)
    expect(s.correctAccusation).toBe(true)
  })

  it('behält die Teams über die Runden hinweg als Aufteilung bei', () => {
    const s0 = bisAnklage(start(NAMES8, { mode: 'duel' }))
    let s = accuse(accuse(s0, teamMembers(s0, 1)[0]!.id), teamMembers(s0, 2)[0]!.id)
    while (s.phase === 'last_chance') s = submitLastChance(s, 'daneben')
    const r2 = nextRound(s)
    expect(teamMembers(r2, 1)).toHaveLength(4)
    expect(teamMembers(r2, 2)).toHaveLength(4)
    expect(teamMembers(r2, 1).filter((p) => p.isImposter)).toHaveLength(1)
  })
})

describe('Eigene Kategorien im Spiel', () => {
  const EIGENE = ['Königsschuss', 'Vogelstange', 'Fahnenträger', 'Schützenkönig', 'Festzelt']

  it('zieht das Wort aus der eigenen Liste statt aus dem Wortschatz', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = createMatch({
        names: NAMES6,
        categoryId: 'eigene:schuetzen',
        customWords: EIGENE,
        customCategoryLabel: 'Schützenverein',
        seed,
      })
      expect(EIGENE).toContain(s.config.secretWord)
      expect(EIGENE).toContain(s.config.helperWord)
      expect(s.config.helperWord).not.toBe(s.config.secretWord)
      expect(s.config.categoryLabel).toBe('Schützenverein')
    }
  })

  it('nimmt die eigene Liste auch in die nächste Runde mit', () => {
    const s0 = createMatch({
      names: NAMES6,
      categoryId: 'eigene:schuetzen',
      customWords: EIGENE,
      customCategoryLabel: 'Schützenverein',
      seed: 7,
    })
    let s = accuse(bisAnklage(s0), s0.players[0]!.id)
    if (s.phase === 'last_chance') s = submitLastChance(s, 'daneben')
    const r2 = nextRound(s)
    expect(EIGENE).toContain(r2.config.secretWord)
    expect(r2.config.categoryLabel).toBe('Schützenverein')
  })
})
