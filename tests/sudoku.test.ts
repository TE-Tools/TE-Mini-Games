/**
 * Sudoku -- Löser, Techniken, Generator, Level und Wertung.
 *
 * Das Wichtigste steht in der Mitte: Jedes der 150 ausgelieferten Rätsel
 * wird hier nachgerechnet -- genau eine Lösung, und zwar die hinterlegte;
 * die gespeicherte Bewertung stimmt mit dem Menschenlöser überein; und die
 * Stufen sind, was sie versprechen: Leicht nur mit Singles, Mittel ohne
 * Fische, Schwer ab X-Wing mit Ketten am Ende. Ein Rätsel, das in der
 * falschen Stufe liegt, fiele im Spiel niemandem auf -- man hielte sich
 * selbst für zu dumm oder das Spiel für zu leicht.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  parse,
  alsText,
  istGueltig,
  istGeloest,
  anzahlVorgaben,
  hatKonflikt,
  NACHBARN,
  zaehleLoesungen,
  istEindeutig,
  loese,
  bewerte,
  naechsterSchritt,
  zustandAus,
  wendeAn,
  tippFuer,
  alleKandidaten,
  TECHNIK_GEWICHT,
  erzeugeRaetsel,
  volleLoesung,
  RAETSEL_DATEN,
  raetsel,
  alleRaetsel,
  schwierigkeitVon,
  stufeVon,
  levelNummer,
  levelName,
  karteFuer,
  haerte,
  SUDOKU_MAX_LEVEL,
  LEVEL_PRO_STUFE,
  sudokuGame,
  werte,
  berechnePunkte,
  sterneFuer,
  xpFuer,
  RICHTZEIT,
  KOSTEN_FEHLER,
  KOSTEN_TIPP,
  leseStand,
  merkeAbschluss,
  merkePartie,
  lesePartie,
  vergissPartie,
  istOffen,
  geloeste,
  loescheStand,
  type Technik,
} from '@/games/sudoku'
import { createRng } from '@/games/rng'

/** Ein bekanntes leichtes Rätsel (Wikipedia-Beispiel). */
const LEICHT = '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79'
/** Arto Inkalas Rätsel von 2012 -- gilt als eines der schwersten. */
const INKALA = '8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..'

const G = TECHNIK_GEWICHT

describe('Gitter', () => {
  it('liest und schreibt 81 Zeichen', () => {
    const g = parse(LEICHT)
    expect(alsText(g)).toBe(LEICHT)
    expect(anzahlVorgaben(g)).toBe(30)
  })

  it('kennt zu jeder Zelle zwanzig Nachbarn', () => {
    for (const n of NACHBARN) expect(n).toHaveLength(20)
    expect(NACHBARN[0]).toContain(8) // Zeile
    expect(NACHBARN[0]).toContain(72) // Spalte
    expect(NACHBARN[0]).toContain(20) // Kasten
    expect(NACHBARN[0]).not.toContain(0)
  })

  it('erkennt Konflikte', () => {
    const g = parse(LEICHT)
    expect(istGueltig(g)).toBe(true)
    g[2] = 5 // in Zeile 1 steht schon eine 5
    expect(istGueltig(g)).toBe(false)
    expect(hatKonflikt(g, 2)).toBe(true)
  })
})

describe('Rechenlöser', () => {
  it('löst das leichte und das schwerste Rätsel eindeutig', () => {
    for (const txt of [LEICHT, INKALA]) {
      const g = parse(txt)
      expect(zaehleLoesungen(g, 2)).toBe(1)
      const l = loese(g)
      expect(l).not.toBeNull()
      expect(istGeloest(l!)).toBe(true)
      // Die Vorgaben stehen unverändert in der Lösung.
      for (let i = 0; i < 81; i++) if (g[i]) expect(l![i]).toBe(g[i])
    }
  })

  it('zählt mehrdeutige Rätsel als mehrdeutig', () => {
    const g = parse(LEICHT)
    // Zwei Vorgaben weg, die sich vertauschen lassen: mehrere Lösungen.
    const leer = new Uint8Array(81)
    expect(zaehleLoesungen(leer, 2)).toBe(2)
    expect(istEindeutig(g)).toBe(true)
  })

  it('gibt bei widersprüchlicher Vorgabe keine Lösung', () => {
    const g = parse(LEICHT)
    g[1] = 5
    expect(loese(g)).toBeNull()
  })
})

