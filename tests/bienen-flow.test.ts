/**
 * Bienen-Flow nachgerechnet.
 *
 * Warum diese Datei am 06.09.2026 entstand: Das Spiel hatte gar keine Tests,
 * und beim Nachmessen stellte sich heraus, dass es auch kein Spiel war -- ein
 * Löser gewann alle 100 Level, Level 1 in zwei Tipps. Nach dem Umbau auf die
 * Mechanik des Originals prüft hier zweierlei:
 *
 *   1. Die Regeln (frei liegen, tragen, verschmelzen, volle Wabe).
 *   2. Die 100 Level -- und zwar nicht "sieht plausibel aus", sondern mit
 *      einem Löser: Jedes Level muss zu gewinnen sein. Ein unlösbares Level
 *      merkt man sonst erst nach fünf Minuten Spielzeit.
 */
import { describe, it, expect } from 'vitest'
import {
  createMatch,
  tapCell,
  canTap,
  openMask,
  reachableMask,
  reachableCells,
  reachableColors,
  remainingCells,
  usedSlots,
} from '@/games/bienen-flow/engine'
import { createBienenLevel } from '@/games/bienen-flow/level'
import { bienenFlowGame } from '@/games/bienen-flow/definition'
import { BIENEN_MAX_LEVEL, MERGE_COUNT, type BienenLevel, type BienenState } from '@/games/bienen-flow/types'
import { SEGMENT_SIZE, isSegmentGate } from '@/progression/zones'

/** Ein Brett von Hand, damit die Regeln an etwas Nachvollziehbarem hängen. */
function brett(zeilen: number[][], slotCount = 3): BienenLevel {
  return {
    level: 1,
    rows: zeilen.length,
    cols: zeilen[0]!.length,
    board: zeilen.flat(),
    slotCount,
    colorCount: Math.max(...zeilen.flat()),
    isGate: false,
    label: 'Test',
  }
}

