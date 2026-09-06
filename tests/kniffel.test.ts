/**
 * Kniffel: Würfeln, Halten, Eintragen, Runden, Ende -- und die KI.
 *
 * Alle Partien laufen mit festem Startwert, sonst fiele hin und wieder ein
 * Test durch, ohne dass sich etwas geändert hätte.
 */
import { describe, it, expect } from 'vitest'
import {
  erstellePartie,
  wuerfeln,
  halten,
  alleFreigeben,
  eintragen,
  darfWuerfeln,
  darfEintragen,
  aktiverSpieler,
  spielerMit,
  endstand,
  beenden,
  offeneZuege,
  wuerfelWurf,
  kiSchritt,
  kiFeldwahl,
  kiHaltewahl,
  gesamtpunkte,
  leererBlock,
  blockVoll,
  WUERFE_JE_ZUG,
  WUERFEL_ANZAHL,
  MIN_SPIELER,
  MAX_SPIELER,
  type KniffelZustand,
  type KiStufe,
  type SpielerEinrichtung,
} from '@/games/kniffel'

function partie(
  spieler: SpielerEinrichtung[] = [{ name: 'Anna', typ: 'mensch' }],
  seed = 5,
): KniffelZustand {
  return erstellePartie({ seed, spieler })
}

/** Würfel von Hand setzen -- spart es, auf einen bestimmten Wurf zu warten. */
function mitWuerfeln(state: KniffelZustand, wuerfel: number[]): KniffelZustand {
  return { ...state, wuerfel, wurfNummer: 1, phase: 'eintragen' }
}

describe('Aufstellung', () => {
  it('fängt mit leeren Blöcken und ohne Würfel an', () => {
    const s = partie()
    expect(s.wurfNummer).toBe(0)
    expect(s.wuerfel).toEqual([0, 0, 0, 0, 0])
    expect(s.runde).toBe(1)
    expect(s.phase).toBe('wurf')
    expect(blockVoll(s.spieler[0]!.block)).toBe(false)
  })

  it('geht allein und zu sechst', () => {
    expect(() => erstellePartie({ seed: 1, spieler: [] })).toThrow(new RegExp(`Mindestens ${MIN_SPIELER}`))
    const sechs = Array.from({ length: MAX_SPIELER }, (_, i) => ({ name: `S${i}`, typ: 'ki' as const }))
    expect(erstellePartie({ seed: 1, spieler: sechs }).spieler).toHaveLength(MAX_SPIELER)
    expect(() =>
      erstellePartie({ seed: 1, spieler: [...sechs, { name: 'zuviel', typ: 'ki' }] }),
    ).toThrow(new RegExp(`Maximal ${MAX_SPIELER}`))
  })

  it('lässt keine doppelten Namen zu', () => {
    expect(() =>
      erstellePartie({ seed: 1, spieler: [{ name: 'Anna', typ: 'mensch' }, { name: 'anna', typ: 'ki' }] }),
    ).toThrow(/doppelt/)
  })

  it('würfelt aus demselben Startwert dasselbe', () => {
    expect(wuerfeln(partie()).wuerfel).toEqual(wuerfeln(partie()).wuerfel)
  })

  it('zählt dreizehn Züge je Spieler', () => {
    expect(offeneZuege(partie())).toBe(13)
    expect(offeneZuege(partie([{ name: 'A', typ: 'mensch' }, { name: 'B', typ: 'ki' }]))).toBe(26)
  })
})

describe('Würfeln', () => {
  it('liefert fünf Augen zwischen eins und sechs', () => {
    for (let seed = 0; seed < 40; seed++) {
      const s = wuerfeln(partie([{ name: 'A', typ: 'mensch' }], seed))
      expect(s.wuerfel).toHaveLength(WUERFEL_ANZAHL)
      for (const w of s.wuerfel) {
        expect(w).toBeGreaterThanOrEqual(1)
        expect(w).toBeLessThanOrEqual(6)
      }
    }
  })

  it('erlaubt genau drei Würfe je Zug', () => {
    let s = partie()
    expect(darfWuerfeln(s)).toBe(true)
    for (let i = 1; i <= WUERFE_JE_ZUG; i++) {
      s = wuerfeln(s)
      expect(s.wurfNummer).toBe(i)
    }
    expect(darfWuerfeln(s)).toBe(false)
    const nachher = s
    expect(wuerfeln(s)).toBe(nachher)
  })

  it('lässt gehaltene Würfel liegen', () => {
    let s = wuerfeln(partie())
    const vorher = [...s.wuerfel]
    s = halten(halten(s, 0), 2)
    s = wuerfeln(s)
    expect(s.wuerfel[0]).toBe(vorher[0])
    expect(s.wuerfel[2]).toBe(vorher[2])
  })

  it('würfelt beim ersten Wurf alles neu, auch Gehaltenes', () => {
    const s = { ...partie(), gehalten: [true, true, true, true, true] }
    expect(wuerfeln(s).wuerfel.every((w) => w >= 1)).toBe(true)
  })

  it('lässt vor dem ersten Wurf nichts halten', () => {
    const s = partie()
    expect(halten(s, 0)).toBe(s)
  })

  it('lässt nach dem letzten Wurf nichts mehr halten', () => {
    let s = partie()
    for (let i = 0; i < WUERFE_JE_ZUG; i++) s = wuerfeln(s)
    const nachher = s
    expect(halten(s, 0)).toBe(nachher)
  })

  it('ignoriert Würfel, die es nicht gibt', () => {
    const s = wuerfeln(partie())
    expect(halten(s, -1)).toBe(s)
    expect(halten(s, 9)).toBe(s)
  })

  it('schaltet Halten wieder aus', () => {
    let s = wuerfeln(partie())
    s = halten(s, 1)
    expect(s.gehalten[1]).toBe(true)
    s = halten(s, 1)
    expect(s.gehalten[1]).toBe(false)
  })

  it('gibt auf Wunsch alles wieder frei', () => {
    let s = wuerfeln(partie())
    s = halten(halten(s, 0), 3)
    expect(alleFreigeben(s).gehalten.every((g) => !g)).toBe(true)
  })

  it('würfelt nur die freien Plätze neu', () => {
    const { wuerfel } = wuerfelWurf([6, 6, 1, 2, 3], [true, true, false, false, false], 42, 0)
    expect(wuerfel[0]).toBe(6)
    expect(wuerfel[1]).toBe(6)
  })
})