describe('Menschenlöser', () => {
  it('löst das leichte Rätsel nur mit Singles', () => {
    const b = bewerte(parse(LEICHT))
    expect(b.geloest).toBe(true)
    expect(G[b.hoechste]).toBeLessThanOrEqual(G['versteckter-single'])
  })

  it('erkennt Inkalas Rätsel als verschachtelt', () => {
    const b = bewerte(parse(INKALA))
    expect(b.geloest).toBe(true)
    expect(b.hoechste).toBe('rohe-gewalt')
  })

  it('macht nie einen Schritt, der der Lösung widerspricht', () => {
    // Über eine Auswahl von Leveln jeden Schritt gegen die Lösung prüfen:
    // Eine gesetzte Ziffer muss stimmen, eine gestrichene darf nicht die
    // richtige sein. Das ist der Test, der einen Fehler in einer Technik
    // findet -- Bewertung allein täte das nicht.
    for (const nr of [1, 25, 50, 60, 90, 100, 105, 120, 135, 150]) {
      const r = raetsel(nr)
      const z = zustandAus(r.vorgabe)
      for (let n = 0; n < 500; n++) {
        const s = naechsterSchritt(z)
        if (!s) break
        if (s.setze) {
          expect(r.loesung[s.setze.zelle], `Level ${nr}: ${s.technik} setzt ${s.text}`).toBe(
            s.setze.ziffer,
          )
        }
        for (const e of s.streiche ?? []) {
          expect(r.loesung[e.zelle], `Level ${nr}: ${s.technik} streicht ${s.text}`).not.toBe(
            e.ziffer,
          )
        }
        wendeAn(z, s)
      }
    }
  })

  it('gibt einen Tipp, der stimmt -- und keinen, wenn etwas falsch drinsteht', () => {
    const r = raetsel(70)
    const t = tippFuer(r.vorgabe, r.loesung)
    expect(t).not.toBeNull()
    expect(r.loesung[t!.zelle]).toBe(t!.ziffer)
    expect(t!.techniken.length).toBeGreaterThan(0)
    const falsch = new Uint8Array(r.vorgabe)
    const leer = falsch.indexOf(0)
    falsch[leer] = r.loesung[leer] === 1 ? 2 : 1
    expect(tippFuer(falsch, r.loesung)).toBeNull()
  })

  it('füllt Notizen mit genau den Kandidaten', () => {
    const g = parse(LEICHT)
    const k = alleKandidaten(g)
    for (let i = 0; i < 81; i++) {
      if (g[i]) {
        expect(k[i]).toBe(0)
        continue
      }
      for (const n of NACHBARN[i]!) if (g[n]) expect(k[i]! & (1 << g[n]!)).toBe(0)
    }
  })
})

describe('Generator', () => {
  it('würfelt volle, gültige Gitter -- deterministisch', () => {
    const a = volleLoesung(createRng('probe'))
    const b = volleLoesung(createRng('probe'))
    expect(istGeloest(a)).toBe(true)
    expect(alsText(a)).toBe(alsText(b))
    expect(alsText(volleLoesung(createRng('anders')))).not.toBe(alsText(a))
  })

  it('gräbt eindeutige Rätsel, symmetrisch und frei', () => {
    for (const sym of [true, false]) {
      const r = erzeugeRaetsel(`test-${sym}`, { symmetrisch: sym, mindestens: 0 })
      expect(istEindeutig(r.vorgabe)).toBe(true)
      expect(alsText(loese(r.vorgabe)!)).toBe(alsText(r.loesung))
      expect(anzahlVorgaben(r.vorgabe)).toBeLessThan(35)
      if (sym) {
        // Punktsymmetrisch bis auf die Paare, bei denen nur eine Zelle gehen
        // konnte -- deshalb "überwiegend", nicht "vollständig".
        let paare = 0
        for (let i = 0; i < 40; i++) if ((r.vorgabe[i] === 0) === (r.vorgabe[80 - i] === 0)) paare++
        expect(paare).toBeGreaterThanOrEqual(30)
      }
    }
  })

  it('hält bei der gewünschten Zahl Vorgaben an', () => {
    const r = erzeugeRaetsel('halt', { symmetrisch: true, mindestens: 40 })
    // Ein Paar kann um eins überschießen.
    expect(anzahlVorgaben(r.vorgabe)).toBeGreaterThanOrEqual(39)
    expect(anzahlVorgaben(r.vorgabe)).toBeLessThanOrEqual(42)
  })
})

