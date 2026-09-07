/**
 * Bienen-Flow nachgerechnet – Mechanik nach dem Original (07.09.2026).
 *
 * Die Regel in einem Satz: Der oberste Block einer Nachschub-Spalte wandert
 * auf einen freien Platz, die Bienen tragen so viele Pollen ins Bild, wie
 * diese Farbe noch braucht. Geht es genau auf, ist der Platz wieder frei --
 * bleibt etwas übrig, ist er für immer verstopft. Fünf verstopfte Plätze
 * beenden das Level.
 *
 * Zweimal lag ich hier schon daneben (erst räumte ein Platz eine ganze Farbe
 * ab, dann verschmolzen Dreier), deshalb prüft diese Datei nicht nur die
 * Regeln, sondern rechnet auch jedes der 100 Level mit einem Löser durch.
 */
import { describe, it, expect } from 'vitest'
import {
  createMatch,
  tapSpalte,
  kannTippen,
  gehtAuf,
  obersterBlock,
  freieSlots,
  sichtbareSpalten,
  verdeckteBloecke,
  offenePixel,
} from '@/games/bienen-flow/engine'
import { createBienenLevel, blockZahlen } from '@/games/bienen-flow/level'
import { bienenFlowGame } from '@/games/bienen-flow/definition'
import { MOTIVE, REICHE_MOTIVE, motivRaster, bedarfJeFarbe } from '@/games/bienen-flow/motive'
import {
  BIENEN_MAX_LEVEL,
  SLOT_COUNT,
  SPALTEN,
  SICHTBARE_REIHEN,
  type BienenLevel,
  type BienenState,
} from '@/games/bienen-flow/types'
import { isSegmentGate, SEGMENT_SIZE } from '@/progression/zones'

/** Ein Level von Hand: zwei Farben, ein Bild, ein Nachschub. */
function level(
  bild: number[],
  cols: number,
  spalten: { color: number; amount: number }[][],
): BienenLevel {
  return {
    level: 1,
    motiv: 'Test',
    rows: bild.length / cols,
    cols,
    bild,
    spalten: spalten.map((s, si) =>
      s.map((b, bi) => ({ id: `t${si}-${bi}`, color: b.color, amount: b.amount })),
    ),
    slotCount: SLOT_COUNT,
    colorCount: Math.max(...bild),
    isGate: false,
    label: 'Test',
  }
}

/** Bild mit vier roten und drei blauen Pixeln. */
const BILD = [1, 1, 1, 1, 2, 2, 2, 0]

describe('Liefern', () => {
  it('trägt so viele Pollen ins Bild, wie die Farbe noch braucht', () => {
    const s = createMatch(level(BILD, 4, [[{ color: 1, amount: 4 }]]))
    expect(s.offen[1]).toBe(4)

    const r = tapSpalte(s, 0)!
    expect(r.geliefert).toBe(4)
    expect(r.zellen).toEqual([0, 1, 2, 3])
    expect(r.state.offen[1]).toBe(0)
    expect(r.state.gefuellt.slice(0, 4)).toEqual([1, 1, 1, 1])
  })

  it('gibt den Platz frei, wenn der Block genau aufgeht', () => {
    const s = createMatch(level(BILD, 4, [[{ color: 1, amount: 4 }]]))
    const r = tapSpalte(s, 0)!
    expect(r.verstopft).toBe(false)
    expect(r.state.slots.every((x) => x == null)).toBe(true)
    expect(freieSlots(r.state)).toBe(SLOT_COUNT)
  })

  it('lässt den Rest im Block liegen – dieser Platz ist verloren', () => {
    const s = createMatch(level(BILD, 4, [[{ color: 1, amount: 7 }]]))
    const r = tapSpalte(s, 0)!
    expect(r.geliefert).toBe(4)
    expect(r.verstopft).toBe(true)
    expect(r.state.slots[0]).toMatchObject({ color: 1, amount: 3 })
    expect(r.state.verstopft).toBe(1)
    // Die Farbe ist trotzdem fertig -- Überschuss kostet den Platz, nicht das Bild.
    expect(r.state.offen[1]).toBe(0)
  })

  it('nimmt zwei Blöcke, die zusammen genau aufgehen, ohne Verlust', () => {
    let s = createMatch(level(BILD, 4, [[{ color: 1, amount: 3 }], [{ color: 1, amount: 1 }]]))
    s = tapSpalte(s, 0)!.state
    s = tapSpalte(s, 1)!.state
    expect(s.offen[1]).toBe(0)
    expect(s.verstopft).toBe(0)
  })

  it('rechnet auch bei umgekehrter Reihenfolge dasselbe', () => {
    let s = createMatch(level(BILD, 4, [[{ color: 1, amount: 1 }], [{ color: 1, amount: 3 }]]))
    s = tapSpalte(s, 1)!.state
    s = tapSpalte(s, 0)!.state
    expect(s.offen[1]).toBe(0)
    expect(s.verstopft).toBe(0)
  })
})

