/**
 * Käsekästchen: die Regeln. Kästchen schließen, Extrazug, Ende,
 * Gleichstand -- und die Nummern der Linien, die online im Zugbuch stehen.
 *
 * Das 2×2-Blatt, an dem hier gespielt wird:
 *
 *   ·─0─·─1─·        Kästchen 0: 0, 2, 6, 7
 *   6   7   8        Kästchen 1: 1, 3, 7, 8
 *   ·─2─·─3─·        Kästchen 2: 2, 4, 9, 10
 *   9  10  11        Kästchen 3: 3, 5, 10, 11
 *   ·─4─·─5─·
 */
import { describe, it, expect } from 'vitest'
import {
  GROESSEN,
  ausgangFuer,
  groesseVon,
  kaesekaestchenGame,
  lageVon,
  naechsterNach,
  neuePartie,
  partieAus,
  partiePunkte,
  partieXp,
  raster,
  sieger,
  ziehe,
  type Partie,
} from '@/games/kaesekaestchen'

function spiele(p: Partie, ...linien: number[]): Partie {
  return linien.reduce((q, l) => {
    const weiter = ziehe(q, l)
    if (!weiter) throw new Error(`Linie ${l} ging nicht`)
    return weiter
  }, p)
}

/** Eine Partie, die 2 : 2 ausgeht (Schritt für Schritt im Test unten). */
const GLEICHSTAND = [0, 6, 2, 7, 11, 5, 10, 3, 1, 8, 4, 9]

describe('Käsekästchen: das Blatt', () => {
  it('zählt Linien und Kästchen für jede Größe', () => {
    expect(raster(2, 2).anzahlLinien).toBe(12)
    expect(raster(3, 3).anzahlLinien).toBe(24)
    expect(raster(4, 4).anzahlLinien).toBe(40)
    expect(raster(6, 6).anzahlLinien).toBe(84)
    expect(raster(5, 3).anzahlKaestchen).toBe(15)
    for (const g of Object.values(GROESSEN)) {
      const r = raster(g.breite, g.hoehe)
      // Jede Linie liegt an einem oder zwei Kästchen, jedes Kästchen hat vier.
      expect(r.kaestchenAn.every((k) => k.length === 1 || k.length === 2)).toBe(true)
      expect(r.seiten.flat().length).toBe(4 * r.anzahlKaestchen)
    }
  })

  it('nummeriert erst waagrecht, dann senkrecht -- die Nummern stehen im Zugbuch', () => {
    const r = raster(2, 2)
    expect(r.seiten).toEqual([
      [0, 2, 6, 7],
      [1, 3, 7, 8],
      [2, 4, 9, 10],
      [3, 5, 10, 11],
    ])
    expect(lageVon(r, 5)).toEqual({ art: 'waagrecht', zeile: 2, spalte: 1 })
    expect(lageVon(r, 10)).toEqual({ art: 'senkrecht', zeile: 1, spalte: 1 })
  })

  it('nimmt keine Größe außerhalb der Grenzen an', () => {
    expect(() => raster(1, 3)).toThrow()
    expect(() => raster(3, 9)).toThrow()
    expect(() => neuePartie(3, 3, 1)).toThrow()
    expect(() => neuePartie(3, 3, 5)).toThrow()
  })
})

