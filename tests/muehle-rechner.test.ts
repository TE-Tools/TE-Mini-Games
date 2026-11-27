/**
 * Der Computer bei Mühle: zieht nur Erlaubtes, nimmt mit, was gewinnt,
 * verbaut dem Gegner die offene Mühle (ab mittel), ist schnell genug fürs
 * Handy -- und schwer schlägt leicht.
 */
import { describe, it, expect } from 'vitest'
import {
  STANDARD_REGELN,
  STUFEN,
  alsText,
  bewerte,
  grundstellung,
  neuePartie,
  partieAus,
  schluessel,
  stellungAus,
  waehleZug,
  zieheIn,
  type KiAuftrag,
  type MuehleStufe,
  type Partie,
  type Stellung,
  type StufenWerte,
} from '@/games/muehle'

function frage(s: Stellung, stufe: MuehleStufe, extra: Partial<KiAuftrag> = {}) {
  return waehleZug({
    stellung: alsText(s),
    regeln: STANDARD_REGELN,
    verlauf: [schluessel(s)],
    stufe,
    seed: 7,
    ...extra,
  })
}

const GENAU = { rauschen: 0, zufall: 0 }

/** Eine ganze Partie Computer gegen Computer; jeder Zug geht durch die Engine. */
function spieleDurch(
  w: MuehleStufe,
  b: MuehleStufe,
  seed: number,
  schwer: Partial<StufenWerte> = {},
): Partie {
  let p = neuePartie(STANDARD_REGELN)
  while (!p.ende && p.zuege.length < 160) {
    const stufe = p.stellung.amZug === 'w' ? w : b
    const zug = waehleZug({
      stellung: alsText(p.stellung),
      regeln: p.regeln,
      verlauf: p.verlauf,
      stufe,
      seed: seed + p.zuege.length,
      werte: stufe === 'schwer' ? schwer : undefined,
    })
    const weiter = zug ? zieheIn(p, zug) : null
    if (!weiter) throw new Error(`Der Computer (${stufe}) zog ${zug} -- das geht nicht`)
    p = weiter
  }
  return p
}

describe('Mühle-Rechner', () => {
  it('bewertet die Grundstellung ausgeglichen', () => {
    expect(bewerte(grundstellung(), STANDARD_REGELN)).toBe(0)
  })

  it('nimmt den Gewinn mit -- jede Stufe, auch mit Zufall', () => {
    // Schwarz hat drei Steine; f4-f6 schließt eine Mühle, der Schlag lässt ihm zwei.
    const s = stellungAus({ w: ['b6', 'd6', 'f4', 'a1'], b: ['a7', 'g1', 'c3'] }, 'w')
    for (let seed = 1; seed <= 10; seed++) {
      expect(frage(s, 'leicht', { seed })).toMatch(/^f4-f6x/)
    }
    expect(frage(s, 'mittel')).toMatch(/^f4-f6x/)
    expect(frage(s, 'schwer', { werte: { zeitMs: 200 } })).toMatch(/^f4-f6x/)
  })

  it('schließt die eigene Mühle und nimmt dabei den Stein, der droht', () => {
    // Weiß kann g1 schließen; Schwarz droht f6 (b6-d6-f6). Wer schlägt, nimmt b6 oder d6.
    const s = stellungAus({ w: ['a1', 'd1'], b: ['b6', 'd6'] }, 'w', { w: 7, b: 7 })
    expect(frage(s, 'mittel', { werte: GENAU })).toMatch(/^g1x(b6|d6)$/)
    expect(frage(s, 'schwer', { werte: { zeitMs: 200 } })).toMatch(/^g1x(b6|d6)$/)
  })

  it('mittel verbaut die offene Mühle des Gegners; leicht sieht sie nicht immer', () => {
    // Schwarz droht g1 (a1-d1-g1). Weiß hat selbst keine Mühle in Reichweite.
    const s = stellungAus({ w: ['d6', 'b4'], b: ['a1', 'd1'] }, 'w', { w: 7, b: 7 })
    for (let seed = 1; seed <= 6; seed++) expect(frage(s, 'mittel', { seed })).toBe('g1')
    const leicht = new Set(
      Array.from({ length: 20 }, (_, seed) => frage(s, 'leicht', { seed: seed + 1 })),
    )
    expect(leicht.size).toBeGreaterThan(1)
  })

  it('zieht mit demselben Startwert dasselbe', () => {
    const s = grundstellung()
    const a = frage(s, 'leicht', { seed: 42 })
    expect(a).toBe(frage(s, 'leicht', { seed: 42 }))
    expect(a).toMatch(/^[a-g][1-7]$/)
  })

  it('liefert null, wenn es keinen Zug gibt', () => {
    const s = stellungAus({ w: ['a1', 'g1', 'a7', 'g7'], b: ['d1', 'a4', 'g4', 'd7', 'c3'] }, 'w')
    expect(frage(s, 'schwer', { werte: { zeitMs: 50 } })).toBeNull()
    expect(frage(s, 'leicht')).toBeNull()
  })

  it('zieht auf dem Handy nach kurzer Zeit: schwer hält seine Bedenkzeit ein', () => {
    expect(STUFEN.schwer.zeitMs).toBeLessThanOrEqual(1000)
    const p = spieleDurch('mittel', 'mittel', 3)
    expect(p.zuege.length).toBeGreaterThan(14)
    // Aus der Grundstellung und mitten aus einer echten Partie.
    for (const mitte of [
      partieAus(STANDARD_REGELN, []),
      partieAus(STANDARD_REGELN, p.zuege.slice(0, 14)),
    ]) {
      const start = performance.now()
      const zug = waehleZug({
        stellung: alsText(mitte.stellung),
        regeln: STANDARD_REGELN,
        verlauf: mitte.verlauf,
        stufe: 'schwer',
        seed: 1,
      })
      expect(zug).not.toBeNull()
      expect(performance.now() - start).toBeLessThan(STUFEN.schwer.zeitMs + 600)
    }
  })

  it('zieht in ganzen Partien nur Erlaubtes, mit allen Hausregeln', () => {
    for (const seed of [11, 12]) {
      const p = spieleDurch('leicht', 'mittel', seed)
      expect(p.zuege.length).toBeGreaterThan(18)
    }
  })

  it('schwer schlägt leicht -- in beiden Farben', () => {
    const schnell = { zeitMs: 60 }
    let siege = 0
    for (const seed of [100, 200]) {
      if (spieleDurch('schwer', 'leicht', seed, schnell).ende?.sieger === 'w') siege++
      if (spieleDurch('leicht', 'schwer', seed, schnell).ende?.sieger === 'b') siege++
    }
    expect(siege).toBeGreaterThanOrEqual(3)
  }, 60000)
})