describe('Was antippbar ist', () => {
  it('gibt immer nur den obersten Block einer Spalte her', () => {
    const s = createMatch(
      level(BILD, 4, [[{ color: 1, amount: 2 }, { color: 2, amount: 3 }]]),
    )
    expect(obersterBlock(s, 0)).toMatchObject({ color: 1, amount: 2 })
    const r = tapSpalte(s, 0)!
    expect(obersterBlock(r.state, 0)).toMatchObject({ color: 2, amount: 3 })
  })

  it('zeigt nur drei Reihen – der Rest rückt erst nach', () => {
    const tief = Array.from({ length: 6 }, (_, i) => ({ color: 1, amount: i + 1 }))
    const s = createMatch(level(BILD, 4, [tief]))
    expect(sichtbareSpalten(s)[0]).toHaveLength(SICHTBARE_REIHEN)
    expect(verdeckteBloecke(s)).toBe(3)

    const r = tapSpalte(s, 0)!
    expect(verdeckteBloecke(r.state)).toBe(2)
  })

  it('sagt vorher, ob ein Block sauber aufgeht', () => {
    const s = createMatch(level(BILD, 4, [[{ color: 1, amount: 4 }], [{ color: 1, amount: 5 }]]))
    expect(gehtAuf(s, obersterBlock(s, 0))).toBe(true)
    expect(gehtAuf(s, obersterBlock(s, 1))).toBe(false)
    expect(gehtAuf(s, null)).toBe(false)
  })

  it('weist leere Spalten, volle Plätze und Unsinn ab', () => {
    const s = createMatch(level(BILD, 4, [[{ color: 1, amount: 4 }]]))
    expect(kannTippen(s, 1)).toBe(false) // leere Spalte
    expect(kannTippen(s, -1)).toBe(false)
    expect(kannTippen(s, 99)).toBe(false)
    expect(tapSpalte(s, 1)).toBeNull()
  })
})

describe('Gewonnen und verloren', () => {
  it('ist gewonnen, sobald das Bild voll ist', () => {
    let s = createMatch(level(BILD, 4, [[{ color: 1, amount: 4 }], [{ color: 2, amount: 3 }]]))
    s = tapSpalte(s, 0)!.state
    expect(s.phase).toBe('play')
    const r = tapSpalte(s, 1)!
    expect(r.state.phase).toBe('won')
    expect(offenePixel(r.state)).toBe(0)
  })

  it('gewinnt auch mit verstopften Plätzen – das Bild zählt', () => {
    let s = createMatch(level(BILD, 4, [[{ color: 1, amount: 9 }], [{ color: 2, amount: 3 }]]))
    s = tapSpalte(s, 0)!.state
    expect(s.verstopft).toBe(1)
    expect(tapSpalte(s, 1)!.state.phase).toBe('won')
  })

  it('ist verloren, wenn alle fünf Plätze verstopft sind', () => {
    const zuviel = Array.from({ length: 5 }, () => [{ color: 1, amount: 40 }])
    let s = createMatch(level(BILD, 4, [zuviel[0]!.concat(zuviel[1]!), zuviel[2]!, zuviel[3]!, zuviel[4]!]))
    for (let i = 0; i < 5 && s.phase === 'play'; i++) {
      const spalte = s.spalten.findIndex((sp) => sp.length > 0)
      s = tapSpalte(s, spalte)!.state
    }
    expect(s.phase).toBe('lost')
    expect(s.verstopft).toBe(SLOT_COUNT)
  })

  it('nimmt nach dem Ende keine Tipps mehr an', () => {
    let s = createMatch(level(BILD, 4, [[{ color: 1, amount: 4 }], [{ color: 2, amount: 3 }], [{ color: 1, amount: 9 }]]))
    s = tapSpalte(s, 0)!.state
    s = tapSpalte(s, 1)!.state
    expect(s.phase).toBe('won')
    expect(tapSpalte(s, 2)).toBeNull()
  })
})

