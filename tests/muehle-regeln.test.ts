/**
 * Mühle: Brett, Setzen, Ziehen, Springen, Mühle und Schlagen samt Schutz
 * der Mühlensteine, die Hausregeln, Ende und Remis.
 */
import { describe, it, expect } from 'vitest'
import {
  FELDER,
  MUEHLEN,
  NACHBARN,
  STANDARD_REGELN,
  alsText,
  ausText,
  bestand,
  erlaubteZuege,
  feldAus,
  grundstellung,
  kurz,
  neuePartie,
  partieAus,
  phaseJetzt,
  regelnAus,
  schlagbar,
  schluessel,
  stellungAus,
  zieheIn,
  zuegeJetzt,
  type MuehleRegeln,
  type Partie,
  type Stellung,
} from '@/games/muehle'

const R = STANDARD_REGELN
const kurzListe = (s: Stellung, r: MuehleRegeln = R) => erlaubteZuege(s, r).map(kurz).sort()
const namen = (felder: number[]) => felder.map((f) => FELDER[f]).sort()

function spiele(p: Partie, ...zuege: string[]): Partie {
  for (const z of zuege) {
    const weiter = zieheIn(p, z)
    if (!weiter) throw new Error(`Zug ${z} geht nicht (nach ${p.zuege.join(' ')})`)
    p = weiter
  }
  return p
}

describe('Mühle: das Brett', () => {
  it('hat 24 Punkte, 16 Linien und 32 Verbindungen', () => {
    expect(FELDER).toHaveLength(24)
    expect(MUEHLEN).toHaveLength(16)
    const kanten = NACHBARN.reduce((n, l) => n + l.length, 0) / 2
    expect(kanten).toBe(32)
    // Jeder Punkt liegt auf genau zwei Linien.
    for (let f = 0; f < 24; f++) expect(MUEHLEN.filter((m) => m.includes(f))).toHaveLength(2)
  })

  it('die vier Kreuzungen haben vier Nachbarn, die Ecken zwei', () => {
    const vier = FELDER.filter((_, f) => NACHBARN[f]!.length === 4)
    expect([...vier].sort()).toEqual(['b4', 'd2', 'd6', 'f4'])
    expect(namen([...NACHBARN[feldAus('a1')]!])).toEqual(['a4', 'd1'])
    expect(namen([...NACHBARN[feldAus('d3')]!])).toEqual(['c3', 'd2', 'e3'])
  })

  it('Text hin und zurück ergibt dieselbe Stellung', () => {
    const p = spiele(neuePartie(), 'a1', 'g7', 'd1')
    expect(ausText(alsText(p.stellung))).toEqual(p.stellung)
  })
})

describe('Mühle: Setzen', () => {
  it('Weiß beginnt, jeder hat neun Steine in der Hand, gesetzt wird auf jeden freien Punkt', () => {
    const p = neuePartie()
    expect(p.stellung.amZug).toBe('w')
    expect(p.stellung.hand).toEqual({ w: 9, b: 9 })
    expect(phaseJetzt(p)).toBe('setzen')
    expect(zuegeJetzt(p)).toHaveLength(24)
    const q = spiele(p, 'd2')
    expect(q.stellung.hand).toEqual({ w: 8, b: 9 })
    expect(zuegeJetzt(q)).toHaveLength(23)
    expect(zieheIn(q, 'd2')).toBeNull()
  })

  it('nach achtzehn Steinen beginnt das Ziehen', () => {
    // Abwechselnd so, dass niemand eine Mühle schließt.
    const reihe = ['a1', 'd1', 'b2', 'g1', 'd2', 'f2', 'c3', 'd3', 'a4', 'e3']
    const p = spiele(neuePartie(), ...reihe, 'g4', 'b4', 'f4', 'c4', 'c5', 'e4', 'd6', 'f6')
    expect(p.stellung.hand).toEqual({ w: 0, b: 0 })
    expect(bestand(p, 'w')).toEqual({ brett: 9, hand: 0, verloren: 0 })
    expect(phaseJetzt(p)).toBe('ziehen')
    expect(zuegeJetzt(p).every((z) => z.von !== null)).toBe(true)
  })

  it('wer beim Setzen eine Mühle schließt, muss schlagen', () => {
    const p = spiele(neuePartie(), 'a1', 'b2', 'd1', 'b4')
    expect(zieheIn(p, 'g1')).toBeNull()
    const q = spiele(p, 'g1xb2')
    expect(q.stellung.brett[feldAus('b2')]).toBe(0)
    expect(q.letzter?.zug.muehlen).toHaveLength(1)
    expect(bestand(q, 'b')).toEqual({ brett: 1, hand: 7, verloren: 1 })
    // Die Mühle steht, eine zweite kommt erst mit dem nächsten Schließen.
    expect(q.stellung.amZug).toBe('b')
  })
})

