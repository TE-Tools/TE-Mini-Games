/**
 * Kopfrechnen: Aufgaben, Schwierigkeitsstufen und Wertung.
 *
 * Der wichtigste Test ist der langweiligste: Jede erzeugte Aufgabe muss die
 * Antwort haben, die tatsächlich herauskommt. Eine falsche Musterlösung
 * fiele im Spiel niemandem auf – man hielte sich selbst für zu dumm.
 */
import { describe, it, expect } from 'vitest'
import {
  createKopfrechnenLevel,
  calculateKopfrechnenScore,
  stufeForLevel,
  secondsForLevel,
  kopfrechnenGame,
  AUFGABEN_JE_RUNDE,
  NOETIG_ZUM_BESTEHEN,
  MAX_ZEIT_BONUS,
} from '@/games/kopfrechnen'
import { MAX_LEVEL } from '@/progression/zones'

/** Rechnet den angezeigten Text selbst aus – ohne den Code des Spiels. */
function nachrechnen(text: string): number {
  const term = text
    .replace(/·/g, '*')
    .replace(/:/g, '/')
    .replace(/−/g, '-')
  if (!/^[\d\s+\-*/().]+$/.test(term)) throw new Error(`Unerwartete Zeichen: ${text}`)
  return Function(`"use strict"; return (${term});`)() as number
}

