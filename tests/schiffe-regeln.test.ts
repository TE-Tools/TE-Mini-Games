/**
 * Schiffe versenken: Aufstellen (mit und ohne „nicht berühren"), Schüsse,
 * versenkt, Ende, Extraschuss, und was ein Spieler sehen darf.
 */
import { describe, it, expect } from 'vitest'
import {
  FLOTTE,
  STANDARD_REGELN,
  feldName,
  feldVon,
  felderVon,
  feldFolge,
  flottenFehler,
  gedreht,
  gibAuf,
  neuePartie,
  partieAusZuegen,
  platzFehler,
  regelnAus,
  schiesse,
  sichtFuer,
  zufallsFlotte,
  type Partie,
  type Schiff,
  type SchiffeRegeln,
} from '@/games/schiffe-versenken'
import { mulberry32 } from '@/games/rng'

const OHNE_ABSTAND: SchiffeRegeln = { nichtBeruehren: false, nochmalNachTreffer: false }

/** Eine feste Aufstellung: jedes Schiff waagrecht in seiner eigenen Reihe, jede zweite Reihe. */
function reihenFlotte(): Schiff[] {
  return FLOTTE.map((a, i) => ({ id: a.id, laenge: a.laenge, x: 0, y: i * 2, richtung: 'h' }))
}

function partie(regeln: SchiffeRegeln = STANDARD_REGELN): Partie {
  return neuePartie(regeln, reihenFlotte(), reihenFlotte(), 0)
}

/** Schüsse der Reihe nach; wirft, wenn einer nicht geht. */
function spiele(p: Partie, ...felder: number[]): Partie {
  return felder.reduce((q, f) => {
    const n = schiesse(q, f)
    if (!n) throw new Error(`Schuss auf ${feldName(f)} ging nicht`)
    return n
  }, p)
}

describe('Felder', () => {
  it('zählt Spalte und Reihe, nennt Felder wie auf dem Karopapier', () => {
    expect(feldVon(0, 0)).toBe(0)
    expect(feldVon(9, 9)).toBe(99)
    expect(feldName(feldVon(1, 6))).toBe('B7')
    expect(felderVon({ x: 2, y: 3, laenge: 3, richtung: 'v' })).toEqual([32, 42, 52])
  })
})

describe('Aufstellen', () => {
  it('nimmt eine gültige Flotte an', () => {
    expect(flottenFehler(reihenFlotte(), STANDARD_REGELN)).toBeNull()
  })

  it('verlangt genau die Schiffe der Flotte', () => {
    const f = reihenFlotte()
    expect(flottenFehler(f.slice(1), STANDARD_REGELN)).toBe('flotte')
    expect(flottenFehler([...f.slice(1), { ...f[1]! }], STANDARD_REGELN)).toBe('flotte')
    expect(flottenFehler([{ ...f[0]!, laenge: 4 }, ...f.slice(1)], STANDARD_REGELN)).toBe('flotte')
    expect(flottenFehler('Unsinn', STANDARD_REGELN)).toBe('flotte')
  })

  it('kein Schiff ragt hinaus', () => {
    const f = reihenFlotte()
    f[0] = { ...f[0]!, x: 6 }
    expect(flottenFehler(f, STANDARD_REGELN)).toBe('ausserhalb')
    f[0] = { ...f[0]!, x: 0, y: 6, richtung: 'v' }
    expect(flottenFehler(f, STANDARD_REGELN)).toBe('ausserhalb')
    f[0] = { ...f[0]!, x: 1.5, y: 0, richtung: 'h' }
    expect(flottenFehler(f, STANDARD_REGELN)).toBe('ausserhalb')
  })

  it('zwei Schiffe teilen kein Feld', () => {
    const f = reihenFlotte()
    f[1] = { ...f[1]!, y: 0, x: 3 }
    expect(flottenFehler(f, OHNE_ABSTAND)).toBe('ueberlappt')
  })

  it('„nicht berühren": auch nicht über Eck -- abschaltbar', () => {
    const f = reihenFlotte()
    // Kreuzer direkt unter den Träger (Reihe 1 statt 2): Rumpf an Rumpf.
    f[1] = { ...f[1]!, y: 1 }
    expect(flottenFehler(f, STANDARD_REGELN)).toBe('beruehrt')
    expect(flottenFehler(f, OHNE_ABSTAND)).toBeNull()
    // Über Eck: Schnellboot senkrecht genau diagonal ans Heck des Trägers (A1–E1).
    const g = reihenFlotte()
    g[4] = { ...g[4]!, x: 5, y: 1, richtung: 'v' }
    g[1] = { ...g[1]!, y: 4, x: 6 }
    expect(platzFehler(g, g[4]!, STANDARD_REGELN)).toBe('beruehrt')
    expect(platzFehler(g, g[4]!, OHNE_ABSTAND)).toBeNull()
    // Ein Feld Wasser dazwischen genügt.
    expect(platzFehler(g, { ...g[4]!, x: 6 }, STANDARD_REGELN)).toBeNull()
  })

  it('zufällige Flotten gelten immer, mit beiden Regeln', () => {
    const zufall = mulberry32(7)
    for (let i = 0; i < 300; i++) {
      const regeln = i % 2 ? STANDARD_REGELN : OHNE_ABSTAND
      expect(flottenFehler(zufallsFlotte(regeln, zufall), regeln)).toBeNull()
    }
  })

  it('drehen bleibt im Meer', () => {
    const s: Schiff = { id: 'traeger', laenge: 5, x: 5, y: 9, richtung: 'h' }
    const d = gedreht(s)
    expect(d.richtung).toBe('v')
    expect(platzFehler([], d, STANDARD_REGELN)).toBeNull()
    expect(gedreht(d).richtung).toBe('h')
  })

  it('Regeln aus kaputter Quelle fallen auf die Voreinstellung', () => {
    expect(regelnAus(null)).toEqual(STANDARD_REGELN)
    expect(regelnAus({ nochmalNachTreffer: true, nichtBeruehren: 'ja' })).toEqual({
      nichtBeruehren: true,
      nochmalNachTreffer: true,
    })
  })
})