describe('Mühle: Schlagen', () => {
  it('Steine in einer Mühle sind geschützt -- solange es andere gibt', () => {
    const s = stellungAus({ w: ['a1', 'd1'], b: ['a7', 'd7', 'g7', 'c3'] }, 'w', { w: 5, b: 5 })
    expect(kurzListe(s).filter((z) => z.startsWith('g1'))).toEqual(['g1xc3'])
    // Stehen alle in Mühlen, ist jeder zu haben.
    const alle = stellungAus({ w: ['a1', 'd1'], b: ['a7', 'd7', 'g7'] }, 'w', { w: 5, b: 5 })
    expect(kurzListe(alle).filter((z) => z.startsWith('g1'))).toEqual(['g1xa7', 'g1xd7', 'g1xg7'])
  })

  it('Hausregel: aus Mühlen schlagen ist erlaubt', () => {
    const r = { ...R, schlagenAusMuehle: true }
    const s = stellungAus({ w: ['a1', 'd1'], b: ['a7', 'd7', 'g7', 'c3'] }, 'w', { w: 5, b: 5 })
    expect(namen(schlagbar(s.brett, 'b', r))).toEqual(['a7', 'c3', 'd7', 'g7'])
    expect(kurzListe(s, r).filter((z) => z.startsWith('g1'))).toHaveLength(4)
  })

  it('eine Mühle ohne gegnerischen Stein auf dem Brett schlägt nichts', () => {
    const s = stellungAus({ w: ['a1', 'd1'] }, 'w', { w: 5, b: 7 })
    expect(kurzListe(s)).toContain('g1')
  })

  it('wer eine Mühle öffnet und wieder schließt, schlägt erneut', () => {
    const r = R
    const s = stellungAus({ w: ['a1', 'd1', 'g1', 'b6'], b: ['b4', 'c5', 'e5', 'f2'] }, 'w', {
      w: 0,
      b: 0,
    })
    let p = neuePartie(r, s)
    p = spiele(p, 'g1-g4', 'c5-c4', 'g4-g1xb4')
    expect(p.stellung.brett[feldAus('b4')]).toBe(0)
  })
})

describe('Mühle: Ziehen und Springen', () => {
  const s = stellungAus({ w: ['a1', 'd2', 'f4', 'd6'], b: ['g7', 'g1', 'a7', 'c3'] }, 'w', {
    w: 0,
    b: 0,
  })

  it('gezogen wird nur entlang der Linien auf einen freien Nachbarn', () => {
    const z = kurzListe(s)
    expect(z).toContain('a1-d1')
    expect(z).toContain('a1-a4')
    expect(z).toContain('d2-d3')
    expect(z).not.toContain('a1-g4')
    expect(z).not.toContain('d2-c3')
  })

  it('mit drei Steinen wird gesprungen -- auf jeden freien Punkt', () => {
    const drei = stellungAus({ w: ['a1', 'd2', 'f4'], b: ['g7', 'g1', 'a7', 'c3'] }, 'w')
    const p = neuePartie(R, drei)
    expect(phaseJetzt(p)).toBe('springen')
    expect(kurzListe(drei)).toContain('a1-e5')
    // 3 Steine × 17 freie Punkte.
    expect(zuegeJetzt(p)).toHaveLength(51)
  })

  it('Hausregel: ohne Springen zieht auch der Rest nur entlang der Linien', () => {
    const r = { ...R, springen: false }
    const drei = stellungAus({ w: ['a1', 'd2', 'f4'], b: ['g7', 'g1', 'a7', 'c3'] }, 'w')
    const p = neuePartie(r, drei)
    expect(phaseJetzt(p)).toBe('ziehen')
    expect(kurzListe(drei, r)).not.toContain('a1-e5')
    expect(kurzListe(drei, r)).toContain('a1-d1')
  })
})