describe('Die 150 Level', () => {
  it('sind 150, drei Stufen zu fünfzig', () => {
    expect(RAETSEL_DATEN).toHaveLength(SUDOKU_MAX_LEVEL)
    expect(SUDOKU_MAX_LEVEL).toBe(150)
    expect(LEVEL_PRO_STUFE).toBe(50)
    expect(schwierigkeitVon(1)).toBe('leicht')
    expect(schwierigkeitVon(50)).toBe('leicht')
    expect(schwierigkeitVon(51)).toBe('mittel')
    expect(schwierigkeitVon(100)).toBe('mittel')
    expect(schwierigkeitVon(101)).toBe('schwer')
    expect(schwierigkeitVon(150)).toBe('schwer')
    expect(stufeVon(62)).toBe(12)
    expect(levelNummer('mittel', 12)).toBe(62)
    expect(levelName(150)).toBe('Schwer 50')
  })

  it('haben alle genau eine Lösung, und zwar die hinterlegte', () => {
    for (const r of alleRaetsel()) {
      expect(istGueltig(r.vorgabe), `Level ${r.nr} gültig`).toBe(true)
      expect(zaehleLoesungen(r.vorgabe, 2), `Level ${r.nr} eindeutig`).toBe(1)
      expect(istGeloest(r.loesung), `Level ${r.nr} Lösung voll`).toBe(true)
      for (let i = 0; i < 81; i++) {
        if (r.vorgabe[i]) expect(r.loesung[i], `Level ${r.nr} Zelle ${i}`).toBe(r.vorgabe[i])
      }
      expect(alsText(loese(r.vorgabe)!), `Level ${r.nr} Lösung`).toBe(alsText(r.loesung))
    }
  })

  it('kommen kein zweites Mal vor', () => {
    expect(new Set(RAETSEL_DATEN.map((d) => d.v)).size).toBe(RAETSEL_DATEN.length)
  })

  it('sind so bewertet, wie es in den Daten steht', () => {
    for (const r of alleRaetsel()) {
      const b = bewerte(r.vorgabe)
      expect(b.geloest, `Level ${r.nr}`).toBe(true)
      expect(b.hoechste, `Level ${r.nr} schwerster Schritt`).toBe(r.technik)
      expect(b.punkte, `Level ${r.nr} Aufwand`).toBe(r.aufwand)
    }
  })

  it('Leicht: nur Singles, von vielen zu wenigen Vorgaben', () => {
    const leicht = alleRaetsel().filter((r) => r.schwierigkeit === 'leicht')
    for (const r of leicht) {
      expect(G[r.technik], `Level ${r.nr}`).toBeLessThanOrEqual(G['versteckter-single'])
    }
    expect(leicht[0]!.anzahlVorgaben).toBeGreaterThanOrEqual(42)
    expect(leicht.at(-1)!.anzahlVorgaben).toBeLessThanOrEqual(34)
    // Der Aufwand steigt an.
    for (let i = 1; i < leicht.length; i++) {
      expect(leicht[i]!.aufwand, `Level ${leicht[i]!.nr}`).toBeGreaterThanOrEqual(
        leicht[i - 1]!.aufwand,
      )
    }
  })

  it('Mittel: braucht Paare oder mehr, aber keinen Fisch', () => {
    const mittel = alleRaetsel().filter((r) => r.schwierigkeit === 'mittel')
    for (const r of mittel) {
      expect(G[r.technik], `Level ${r.nr} zu leicht`).toBeGreaterThan(G['versteckter-single'])
      expect(G[r.technik], `Level ${r.nr} zu schwer`).toBeLessThan(G['x-wing'])
    }
    for (let i = 1; i < mittel.length; i++) {
      const a = mittel[i - 1]!
      const b = mittel[i]!
      expect(
        G[b.technik] > G[a.technik] || (G[b.technik] === G[a.technik] && b.aufwand >= a.aufwand),
        `Level ${b.nr} leichter als ${a.nr}`,
      ).toBe(true)
    }
  })

  it('Schwer: ab X-Wing, und hinten Ketten und Verschachteltes', () => {
    const schwer = alleRaetsel().filter((r) => r.schwierigkeit === 'schwer')
    for (const r of schwer) {
      expect(G[r.technik], `Level ${r.nr} zu leicht für Schwer`).toBeGreaterThanOrEqual(G['x-wing'])
    }
    for (let i = 1; i < schwer.length; i++) {
      const a = schwer[i - 1]!
      const b = schwer[i]!
      expect(
        G[b.technik] > G[a.technik] || (G[b.technik] === G[a.technik] && b.aufwand >= a.aufwand),
        `Level ${b.nr} leichter als ${a.nr}`,
      ).toBe(true)
    }
    const zaehle = (t: Technik) => schwer.filter((r) => r.technik === t).length
    // Mindestens zehn Level brauchen eine Widerspruchskette, mindestens
    // fünf gehen selbst damit nicht auf -- das sind die, an denen man hängt.
    expect(zaehle('kette')).toBeGreaterThanOrEqual(10)
    expect(zaehle('rohe-gewalt')).toBeGreaterThanOrEqual(5)
    expect(schwer.at(-1)!.technik).toBe('rohe-gewalt')
    // Und wenig Vorgaben: im Schnitt unter 26.
    const schnitt = schwer.reduce((s, r) => s + r.anzahlVorgaben, 0) / schwer.length
    expect(schnitt).toBeLessThan(26)
  })

  it('bietet je Stufe eine Karte mit fünfzig Stufen in fünf Abschnitten', () => {
    for (const s of ['leicht', 'mittel', 'schwer'] as const) {
      const k = karteFuer(s)
      expect(k.maxLevel).toBe(50)
      expect(k.segmentGroesse).toBe(10)
      expect(k.zonen).toHaveLength(1)
      expect(k.zonen[0]!.name.length).toBeGreaterThan(2)
    }
    expect(haerte(1)).toBe(1)
    expect(haerte(150)).toBe(5)
  })
})