describe('Schießen', () => {
  it('Wasser, Treffer, versenkt -- und danach ist der andere dran', () => {
    let p = partie()
    p = spiele(p, feldVon(9, 9))
    expect(p.schuesse[0]).toEqual([{ feld: 99, ergebnis: 'wasser' }])
    expect(p.amZug).toBe(1)
    // Spieler 1 trifft das Schnellboot (Reihe 9, A und B).
    p = spiele(p, feldVon(0, 8))
    expect(p.schuesse[1].at(-1)).toEqual({ feld: 80, ergebnis: 'treffer' })
    p = spiele(p, feldVon(9, 8))
    p = spiele(p, feldVon(1, 8))
    expect(p.schuesse[1].at(-1)).toEqual({ feld: 81, ergebnis: 'versenkt', schiff: 'schnellboot' })
    expect(p.amZug).toBe(0)
  })

  it('ein Feld nur einmal, und nicht außerhalb', () => {
    let p = spiele(partie(), 5)
    p = spiele(p, 50)
    expect(schiesse(p, 5)).toBeNull()
    expect(schiesse(p, 100)).toBeNull()
    expect(schiesse(p, -1)).toBeNull()
    expect(schiesse(p, 2.5)).toBeNull()
    // Spieler 1 darf dasselbe Feld beschießen -- es ist ein anderes Meer.
    expect(schiesse(spiele(partie(), 99), 99)).not.toBeNull()
  })

  it('„Nach einem Treffer noch einmal": wer trifft, bleibt dran', () => {
    let p = partie({ nichtBeruehren: true, nochmalNachTreffer: true })
    p = spiele(p, 0)
    expect(p.amZug).toBe(0)
    p = spiele(p, 1, 99)
    expect(p.amZug).toBe(1)
  })

  it('wer die letzte Flotte versenkt, gewinnt; danach geht nichts mehr', () => {
    const alle = reihenFlotte().flatMap((s) => felderVon(s))
    const wasser = Array.from({ length: 100 }, (_, i) => i).filter((f) => !alle.includes(f))
    let p = partie()
    alle.forEach((f, i) => {
      p = i < alle.length - 1 ? spiele(p, f, wasser[i]!) : spiele(p, f)
    })
    // Der letzte Schuss von Spieler 0 hat versenkt -- Spieler 1 kam nicht mehr dran.
    expect(p.ende).toEqual({ art: 'versenkt', sieger: 0 })
    expect(p.schuesse[0]).toHaveLength(17)
    expect(p.schuesse[1]).toHaveLength(16)
    expect(schiesse(p, 98)).toBeNull()
  })

  it('aufgeben', () => {
    const p = gibAuf(partie(), 0)
    expect(p.ende).toEqual({ art: 'aufgabe', sieger: 1 })
    expect(gibAuf(p, 1)).toBe(p)
    expect(schiesse(p, 50)).toBeNull()
  })

  it('eine Partie ist ein unveränderlicher Wert', () => {
    const p = partie()
    const vorher = JSON.stringify(p)
    spiele(p, 0)
    expect(JSON.stringify(p)).toBe(vorher)
  })

  it('lässt sich aus den Feldern nachspielen', () => {
    const regeln = { nichtBeruehren: true, nochmalNachTreffer: true }
    const p = spiele(partie(regeln), 0, 1, 99, 98, 2, 50)
    const folge = feldFolge(p, 0)
    expect(folge).toEqual([0, 1, 99, 98, 2, 50])
    expect(partieAusZuegen(regeln, p.flotten, 0, folge)).toEqual(p)
    expect(partieAusZuegen(regeln, p.flotten, 0, [0, 0])).toBeNull()
  })
})

describe('Was jeder sieht', () => {
  it('die fremde Flotte nur, soweit sie versenkt ist -- ganz erst am Ende', () => {
    let p = partie()
    let sicht = sichtFuer(p, 0)
    expect(sicht.eigeneFlotte).toHaveLength(5)
    expect(sicht.gegnerFlotte).toEqual([])
    // Spieler 0 versenkt das Schnellboot von Spieler 1, trifft den Träger an.
    p = spiele(p, 80, 99, 81, 98, 0)
    sicht = sichtFuer(p, 0)
    expect(sicht.gegnerFlotte.map((s) => s.id)).toEqual(['schnellboot'])
    expect(sicht.eigeneSchuesse.map((s) => s.ergebnis)).toEqual(['treffer', 'versenkt', 'treffer'])
    expect(sicht.gegnerSchuesse.map((s) => s.ergebnis)).toEqual(['wasser', 'wasser'])
    // Spieler 1 sieht von der Flotte von Spieler 0 nichts.
    expect(sichtFuer(p, 1).gegnerFlotte).toEqual([])
    // Nach der Aufgabe liegt alles offen.
    expect(sichtFuer(gibAuf(p, 1), 0).gegnerFlotte).toHaveLength(5)
  })
})
