/**
 * Käsekästchen online: das Zugbuch nachspielen.
 *
 * Der Server prüft nur, wer laut seinem Buch am Zug ist und ob die Linie
 * frei ist (Migration 032). Wer danach dran ist, meldet der Ziehende mit
 * (`weiter`). Was ein Eintrag bewirkt -- und ob `weiter` stimmt --,
 * entscheidet jeder Mitspieler selbst mit dieser Engine. Alle müssen zum
 * selben Schluss kommen, auch bei Unsinn im Buch.
 */
import { describe, it, expect } from 'vitest'
import {
  ausgangFuerSitz,
  neuerStand,
  sitzAmZug,
  standAus,
  weiterNach,
  wendeAn,
  type KaestchenAktion,
  type KaestchenEintrag,
  type OnlineStand,
  type OnlineTisch,
} from '@/games/kaesekaestchen'

/** 2×2, Sitze 1 und 3 (Sitz 2 ist vor dem Start gegangen), Sitz 1 fängt an. */
const TISCH: OnlineTisch = { breite: 2, hoehe: 2, sitze: [1, 3], beginner: 1 }

/** Dieselbe 2 : 2-Partie wie in kaesekaestchen-regeln.test.ts. */
const GLEICHSTAND = [0, 6, 2, 7, 11, 5, 10, 3, 1, 8, 4, 9]

/**
 * Ein Buch, wie es ehrliche Mitspieler schreiben: Jeder zieht, wenn er
 * dran ist, und meldet, was die Engine als Nächstes sagt.
 */
function ehrlich(tisch: OnlineTisch, linien: number[]): KaestchenEintrag[] {
  let stand: OnlineStand = neuerStand(tisch)
  return linien.map((linie, i) => {
    const seat = sitzAmZug(stand, tisch)!
    const eintrag: KaestchenEintrag = {
      nr: i + 1,
      seat,
      aktion: { art: 'linie', linie, weiter: weiterNach(stand, tisch, linie) },
    }
    stand = wendeAn(stand, eintrag, tisch)
    return eintrag
  })
}

const eintrag = (nr: number, seat: number, aktion: KaestchenAktion): KaestchenEintrag => ({
  nr,
  seat,
  aktion,
})

describe('Käsekästchen online: Zugbuch', () => {
  it('spielt ein ehrliches Buch zu Ende -- auch ungeordnet', () => {
    const buch = ehrlich(TISCH, GLEICHSTAND)
    const s = standAus(TISCH, [...buch].reverse())
    expect(s.ende).toEqual({ art: 'fertig' })
    expect(s.partie.punkte).toEqual([2, 2])
    expect(ausgangFuerSitz(s, TISCH, 1)).toBe('remis')
    expect(ausgangFuerSitz(s, TISCH, 3)).toBe('remis')
  })

  it('wer ein Kästchen schließt, meldet sich selbst als Nächsten', () => {
    const buch = ehrlich(TISCH, [0, 6, 2, 7])
    // Sitz 3 schließt mit Linie 7 Kästchen 0 und bleibt dran.
    expect(buch[3]).toEqual(eintrag(4, 3, { art: 'linie', linie: 7, weiter: 3 }))
    expect(buch[2]!.aktion).toEqual({ art: 'linie', linie: 2, weiter: 3 })
    expect(sitzAmZug(standAus(TISCH, buch), TISCH)).toBe(3)
  })

  it('beginnt beim Sitz, den der Server ausgelost hat', () => {
    const tisch = { ...TISCH, beginner: 3 }
    expect(sitzAmZug(neuerStand(tisch), tisch)).toBe(3)
  })

  it('beendet die Partie bei einer falschen Angabe -- der Absender verliert', () => {
    const buch = ehrlich(TISCH, [0, 6, 2])
    // Sitz 3 schließt Kästchen 0, behauptet aber, Sitz 1 sei dran.
    const falsch = [...buch, eintrag(4, 3, { art: 'linie', linie: 7, weiter: 1 })]
    const s = standAus(TISCH, falsch)
    expect(s.ende).toEqual({ art: 'ungueltig', sitz: 3 })
    // Der falsche Eintrag zählt nicht.
    expect(s.partie.zuege).toHaveLength(3)
    expect(ausgangFuerSitz(s, TISCH, 3)).toBe('niederlage')
    expect(ausgangFuerSitz(s, TISCH, 1)).toBe('sieg')
    // Was danach kommt, ändert nichts mehr.
    const danach = standAus(TISCH, [
      ...falsch,
      eintrag(5, 1, { art: 'linie', linie: 7, weiter: 1 }),
    ])
    expect(danach).toEqual(s)
  })

  it('auch wer sich zu Unrecht einen Extrazug gibt, verliert', () => {
    const s = standAus(TISCH, [eintrag(1, 1, { art: 'linie', linie: 0, weiter: 1 })])
    expect(s.ende).toEqual({ art: 'ungueltig', sitz: 1 })
  })

  it('eine gezogene oder erfundene Linie zählt wie eine falsche Angabe', () => {
    const buch = ehrlich(TISCH, [0])
    const doppelt = standAus(TISCH, [...buch, eintrag(2, 3, { art: 'linie', linie: 0, weiter: 1 })])
    expect(doppelt.ende).toEqual({ art: 'ungueltig', sitz: 3 })
    const erfunden = standAus(TISCH, [eintrag(1, 1, { art: 'linie', linie: 99, weiter: 3 })])
    expect(erfunden.ende).toEqual({ art: 'ungueltig', sitz: 1 })
  })

  it('lässt einen Eintrag vom falschen Sitz liegen', () => {
    const s = standAus(TISCH, [
      eintrag(1, 3, { art: 'linie', linie: 0, weiter: 1 }),
      eintrag(2, 1, { art: 'linie', linie: 1, weiter: 3 }),
      eintrag(3, 2, { art: 'linie', linie: 2, weiter: 1 }),
    ])
    expect(s.ende).toBeNull()
    expect(s.partie.zuege.map((z) => z.linie)).toEqual([1])
    expect(sitzAmZug(s, TISCH)).toBe(3)
  })

  it('Aufgeben beendet die Partie; unter den übrigen entscheiden die Kästchen', () => {
    const tisch: OnlineTisch = { breite: 2, hoehe: 2, sitze: [1, 2, 4], beginner: 1 }
    // Sitz 1, 2, 4 ziehen reihum; Sitz 2 schließt Kästchen 0 (0, 6, 2 gehen voraus).
    const buch = ehrlich(tisch, [0, 6, 2, 1, 7])
    const zwischen = standAus(tisch, buch)
    expect(zwischen.partie.punkte).toEqual([0, 1, 0])
    const s = standAus(tisch, [...buch, eintrag(6, 2, { art: 'aufgeben' })])
    expect(s.ende).toEqual({ art: 'aufgabe', sitz: 2 })
    expect(ausgangFuerSitz(s, tisch, 2)).toBe('niederlage')
    // Sitz 1 und 4 haben beide null Kästchen: Gleichstand unter den übrigen.
    expect(ausgangFuerSitz(s, tisch, 1)).toBe('remis')
    expect(ausgangFuerSitz(s, tisch, 4)).toBe('remis')
    expect(ausgangFuerSitz(s, tisch, 3)).toBeNull()
  })

  it('zu zweit gewinnt, wer bleibt, auch mit weniger Kästchen', () => {
    const buch = ehrlich(TISCH, [0, 6, 2, 7])
    const s = standAus(TISCH, [...buch, eintrag(5, 3, { art: 'aufgeben' })])
    expect(ausgangFuerSitz(s, TISCH, 1)).toBe('sieg')
  })
})