describe('Aufgaben', () => {
  it('stimmen rechnerisch – über die ganze Levelkarte', () => {
    for (let L = 1; L <= MAX_LEVEL; L += 3) {
      for (const a of createKopfrechnenLevel(L).tasks) {
        const erwartet = nachrechnen(a.text)
        // Nur beim Teilen mit Rest wird gerundet; sonst muss es genau passen.
        expect(Math.abs(erwartet - a.answer), `Level ${L}: ${a.text} = ${a.answer}`)
          .toBeLessThanOrEqual(0.5)
      }
    }
  })

  it('kommen immer in Zehnerpackungen', () => {
    for (const L of [1, 30, 90, 200, 450]) {
      expect(createKopfrechnenLevel(L).tasks).toHaveLength(AUFGABEN_JE_RUNDE)
    }
  })

  it('wiederholen sich innerhalb einer Runde nicht', () => {
    for (let L = 1; L <= MAX_LEVEL; L += 11) {
      const texte = createKopfrechnenLevel(L).tasks.map((t) => t.text)
      expect(new Set(texte).size, `Level ${L} hat eine Aufgabe doppelt`).toBe(texte.length)
    }
  })

  it('haben ganzzahlige Antworten', () => {
    for (let L = 1; L <= MAX_LEVEL; L += 7) {
      for (const a of createKopfrechnenLevel(L).tasks) {
        expect(Number.isInteger(a.answer), `${a.text} = ${a.answer}`).toBe(true)
      }
    }
  })

  it('bleiben in den unteren Leveln bei Plus und Minus ohne Minusergebnis', () => {
    for (let L = 1; L < 25; L++) {
      for (const a of createKopfrechnenLevel(L).tasks) {
        expect(a.text).toMatch(/^\d+ [+−] \d+$/)
        expect(a.answer).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('bringt ab Level 25 das Malnehmen dazu', () => {
    const texte = Array.from({ length: 12 }, (_, i) =>
      createKopfrechnenLevel(30 + i).tasks.map((t) => t.text).join(' '),
    ).join(' ')
    expect(texte).toContain('·')
  })

  it('teilt immer glatt auf', () => {
    for (let L = 75; L < 150; L += 3) {
      for (const a of createKopfrechnenLevel(L).tasks) {
        const m = /^(\d+) : (\d+)$/.exec(a.text)
        if (m) expect(Number(m[1]) % Number(m[2]), a.text).toBe(0)
      }
    }
  })

  it('ist zum selben Startwert immer dieselbe Runde', () => {
    const a = createKopfrechnenLevel(77).tasks.map((t) => t.text)
    const b = createKopfrechnenLevel(77).tasks.map((t) => t.text)
    expect(a).toEqual(b)
  })
})

describe('Stufen und Zeit', () => {
  it('teilt die Levelkarte in fünf Stufen', () => {
    expect(stufeForLevel(1)).toBe('grund')
    expect(stufeForLevel(24)).toBe('grund')
    expect(stufeForLevel(25)).toBe('malnehmen')
    expect(stufeForLevel(75)).toBe('teilen')
    expect(stufeForLevel(150)).toBe('zweischritt')
    expect(stufeForLevel(300)).toBe('dreizahlen')
    expect(stufeForLevel(MAX_LEVEL)).toBe('dreizahlen')
  })

  it('gibt mit steigendem Level weniger Zeit, aber nie zu wenig', () => {
    expect(secondsForLevel(1)).toBe(90)
    expect(secondsForLevel(MAX_LEVEL)).toBe(45)
    for (let L = 2; L <= MAX_LEVEL; L++) {
      expect(secondsForLevel(L)).toBeLessThanOrEqual(secondsForLevel(L - 1))
      expect(secondsForLevel(L)).toBeGreaterThanOrEqual(45)
    }
  })
})

describe('Wertung', () => {
  it('gibt 100 Punkte je richtiger Aufgabe', () => {
    expect(calculateKopfrechnenScore({ correct: 6, secondsLeft: 20, level: 5 }).score).toBe(600)
  })

  it('gibt den Zeitbonus nur für eine fehlerfreie Runde', () => {
    const perfekt = calculateKopfrechnenScore({ correct: 10, secondsLeft: 20, level: 5 })
    const fastPerfekt = calculateKopfrechnenScore({ correct: 9, secondsLeft: 20, level: 5 })
    expect(perfekt.timeBonus).toBe(100)
    expect(perfekt.score).toBe(1100)
    expect(fastPerfekt.timeBonus).toBe(0)
  })

  it('deckelt den Zeitbonus', () => {
    const r = calculateKopfrechnenScore({ correct: 10, secondsLeft: 9999, level: 5 })
    expect(r.timeBonus).toBe(MAX_ZEIT_BONUS)
  })

  it('gibt XP erst ab acht Richtigen', () => {
    expect(calculateKopfrechnenScore({ correct: NOETIG_ZUM_BESTEHEN - 1, secondsLeft: 0, level: 20 }))
      .toMatchObject({ passed: false, xp: 0 })
    expect(calculateKopfrechnenScore({ correct: NOETIG_ZUM_BESTEHEN, secondsLeft: 0, level: 20 }))
      .toMatchObject({ passed: true, xp: 60 })
  })

  it('vergibt Sterne nach Richtigen', () => {
    expect(calculateKopfrechnenScore({ correct: 0, secondsLeft: 0, level: 1 }).stars).toBe(0)
    expect(calculateKopfrechnenScore({ correct: 5, secondsLeft: 0, level: 1 }).stars).toBe(2)
    expect(calculateKopfrechnenScore({ correct: 10, secondsLeft: 0, level: 1 }).stars).toBe(5)
  })

  it('lässt sich nicht mit erfundenen Werten überlisten', () => {
    const r = calculateKopfrechnenScore({ correct: 99, secondsLeft: -50, level: 1 })
    expect(r.score).toBeLessThanOrEqual(AUFGABEN_JE_RUNDE * 100 + MAX_ZEIT_BONUS)
    expect(r.stars).toBeLessThanOrEqual(5)
  })
})

describe('Registrierung im Spielverzeichnis', () => {
  it('rechnet über die GameDefinition genauso', () => {
    expect(kopfrechnenGame.id).toBe('kopfrechnen')
    expect(kopfrechnenGame.calculateScore(5, { correct: 6, secondsLeft: 20 })).toBe(600)
    expect(kopfrechnenGame.calculateXP(20, 800)).toBe(60)
    expect(kopfrechnenGame.calculateXP(20, 700)).toBe(0)
  })
})

describe('Klammeraufgaben ab Level 300', () => {
  it('gehen immer glatt auf – kein Runden im Kopf', () => {
    for (let L = 300; L <= MAX_LEVEL; L += 5) {
      for (const a of createKopfrechnenLevel(L).tasks) {
        const m = /^\((\d+) \+ (\d+)\) : (\d+)$/.exec(a.text)
        if (!m) continue
        const summe = Number(m[1]) + Number(m[2])
        expect(summe % Number(m[3]), a.text).toBe(0)
        expect(a.answer).toBe(summe / Number(m[3]))
      }
    }
  })
})
