/**
 * Käsekästchen: der Computer. Er ist rein und bekommt seinen Zufall von
 * außen -- deshalb lässt sich hier Linie für Linie prüfen, was er zieht.
 */
import { describe, it, expect } from 'vitest'
import {
  ausgangFuer,
  endspielWert,
  neuePartie,
  partieAus,
  seitenZahl,
  waehleLinie,
  zufallAus,
  ziehe,
  type KaestchenStufe,
  type Partie,
} from '@/games/kaesekaestchen'

const ALLE: KaestchenStufe[] = ['leicht', 'mittel', 'schwer']
const bereich = (von: number, bis: number) =>
  Array.from({ length: bis - von + 1 }, (_, i) => von + i)

function frage(
  breite: number,
  hoehe: number,
  gezogen: number[],
  stufe: KaestchenStufe,
  seed = 1,
  zufall?: () => number,
) {
  return waehleLinie({ breite, hoehe, gezogen, stufe, seed }, zufall)
}

/** Gibt die Linie einem Kästchen die dritte Seite? */
function gibtDritte(p: Partie, linie: number): boolean {
  return p.raster.kaestchenAn[linie]!.some((k) => seitenZahl(p, k) === 2)
}

/** Eine ganze Partie Computer gegen Computer. */
function partie(breite: number, hoehe: number, a: KaestchenStufe, b: KaestchenStufe, seed: number) {
  let p = neuePartie(breite, hoehe, 2, seed % 2)
  let n = 0
  while (!p.vorbei) {
    const stufe = p.amZug === 0 ? a : b
    const gezogen = p.zuege.map((z) => z.linie)
    const l = waehleLinie({ breite, hoehe, gezogen, stufe, seed: seed * 1000 + n++ })
    expect(l).not.toBeNull()
    p = ziehe(p, l!)!
    expect(p).not.toBeNull()
  }
  return p
}

describe('Käsekästchen-Rechner: Grundsätzliches', () => {
  it('zieht eine freie Linie, und ohne freie Linie nichts', () => {
    for (const stufe of ALLE) {
      const l = frage(3, 3, [0, 1, 2], stufe)
      expect(l).not.toBeNull()
      expect([0, 1, 2]).not.toContain(l)
    }
    expect(frage(2, 2, bereich(0, 11), 'schwer')).toBeNull()
  })

  it('ist mit demselben Startwert und demselben Zufall immer gleich', () => {
    const gezogen = [0, 5, 13, 20]
    for (const stufe of ALLE) {
      expect(frage(4, 4, gezogen, stufe, 7)).toBe(frage(4, 4, gezogen, stufe, 7))
    }
    const r1 = zufallAus(42)
    const r2 = zufallAus(42)
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()])
  })
})

describe('Käsekästchen-Rechner: nimmt, was offen liegt', () => {
  // Kästchen 0 hat drei Seiten (0, 2, 6); Linie 7 schließt es.
  const offen = [0, 2, 6]

  it('nimmt ein freies Kästchen -- mittel und schwer immer', () => {
    for (let seed = 1; seed <= 20; seed++) {
      expect(frage(2, 2, offen, 'mittel', seed)).toBe(7)
      expect(frage(2, 2, offen, 'schwer', seed)).toBe(7)
    }
  })

  it('leicht nimmt es nur manchmal', () => {
    // Zufall 0: nimmt. Zufall knapp unter 1: lässt es liegen.
    expect(frage(2, 2, offen, 'leicht', 1, () => 0)).toBe(7)
    const nimmtNicht = frage(2, 2, offen, 'leicht', 1, () => 0.99)
    expect(nimmtNicht).not.toBe(7)
  })
})

describe('Käsekästchen-Rechner: gibt keine dritte Seite her', () => {
  it('mittel und schwer ziehen eine sichere Linie, solange es eine gibt', () => {
    // 4×4, einige Kästchen schon mit zwei Seiten -- sichere Linien gibt es noch.
    const gezogen = [0, 20, 5, 26, 10, 31, 15, 37]
    const p = partieAus(4, 4, 2, gezogen)
    for (const stufe of ['mittel', 'schwer'] as const) {
      for (let seed = 1; seed <= 30; seed++) {
        const l = frage(4, 4, gezogen, stufe, seed)!
        expect(gibtDritte(p, l), `${stufe}, Startwert ${seed}: Linie ${l}`).toBe(false)
      }
    }
  })

  it('leicht gibt sie dagegen auch einmal her', () => {
    const gezogen = [0, 6]
    const p = partieAus(2, 2, 2, gezogen)
    const linien = new Set(bereich(1, 60).map((seed) => frage(2, 2, gezogen, 'leicht', seed)!))
    expect([...linien].some((l) => gibtDritte(p, l))).toBe(true)
  })

  /*
   * 3×3, alle waagrechten Linien der oberen drei Reihen gezogen, dazu 21
   * und 23. Es bleiben: zwei Dreierketten (oben, Mitte), unten links ein
   * einzelnes Kästchen (frei: 9, 20) und rechts daneben eine Zweierkette
   * (frei: 10, 22, 11). Jede freie Linie gibt etwas her.
   */
  const endspiel = [0, 1, 2, 3, 4, 5, 6, 7, 8, 21, 23]

  it('opfert im Endspiel das Wenigste: das einzelne Kästchen', () => {
    for (let seed = 1; seed <= 20; seed++) {
      expect([9, 20]).toContain(frage(3, 3, endspiel, 'mittel', seed))
      expect([9, 20]).toContain(frage(3, 3, endspiel, 'schwer', seed))
    }
  })
})