describe('Spieldefinition', () => {
  it('ist registrierbar und liefert jedes Level', () => {
    expect(sudokuGame.id).toBe('sudoku')
    expect(sudokuGame.maxLevel).toBe(150)
    for (let L = 1; L <= 150; L++) {
      const c = sudokuGame.createLevel(L)
      expect(c.level).toBe(L)
      expect(typeof c.vorgabe).toBe('string')
      expect((c.vorgabe as string).length).toBe(81)
    }
  })

  it('rechnet Punkte, Sterne und XP aus dem Rohergebnis', () => {
    const roh = { geloest: true, sekunden: 120, fehler: 0, tipps: 0 }
    const p = sudokuGame.calculateScore(10, roh)
    expect(p).toBe(berechnePunkte(10, roh))
    expect(sudokuGame.calculateStars?.(10, p)).toBe(5)
    expect(sudokuGame.calculateXP(10, p)).toBe(xpFuer(10, p))
    expect(sudokuGame.calculateScore(10, { geloest: false })).toBe(0)
    expect(sudokuGame.calculateXP(10, 0)).toBe(0)
  })
})

describe('Wertung', () => {
  it('bezahlt Schwer deutlich besser als Leicht', () => {
    const e = { geloest: true, sekunden: 60, fehler: 0, tipps: 0 }
    expect(berechnePunkte(101, e)).toBeGreaterThan(berechnePunkte(51, e) + 200)
    expect(berechnePunkte(51, e)).toBeGreaterThan(berechnePunkte(1, e) + 200)
    expect(xpFuer(101, berechnePunkte(101, e))).toBeGreaterThan(2 * xpFuer(1, berechnePunkte(1, e)))
  })

  it('zieht für Fehler und Tipps ab, bleibt aber über null', () => {
    const sauber = werte(20, { geloest: true, sekunden: 60, fehler: 0, tipps: 0 })
    const fehler = werte(20, { geloest: true, sekunden: 60, fehler: 2, tipps: 0 })
    const tipps = werte(20, { geloest: true, sekunden: 60, fehler: 0, tipps: 1 })
    expect(sauber.punkte - fehler.punkte).toBe(2 * KOSTEN_FEHLER)
    expect(sauber.punkte - tipps.punkte).toBe(KOSTEN_TIPP)
    expect(sauber.sterne).toBe(5)
    expect(fehler.sterne).toBeLessThan(5)
    const schlimm = werte(20, { geloest: true, sekunden: 99999, fehler: 50, tipps: 50 })
    expect(schlimm.punkte).toBeGreaterThan(0)
    expect(schlimm.sterne).toBe(1)
  })

  it('gibt den Zeitbonus bis zur Richtzeit voll und danach schmelzend', () => {
    const richt = RICHTZEIT.schwer
    const schnell = werte(120, { geloest: true, sekunden: richt, fehler: 0, tipps: 0 })
    const langsam = werte(120, { geloest: true, sekunden: richt * 1.5, fehler: 0, tipps: 0 })
    const ewig = werte(120, { geloest: true, sekunden: richt * 3, fehler: 0, tipps: 0 })
    expect(schnell.zeitBonus).toBe(300)
    expect(langsam.zeitBonus).toBe(150)
    expect(ewig.zeitBonus).toBe(0)
    // Auch der Langsame bekommt noch vier Sterne -- Gründlichkeit ist kein Fehler.
    expect(ewig.sterne).toBeGreaterThanOrEqual(3)
    expect(sterneFuer(120, 0)).toBe(0)
  })
})