describe('Motive', () => {
  it('übersetzt ein Zeichenraster in Pixel und zählt den Bedarf', () => {
    const { rows, cols, bild } = motivRaster({ name: 'X', zeilen: ['RR.', '.R.'] })
    expect({ rows, cols }).toEqual({ rows: 2, cols: 3 })
    expect(bild).toEqual([1, 1, 0, 0, 1, 0])
    expect(bedarfJeFarbe(bild)[1]).toBe(3)
  })

  it('vervierfacht die Pollen beim Vergrößern, ohne das Bild zu verzerren', () => {
    const klein = motivRaster({ name: 'X', zeilen: ['RR', '.R'] })
    const gross = motivRaster({ name: 'X', zeilen: ['RR', '.R'] }, 2)
    expect(gross.rows).toBe(klein.rows * 2)
    expect(gross.cols).toBe(klein.cols * 2)
    expect(bedarfJeFarbe(gross.bild)[1]).toBe(bedarfJeFarbe(klein.bild)[1]! * 4)
  })

  it('hat lauter erkennbare Motive – Zeilen gleich lang, keine leeren', () => {
    for (const m of [...MOTIVE, ...REICHE_MOTIVE]) {
      expect(m.zeilen.length).toBeGreaterThan(2)
      const pixel = m.zeilen.join('').split('').filter((c) => c !== '.').length
      expect(pixel).toBeGreaterThan(10)
    }
  })

  it('bringt für die späten Abschnitte Motive mit mindestens fünf Farben mit', () => {
    for (const m of REICHE_MOTIVE) {
      const farben = new Set(m.zeilen.join('').split('').filter((c) => c !== '.' && c !== ' '))
      expect(farben.size).toBeGreaterThanOrEqual(4)
    }
  })
})

describe('Die 100 Level', () => {
  const alle = Array.from({ length: BIENEN_MAX_LEVEL }, (_, i) => createBienenLevel(i + 1))

  it('gibt es von 1 bis 100, mit einem Tor am Ende jedes Abschnitts', () => {
    expect(alle).toHaveLength(100)
    for (const l of alle) expect(l.isGate).toBe(isSegmentGate(l.level))
    expect(alle.filter((l) => l.isGate).map((l) => l.level)).toEqual([20, 40, 60, 80, 100])
    expect(SEGMENT_SIZE).toBe(20)
  })

  it('bringt von jeder Farbe mindestens so viele Pollen mit, wie das Bild braucht', () => {
    // Sonst wäre ein Level unlösbar, und zwar erst nach Minuten sichtbar.
    for (const l of alle) {
      const bedarf = bedarfJeFarbe(l.bild)
      const vorrat: number[] = []
      for (const b of l.spalten.flat()) vorrat[b.color] = (vorrat[b.color] ?? 0) + b.amount
      for (let farbe = 1; farbe < bedarf.length; farbe++) {
        if (!bedarf[farbe]) continue
        expect(vorrat[farbe] ?? 0).toBeGreaterThanOrEqual(bedarf[farbe]!)
      }
    }
  })

  it('verteilt den Nachschub auf vier Spalten und lässt fünf Plätze', () => {
    for (const l of alle) {
      expect(l.spalten).toHaveLength(SPALTEN)
      expect(l.slotCount).toBe(SLOT_COUNT)
      expect(l.spalten.flat().length).toBeGreaterThan(2)
    }
  })

  it('ist immer gleich aufgebaut – gleiches Level, gleiches Bild', () => {
    for (const n of [1, 17, 40, 99]) {
      const a = createBienenLevel(n)
      const b = createBienenLevel(n)
      expect(b.bild).toEqual(a.bild)
      expect(b.spalten.flat().map((x) => `${x.color}:${x.amount}`)).toEqual(
        a.spalten.flat().map((x) => `${x.color}:${x.amount}`),
      )
    }
  })

  it('wird größer, bunter und voller', () => {
    const pixel = (l: BienenLevel) => l.bild.filter((c) => c > 0).length
    expect(pixel(alle[0]!)).toBeLessThan(pixel(alle[99]!))
    expect(blockZahlen(alle[0]!).gesamt).toBeLessThan(blockZahlen(alle[99]!).gesamt)
  })

  it('bleibt außerhalb von 1…100 in seinen Grenzen', () => {
    expect(createBienenLevel(0).level).toBe(1)
    expect(createBienenLevel(999).level).toBe(BIENEN_MAX_LEVEL)
  })
})

