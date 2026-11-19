/**
 * Schach online: Das Zugbuch nachspielen.
 *
 * Der Server prüft nur, wer dran ist (Migration 031). Was ein Eintrag
 * bewirkt, entscheidet jeder Mitspieler selbst mit dieser Engine -- und
 * alle müssen zum selben Schluss kommen, auch bei Unsinn im Buch.
 */
import { describe, it, expect } from 'vitest'
import { farbeVon, standAus, type SchachAktion, type SchachEintrag } from '@/games/schach'

/** Ein Buch aus [Sitz, Aktion]-Paaren; Weiß sitzt, wo angegeben. */
function buch(...eintraege: [number, SchachAktion | string][]): SchachEintrag[] {
  return eintraege.map(([seat, a], i) => ({
    nr: i + 1,
    seat,
    aktion: typeof a === 'string' ? { art: 'zug', zug: a } : a,
  }))
}

describe('Schach online: Zugbuch', () => {
  it('ordnet die Farben den Sitzen zu', () => {
    expect([farbeVon(1, 1), farbeVon(2, 1), farbeVon(1, 2), farbeVon(2, 2)]).toEqual([
      'w',
      'b',
      'b',
      'w',
    ])
  })

  it('spielt die Züge der Reihe nach -- auch wenn sie ungeordnet ankommen', () => {
    const b = buch([2, 'e2e4'], [1, 'e7e5'], [2, 'g1f3'])
    const s = standAus(2, [b[2]!, b[0]!, b[1]!])
    expect(s.partie.notation).toEqual(['e4', 'e5', 'Nf3'])
    expect(s.partie.ende).toBeNull()
  })

  it('lässt einen Zug vom falschen Sitz liegen', () => {
    // Sitz 2 hat Schwarz und zieht zuerst -- das zählt nicht.
    const s = standAus(1, buch([2, 'e7e5'], [1, 'e2e4']))
    expect(s.partie.zuege).toEqual(['e2e4'])
  })

  it('ein unmöglicher Zug kostet die Partie -- bei jedem Mitspieler gleich', () => {
    const s = standAus(1, buch([1, 'e2e4'], [2, 'e7e4'], [1, 'd2d4']))
    expect(s.partie.ende).toEqual({ art: 'ungueltiger-zug', sieger: 'w' })
    expect(s.partie.zuege).toEqual(['e2e4'])
  })

  it('erkennt Matt aus dem Buch', () => {
    const s = standAus(1, buch([1, 'f2f3'], [2, 'e7e5'], [1, 'g2g4'], [2, 'd8h4']))
    expect(s.partie.ende).toEqual({ art: 'matt', sieger: 'b' })
  })

  it('Aufgeben geht jederzeit, auch wenn man nicht dran ist', () => {
    const s = standAus(1, buch([1, 'e2e4'], [1, { art: 'aufgeben' }]))
    expect(s.partie.ende).toEqual({ art: 'aufgabe', sieger: 'b' })
    // Danach zählt nichts mehr.
    const danach = standAus(1, buch([1, 'e2e4'], [1, { art: 'aufgeben' }], [2, 'e7e5']))
    expect(danach.partie.zuege).toEqual(['e2e4'])
  })

  it('Remis: anbieten, annehmen', () => {
    const s = standAus(
      1,
      buch([1, 'e2e4'], [1, { art: 'remis_anbieten' }], [2, { art: 'remis_annehmen' }]),
    )
    expect(s.partie.ende).toEqual({ art: 'remis-vereinbart', sieger: null })
  })

  it('Remis: das eigene Angebot kann man nicht selbst annehmen', () => {
    const s = standAus(1, buch([1, { art: 'remis_anbieten' }], [1, { art: 'remis_annehmen' }]))
    expect(s.partie.ende).toBeNull()
    expect(s.remisAngebot).toBe('w')
  })

  it('Remis: ablehnen oder einfach weiterziehen nimmt das Angebot zurück', () => {
    const abgelehnt = standAus(
      1,
      buch([1, { art: 'remis_anbieten' }], [2, { art: 'remis_ablehnen' }]),
    )
    expect(abgelehnt.remisAngebot).toBeNull()
    // Weiß bietet an und zieht; Schwarz zieht, statt anzunehmen.
    const weiter = standAus(1, buch([1, 'e2e4'], [1, { art: 'remis_anbieten' }], [2, 'e7e5']))
    expect(weiter.remisAngebot).toBeNull()
    // Wer selbst angeboten hat und dann zieht, lässt sein Angebot stehen.
    const steht = standAus(1, buch([1, { art: 'remis_anbieten' }], [1, 'e2e4']))
    expect(steht.remisAngebot).toBe('w')
    // Annehmen ohne Angebot bewirkt nichts.
    expect(standAus(1, buch([2, { art: 'remis_annehmen' }])).partie.ende).toBeNull()
  })

  it('ein leeres Buch ist die Grundstellung', () => {
    const s = standAus(2, [])
    expect(s.partie.zuege).toEqual([])
    expect(s.partie.stellung.farbe()).toBe('w')
    expect(s.remisAngebot).toBeNull()
  })
})
