/**
 * Mühle online: Das Zugbuch wird durch dieselbe Engine nachgespielt -- mit
 * den Hausregeln des Tisches. Ein Zug samt Schlag ist ein Eintrag; ein
 * unmöglicher Zug kostet den, der ihn geschickt hat, die Partie.
 */
import { describe, it, expect } from 'vitest'
import {
  STANDARD_REGELN,
  farbeVon,
  standAus,
  type MuehleAktion,
  type MuehleEintrag,
} from '@/games/muehle'

/** Sitz 1 spielt Weiß, wenn nicht anders gesagt. */
function buch(...eintraege: [number, MuehleAktion][]): MuehleEintrag[] {
  return eintraege.map(([seat, aktion], i) => ({ nr: i + 1, seat, aktion }))
}
const zug = (z: string): MuehleAktion => ({ art: 'zug', zug: z })

describe('Mühle-Zugbuch', () => {
  it('spielt Züge nach, auch in falscher Reihenfolge geliefert', () => {
    const b = buch(
      [1, zug('a1')],
      [2, zug('b2')],
      [1, zug('d1')],
      [2, zug('b4')],
      [1, zug('g1xb2')],
    )
    const stand = standAus(1, STANDARD_REGELN, [...b].reverse())
    expect(stand.partie.zuege).toEqual(['a1', 'b2', 'd1', 'b4', 'g1xb2'])
    expect(stand.partie.stellung.amZug).toBe('b')
    expect(stand.partie.stellung.hand).toEqual({ w: 6, b: 7 })
    expect(stand.partie.ende).toBeNull()
  })

  it('Weiß kann auch Sitz 2 sein', () => {
    expect(farbeVon(2, 2)).toBe('w')
    expect(farbeVon(1, 2)).toBe('b')
    const stand = standAus(2, STANDARD_REGELN, buch([2, zug('d2')]))
    expect(stand.partie.zuege).toEqual(['d2'])
  })

  it('ein Zug, der die Mühle schließt, aber nicht schlägt, verliert die Partie', () => {
    const b = buch([1, zug('a1')], [2, zug('b2')], [1, zug('d1')], [2, zug('b4')], [1, zug('g1')])
    const stand = standAus(1, STANDARD_REGELN, b)
    expect(stand.partie.ende).toEqual({ art: 'ungueltiger-zug', sieger: 'b' })
    // Danach zählt nichts mehr.
    const weiter = standAus(1, STANDARD_REGELN, [...b, { nr: 6, seat: 2, aktion: zug('c3') }])
    expect(weiter.partie.zuege).toEqual(['a1', 'b2', 'd1', 'b4'])
  })

  it('auf einen besetzten Punkt setzen verliert, Unsinn auch', () => {
    const besetzt = standAus(1, STANDARD_REGELN, buch([1, zug('a1')], [2, zug('a1')]))
    expect(besetzt.partie.ende).toEqual({ art: 'ungueltiger-zug', sieger: 'w' })
    const unsinn = standAus(1, STANDARD_REGELN, buch([1, zug('h9')]))
    expect(unsinn.partie.ende).toEqual({ art: 'ungueltiger-zug', sieger: 'b' })
  })

  it('derselbe Schlag ist unter anderen Hausregeln erlaubt', () => {
    // Schwarz hat eine Mühle (b2-b4-b6) und einen freien Stein (g7).
    const vorher: [number, MuehleAktion][] = [
      [1, zug('a1')],
      [2, zug('b2')],
      [1, zug('d1')],
      [2, zug('b4')],
      [1, zug('c3')],
      [2, zug('b6xc3')],
      [1, zug('e4')],
      [2, zug('g7')],
    ]
    const b = buch(...vorher, [1, zug('g1xb4')])
    expect(standAus(1, STANDARD_REGELN, b).partie.ende?.art).toBe('ungueltiger-zug')
    const frei = standAus(1, { ...STANDARD_REGELN, schlagenAusMuehle: true }, b)
    expect(frei.partie.ende).toBeNull()
    expect(frei.partie.zuege).toHaveLength(9)
    expect(frei.partie.regeln.schlagenAusMuehle).toBe(true)
  })

  it('ein Zug außer der Reihe bleibt liegen', () => {
    const stand = standAus(1, STANDARD_REGELN, buch([2, zug('d2')]))
    expect(stand.partie.zuege).toEqual([])
    expect(stand.partie.ende).toBeNull()
  })

  it('Remis anbieten, ablehnen durch Ziehen, annehmen', () => {
    let stand = standAus(1, STANDARD_REGELN, buch([1, { art: 'remis_anbieten' }]))
    expect(stand.remisAngebot).toBe('w')
    stand = standAus(
      1,
      STANDARD_REGELN,
      buch([1, zug('d2')], [1, { art: 'remis_anbieten' }], [2, zug('d6')]),
    )
    expect(stand.remisAngebot).toBeNull()
    stand = standAus(
      1,
      STANDARD_REGELN,
      buch([1, { art: 'remis_anbieten' }], [1, { art: 'remis_annehmen' }]),
    )
    expect(stand.partie.ende).toBeNull()
    stand = standAus(
      1,
      STANDARD_REGELN,
      buch([1, { art: 'remis_anbieten' }], [2, { art: 'remis_annehmen' }]),
    )
    expect(stand.partie.ende).toEqual({ art: 'remis-vereinbart', sieger: null })
  })

  it('Aufgeben geht jederzeit', () => {
    const stand = standAus(1, STANDARD_REGELN, buch([1, zug('d2')], [1, { art: 'aufgeben' }]))
    expect(stand.partie.ende).toEqual({ art: 'aufgabe', sieger: 'b' })
  })
})