describe('Eintragen', () => {
  it('trägt die Punkte des Wurfs ein', () => {
    const s = eintragen(mitWuerfeln(partie(), [5, 5, 5, 2, 1]), 'fuenfer')
    expect(spielerMit(s, 'p0')!.block.fuenfer).toBe(15)
  })

  it('erlaubt es, ein Feld mit 0 zu streichen', () => {
    const s = eintragen(mitWuerfeln(partie(), [1, 2, 3, 4, 6]), 'kniffel')
    expect(spielerMit(s, 'p0')!.block.kniffel).toBe(0)
  })

  it('lässt kein Feld zweimal beschreiben', () => {
    let s = eintragen(mitWuerfeln(partie(), [5, 5, 5, 2, 1]), 'fuenfer')
    s = mitWuerfeln(s, [5, 5, 5, 5, 5])
    expect(darfEintragen(s, 'fuenfer')).toBe(false)
    const nachher = s
    expect(eintragen(s, 'fuenfer')).toBe(nachher)
  })

  it('lässt vor dem ersten Wurf nichts eintragen', () => {
    const s = partie()
    expect(darfEintragen(s, 'chance')).toBe(false)
    expect(eintragen(s, 'chance')).toBe(s)
  })

  it('setzt danach die Würfel für den nächsten Zug zurück', () => {
    const zwei: SpielerEinrichtung[] = [
      { name: 'A', typ: 'mensch' },
      { name: 'B', typ: 'mensch' },
    ]
    let s = mitWuerfeln(partie(zwei), [1, 1, 1, 1, 1])
    s = { ...s, gehalten: [true, true, false, false, false] }
    s = eintragen(s, 'einser')
    expect(s.wurfNummer).toBe(0)
    expect(s.wuerfel).toEqual([0, 0, 0, 0, 0])
    // Nichts bleibt aus dem letzten Zug liegen.
    expect(s.gehalten).toEqual([false, false, false, false, false])
    expect(s.phase).toBe('wurf')
  })
})

describe('Zugfolge', () => {
  const zwei = [{ name: 'A', typ: 'mensch' as const }, { name: 'B', typ: 'mensch' as const }]

  it('gibt nach dem Eintragen weiter', () => {
    const s = eintragen(mitWuerfeln(partie(zwei), [1, 1, 1, 1, 1]), 'einser')
    expect(aktiverSpieler(s).id).toBe('p1')
    expect(s.runde).toBe(1)
  })

  it('zählt die Runde hoch, wenn alle dran waren', () => {
    let s = partie(zwei)
    s = eintragen(mitWuerfeln(s, [1, 1, 1, 1, 1]), 'einser')
    s = eintragen(mitWuerfeln(s, [1, 1, 1, 1, 1]), 'einser')
    expect(aktiverSpieler(s).id).toBe('p0')
    expect(s.runde).toBe(2)
  })

  it('endet, wenn alle Blöcke voll sind', () => {
    let s = partie()
    const felder = ['einser','zweier','dreier','vierer','fuenfer','sechser','dreierpasch','viererpasch','fullHouse','kleineStrasse','grosseStrasse','kniffel','chance'] as const
    for (const feld of felder) s = eintragen(mitWuerfeln(s, [1, 2, 3, 4, 5]), feld)
    expect(s.phase).toBe('ende')
    expect(s.siegerId).toBe('p0')
  })
})

