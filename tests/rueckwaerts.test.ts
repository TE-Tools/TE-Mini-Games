/**
 * Rückwärts – die Regeln, ohne Browser.
 *
 * Drei Dinge müssen stimmen, und jedes hat hier seinen Abschnitt:
 * das Umdrehen und Stutzen einer Aufnahme, wer wann was hören darf, und
 * dass am Ende einer Runde keine Stimme mehr im Speicher liegt.
 */
import { describe, it, expect } from 'vitest'
import {
  RUECKWAERTS,
  aufloesen,
  beenden,
  createRueckwaertsMatch,
  dauer,
  hoerbar,
  kehreUm,
  klangFuer,
  naechsteRunde,
  neuEinsprechen,
  nimmNachahmung,
  nimmOriginal,
  rollen,
  stutze,
  verwerfeAufnahmen,
  type HoerArt,
  type Klang,
  type RueckZustand,
} from '@/games/rueckwaerts'

const RATE = 8000

/** Ein „Wort": ein Ton, der von tief nach hoch steigt -- vorn und hinten klingen verschieden. */
function wort(sekunden = 0.8, ausschlag = 0.5): Float32Array {
  const n = Math.round(RATE * sekunden)
  const out = new Float32Array(n)
  let phase = 0
  for (let i = 0; i < n; i++) {
    const x = i / n
    phase += (2 * Math.PI * (150 + 650 * x)) / RATE
    out[i] = ausschlag * Math.sin(phase)
  }
  return out
}

function stille(sekunden: number): Float32Array {
  return new Float32Array(Math.round(RATE * sekunden))
}

function klang(...teile: Float32Array[]): Klang {
  const n = teile.reduce((a, t) => a + t.length, 0)
  const samples = new Float32Array(n)
  let ab = 0
  for (const t of teile) {
    samples.set(t, ab)
    ab += t.length
  }
  return { samples, rate: RATE }
}

/** Eine Aufnahme, wie sie vom Mikrofon kommt: erst Stille, dann das Wort, dann wieder Stille. */
const aufnahme = () => klang(stille(0.5), wort(), stille(0.6))

/** Nulldurchgänge in der vorderen und hinteren Hälfte -- steigt der Ton, sind es hinten mehr. */
function kreuzungen(k: Klang): { vorn: number; hinten: number } {
  const d = k.samples
  const mitte = Math.floor(d.length / 2)
  const zaehle = (von: number, bis: number) => {
    let n = 0
    for (let i = von + 1; i < bis; i++) if (d[i - 1]! < 0 !== d[i]! < 0) n++
    return n
  }
  return { vorn: zaehle(0, mitte), hinten: zaehle(mitte, d.length) }
}

const istStill = (k: Klang | Float32Array) => ('samples' in k ? k.samples : k).every((v) => v === 0)

const NAMEN = ['Anna', 'Ben', 'Cem']

function mitOriginal(namen = NAMEN): RueckZustand {
  const e = nimmOriginal(createRueckwaertsMatch({ names: namen }), aufnahme())
  if (!e.ok) throw new Error('Aufnahme zählt nicht')
  return e.zustand
}

function mitNachahmung(namen = NAMEN): RueckZustand {
  const e = nimmNachahmung(mitOriginal(namen), aufnahme())
  if (!e.ok) throw new Error('Aufnahme zählt nicht')
  return e.zustand
}

describe('Umdrehen', () => {
  it('liest die Aufnahme von hinten nach vorn', () => {
    const k = { samples: Float32Array.from([0.1, 0.2, 0.3, 0.4]), rate: RATE }
    expect(Array.from(kehreUm(k).samples)).toEqual(
      Array.from(Float32Array.from([0.4, 0.3, 0.2, 0.1])),
    )
  })

  it('zweimal umgedreht ist wieder das Original -- darauf beruht das ganze Spiel', () => {
    const k = klang(wort())
    expect(Array.from(kehreUm(kehreUm(k)).samples)).toEqual(Array.from(k.samples))
  })

  it('lässt die Vorlage unberührt und liefert eine eigene Kopie', () => {
    const k = klang(wort())
    const vorher = Array.from(k.samples)
    const um = kehreUm(k)
    um.samples.fill(0)
    expect(Array.from(k.samples)).toEqual(vorher)
  })

  it('macht aus einem steigenden Ton einen fallenden', () => {
    const k = klang(wort())
    expect(kreuzungen(k).hinten).toBeGreaterThan(kreuzungen(k).vorn * 1.5)
    const um = kreuzungen(kehreUm(k))
    expect(um.vorn).toBeGreaterThan(um.hinten * 1.5)
  })
})

