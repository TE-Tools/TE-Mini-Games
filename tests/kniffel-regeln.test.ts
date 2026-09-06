/**
 * Die Wertung des Kniffelblocks.
 *
 * Kniffel besteht fast nur aus Wertung, und die Fallen liegen alle an den
 * Rändern: die Straße, die knapp keine ist; der Viererpasch, der nur ein
 * Dreierpasch ist; das Feld, das man mit 0 streicht.
 */
import { describe, it, expect } from 'vitest'
import {
  KATEGORIEN,
  KATEGORIE_IDS,
  BONUS_GRENZE,
  BONUS_PUNKTE,
  KNIFFEL_ZAEHLT_ALS_FULL_HOUSE,
  punkteFuer,
  haeufigkeiten,
  augensumme,
  laengsteFolge,
  leererBlock,
  obenSumme,
  untenSumme,
  bonus,
  bonusErreicht,
  bisZumBonus,
  gesamtpunkte,
  freieFelder,
  blockVoll,
  moeglichePunkte,
  kategorie,
  type Block,
} from '@/games/kniffel'

describe('Der Block', () => {
  it('hat dreizehn Felder, sechs oben und sieben unten', () => {
    expect(KATEGORIEN).toHaveLength(13)
    expect(KATEGORIEN.filter((k) => k.teil === 'oben')).toHaveLength(6)
    expect(KATEGORIEN.filter((k) => k.teil === 'unten')).toHaveLength(7)
  })

  it('führt jedes Feld genau einmal', () => {
    expect(new Set(KATEGORIE_IDS).size).toBe(13)
  })

  it('fängt leer an', () => {
    const block = leererBlock()
    expect(freieFelder(block)).toHaveLength(13)
    expect(gesamtpunkte(block)).toBe(0)
    expect(blockVoll(block)).toBe(false)
  })

  it('kennt zu jedem Feld einen Namen und eine Erklärung', () => {
    for (const id of KATEGORIE_IDS) {
      expect(kategorie(id).name.length).toBeGreaterThan(2)
      expect(kategorie(id).kurz.length).toBeGreaterThan(5)
    }
  })

  it('meckert bei einem unbekannten Feld', () => {
    expect(() => kategorie('gibtsnicht' as never)).toThrow(/Unbekanntes Feld/)
  })
})

describe('Hilfsrechnungen', () => {
  it('zählt die Augenzahlen', () => {
    expect(haeufigkeiten([1, 1, 3, 6, 6])).toEqual([0, 2, 0, 1, 0, 0, 2])
  })

  it('ignoriert unmögliche Augenzahlen', () => {
    expect(haeufigkeiten([0, 7, 3])).toEqual([0, 0, 0, 1, 0, 0, 0])
  })

  it('summiert die Augen', () => {
    expect(augensumme([1, 2, 3, 4, 5])).toBe(15)
    expect(augensumme([])).toBe(0)
  })

  it('findet die längste Folge', () => {
    expect(laengsteFolge([1, 2, 3, 4, 5])).toBe(5)
    expect(laengsteFolge([2, 3, 4, 5, 5])).toBe(4)
    expect(laengsteFolge([1, 3, 5, 2, 6])).toBe(3)
    expect(laengsteFolge([6, 6, 6, 6, 6])).toBe(1)
  })
})

describe('Die oberen Felder', () => {
  it('zählt nur die eigene Zahl', () => {
    expect(punkteFuer('einser', [1, 1, 1, 4, 5])).toBe(3)
    expect(punkteFuer('vierer', [4, 4, 2, 4, 4])).toBe(16)
    expect(punkteFuer('sechser', [6, 6, 6, 6, 6])).toBe(30)
  })

  it('gibt 0, wenn die Zahl gar nicht vorkommt', () => {
    expect(punkteFuer('dreier', [1, 2, 4, 5, 6])).toBe(0)
  })
})

