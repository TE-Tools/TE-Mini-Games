/**
 * Die Stockwerk-Level: hoch und runter statt nur nach rechts.
 *
 * Thomas am 05.11.2026: "mehr verschiedene Level [...] mit mehreren Ebenen
 * und hoch und runter laufen". Ob sie zu schaffen sind, prüft schon
 * tests/trapbound.test.ts für alle Level. Hier steht, was sie von den
 * anderen unterscheidet -- und das muss auch so bleiben.
 */
import { describe, expect, it } from 'vitest'
import { levelDaten, LEVEL_ANZAHL } from '@/games/trapbound/levels'
import { istEtagenLevel, type EtagenArt } from '@/games/trapbound/levels/etagen'
import { spieleLoesung } from '@/games/trapbound/loesung'
import { BILD_HOEHE } from '@/games/trapbound/types'

const etagen: number[] = []
for (let nr = 1; nr <= LEVEL_ANZAHL; nr++) if (istEtagenLevel(nr)) etagen.push(nr)

const art = (nr: number): EtagenArt =>
  (['aufstieg', 'abstieg', 'turm'] as const).find((a) => levelDaten(nr).idee.includes(a))!

describe('Stockwerk-Level', () => {
  it('kommen in jeder Welt bis zum Endspiel zweimal vor, ab Level 17', () => {
    expect(etagen[0]).toBe(17)
    expect(etagen).toHaveLength(29)
    // Nie zwei hintereinander.
    expect(etagen.filter((nr) => etagen.includes(nr + 1))).toEqual([])
  })

  it('sind höher als ein Bildschirm und bringen alle drei Bauarten', () => {
    for (const nr of etagen) {
      expect(levelDaten(nr).hoehe ?? 0, `Level ${nr}`).toBeGreaterThan(BILD_HOEHE)
    }
    const arten = new Set(etagen.map(art))
    expect([...arten].sort()).toEqual(['abstieg', 'aufstieg', 'turm'])
  })

  it('führen wirklich nach oben bzw. nach unten', () => {
    for (const nr of etagen) {
      const l = levelDaten(nr)
      const r = spieleLoesung(l)
      expect(r.geschafft, `Level ${nr}`).toBe(true)
      const hoechster = Math.min(...r.spur.map((p) => p.y))
      const ende = r.spur.at(-1)!.y
      if (art(nr) === 'aufstieg') expect(ende, `Level ${nr}`).toBeLessThan(l.start.y - 150)
      if (art(nr) === 'abstieg') expect(ende, `Level ${nr}`).toBeGreaterThan(l.start.y + 150)
      if (art(nr) === 'turm') {
        // Erst ganz hinauf, dann tiefer als der Start wieder heraus.
        expect(hoechster, `Level ${nr}`).toBeLessThan(l.start.y - 150)
        expect(ende, `Level ${nr}`).toBeGreaterThan(l.start.y)
      }
    }
  })

  it('stellt oben im Turm einen falschen Ausgang auf, der echte liegt im Keller', () => {
    for (const nr of etagen.filter((n) => art(n) === 'turm')) {
      const l = levelDaten(nr)
      const ziele = l.objekte.filter((o) => o.typ === 'ziel')
      const falsch = ziele.find((o) => o.falle)!
      const echt = ziele.find((o) => !o.falle)!
      expect(falsch.y, `Level ${nr}`).toBeLessThan(echt.y)
      expect(echt.y, `Level ${nr}`).toBeGreaterThan(l.start.y)
    }
  })

  it('lässt den Keller zu, bis oben der Knopf gedrückt ist', () => {
    for (const nr of etagen.filter((n) => art(n) === 'turm')) {
      const l = levelDaten(nr)
      const ohneKnopf = {
        ...l,
        objekte: l.objekte.map((o) => (o.typ === 'knopf' ? { ...o, loest: [] } : o)),
      }
      expect(spieleLoesung(ohneKnopf).geschafft, `Level ${nr}`).toBe(false)
    }
  })
})