describe('Stutzen', () => {
  it('schneidet die Stille vor und hinter dem Wort weg', () => {
    const e = stutze(aufnahme())
    expect(e.ok).toBe(true)
    if (!e.ok) return
    // 0,8 s Wort plus je ein Rand; die Stille davor und dahinter (1,1 s) ist weg.
    const erwartet = 0.8 + 2 * RUECKWAERTS.randSekunden
    expect(dauer(e.klang)).toBeGreaterThan(erwartet - 0.05)
    expect(dauer(e.klang)).toBeLessThan(erwartet + 0.05)
  })

  it('liefert eine eigene Kopie -- die Rohfassung lässt sich danach überschreiben', () => {
    const roh = aufnahme()
    const e = stutze(roh)
    if (!e.ok) throw new Error('zählt nicht')
    roh.samples.fill(0)
    expect(istStill(e.klang)).toBe(false)
  })

  it('weist eine stille Aufnahme zurück', () => {
    expect(stutze(klang(stille(1.5)))).toEqual({ ok: false, grund: 'zu-leise' })
  })

  it('weist Zimmerrauschen zurück', () => {
    const rauschen = new Float32Array(RATE)
    for (let i = 0; i < rauschen.length; i++) rauschen[i] = 0.004 * Math.sin(i * 12.9898)
    expect(stutze(klang(rauschen))).toEqual({ ok: false, grund: 'zu-leise' })
  })

  it('weist einen kurzen Knacks zurück', () => {
    expect(stutze(klang(stille(0.4), wort(0.08), stille(0.4)))).toEqual({
      ok: false,
      grund: 'zu-kurz',
    })
  })

  it('weist eine leere Aufnahme zurück', () => {
    expect(stutze({ samples: new Float32Array(0), rate: RATE })).toEqual({
      ok: false,
      grund: 'zu-kurz',
    })
  })

  it('nimmt auch leise Sprecher an -- die Schwelle richtet sich nach der Aufnahme', () => {
    const e = stutze(klang(stille(0.3), wort(0.8, 0.06), stille(0.3)))
    expect(e.ok).toBe(true)
  })

  it('hält den Fingertipp auf den Knopf nicht für den Anfang des Worts', () => {
    // Ein einzelner harter Ausschlag ganz vorn, dann Stille, dann das Wort.
    const tipp = stille(0.3)
    tipp[5] = 0.9
    const e = stutze(klang(tipp, wort(), stille(0.3)))
    if (!e.ok) throw new Error('zählt nicht')
    expect(dauer(e.klang)).toBeLessThan(0.8 + 2 * RUECKWAERTS.randSekunden + 0.05)
  })

  it('... und den Tipp auf Stopp nicht für sein Ende', () => {
    const tipp = stille(0.4)
    tipp[tipp.length - 9] = -0.9
    const e = stutze(klang(stille(0.3), wort(), tipp))
    if (!e.ok) throw new Error('zählt nicht')
    expect(dauer(e.klang)).toBeLessThan(0.8 + 2 * RUECKWAERTS.randSekunden + 0.05)
  })

  it('behält ein Wort mit Pause in der Mitte ganz', () => {
    // Zwei Silben mit einer Lücke: Gestutzt wird nur außen.
    const e = stutze(klang(stille(0.3), wort(0.4), stille(0.2), wort(0.4), stille(0.3)))
    if (!e.ok) throw new Error('zählt nicht')
    expect(dauer(e.klang)).toBeGreaterThan(1.0)
  })
})