describe('Fortschritt', () => {
  beforeEach(() => loescheStand())

  it('öffnet je Stufe getrennt', () => {
    expect(istOffen(1)).toBe(true)
    expect(istOffen(2)).toBe(false)
    expect(istOffen(51)).toBe(true)
    expect(istOffen(101)).toBe(true)
    merkeAbschluss({ nr: 101, sekunden: 600, punkte: 900, sterne: 4 })
    expect(istOffen(102)).toBe(true)
    expect(istOffen(2)).toBe(false)
    expect(geloeste('schwer')).toBe(1)
    expect(geloeste('leicht')).toBe(0)
    expect(leseStand().frei.schwer).toBe(2)
  })

  it('behält die beste Zeit und die besten Punkte', () => {
    merkeAbschluss({ nr: 5, sekunden: 300, punkte: 500, sterne: 3 })
    merkeAbschluss({ nr: 5, sekunden: 200, punkte: 450, sterne: 2 })
    const s = leseStand().level['5']!
    expect(s.besteZeit).toBe(200)
    expect(s.bestePunkte).toBe(500)
    expect(s.sterne).toBe(3)
  })

  it('merkt sich eine angefangene Partie und vergisst sie nach dem Lösen', () => {
    const p = {
      nr: 7,
      werte: '.'.repeat(81),
      notizen: new Array(81).fill(0),
      sekunden: 42,
      fehler: 1,
      tipps: 0,
    }
    merkePartie(p)
    expect(lesePartie(7)?.sekunden).toBe(42)
    merkeAbschluss({ nr: 7, sekunden: 100, punkte: 400, sterne: 3 })
    expect(lesePartie(7)).toBeNull()
    merkePartie(p)
    vergissPartie(7)
    expect(lesePartie(7)).toBeNull()
  })
})