describe('Käsekästchen: ziehen', () => {
  it('wechselt nach einer Linie, die nichts schließt, zum Nächsten', () => {
    const p = spiele(neuePartie(2, 2, 3), 0)
    expect(p.amZug).toBe(1)
    expect(spiele(p, 1, 4).amZug).toBe(0)
  })

  it('gibt das geschlossene Kästchen dem Ziehenden -- und er zieht noch einmal', () => {
    const p = spiele(neuePartie(2, 2, 2), 0, 6, 2)
    expect(p.amZug).toBe(1)
    expect(naechsterNach(p, 7)).toBe(1)
    const zu = spiele(p, 7)
    expect(zu.besitzer[0]).toBe(1)
    expect(zu.punkte).toEqual([0, 1])
    expect(zu.amZug).toBe(1)
    expect(zu.zuege.at(-1)).toEqual({ linie: 7, spieler: 1, geschlossen: [0] })
  })

  it('schließt mit einer Linie zwei Kästchen auf einmal', () => {
    // Kästchen 0 und 1 haben je drei Seiten, Linie 7 fehlt beiden.
    const p = spiele(neuePartie(2, 2, 2), 0, 1, 2, 3, 6, 8)
    const zu = spiele(p, 7)
    expect(zu.zuege.at(-1)!.geschlossen).toEqual([0, 1])
    expect(zu.punkte[p.amZug]).toBe(2)
    expect(zu.amZug).toBe(p.amZug)
  })

  it('lehnt eine gezogene oder erfundene Linie ab', () => {
    const p = spiele(neuePartie(2, 2, 2), 0)
    expect(ziehe(p, 0)).toBeNull()
    expect(ziehe(p, 12)).toBeNull()
    expect(ziehe(p, -1)).toBeNull()
    expect(ziehe(p, 1.5)).toBeNull()
  })

  it('beginnt mit dem angegebenen Spieler', () => {
    const p = neuePartie(3, 3, 4, 2)
    expect(p.amZug).toBe(2)
    expect(spiele(p, 0).amZug).toBe(3)
    expect(spiele(p, 0, 1).amZug).toBe(0)
  })
})

describe('Käsekästchen: Ende', () => {
  it('endet, wenn alle Kästchen vergeben sind -- hier mit Gleichstand', () => {
    const p = partieAus(2, 2, 2, GLEICHSTAND)
    expect(p.vorbei).toBe(true)
    expect(p.punkte).toEqual([2, 2])
    expect(p.besitzer).toEqual([1, 1, 0, 0])
    expect(sieger(p)).toEqual([0, 1])
    expect(ausgangFuer(p, 0)).toBe('remis')
    expect(ausgangFuer(p, 1)).toBe('remis')
    // Nach dem Ende geht nichts mehr.
    expect(ziehe(p, 0)).toBeNull()
  })

  it('kennt einen Sieger, solange nicht alle gleich viele haben', () => {
    // Spieler 1 nimmt alles: Nach 0, 6, 2 hat Kästchen 0 drei Seiten.
    const p = partieAus(2, 2, 2, [0, 6, 2, 1, 8, 4, 9, 5, 11, 7, 3, 10])
    expect(p.vorbei).toBe(true)
    expect(sieger(p)).toEqual([1])
    expect(ausgangFuer(p, 1)).toBe('sieg')
    expect(ausgangFuer(p, 0)).toBe('niederlage')
  })

  it('spielt eine Liste nur so weit nach, wie sie geht', () => {
    const p = partieAus(2, 2, 2, [0, 1, 1, 2])
    expect(p.zuege.map((z) => z.linie)).toEqual([0, 1])
  })

  it('meldet keinen Sieger, solange die Partie läuft', () => {
    expect(sieger(partieAus(2, 2, 2, [0, 1]))).toEqual([])
    expect(ausgangFuer(partieAus(2, 2, 2, [0, 1]), 0)).toBeNull()
  })
})

describe('Käsekästchen: Wertung', () => {
  it('zählt einen Sieg gegen einen stärkeren Gegner und auf größerem Blatt mehr', () => {
    expect(partiePunkte('sieg', 'leicht', 'mittel')).toBe(60)
    expect(partiePunkte('sieg', 'schwer', 'mittel')).toBe(240)
    expect(partiePunkte('sieg', 'schwer', 'riesig')).toBe(360)
    expect(partiePunkte('remis', 'mittel', 'mittel')).toBe(60)
    expect(partiePunkte('niederlage', 'schwer', 'riesig')).toBe(10)
    expect(partieXp(240)).toBe(60)
  })

  it('ordnet ein Blatt seiner Größe zu', () => {
    expect(groesseVon(3, 3)).toBe('klein')
    expect(groesseVon(4, 4)).toBe('mittel')
    expect(groesseVon(6, 6)).toBe('riesig')
    expect(groesseVon(2, 2)).toBe('klein')
  })

  it('rechnet in der Spieldefinition dieselben Punkte', () => {
    expect(
      kaesekaestchenGame.calculateScore(1, { ausgang: 'sieg', gegner: 'online', groesse: 'gross' }),
    ).toBe(188)
  })
})