describe('Partie und Rollen', () => {
  it('beginnt mit dem Einsprechen, ohne Aufnahmen', () => {
    const z = createRueckwaertsMatch({ names: NAMEN })
    expect(z.phase).toBe('einsprechen')
    expect(z.runde).toBe(1)
    expect([z.original, z.originalRueckwaerts, z.nachahmung, z.nachahmungRueckwaerts]).toEqual([
      null,
      null,
      null,
      null,
    ])
  })

  it('verlangt zwei bis zwölf Spieler und keine doppelten Namen', () => {
    expect(() => createRueckwaertsMatch({ names: ['Anna'] })).toThrow('Mindestens 2 Spieler nötig')
    expect(() =>
      createRueckwaertsMatch({ names: Array.from({ length: 13 }, (_, i) => `S${i}`) }),
    ).toThrow('Maximal 12 Spieler')
    expect(() => createRueckwaertsMatch({ names: ['Anna', ' anna '] })).toThrow(
      'Name doppelt: anna',
    )
  })

  it('zu dritt: eine spricht ein, einer spricht nach, einer rät', () => {
    const r = rollen(createRueckwaertsMatch({ names: NAMEN }))
    expect(r.sprecher.name).toBe('Anna')
    expect(r.nachsprecher.name).toBe('Ben')
    expect(r.rater.map((p) => p.name)).toEqual(['Cem'])
  })

  it('zu zweit rät, wer nachgesprochen hat', () => {
    const r = rollen(createRueckwaertsMatch({ names: ['Anna', 'Ben'] }))
    expect(r.sprecher.name).toBe('Anna')
    expect(r.nachsprecher.name).toBe('Ben')
    expect(r.rater.map((p) => p.name)).toEqual(['Ben'])
  })

  it('zu fünft raten alle, die weder eingesprochen noch nachgesprochen haben', () => {
    const r = rollen(createRueckwaertsMatch({ names: ['A1', 'B2', 'C3', 'D4', 'E5'] }))
    expect(r.rater.map((p) => p.name)).toEqual(['C3', 'D4', 'E5'])
  })

  it('rückt die Rollen jede Runde einen Platz weiter', () => {
    let z = mitNachahmung()
    z = naechsteRunde(aufloesen(z), true)
    const r = rollen(z)
    expect(r.sprecher.name).toBe('Ben')
    expect(r.nachsprecher.name).toBe('Cem')
    expect(r.rater.map((p) => p.name)).toEqual(['Anna'])
  })

  it('wer rät, hat ab drei Spielern nie eingesprochen', () => {
    for (let n = 3; n <= 12; n++) {
      let z = createRueckwaertsMatch({ names: Array.from({ length: n }, (_, i) => `S${i}`) })
      for (let runde = 0; runde < n + 2; runde++) {
        const r = rollen(z)
        expect(r.rater).not.toContain(r.sprecher)
        expect(r.rater).not.toContain(r.nachsprecher)
        expect(r.sprecher).not.toBe(r.nachsprecher)
        const a = nimmOriginal(z, aufnahme())
        if (!a.ok) throw new Error('zählt nicht')
        const b = nimmNachahmung(a.zustand, aufnahme())
        if (!b.ok) throw new Error('zählt nicht')
        z = naechsteRunde(aufloesen(b.zustand), false)
      }
    }
  })
})