describe('Was frei liegt', () => {
  it('zählt nur Luft, die mit dem Rand zusammenhängt', () => {
    // Ring aus Pollen mit einer eingeschlossenen Lücke in der Mitte.
    const b = [
      [1, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
    ].flat()
    const open = openMask(b, 3, 3)
    expect(open[4]).toBe(false)
    expect(open.every((o) => o === false)).toBe(true)
  })

  it('gibt die oberste Reihe immer frei – von oben kommt die Biene heran', () => {
    const b = [
      [1, 2],
      [3, 4],
    ].flat()
    const frei = reachableMask(b, 2, 2)
    expect(frei[0]).toBe(true)
    expect(frei[1]).toBe(true)
  })

  it('lässt verdeckte Pollen verdeckt, bis darüber Platz entsteht', () => {
    const level = brett([
      [1, 1],
      [2, 2],
      [3, 3],
    ])
    let s = createMatch(level)
    expect(reachableMask(s.board, s.rows, s.cols).slice(2)).toEqual([false, false, false, false])

    s = tapCell(s, 0)!.state
    s = tapCell(s, 1)!.state
    // Jetzt ist die obere Reihe leer, die zweite liegt frei.
    const frei = reachableMask(s.board, s.rows, s.cols)
    expect(frei[2]).toBe(true)
    expect(frei[3]).toBe(true)
    expect(frei[4]).toBe(false)
  })

  it('meldet die freien Farben und Zellen passend zueinander', () => {
    const s = createMatch(brett([
      [1, 2],
      [3, 3],
    ]))
    expect([...reachableColors(s.board, s.rows, s.cols)].sort()).toEqual([1, 2])
    expect(reachableCells(s)).toEqual([0, 1])
  })
})

describe('Tragen und verschmelzen', () => {
  it('trägt genau einen Pollen in die Wabe', () => {
    const s0 = createMatch(brett([[1, 2, 3]]))
    const r = tapCell(s0, 0)!
    expect(r.state.board[0]).toBe(0)
    expect(r.state.slots[0]).toBe(1)
    expect(r.flight).toEqual({ cell: 0, slot: 0, color: 1 })
    expect(r.merge).toBeNull()
    expect(r.state.moves).toBe(1)
    expect(remainingCells(r.state)).toBe(2)
  })

  it('legt gleiche Farben nebeneinander, damit man den Dreier kommen sieht', () => {
    let s = createMatch(brett([[1, 2, 1, 2]], 4))
    s = tapCell(s, 0)!.state // 1
    s = tapCell(s, 1)!.state // 2
    const r = tapCell(s, 2)! // noch eine 1 -- gehört neben die erste
    expect(r.flight.slot).toBe(1)
    expect(r.state.slots).toEqual([1, 1, 2, null])
  })

  it('lässt drei gleiche verschmelzen und gibt die Plätze frei', () => {
    let s = createMatch(brett([[1, 1, 1, 2]], 4))
    s = tapCell(s, 0)!.state
    s = tapCell(s, 1)!.state
    expect(usedSlots(s)).toBe(2)

    const r = tapCell(s, 2)!
    expect(r.merge).toEqual({ color: 1, slots: [0, 1, 2] })
    expect(usedSlots(r.state)).toBe(0)
    expect(r.state.phase).toBe('play')
  })

  it('merkt sich die vollste Wabe – das ist das Maß für sauberes Spiel', () => {
    let s = createMatch(brett([[1, 2, 3, 1, 1]], 5))
    for (const i of [0, 1, 2, 3, 4]) s = tapCell(s, i)!.state
    // 1,2,3 belegen drei Plätze, dann kommen zwei weitere Einsen dazu:
    // Spitze 4, danach verschmilzt die 1 und es bleiben 2.
    expect(s.peakSlots).toBe(4)
    expect(usedSlots(s)).toBe(2)
  })
})

describe('Gewonnen und verloren', () => {
  it('ist gewonnen, wenn Brett und Wabe leer sind', () => {
    let s = createMatch(brett([[1, 1, 1]]))
    s = tapCell(s, 0)!.state
    s = tapCell(s, 1)!.state
    const r = tapCell(s, 2)!
    expect(r.state.phase).toBe('won')
    expect(remainingCells(r.state)).toBe(0)
    expect(usedSlots(r.state)).toBe(0)
  })

  it('ist verloren, sobald die Wabe voll ist und kein Dreier fällt', () => {
    let s = createMatch(brett([[1, 2, 3, 4]], 3))
    s = tapCell(s, 0)!.state
    s = tapCell(s, 1)!.state
    const r = tapCell(s, 2)!
    expect(r.state.phase).toBe('lost')
    expect(usedSlots(r.state)).toBe(3)
  })

  it('nimmt nach dem Ende keine Tipps mehr an', () => {
    let s = createMatch(brett([[1, 2, 3, 4]], 3))
    s = tapCell(s, 0)!.state
    s = tapCell(s, 1)!.state
    s = tapCell(s, 2)!.state
    expect(s.phase).toBe('lost')
    expect(tapCell(s, 3)).toBeNull()
  })

  it('weist Tipps auf Leeres, Verdecktes und Unsinniges ab', () => {
    const s = createMatch(brett([
      [1, 1],
      [2, 2],
    ]))
    expect(tapCell(s, -1)).toBeNull()
    expect(tapCell(s, 99)).toBeNull()
    expect(canTap(s, 2)).toBe(false) // verdeckt
    expect(tapCell(s, 2)).toBeNull()
    const leer = tapCell(s, 0)!.state
    expect(tapCell(leer, 0)).toBeNull() // schon weg
  })
})

describe('Die 100 Level', () => {
  const alle = Array.from({ length: BIENEN_MAX_LEVEL }, (_, i) => createBienenLevel(i + 1))

  it('gibt es von 1 bis 100, mit einem Tor am Ende jedes Abschnitts', () => {
    expect(alle).toHaveLength(100)
    for (const l of alle) {
      expect(l.level).toBeGreaterThanOrEqual(1)
      expect(l.isGate).toBe(isSegmentGate(l.level))
    }
    expect(alle.filter((l) => l.isGate).map((l) => l.level)).toEqual([20, 40, 60, 80, 100])
    expect(SEGMENT_SIZE).toBe(20)
  })

  it('hat von jeder Farbe ein Vielfaches von drei – sonst bliebe ein Rest übrig', () => {
    for (const l of alle) {
      const zaehler = new Map<number, number>()
      for (const c of l.board) if (c > 0) zaehler.set(c, (zaehler.get(c) ?? 0) + 1)
      expect(zaehler.size).toBe(l.colorCount)
      for (const [, n] of zaehler) expect(n % MERGE_COUNT).toBe(0)
    }
  })

  it('ist immer gleich aufgebaut – gleiches Level, gleiches Brett', () => {
    for (const level of [1, 17, 40, 99]) {
      expect(createBienenLevel(level).board).toEqual(createBienenLevel(level).board)
    }
  })

  it('wird länger und bunter, und am Tor wird die Wabe enger', () => {
    const pollen = (l: BienenLevel) => l.board.filter((c) => c > 0).length
    expect(pollen(alle[0]!)).toBeLessThan(pollen(alle[99]!))
    expect(alle[0]!.colorCount).toBeLessThan(alle[99]!.colorCount)
    for (const l of alle) {
      expect(l.slotCount).toBeGreaterThanOrEqual(5)
      expect(l.slotCount).toBeLessThanOrEqual(7)
      if (l.isGate) expect(l.slotCount).toBe(5)
      // Höchstens drei Farben mehr als Plätze -- darüber wird aus knifflig
      // schnell aussichtslos. Am Tor ist genau das der Fall (8 Farben, 5 Plätze).
      expect(l.colorCount).toBeLessThanOrEqual(l.slotCount + 3)
    }
  })

  it('bleibt außerhalb von 1…100 in seinen Grenzen', () => {
    expect(createBienenLevel(0).level).toBe(1)
    expect(createBienenLevel(999).level).toBe(BIENEN_MAX_LEVEL)
  })
})

/**
 * Der Löser. Eine Strahlensuche mit schmalem Strahl -- sie beweist nichts,
 * aber wenn sie einen Weg findet, gibt es einen. Genau das soll hier stehen:
 * kein Level, das sich nicht gewinnen lässt.
 */
function loesbar(level: number, breite: number): boolean {
  let strahl: BienenState[] = [createMatch(createBienenLevel(level))]
  const gesehen = new Set<string>()
  for (let tiefe = 0; tiefe < 400; tiefe++) {
    const naechste: BienenState[] = []
    for (const s of strahl) {
      for (const i of reachableCells(s)) {
        const r = tapCell(s, i)
        if (!r) continue
        if (r.state.phase === 'won') return true
        if (r.state.phase === 'lost') continue
        const key = `${r.state.board.join('')}|${r.state.slots.join(',')}`
        if (gesehen.has(key)) continue
        gesehen.add(key)
        naechste.push(r.state)
      }
    }
    if (naechste.length === 0) return false
    naechste.sort((a, b) => guete(b) - guete(a))
    strahl = naechste.slice(0, breite)
  }
  return false
}

function guete(s: BienenState): number {
  const rest = remainingCells(s)
  const belegt = usedSlots(s)
  const zaehler = new Map<number, number>()
  for (const c of s.slots) if (c != null) zaehler.set(c, (zaehler.get(c) ?? 0) + 1)
  const fastFertig = [...zaehler.values()].filter((n) => n === MERGE_COUNT - 1).length
  return -rest * 2 - belegt * 6 + fastFertig * 3
}

describe('Lösbarkeit', () => {
  it('lässt jedes der 100 Level gewinnen', () => {
    const gescheitert: number[] = []
    for (let level = 1; level <= BIENEN_MAX_LEVEL; level++) {
      if (!loesbar(level, 8)) gescheitert.push(level)
    }
    expect(gescheitert).toEqual([])
  }, 30_000)
})

describe('Wertung', () => {
  const roh = (peak: number, slots = 7) => ({ won: true, peakSlots: peak, slotCount: slots })

  it('gibt nichts für ein verlorenes Level', () => {
    expect(bienenFlowGame.calculateScore(5, { won: false, peakSlots: 3, slotCount: 7 })).toBe(0)
    expect(bienenFlowGame.calculateXP(5, 0)).toBe(0)
    expect(bienenFlowGame.calculateStars!(5, 0)).toBe(0)
  })

  it('belohnt die leere Wabe, nicht die Zahl der Züge', () => {
    // Züge sind kein Maß: Wer gewinnt, tippt jeden Pollen genau einmal an.
    const sauber = bienenFlowGame.calculateScore(10, roh(2))
    const knapp = bienenFlowGame.calculateScore(10, roh(6))
    expect(sauber).toBeGreaterThan(knapp)
    expect(bienenFlowGame.calculateScore(10, roh(4))).toBeLessThan(sauber)
  })

  it('vergibt Sterne von eins bis fünf, und mehr Punkte sind nie weniger Sterne', () => {
    const sterne = [2, 3, 4, 5, 6].map((p) => bienenFlowGame.calculateStars!(10, bienenFlowGame.calculateScore(10, roh(p))))
    expect(Math.max(...sterne)).toBe(5)
    expect(Math.min(...sterne)).toBeGreaterThanOrEqual(1)
    for (let i = 1; i < sterne.length; i++) expect(sterne[i]!).toBeLessThanOrEqual(sterne[i - 1]!)
  })

  it('gibt XP nur mit Punkten', () => {
    expect(bienenFlowGame.calculateXP(1, 0)).toBe(0)
    expect(bienenFlowGame.calculateXP(1, 600)).toBeGreaterThan(0)
  })
})
