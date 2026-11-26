/**
 * Dame online: Das Zugbuch wird durch dieselbe Engine nachgespielt -- mit
 * den Hausregeln des Tisches. Ein unmöglicher Zug kostet den, der ihn
 * geschickt hat, die Partie.
 */
import { describe, it, expect } from 'vitest'
import {
  STANDARD_REGELN,
  farbeVon,
  standAus,
  type DameAktion,
  type DameEintrag,
} from '@/games/dame'

/** Sitz 1 spielt Weiß. */
function buch(...eintraege: [number, DameAktion][]): DameEintrag[] {
  return eintraege.map(([seat, aktion], i) => ({ nr: i + 1, seat, aktion }))
}
const zug = (z: string): DameAktion => ({ art: 'zug', zug: z })

describe('Dame-Zugbuch', () => {
  it('spielt Züge nach, auch in falscher Reihenfolge geliefert', () => {
    const b = buch([1, zug('c3-d4')], [2, zug('f6-e5')], [1, zug('d4xf6')])
    const stand = standAus(1, STANDARD_REGELN, [...b].reverse())
    expect(stand.partie.zuege).toEqual(['c3-d4', 'f6-e5', 'd4xf6'])
    expect(stand.partie.stellung.amZug).toBe('b')
    expect(stand.partie.ende).toBeNull()
  })

  it('Weiß kann auch Sitz 2 sein', () => {
    expect(farbeVon(2, 2)).toBe('w')
    expect(farbeVon(1, 2)).toBe('b')
    const stand = standAus(2, STANDARD_REGELN, buch([2, zug('c3-d4')]))
    expect(stand.partie.zuege).toEqual(['c3-d4'])
  })

  it('ein unmöglicher Zug verliert die Partie', () => {
    // Weiß müsste schlagen (Schlagzwang) und zieht still.
    const b = buch([1, zug('c3-d4')], [2, zug('f6-e5')], [1, zug('g3-h4')])
    const stand = standAus(1, STANDARD_REGELN, b)
    expect(stand.partie.ende).toEqual({ art: 'ungueltiger-zug', sieger: 'b' })
    // Danach zählt nichts mehr.
    const weiter = standAus(1, STANDARD_REGELN, [...b, { nr: 4, seat: 2, aktion: zug('e5xc3') }])
    expect(weiter.partie.zuege).toEqual(['c3-d4', 'f6-e5'])
  })

  it('derselbe Zug ist unter anderen Hausregeln erlaubt', () => {
    const b = buch([1, zug('c3-d4')], [2, zug('f6-e5')], [1, zug('g3-h4')])
    const frei = standAus(1, { ...STANDARD_REGELN, schlagzwang: false }, b)
    expect(frei.partie.ende).toBeNull()
    expect(frei.partie.zuege).toHaveLength(3)
    expect(frei.partie.regeln.schlagzwang).toBe(false)
  })

  it('ein Zug außer der Reihe bleibt liegen, Unsinn verliert', () => {
    const stand = standAus(1, STANDARD_REGELN, buch([2, zug('f6-e5')]))
    expect(stand.partie.zuege).toEqual([])
    expect(stand.partie.ende).toBeNull()
    const unsinn = standAus(1, STANDARD_REGELN, buch([1, zug('zz')]))
    expect(unsinn.partie.ende).toEqual({ art: 'ungueltiger-zug', sieger: 'b' })
  })

  it('Remis anbieten, ablehnen durch Ziehen, annehmen', () => {
    let stand = standAus(1, STANDARD_REGELN, buch([1, { art: 'remis_anbieten' }]))
    expect(stand.remisAngebot).toBe('w')
    // Schwarz zieht, statt anzunehmen: Das Angebot ist vom Tisch.
    stand = standAus(
      1,
      STANDARD_REGELN,
      buch([1, zug('c3-d4')], [1, { art: 'remis_anbieten' }], [2, zug('f6-g5')]),
    )
    expect(stand.remisAngebot).toBeNull()
    // Wer anbietet, kann nicht selbst annehmen.
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
    const stand = standAus(1, STANDARD_REGELN, buch([1, zug('c3-d4')], [1, { art: 'aufgeben' }]))
    expect(stand.partie.ende).toEqual({ art: 'aufgabe', sieger: 'b' })
  })
})