describe('Mühle: Doppelschlag (Hausregel)', () => {
  // a4 schließt a1-a4-a7 und a4-b4-c4 zugleich.
  const s = stellungAus({ w: ['a1', 'a7', 'b4', 'c4'], b: ['g1', 'g4', 'g7', 'd6'] }, 'w', {
    w: 3,
    b: 3,
  })

  it('aus: eine doppelte Mühle schlägt einen Stein', () => {
    expect(kurzListe(s).filter((z) => z.startsWith('a4'))).toEqual(['a4xd6'])
  })

  it('an: zwei Steine, und der erste kann den Schutz aufheben', () => {
    const r = { ...R, doppelSchlag: true }
    const z = kurzListe(s, r).filter((x) => x.startsWith('a4'))
    // Erst d6 (der einzige Stein außerhalb der Mühle), dann ist die Mühle frei.
    expect(z).toEqual(['a4xd6xg1', 'a4xd6xg4', 'a4xd6xg7'])
    const p = spiele(neuePartie(r, s), 'a4xd6xg4')
    expect(bestand(p, 'b').brett).toBe(2)
  })
})

describe('Mühle: Ende und Remis', () => {
  it('wer nur noch zwei Steine hat, verliert', () => {
    const s = stellungAus({ w: ['a1', 'd1', 'g7'], b: ['b6', 'd6', 'f4', 'c3'] }, 'b')
    const p = spiele(neuePartie(R, s), 'f4-f6xa1')
    expect(p.ende).toEqual({ art: 'zwei-steine', sieger: 'b' })
    expect(zuegeJetzt(p)).toEqual([])
  })

  it('wer nicht ziehen kann, verliert', () => {
    const s = stellungAus({ w: ['a1', 'g1', 'a7', 'g7'], b: ['d1', 'a4', 'g4', 'd7', 'c3'] }, 'w')
    expect(neuePartie(R, s).ende).toEqual({ art: 'blockiert', sieger: 'b' })
  })

  it('25 Züge je Seite ohne Mühle sind Remis', () => {
    const s: Stellung = {
      ...stellungAus({ w: ['a1', 'g1', 'a7', 'b2'], b: ['g7', 'f6', 'f2', 'd5'] }, 'w'),
      ohneMuehle: 49,
    }
    const p = spiele(neuePartie(R, s), 'b2-d2')
    expect(p.ende).toEqual({ art: 'ohne-muehle', sieger: null })
  })

  it('springen beide, sind 10 Züge je Seite ohne Mühle Remis', () => {
    const s: Stellung = {
      ...stellungAus({ w: ['a1', 'g1', 'b2'], b: ['g7', 'f6', 'd5'] }, 'w'),
      ohneMuehle: 19,
    }
    const p = spiele(neuePartie(R, s), 'b2-c3')
    expect(p.ende).toEqual({ art: 'endspiel', sieger: null })
    // Springt nur einer, läuft die Partie weiter.
    const einer: Stellung = {
      ...stellungAus({ w: ['a1', 'g1', 'b2', 'e4'], b: ['g7', 'f6', 'd5'] }, 'w'),
      ohneMuehle: 19,
    }
    expect(spiele(neuePartie(R, einer), 'b2-d2').ende).toBeNull()
  })

  it('dreimal dieselbe Stellung ist Remis', () => {
    const s = stellungAus({ w: ['a1', 'g1', 'a7', 'b2'], b: ['g7', 'f6', 'f2', 'd5'] }, 'w')
    const hin = ['b2-d2', 'd5-d6', 'd2-b2', 'd6-d5']
    const p = spiele(neuePartie(R, s), ...hin)
    expect(p.ende).toBeNull()
    const q = spiele(p, ...hin)
    expect(q.ende).toEqual({ art: 'wiederholung', sieger: null })
    expect(q.verlauf.filter((k) => k === schluessel(s))).toHaveLength(3)
  })
})

describe('Mühle: Partie und Hausregeln', () => {
  it('partieAus hält beim ersten Zug an, der nicht geht', () => {
    const p = partieAus(R, ['a1', 'g7', 'a1', 'd1'])
    expect(p.zuege).toEqual(['a1', 'g7'])
  })

  it('die Partie trägt ihre Regeln mit', () => {
    const r = { ...R, springen: false }
    const p = neuePartie(r)
    r.springen = true
    expect(p.regeln.springen).toBe(false)
  })

  it('regelnAus füllt Fehlendes mit der Voreinstellung', () => {
    expect(regelnAus(null)).toEqual(R)
    expect(regelnAus({ springen: false, doppelSchlag: 'ja' })).toEqual({ ...R, springen: false })
  })

  it('die Grundstellung hat neun Steine je Seite in der Hand', () => {
    expect(grundstellung().hand).toEqual({ w: 9, b: 9 })
  })
})