describe('Ablauf', () => {
  it('führt vom Einsprechen über das Nachsprechen und Raten zur Auflösung', () => {
    const a = mitOriginal()
    expect(a.phase).toBe('nachsprechen')
    const b = nimmNachahmung(a, aufnahme())
    if (!b.ok) throw new Error('zählt nicht')
    expect(b.zustand.phase).toBe('raten')
    expect(aufloesen(b.zustand).phase).toBe('aufloesung')
  })

  it('hält das Wort gestutzt fest und dazu umgedreht', () => {
    const z = mitOriginal()
    expect(dauer(z.original!)).toBeLessThan(1.1)
    expect(Array.from(z.originalRueckwaerts!.samples)).toEqual(
      Array.from(kehreUm(z.original!).samples),
    )
  })

  it('lässt alles, wie es war, wenn eine Aufnahme nicht zählt', () => {
    const z = createRueckwaertsMatch({ names: NAMEN })
    expect(nimmOriginal(z, klang(stille(1)))).toEqual({ ok: false, grund: 'zu-leise' })
    expect(z.phase).toBe('einsprechen')
    expect(z.original).toBeNull()

    const a = mitOriginal()
    expect(nimmNachahmung(a, klang(stille(1)))).toEqual({ ok: false, grund: 'zu-leise' })
    expect(a.phase).toBe('nachsprechen')
    expect(a.nachahmung).toBeNull()
    expect(istStill(a.original!)).toBe(false)
  })

  it('nimmt nichts an, was nicht an der Reihe ist', () => {
    const z = createRueckwaertsMatch({ names: NAMEN })
    expect(() => nimmNachahmung(z, aufnahme())).toThrow()
    expect(() => aufloesen(z)).toThrow()
    expect(() => naechsteRunde(z, true)).toThrow()
    expect(() => neuEinsprechen(z)).toThrow()
    expect(() => nimmOriginal(mitOriginal(), aufnahme())).toThrow()
    expect(() => naechsteRunde(mitNachahmung(), true)).toThrow()
  })

  it('eine gelungene Nachahmung steht nach dem Umdrehen wieder richtig herum', () => {
    const a = mitOriginal()
    // Die beste denkbare Nachahmung: genau das, was rückwärts zu hören war.
    const nachgesprochen = klang(stille(0.4), a.originalRueckwaerts!.samples, stille(0.5))
    const b = nimmNachahmung(a, nachgesprochen)
    if (!b.ok) throw new Error('zählt nicht')
    const gehoert = b.zustand.nachahmungRueckwaerts!
    // Steigt wie das Original ...
    expect(kreuzungen(gehoert).hinten).toBeGreaterThan(kreuzungen(gehoert).vorn * 1.5)
    // ... und ist so lang wie das Original.
    expect(Math.abs(dauer(gehoert) - dauer(a.original!))).toBeLessThan(0.05)
  })

  it('zählt abgeschlossene und erratene Runden', () => {
    let z = naechsteRunde(aufloesen(mitNachahmung()), true)
    expect([z.runde, z.gespielt, z.erraten]).toEqual([2, 1, 1])
    const a = nimmOriginal(z, aufnahme())
    if (!a.ok) throw new Error('zählt nicht')
    const b = nimmNachahmung(a.zustand, aufnahme())
    if (!b.ok) throw new Error('zählt nicht')
    z = naechsteRunde(aufloesen(b.zustand), false)
    expect([z.runde, z.gespielt, z.erraten]).toEqual([3, 2, 1])
  })

  it('eine abgebrochene Runde zählt beim Beenden nicht mit', () => {
    const z = beenden(mitOriginal())
    expect(z.phase).toBe('ende')
    expect(z.gespielt).toBe(0)
  })
})