describe('Käsekästchen-Rechner: schwer zählt Ketten', () => {
  it('bewertet Ketten und Ringe wie in der Theorie', () => {
    // Eine lange Kette: alles für den, der die Kontrolle hat.
    expect(endspielWert([{ ring: false, n: 3 }])).toBe(3)
    // Zwei Dreierketten: Doppelkreuz in der ersten (3 - 4 + 3).
    expect(
      endspielWert([
        { ring: false, n: 3 },
        { ring: false, n: 3 },
      ]),
    ).toBe(2)
    // Eine Zweierkette öffnet man in der Mitte -- kein Doppelkreuz möglich.
    expect(
      endspielWert([
        { ring: false, n: 2 },
        { ring: false, n: 3 },
      ]),
    ).toBe(-1)
    // Ein Viererring kostet beim Doppelkreuz vier.
    expect(endspielWert([{ ring: true, n: 4 }])).toBe(4)
  })

  /*
   * 3×2, alle waagrechten Linien gezogen: zwei Dreierketten, oben und
   * unten. Der Gegner hat die obere links geöffnet (Linie 9).
   */
  const geoeffnet = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

  it('frisst die geschenkte Kette -- und lässt die letzten zwei liegen (Doppelkreuz)', () => {
    expect(frage(3, 2, geoeffnet, 'schwer')).toBe(10)
    // Jetzt hängt Kästchen 1 (drei Seiten) an Kästchen 2: Statt zu nehmen,
    // zieht er die äußere Linie 12. Der Gegner bekommt zwei Kästchen und
    // muss danach die untere Kette öffnen -- die bringt drei.
    expect(frage(3, 2, [...geoeffnet, 10], 'schwer')).toBe(12)
    // Mittel nimmt einfach alles.
    expect(frage(3, 2, [...geoeffnet, 10], 'mittel')).toBe(11)
  })

  it('zu dritt kein Doppelkreuz: Die Kette ginge an den Übernächsten', () => {
    const auftrag = { breite: 3, hoehe: 2, gezogen: [...geoeffnet, 10], stufe: 'schwer' as const }
    expect(waehleLinie({ ...auftrag, seed: 1, spielerZahl: 3 })).toBe(11)
    expect(waehleLinie({ ...auftrag, seed: 1, spielerZahl: 2 })).toBe(12)
  })

  it('spielt zu viert eine ganze Partie bis zum Ende', () => {
    let p = neuePartie(4, 4, 4)
    let n = 0
    while (!p.vorbei) {
      const l = waehleLinie({
        breite: 4,
        hoehe: 4,
        gezogen: p.zuege.map((z) => z.linie),
        stufe: ALLE[p.amZug % 3]!,
        seed: n++,
        spielerZahl: 4,
      })
      p = ziehe(p, l!)!
    }
    expect(p.punkte.reduce((a, b) => a + b, 0)).toBe(16)
  })

  it('nimmt alles, wenn danach nichts mehr kommt', () => {
    // Die untere Reihe ist schon zu: Liegenlassen brächte nichts.
    expect(frage(3, 2, [...geoeffnet, 13, 14, 15, 16, 10], 'schwer')).toBe(11)
  })

  it('gewinnt gegen mittel und leicht die meisten Partien', () => {
    let gegenMittel = 0
    let gegenLeicht = 0
    const runden = 12
    for (let seed = 1; seed <= runden; seed++) {
      if (ausgangFuer(partie(4, 4, 'schwer', 'mittel', seed), 0) === 'sieg') gegenMittel++
      if (ausgangFuer(partie(4, 4, 'schwer', 'leicht', seed), 0) === 'sieg') gegenLeicht++
    }
    expect(gegenLeicht).toBeGreaterThanOrEqual(runden - 1)
    expect(gegenMittel).toBeGreaterThan(runden / 2)
  })

  it('ist auch auf dem größten Blatt schnell genug fürs Handy', () => {
    const start = performance.now()
    const p = partie(6, 6, 'schwer', 'schwer', 3)
    expect(p.vorbei).toBe(true)
    // Eine ganze Partie, beide Seiten schwer: weit unter einer Sekunde je Zug.
    expect(performance.now() - start).toBeLessThan(15000)
  })
})