/**
 * Der Löser. Vollständige Suche über die Spaltenhöhen -- der Zustand hängt
 * nur davon ab, wie weit jede Spalte abgetragen ist, plus der Zahl der
 * verstopften Plätze. Damit ist das erschöpfend und trotzdem schnell.
 */
function loesbar(level: number): boolean {
  const start = createMatch(createBienenLevel(level))
  const gesehen = new Set<string>()
  const stapel: BienenState[] = [start]
  let schritte = 0
  while (stapel.length > 0 && schritte++ < 200_000) {
    const s = stapel.pop()!
    for (let i = 0; i < s.spalten.length; i++) {
      const r = tapSpalte(s, i)
      if (!r) continue
      if (r.state.phase === 'won') return true
      if (r.state.phase === 'lost') continue
      const key = `${r.state.spalten.map((sp) => sp.length).join(',')}|${r.state.verstopft}`
      if (gesehen.has(key)) continue
      gesehen.add(key)
      stapel.push(r.state)
    }
  }
  return false
}

describe('Lösbarkeit', () => {
  it('lässt jedes der 100 Level gewinnen', () => {
    const gescheitert: number[] = []
    for (let level = 1; level <= BIENEN_MAX_LEVEL; level++) {
      if (!loesbar(level)) gescheitert.push(level)
    }
    expect(gescheitert).toEqual([])
  }, 60_000)

  it('lässt die ersten Level auch ohne Nachdenken durchgehen', () => {
    // Wer die ersten Level nicht schafft, hört auf. Hier darf nichts schiefgehen.
    for (let level = 1; level <= 6; level++) {
      let s = createMatch(createBienenLevel(level))
      let n = 0
      while (s.phase === 'play' && n++ < 200) {
        const spalte = s.spalten.findIndex((sp) => sp.length > 0)
        if (spalte < 0) break
        const r = tapSpalte(s, spalte)
        if (!r) break
        s = r.state
      }
      expect(`Level ${level}: ${s.phase}`).toBe(`Level ${level}: won`)
    }
  })
})

describe('Wertung', () => {
  const roh = (verstopft: number) => ({ won: true, verstopft, slotCount: SLOT_COUNT })

  it('gibt nichts für ein verlorenes Level', () => {
    expect(bienenFlowGame.calculateScore(5, { won: false, verstopft: 0, slotCount: 5 })).toBe(0)
    expect(bienenFlowGame.calculateXP(5, 0)).toBe(0)
    expect(bienenFlowGame.calculateStars!(5, 0)).toBe(0)
  })

  it('belohnt sauberes Rechnen: kein verstopfter Platz gibt am meisten', () => {
    expect(bienenFlowGame.calculateScore(10, roh(0))).toBeGreaterThan(
      bienenFlowGame.calculateScore(10, roh(2)),
    )
    expect(bienenFlowGame.calculateScore(10, roh(2))).toBeGreaterThan(
      bienenFlowGame.calculateScore(10, roh(4)),
    )
  })

  it('vergibt Sterne von eins bis fünf, und mehr Punkte sind nie weniger Sterne', () => {
    const sterne = [0, 1, 2, 3, 4].map((v) =>
      bienenFlowGame.calculateStars!(10, bienenFlowGame.calculateScore(10, roh(v))),
    )
    expect(sterne[0]).toBe(5)
    expect(Math.min(...sterne)).toBeGreaterThanOrEqual(1)
    for (let i = 1; i < sterne.length; i++) expect(sterne[i]!).toBeLessThanOrEqual(sterne[i - 1]!)
  })

  it('gibt XP nur mit Punkten', () => {
    expect(bienenFlowGame.calculateXP(1, 0)).toBe(0)
    expect(bienenFlowGame.calculateXP(1, 600)).toBeGreaterThan(0)
  })
})