describe('Endstand', () => {
  it('sortiert nach Punkten', () => {
    let s = partie([{ name: 'A', typ: 'mensch' }, { name: 'B', typ: 'mensch' }])
    s = { ...s, spieler: s.spieler.map((p) => p.id === 'p1' ? { ...p, block: { ...leererBlock(), kniffel: 50 } } : p) }
    const tabelle = endstand(s)
    expect(tabelle[0]!.name).toBe('B')
    expect(tabelle[0]!.punkte).toBe(50)
  })

  it('kürt beim Beenden den Besten', () => {
    let s = partie([{ name: 'A', typ: 'mensch' }, { name: 'B', typ: 'mensch' }])
    s = { ...s, spieler: s.spieler.map((p) => p.id === 'p1' ? { ...p, block: { ...leererBlock(), chance: 20 } } : p) }
    expect(beenden(s).siegerId).toBe('p1')
  })
})

/* -------------------------------------------------------------- Die KI */

function spieleDurch(state: KniffelZustand, maxSchritte = 4000): KniffelZustand {
  let s = state
  for (let i = 0; i < maxSchritte; i++) {
    if (s.phase === 'ende') return s
    const schritt = kiSchritt(s)
    if (schritt.state === s && schritt.aktion === 'nichts') {
      throw new Error(`KI steckt fest in Phase ${s.phase}`)
    }
    s = schritt.state
  }
  throw new Error('Partie war nicht zu Ende')
}

function kiPartie(stufen: KiStufe[], seed: number): KniffelZustand {
  return erstellePartie({
    seed,
    spieler: stufen.map((kiStufe, i) => ({ name: `${kiStufe}${i}`, typ: 'ki' as const, kiStufe })),
  })
}

describe('Computergegner', () => {
  it('rührt sich nicht, wenn ein Mensch am Zug ist', () => {
    const s = partie()
    expect(kiSchritt(s).state).toBe(s)
    expect(kiSchritt(s).aktion).toBe('nichts')
  })

  it('trägt einen Kniffel nicht in die Chance ein', () => {
    const feld = kiFeldwahl(leererBlock(), [6, 6, 6, 6, 6], 'schwer', 13)
    expect(feld).toBe('kniffel')
  })

  it('nimmt bei "leicht" schlicht die höchste Punktzahl', () => {
    // Fünf Sechser: Kniffel (50) schlägt Chance (30) und Sechser (30).
    expect(kiFeldwahl(leererBlock(), [6, 6, 6, 6, 6], 'leicht', 13)).toBe('kniffel')
  })

  it('hält bei "leicht" die häufigste Augenzahl', () => {
    const halten = kiHaltewahl(leererBlock(), [3, 3, 3, 1, 6], 'leicht', kiPartie(['leicht'], 1), 1)
    expect(halten).toEqual([true, true, true, false, false])
  })

  it('zerschlägt bei "normal" keine angefangene Straße', () => {
    const halten = kiHaltewahl(leererBlock(), [2, 3, 4, 6, 6], 'normal', kiPartie(['normal'], 1), 1)
    expect(halten[0]).toBe(true)
    expect(halten[1]).toBe(true)
    expect(halten[2]).toBe(true)
  })

  it('hält nach dem letzten Wurf alles', () => {
    const state = kiPartie(['schwer'], 3)
    const halten = kiHaltewahl(leererBlock(), [1, 2, 3, 4, 5], 'schwer', state, 3)
    expect(halten.every(Boolean)).toBe(true)
  })

  it('spielt eine Partie allein zu Ende', () => {
    const s = spieleDurch(kiPartie(['normal'], 9))
    expect(s.phase).toBe('ende')
    expect(blockVoll(s.spieler[0]!.block)).toBe(true)
  })

  it('spielt mit vier Gegnern zu Ende', () => {
    const s = spieleDurch(kiPartie(['leicht', 'normal', 'schwer', 'normal'], 21))
    expect(s.phase).toBe('ende')
    expect(s.spieler.every((p) => blockVoll(p.block))).toBe(true)
    expect(endstand(s)[0]!.spielerId).toBe(s.siegerId)
  })

  it('kommt mit zehn Startwerten immer zum Ende', () => {
    for (let seed = 0; seed < 10; seed++) {
      const s = spieleDurch(kiPartie(['leicht', 'schwer'], seed))
      expect(s.phase).toBe('ende')
      expect(s.spieler.every((p) => gesamtpunkte(p.block) >= 0)).toBe(true)
    }
  })

  it('spielt aus demselben Startwert zweimal dasselbe', () => {
    const a = spieleDurch(kiPartie(['normal', 'schwer'], 77))
    const b = spieleDurch(kiPartie(['normal', 'schwer'], 77))
    expect(a.spieler.map((p) => gesamtpunkte(p.block))).toEqual(
      b.spieler.map((p) => gesamtpunkte(p.block)),
    )
  })

  it('schneidet mit steigender Stufe im Schnitt besser ab', () => {
    const schnitt = (stufe: KiStufe) => {
      let summe = 0
      const n = 12
      for (let seed = 0; seed < n; seed++) {
        const s = spieleDurch(kiPartie([stufe], 500 + seed))
        summe += gesamtpunkte(s.spieler[0]!.block)
      }
      return summe / n
    }
    const leicht = schnitt('leicht')
    const normal = schnitt('normal')
    const schwer = schnitt('schwer')
    expect(normal).toBeGreaterThan(leicht)
    expect(schwer).toBeGreaterThan(normal)
  })
})