describe('Pasch', () => {
  it('zählt beim Dreierpasch alle Augen', () => {
    expect(punkteFuer('dreierpasch', [3, 3, 3, 5, 6])).toBe(20)
  })

  it('gibt beim Dreierpasch 0, wenn nur zwei gleich sind', () => {
    expect(punkteFuer('dreierpasch', [3, 3, 4, 5, 6])).toBe(0)
  })

  it('zählt einen Viererpasch auch als Dreierpasch', () => {
    expect(punkteFuer('dreierpasch', [2, 2, 2, 2, 6])).toBe(14)
  })

  it('verlangt beim Viererpasch wirklich vier gleiche', () => {
    expect(punkteFuer('viererpasch', [2, 2, 2, 2, 6])).toBe(14)
    expect(punkteFuer('viererpasch', [2, 2, 2, 5, 6])).toBe(0)
  })

  it('gibt für fünf gleiche 50 Punkte', () => {
    expect(punkteFuer('kniffel', [4, 4, 4, 4, 4])).toBe(50)
    expect(punkteFuer('kniffel', [4, 4, 4, 4, 5])).toBe(0)
  })
})

describe('Full House', () => {
  it('zahlt 25 für drei und zwei gleiche', () => {
    expect(punkteFuer('fullHouse', [3, 3, 3, 5, 5])).toBe(25)
  })

  it('gibt 0 für zwei Paare', () => {
    expect(punkteFuer('fullHouse', [3, 3, 5, 5, 6])).toBe(0)
  })

  it('gibt 0 für vier gleiche plus eine andere', () => {
    expect(punkteFuer('fullHouse', [3, 3, 3, 3, 5])).toBe(0)
  })

  it('zählt fünf gleiche mit – die verbreitete Hausregel', () => {
    expect(KNIFFEL_ZAEHLT_ALS_FULL_HOUSE).toBe(true)
    expect(punkteFuer('fullHouse', [3, 3, 3, 3, 3])).toBe(25)
  })
})

describe('Straßen', () => {
  it('zahlt 30 für vier in Folge', () => {
    expect(punkteFuer('kleineStrasse', [1, 2, 3, 4, 6])).toBe(30)
    expect(punkteFuer('kleineStrasse', [3, 4, 5, 6, 6])).toBe(30)
  })

  it('gibt 0, wenn nur drei in Folge liegen', () => {
    expect(punkteFuer('kleineStrasse', [1, 2, 3, 5, 5])).toBe(0)
  })

  it('zahlt 40 für fünf in Folge', () => {
    expect(punkteFuer('grosseStrasse', [1, 2, 3, 4, 5])).toBe(40)
    expect(punkteFuer('grosseStrasse', [2, 3, 4, 5, 6])).toBe(40)
  })

  it('zählt eine große Straße auch als kleine', () => {
    expect(punkteFuer('kleineStrasse', [2, 3, 4, 5, 6])).toBe(30)
  })

  it('gibt 0 für eine Folge mit Lücke', () => {
    expect(punkteFuer('grosseStrasse', [1, 2, 3, 4, 6])).toBe(0)
  })

  it('lässt sich von der Reihenfolge nicht täuschen', () => {
    expect(punkteFuer('grosseStrasse', [5, 1, 4, 2, 3])).toBe(40)
  })
})

describe('Chance', () => {
  it('zählt immer alle Augen', () => {
    expect(punkteFuer('chance', [1, 1, 1, 1, 1])).toBe(5)
    expect(punkteFuer('chance', [6, 6, 6, 6, 6])).toBe(30)
  })
})

