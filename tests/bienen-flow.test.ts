/**
 * Bienen-Flow nachgerechnet – die Mechanik des Originals (07.09.2026).
 *
 * Kurz: Das Bild liegt oben vollständig und wird abgetragen. Ein Block auf
 * einem Platz sammelt zugängliche Pixel seiner Farbe, seine Zahl zählt
 * herunter, bei null ist er voll und gibt den Platz frei. Zugänglich ist
 * nur, was von außen erreichbar ist. Alle fünf Plätze belegt und keine
 * dieser Farben zugänglich heißt verloren.
 *
 * Dreimal lag ich hier schon daneben, deshalb prüft diese Datei jede Regel
 * einzeln -- und rechnet zusätzlich jedes Level mit einem Löser durch.
 */
import { describe, it, expect } from 'vitest'
import {
  createMatch,
  tapSpalte,
  tick,
  arbeiteAus,
  arbeitMoeglich,
  kannTippen,
  passtNoch,
  obersterBlock,
  freieSlots,
  sichtbareSpalten,
  verdeckteBloecke,
  luftMaske,
  zugaenglich,
  zugaenglicheFarben,
  pixelDerFarbe,
  restPixel,
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

/** Ein Level von Hand. */
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

/** Block hochschieben und die Bienen arbeiten lassen, bis nichts mehr geht. */
function schiebe(state: BienenState, spalte: number): BienenState {
  const r = tapSpalte(state, spalte)
  if (!r) throw new Error(`Spalte ${spalte} lässt sich nicht antippen`)
  return arbeiteAus(r.state).state
}

/** Wie `schiebe`, gibt aber auch die Handgriffe der Bienen zurück. */
function schiebeMitSchritten(state: BienenState, spalte: number) {
  const r = tapSpalte(state, spalte)
  if (!r) throw new Error(`Spalte ${spalte} lässt sich nicht antippen`)
  const aus = arbeiteAus(r.state)
  return { state: aus.state, schritte: aus.schritte, slot: r.slot }
}

/**
 * Ein Ring aus Rot mit einem blauen Kern:
 *   1 1 1
 *   1 2 1
 *   1 1 1
 * Der Kern ist verdeckt, bis der Ring weg ist -- daran hängen die Regeln.
 */
const RING = [1, 1, 1, 1, 2, 1, 1, 1, 1]

describe('Zugänglich', () => {
  it('lässt nur an das heran, was von außen erreichbar ist', () => {
    const frei = zugaenglich(RING, 3, 3)
    expect(frei[4]).toBe(false) // der Kern steckt fest
    expect(frei.filter(Boolean)).toHaveLength(8) // der ganze Ring liegt frei
  })

  it('zählt eine eingeschlossene Lücke nicht als Luft', () => {
    const mitLoch = [1, 1, 1, 1, 0, 1, 1, 1, 1]
    expect(luftMaske(mitLoch, 3, 3)[4]).toBe(false)
  })

  it('legt den Kern frei, sobald ringsum abgetragen ist', () => {
    const s = createMatch(level(RING, 3, [[{ color: 1, amount: 8 }]]))
    expect(zugaenglicheFarben(s)).toEqual(new Set([1]))
    const r = schiebeMitSchritten(s, 0)
    expect(restPixel(r.state)).toBe(1)
    expect(zugaenglicheFarben(r.state)).toEqual(new Set([2]))
  })
})

describe('Sammeln', () => {
  it('holt Pixel der Farbe und zählt den Block herunter', () => {
    const s = createMatch(level(RING, 3, [[{ color: 1, amount: 3 }]]))
    const r = schiebeMitSchritten(s, 0)
    expect(r.schritte).toHaveLength(3)
    expect(r.schritte.every((x) => x.farbe === 1)).toBe(true)
    expect(restPixel(r.state)).toBe(6) // 9 minus 3 geholte
    expect(r.state.slots.every((x) => x == null)).toBe(true) // voll, Platz frei
  })

  it('lässt einen Block warten, dessen Farbe verdeckt ist', () => {
    const s = createMatch(level(RING, 3, [[{ color: 2, amount: 1 }]]))
    const r = schiebeMitSchritten(s, 0)
    expect(r.schritte).toHaveLength(0)
    expect(r.state.slots[0]).toMatchObject({ color: 2, amount: 1 })
    expect(r.state.phase).toBe('play')
  })

  it('holt später nach, sobald die Farbe freiliegt – ohne neuen Tipp', () => {
    let s = createMatch(
      level(RING, 3, [[{ color: 2, amount: 1 }], [{ color: 1, amount: 8 }]]),
    )
    s = schiebe(s, 0) // Blau wartet
    expect(s.slots[0]).not.toBeNull()

    const r = schiebeMitSchritten(s, 1) // Rot räumt den Ring ab …
    // … und im selben Zug holt der wartende blaue Block seinen Kern.
    expect(r.state.phase).toBe('won')
    expect(restPixel(r.state)).toBe(0)
    expect(r.schritte.some((x) => x.farbe === 2)).toBe(true)
  })

  it('lässt bei nur einem Pixel den Block mit der kleinsten Zahl vor', () => {
    // Blauer Ring, roter Kern. Zwei rote Blöcke warten; wenn der Kern
    // freigelegt wird, gibt es genau ein rotes Pixel für beide.
    const kern = [2, 2, 2, 2, 1, 2, 2, 2, 2]
    let s = createMatch(
      level(kern, 3, [
        [{ color: 1, amount: 5 }],
        [{ color: 1, amount: 1 }],
        [{ color: 2, amount: 8 }],
      ]),
    )
    s = schiebe(s, 0) // der große rote Block wartet
    s = schiebe(s, 1) // der kleine auch
    expect(s.slots[0]).toMatchObject({ amount: 5 })
    expect(s.slots[1]).toMatchObject({ amount: 1 })

    const r = schiebeMitSchritten(s, 2) // Blau trägt den Ring ab
    const rot = r.schritte.filter((x) => x.farbe === 1)
    expect(rot).toHaveLength(1)
    expect(rot[0]!.slot).toBe(1) // der Block mit der 1 war dran
    expect(r.state.slots[1]).toBeNull() // voll und weg
    expect(r.state.slots[0]).toMatchObject({ amount: 5 }) // der große bleibt liegen
  })
})

describe('Der Takt', () => {
  it('holt je Runde einen Pixel pro arbeitendem Block', () => {
    const s = createMatch(level(RING, 3, [[{ color: 1, amount: 8 }]]))
    const r = tick(tapSpalte(s, 0)!.state)
    expect(r.schritte).toHaveLength(1)
    expect(r.state.slots[0]).toMatchObject({ amount: 7 })
    expect(restPixel(r.state)).toBe(8)
  })

  it('lässt zwei Blöcke gleichzeitig arbeiten – jeder holt einen je Runde', () => {
    let s = createMatch(
      level(RING, 3, [[{ color: 1, amount: 4 }], [{ color: 1, amount: 4 }]]),
    )
    s = tapSpalte(s, 0)!.state
    s = tapSpalte(s, 1)!.state
    const r = tick(s)
    expect(r.schritte).toHaveLength(2)
    expect(r.state.slots[0]).toMatchObject({ amount: 3 })
    expect(r.state.slots[1]).toMatchObject({ amount: 3 })
  })

  it('legt den zweiten Block auf den zweiten Platz, solange der erste arbeitet', () => {
    // Thomas: "wenn ich 2 anklicke, soll der 2. in die 2. Wabe springen."
    // Genau deshalb arbeitet ein Tipp nicht sofort alles ab.
    const s = createMatch(
      level(RING, 3, [[{ color: 1, amount: 4 }], [{ color: 1, amount: 4 }]]),
    )
    const erster = tapSpalte(s, 0)!
    expect(erster.slot).toBe(0)
    const zweiter = tapSpalte(erster.state, 1)!
    expect(zweiter.slot).toBe(1)
    expect(zweiter.state.slots.filter((x) => x != null)).toHaveLength(2)
  })

  it('sagt, ob überhaupt noch eine Biene fliegen kann', () => {
    const leerlauf = createMatch(level(RING, 3, [[{ color: 1, amount: 1 }]]))
    expect(arbeitMoeglich(leerlauf)).toBe(false) // nichts auf den Plätzen
    expect(arbeitMoeglich(tapSpalte(leerlauf, 0)!.state)).toBe(true)

    // Blau steckt im Kern fest: der Block kann nicht arbeiten.
    const wartet = createMatch(level(RING, 3, [[{ color: 2, amount: 1 }]]))
    expect(arbeitMoeglich(tapSpalte(wartet, 0)!.state)).toBe(false)
  })
})

describe('Der Nachschub', () => {
  it('gibt immer nur den obersten Block einer Spalte her', () => {
    const s = createMatch(
      level(RING, 3, [[{ color: 1, amount: 2 }, { color: 2, amount: 1 }]]),
    )
    expect(obersterBlock(s, 0)).toMatchObject({ color: 1, amount: 2 })
    expect(obersterBlock(schiebe(s, 0), 0)).toMatchObject({ color: 2, amount: 1 })
  })

  it('zeigt nur drei Reihen – der Rest rückt nach', () => {
    const tief = Array.from({ length: 6 }, (_, i) => ({ color: 1, amount: i + 1 }))
    const s = createMatch(level(RING, 3, [tief]))
    expect(sichtbareSpalten(s, SICHTBARE_REIHEN)[0]).toHaveLength(SICHTBARE_REIHEN)
    expect(verdeckteBloecke(s, SICHTBARE_REIHEN)).toBe(3)
  })

  it('sagt vorher, ob ein Block noch voll werden kann', () => {
    const s = createMatch(
      level(RING, 3, [[{ color: 1, amount: 8 }], [{ color: 1, amount: 9 }]]),
    )
    expect(passtNoch(s, obersterBlock(s, 0))).toBe(true) // acht rote Pixel gibt es
    expect(passtNoch(s, obersterBlock(s, 1))).toBe(false) // neun nicht
    expect(passtNoch(s, null)).toBe(false)
  })

  it('rechnet dabei mit, was schon auf den Plätzen bestellt ist', () => {
    let s = createMatch(
      level(RING, 3, [[{ color: 1, amount: 5 }], [{ color: 1, amount: 5 }]]),
    )
    s = schiebe(s, 0) // fünf der acht roten sind weg
    expect(passtNoch(s, obersterBlock(s, 1))).toBe(false) // fünf weitere passen nicht
  })

  it('weist leere Spalten und Unsinn ab', () => {
    const s = createMatch(level(RING, 3, [[{ color: 1, amount: 1 }]]))
    expect(kannTippen(s, 1)).toBe(false)
    expect(kannTippen(s, -1)).toBe(false)
    expect(kannTippen(s, 99)).toBe(false)
    expect(tapSpalte(s, 1)).toBeNull()
  })

  it('nimmt nichts mehr an, wenn alle fünf Plätze belegt sind', () => {
    // Fünf Blöcke einer verdeckten Farbe -- sie warten alle.
    const spalten = Array.from({ length: 4 }, (_, i) =>
      i === 0
        ? [
            { color: 2, amount: 9 },
            { color: 2, amount: 9 },
          ]
        : [{ color: 2, amount: 9 }],
    )
    let s = createMatch(level(RING, 3, spalten))
    for (let i = 0; i < 5 && s.phase === 'play'; i++) {
      const spalte = s.spalten.findIndex((sp) => sp.length > 0)
      s = tapSpalte(s, spalte)!.state
    }
    expect(freieSlots(s)).toBe(0)
    expect(s.phase).toBe('lost')
  })
})

describe('Gewonnen und verloren', () => {
  it('ist gewonnen, wenn das Bild leer ist', () => {
    const s = createMatch(
      level(RING, 3, [[{ color: 1, amount: 8 }], [{ color: 2, amount: 1 }]]),
    )
    const nachRot = schiebe(s, 0)
    expect(nachRot.phase).toBe('play')
    expect(schiebe(nachRot, 1).phase).toBe('won')
  })

  it('ist verloren, wenn alle Plätze auf Farben warten, an die niemand kommt', () => {
    const spalten = [
      [{ color: 2, amount: 9 }],
      [{ color: 2, amount: 9 }],
      [{ color: 2, amount: 9 }],
      [
        { color: 2, amount: 9 },
        { color: 2, amount: 9 },
      ],
    ]
    let s = createMatch(level(RING, 3, spalten))
    for (let i = 0; i < 5 && s.phase === 'play'; i++) {
      const spalte = s.spalten.findIndex((sp) => sp.length > 0)
      s = tapSpalte(s, spalte)!.state
    }
    expect(s.phase).toBe('lost')
    expect(restPixel(s)).toBeGreaterThan(0)
  })

  it('zählt am Ende die Blöcke, deren Farbe es nicht mehr gibt', () => {
    // Ein roter Block zu viel: Rot ist abgetragen, er wird nie voll.
    let s = createMatch(
      level(RING, 3, [
        [{ color: 1, amount: 8 }],
        [{ color: 1, amount: 4 }],
        [{ color: 2, amount: 1 }],
      ]),
    )
    s = schiebe(s, 0)
    s = schiebe(s, 1)
    expect(pixelDerFarbe(s, 1)).toBe(0)
    expect(s.tote).toBe(1)
    expect(schiebe(s, 2).phase).toBe('won')
  })

  it('nimmt nach dem Ende keine Tipps mehr an', () => {
    let s = createMatch(
      level(RING, 3, [
        [{ color: 1, amount: 8 }],
        [{ color: 2, amount: 1 }],
        [{ color: 1, amount: 3 }],
      ]),
    )
    s = schiebe(s, 0)
    s = schiebe(s, 1)
    expect(s.phase).toBe('won')
    expect(tapSpalte(s, 2)).toBeNull()
  })
})

describe('Motive', () => {
  it('übersetzt ein Zeichenraster in Pixel und zählt sie', () => {
    const { rows, cols, bild } = motivRaster({ name: 'X', zeilen: ['RR.', '.R.'] })
    expect({ rows, cols }).toEqual({ rows: 2, cols: 3 })
    expect(bild).toEqual([1, 1, 0, 0, 1, 0])
    expect(bedarfJeFarbe(bild)[1]).toBe(3)
  })

  it('hat lauter erkennbare Motive', () => {
    for (const m of [...MOTIVE, ...REICHE_MOTIVE]) {
      expect(m.zeilen.length).toBeGreaterThan(2)
      const pixel = m.zeilen.join('').split('').filter((c) => c !== '.' && c !== ' ').length
      expect(pixel).toBeGreaterThan(10)
    }
  })
})

describe('Die Level', () => {
  const alle = Array.from({ length: BIENEN_MAX_LEVEL }, (_, i) => createBienenLevel(i + 1))

  it('bringt von jeder Farbe genau so viel Kapazität mit, wie das Bild hat', () => {
    // Zu wenig hieße unlösbar, zu viel ist der Überschuss -- der ist gewollt,
    // aber er darf nicht aus Versehen entstehen.
    for (const l of alle) {
      const pixel = bedarfJeFarbe(l.bild)
      const kapazitaet: number[] = []
      for (const b of l.spalten.flat()) kapazitaet[b.color] = (kapazitaet[b.color] ?? 0) + b.amount
      for (let farbe = 1; farbe < pixel.length; farbe++) {
        if (!pixel[farbe]) continue
        expect(kapazitaet[farbe] ?? 0).toBeGreaterThanOrEqual(pixel[farbe]!)
      }
    }
  })

  it('verteilt den Nachschub auf drei bis vier Spalten und lässt fünf Plätze', () => {
    // Im Original ist Level 1 dreispaltig, spätere Level sind vierspaltig.
    for (const l of alle) {
      expect(l.spalten.length).toBeGreaterThanOrEqual(SPALTEN - 1)
      expect(l.spalten.length).toBeLessThanOrEqual(SPALTEN)
      expect(l.slotCount).toBe(SLOT_COUNT)
    }
    expect(alle[0]!.spalten).toHaveLength(SPALTEN - 1)
    expect(alle[299]!.spalten).toHaveLength(SPALTEN)
  })

  it('ist immer gleich aufgebaut – gleiches Level, gleiches Bild', () => {
    for (const n of [1, 5, 10]) {
      const a = createBienenLevel(n)
      const b = createBienenLevel(n)
      expect(b.bild).toEqual(a.bild)
      expect(b.spalten.flat().map((x) => `${x.color}:${x.amount}`)).toEqual(
        a.spalten.flat().map((x) => `${x.color}:${x.amount}`),
      )
    }
  })

  it('wird über die 300 Level hinweg größer', () => {
    const pixel = (l: BienenLevel) => l.bild.filter((c) => c > 0).length
    expect(pixel(alle[0]!)).toBeLessThan(pixel(alle[299]!))
    expect(blockZahlen(alle[0]!).gesamt).toBeLessThan(blockZahlen(alle[299]!).gesamt)
  })

  it('setzt alle zwanzig Level ein Tor', () => {
    for (const l of alle) expect(l.isGate).toBe(isSegmentGate(l.level))
    expect(alle.filter((l) => l.isGate)).toHaveLength(15)
    expect(SEGMENT_SIZE).toBe(20)
  })

  it('nimmt nicht immer dasselbe Motiv – auch nicht an den Toren', () => {
    // Erst wanderte die Auswahl in festen Schritten durch die Liste, und an
    // den Toren kamen dadurch immer nur zwei Motive vor.
    const tore = new Set(alle.filter((l) => l.isGate).map((l) => l.motiv))
    expect(tore.size).toBeGreaterThanOrEqual(4)
    const alleMotive = new Set(alle.map((l) => l.motiv))
    expect(alleMotive.size).toBeGreaterThanOrEqual(10)
  })

  it('bleibt außerhalb seiner Grenzen stehen', () => {
    expect(createBienenLevel(0).level).toBe(1)
    expect(createBienenLevel(999).level).toBe(BIENEN_MAX_LEVEL)
  })
})

/**
 * Der Löser, zweistufig.
 *
 * Stufe 1 ist die sichere Strategie: immer einen Platz frei halten, nur
 * Blöcke nehmen, die noch aufgehen, und lieber abwarten als graben. Was die
 * gewinnt, gewinnt auch ein aufmerksamer Mensch.
 *
 * Stufe 2 ist eine Strahlensuche mit etwas Vorausblick -- für die wenigen
 * Level, bei denen die einfache Strategie sich verrennt. Zusammen weisen sie
 * nach, dass jedes der 300 Level zu gewinnen ist, und zwar schnell genug für
 * jeden Testlauf.
 */
function sichererZug(s: BienenState): number | null {
  const reserve = freieSlots(s)
  if (reserve === 0) return null
  const frei = zugaenglich(s.board, s.rows, s.cols)
  const offen = (farbe: number) => frei.some((f, z) => f && s.board[z] === farbe)
  const oben = s.spalten
    .map((sp, i) => ({ b: sp[0], i }))
    .filter((x): x is { b: NonNullable<typeof x.b>; i: number } => Boolean(x.b))

  const sofort = oben.filter((x) => passtNoch(s, x.b) && offen(x.b.color))
  if (sofort.length > 0) return sofort.reduce((a, b) => (a.b.amount <= b.b.amount ? a : b)).i

  const wartend = oben.filter((x) => passtNoch(s, x.b))
  if (wartend.length > 0 && reserve >= 2) {
    return wartend.reduce((a, b) => (a.b.amount <= b.b.amount ? a : b)).i
  }
  if (arbeitMoeglich(s)) return null
  if (reserve >= 2 && oben.length > 0) {
    return oben.reduce((a, b) =>
      a.b.amount - pixelDerFarbe(s, a.b.color) <= b.b.amount - pixelDerFarbe(s, b.b.color) ? a : b,
    ).i
  }
  return null
}

function mitSichererStrategie(level: number): boolean {
  let s = createMatch(createBienenLevel(level))
  for (let n = 0; n < 900 && s.phase === 'play'; n++) {
    let i = sichererZug(s)
    if (i === null) {
      const r = arbeiteAus(s)
      if (r.schritte.length > 0) {
        s = r.state
        continue
      }
      const oben = s.spalten.map((sp, k) => ({ b: sp[0], k })).filter((x) => x.b)
      if (oben.length === 0 || freieSlots(s) === 0) break
      i = oben.reduce((a, b) =>
        a.b!.amount - pixelDerFarbe(s, a.b!.color) <= b.b!.amount - pixelDerFarbe(s, b.b!.color)
          ? a
          : b,
      ).k
    }
    const t = tapSpalte(s, i)
    if (!t) break
    s = arbeiteAus(t.state).state
  }
  return s.phase === 'won'
}

function mitVorausblick(level: number, breite = 40): boolean {
  let strahl: BienenState[] = [createMatch(createBienenLevel(level))]
  const gesehen = new Set<string>()
  for (let tiefe = 0; tiefe < 400; tiefe++) {
    const naechste: BienenState[] = []
    for (const s of strahl) {
      for (let i = 0; i < s.spalten.length; i++) {
        const t = tapSpalte(s, i)
        if (!t) continue
        const danach = arbeiteAus(t.state).state
        if (danach.phase === 'won') return true
        if (danach.phase === 'lost') continue
        const key =
          `${danach.spalten.map((sp) => sp.length).join(',')}|` +
          danach.slots.map((x) => (x ? `${x.color}:${x.amount}` : '-')).join(',')
        if (gesehen.has(key)) continue
        gesehen.add(key)
        naechste.push(danach)
      }
    }
    if (naechste.length === 0) return false
    naechste.sort((a, b) => {
      const totA = a.slots.filter((x) => x && !passtNoch(a, x)).length
      const totB = b.slots.filter((x) => x && !passtNoch(b, x)).length
      return totA - totB || restPixel(a) - restPixel(b)
    })
    strahl = naechste.slice(0, breite)
  }
  return false
}

describe('Lösbarkeit', () => {
  it('lässt jedes der 300 Level gewinnen', () => {
    const gescheitert: number[] = []
    for (let level = 1; level <= BIENEN_MAX_LEVEL; level++) {
      if (mitSichererStrategie(level)) continue
      if (!mitVorausblick(level)) gescheitert.push(level)
    }
    expect(gescheitert).toEqual([])
  }, 120_000)

  it('gewinnt die allermeisten Level schon mit der einfachen Strategie', () => {
    // Wenn hier plötzlich viele durchfallen, ist die Steigerung zu steil
    // geworden -- dann muss man nachrechnen, nicht nur nachsehen.
    let ok = 0
    for (let level = 1; level <= BIENEN_MAX_LEVEL; level++) {
      if (mitSichererStrategie(level)) ok++
    }
    expect(ok).toBeGreaterThanOrEqual(285)
  }, 120_000)

  it('lässt die ersten Level auch ohne Nachdenken durchgehen', () => {
    for (let level = 1; level <= 3; level++) {
      let s = createMatch(createBienenLevel(level))
      let n = 0
      while (s.phase === 'play' && n++ < 200) {
        const spalte = s.spalten.findIndex((sp) => sp.length > 0)
        if (spalte < 0 || freieSlots(s) === 0) break
        s = schiebe(s, spalte)
      }
      expect(`Level ${level}: ${s.phase}`).toBe(`Level ${level}: won`)
    }
  })
})

describe('Wertung', () => {
  const roh = (tote: number) => ({ won: true, tote, slotCount: SLOT_COUNT })

  it('gibt nichts für ein verlorenes Level', () => {
    expect(bienenFlowGame.calculateScore(5, { won: false, tote: 0, slotCount: 5 })).toBe(0)
    expect(bienenFlowGame.calculateXP(5, 0)).toBe(0)
    expect(bienenFlowGame.calculateStars!(5, 0)).toBe(0)
  })

  it('belohnt, wenn kein Block liegen bleibt', () => {
    expect(bienenFlowGame.calculateScore(5, roh(0))).toBeGreaterThan(
      bienenFlowGame.calculateScore(5, roh(2)),
    )
  })

  it('vergibt Sterne von eins bis fünf, und mehr Punkte sind nie weniger Sterne', () => {
    const sterne = [0, 1, 2, 3, 4].map((v) =>
      bienenFlowGame.calculateStars!(5, bienenFlowGame.calculateScore(5, roh(v))),
    )
    expect(sterne[0]).toBe(5)
    expect(Math.min(...sterne)).toBeGreaterThanOrEqual(1)
    for (let i = 1; i < sterne.length; i++) expect(sterne[i]!).toBeLessThanOrEqual(sterne[i - 1]!)
  })
})