describe('Was zu hören ist', () => {
  const ALLE: HoerArt[] = [
    'original',
    'original-rueckwaerts',
    'nachahmung',
    'nachahmung-rueckwaerts',
  ]

  it('beim Einsprechen: nichts', () => {
    expect(hoerbar(createRueckwaertsMatch({ names: NAMEN }))).toEqual([])
  })

  it('wer nachspricht, hört das Wort nur rückwärts', () => {
    const z = mitOriginal()
    expect(hoerbar(z)).toEqual(['original-rueckwaerts'])
    expect(klangFuer(z, 'original-rueckwaerts')).toBe(z.originalRueckwaerts)
    // Das Wort richtig herum wäre die Lösung.
    expect(() => klangFuer(z, 'original')).toThrow()
  })

  it('wer rät, hört nur die umgedrehte Nachahmung', () => {
    const z = mitNachahmung()
    expect(hoerbar(z)).toEqual(['nachahmung-rueckwaerts'])
    expect(klangFuer(z, 'nachahmung-rueckwaerts')).toBe(z.nachahmungRueckwaerts)
    for (const art of ALLE.filter((a) => a !== 'nachahmung-rueckwaerts')) {
      expect(() => klangFuer(z, art)).toThrow()
    }
  })

  it('die Auflösung gibt alles frei, jedes unter seinem Namen', () => {
    const z = aufloesen(mitNachahmung())
    expect(hoerbar(z)).toEqual(ALLE)
    expect(klangFuer(z, 'original')).toBe(z.original)
    expect(klangFuer(z, 'original-rueckwaerts')).toBe(z.originalRueckwaerts)
    expect(klangFuer(z, 'nachahmung')).toBe(z.nachahmung)
    expect(klangFuer(z, 'nachahmung-rueckwaerts')).toBe(z.nachahmungRueckwaerts)
  })

  it('nach dem Ende: nichts', () => {
    const z = beenden(aufloesen(mitNachahmung()))
    expect(hoerbar(z)).toEqual([])
    for (const art of ALLE) expect(() => klangFuer(z, art)).toThrow()
  })
})

describe('Löschen', () => {
  /** Die vier Aufnahmen eines Zustands -- festgehalten, bevor er sie loslässt. */
  const aufnahmenVon = (z: RueckZustand) =>
    [z.original, z.originalRueckwaerts, z.nachahmung, z.nachahmungRueckwaerts].filter(
      (k): k is Klang => k !== null,
    )

  it('die nächste Runde überschreibt alle vier Aufnahmen und hält keine mehr fest', () => {
    const z = aufloesen(mitNachahmung())
    const alte = aufnahmenVon(z)
    expect(alte).toHaveLength(4)
    expect(alte.every((k) => !istStill(k))).toBe(true)

    const neu = naechsteRunde(z, true)
    expect(alte.every(istStill)).toBe(true)
    expect(aufnahmenVon(neu)).toEqual([])
  })

  it('das gilt auch, wenn nicht richtig geraten wurde', () => {
    const z = aufloesen(mitNachahmung())
    const alte = aufnahmenVon(z)
    naechsteRunde(z, false)
    expect(alte.every(istStill)).toBe(true)
  })

  it('neu einsprechen überschreibt das verworfene Wort', () => {
    const z = mitOriginal()
    const alte = aufnahmenVon(z)
    expect(alte).toHaveLength(2)
    const neu = neuEinsprechen(z)
    expect(alte.every(istStill)).toBe(true)
    expect(neu.phase).toBe('einsprechen')
    expect(aufnahmenVon(neu)).toEqual([])
  })

  it('beenden überschreibt aus jeder Phase', () => {
    for (const z of [mitOriginal(), mitNachahmung(), aufloesen(mitNachahmung())]) {
      const alte = aufnahmenVon(z)
      const ende = beenden(z)
      expect(alte.every(istStill)).toBe(true)
      expect(aufnahmenVon(ende)).toEqual([])
    }
  })

  it('verwerfen überschreibt, ohne die Partie anzufassen -- für das Verlassen der Seite', () => {
    const z = mitNachahmung()
    const alte = aufnahmenVon(z)
    const danach = verwerfeAufnahmen(z)
    expect(alte.every(istStill)).toBe(true)
    expect(danach.phase).toBe('raten')
    expect(danach.runde).toBe(1)
  })

  it('die Rohfassung vom Mikrofon gehört dem Aufrufer -- der Zustand hält nur seine Kopie', () => {
    const roh = aufnahme()
    const e = nimmOriginal(createRueckwaertsMatch({ names: NAMEN }), roh)
    if (!e.ok) throw new Error('zählt nicht')
    roh.samples.fill(0)
    expect(istStill(e.zustand.original!)).toBe(false)
    expect(istStill(e.zustand.originalRueckwaerts!)).toBe(false)
  })
})