describe('Bonus und Summen', () => {
  function blockMit(werte: Partial<Block>): Block {
    return { ...leererBlock(), ...werte }
  }

  it('gibt den Bonus ab 63 Punkten oben', () => {
    const knapp = blockMit({ einser: 3, zweier: 6, dreier: 9, vierer: 12, fuenfer: 15, sechser: 18 })
    expect(obenSumme(knapp)).toBe(BONUS_GRENZE)
    expect(bonusErreicht(knapp)).toBe(true)
    expect(bonus(knapp)).toBe(BONUS_PUNKTE)
    expect(bisZumBonus(knapp)).toBe(0)
  })

  it('gibt ihn bei 62 Punkten nicht', () => {
    const daneben = blockMit({ einser: 2, zweier: 6, dreier: 9, vierer: 12, fuenfer: 15, sechser: 18 })
    expect(obenSumme(daneben)).toBe(62)
    expect(bonus(daneben)).toBe(0)
    expect(bisZumBonus(daneben)).toBe(1)
  })

  it('rechnet oben, Bonus und unten zusammen', () => {
    const block = blockMit({
      einser: 3, zweier: 6, dreier: 9, vierer: 12, fuenfer: 15, sechser: 18,
      kniffel: 50, chance: 20,
    })
    expect(untenSumme(block)).toBe(70)
    expect(gesamtpunkte(block)).toBe(63 + 35 + 70)
  })

  it('zählt gestrichene Felder als 0, nicht als frei', () => {
    const block = blockMit({ kniffel: 0 })
    expect(freieFelder(block)).toHaveLength(12)
    expect(gesamtpunkte(block)).toBe(0)
  })

  it('merkt, wenn der Block voll ist', () => {
    const voll = {} as Block
    for (const id of KATEGORIE_IDS) voll[id] = 0
    expect(blockVoll(voll)).toBe(true)
    expect(freieFelder(voll)).toHaveLength(0)
  })
})

describe('Was der Wurf hergibt', () => {
  it('bietet nur die freien Felder an', () => {
    const block = { ...leererBlock(), kniffel: 50, einser: 2 }
    const moeglich = moeglichePunkte(block, [3, 3, 3, 4, 4])
    expect(moeglich.kniffel).toBeUndefined()
    expect(moeglich.einser).toBeUndefined()
    expect(moeglich.fullHouse).toBe(25)
    expect(moeglich.dreier).toBe(9)
  })

  it('nennt auch die Felder, die 0 brächten – streichen gehört dazu', () => {
    const moeglich = moeglichePunkte(leererBlock(), [1, 1, 2, 3, 4])
    expect(moeglich.kniffel).toBe(0)
    expect(moeglich.grosseStrasse).toBe(0)
    expect(Object.keys(moeglich)).toHaveLength(13)
  })
})

describe('Die Würfelaugen auf dem Bildschirm', () => {
  it('zeigt auf jeder Seite so viele Augen, wie sie wert ist', async () => {
    // Angeschaut hatte ich es -- geprüft war es nicht. Bei sechs Seiten mit
    // je eigenem Muster ist ein vertauschter Platz schnell übersehen.
    const { AUGEN_PLAETZE } = await import('@/pages/play/kniffel/augen')
    for (let augen = 1; augen <= 6; augen++) {
      expect(AUGEN_PLAETZE[augen]).toHaveLength(augen)
    }
  })

  it('setzt kein Auge zweimal auf denselben Platz', async () => {
    const { AUGEN_PLAETZE } = await import('@/pages/play/kniffel/augen')
    for (let augen = 1; augen <= 6; augen++) {
      const plaetze = AUGEN_PLAETZE[augen]!
      expect(new Set(plaetze).size).toBe(plaetze.length)
      for (const p of plaetze) {
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThanOrEqual(8)
      }
    }
  })

  it('setzt die Augen symmetrisch – sonst kippt das Bild', () => {
    // Zu jedem Platz p gehoert der gegenueberliegende 8-p. Ausser der
    // Mitte (4) muss jedes Auge seinen Partner haben.
    return import('@/pages/play/kniffel/augen').then(({ AUGEN_PLAETZE }) => {
      for (let augen = 1; augen <= 6; augen++) {
        const plaetze = new Set(AUGEN_PLAETZE[augen]!)
        for (const p of plaetze) {
          if (p === 4) continue
          expect(plaetze.has(8 - p)).toBe(true)
        }
      }
    })
  })
})
