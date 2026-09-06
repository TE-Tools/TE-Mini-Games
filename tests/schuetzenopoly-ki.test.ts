/**
 * KI, Handel und Minispiele.
 *
 * Der wichtigste Test hier ist der letzte: vier KI-Spieler spielen ganze
 * Partien zu Ende. Das fängt Endlosschleifen, kaputte Zustände und
 * Regelknoten ab, die einzelne Zugtests nie zeigen.
 */
import { describe, it, expect } from 'vitest'
import {
  erstellePartie,
  kiSchritt,
  kiWillKaufen,
  kiNimmtAn,
  kiBaut,
  pruefeHandel,
  handelAusfuehren,
  bewerteAngebot,
  feldWert,
  handelbareFelder,
  kaufpreis,
  spielerMit,
  besitzVon,
  endstand,
  medailleFuer,
  kiMinispielPunkte,
  trefferPunkte,
  MINISPIELE,
  minispiel,
  belohnungFuer,
  type SpielZustand,
  type KiStufe,
  type Handelsangebot,
} from '@/games/schuetzenopoly'

function kiPartie(stufen: KiStufe[] = ['normal', 'normal'], seed = 7): SpielZustand {
  return erstellePartie({
    seed,
    spieler: stufen.map((kiStufe, i) => ({
      name: `KI ${i + 1}`,
      typ: 'ki' as const,
      kiStufe,
    })),
  })
}

function gibFeld(state: SpielZustand, feldId: string, besitzerId: string | null): SpielZustand {
  return {
    ...state,
    besitz: { ...state.besitz, [feldId]: { ...state.besitz[feldId]!, besitzerId } },
  }
}

describe('Minispiel-Wertung', () => {
  it('kennt drei Minispiele mit steigenden Schwellen', () => {
    expect(MINISPIELE).toHaveLength(3)
    for (const m of MINISPIELE) {
      expect(m.schwellen.bronze).toBeLessThan(m.schwellen.silber)
      expect(m.schwellen.silber).toBeLessThan(m.schwellen.gold)
    }
  })

  it('übersetzt Punkte in Medaillen', () => {
    const m = minispiel('praezision')
    expect(medailleFuer('praezision', 0)).toBe('keine')
    expect(medailleFuer('praezision', m.schwellen.bronze)).toBe('bronze')
    expect(medailleFuer('praezision', m.schwellen.silber)).toBe('silber')
    expect(medailleFuer('praezision', m.schwellen.gold + 100)).toBe('gold')
  })

  it('zahlt für bessere Medaillen mehr', () => {
    expect(belohnungFuer('keine')).toBe(0)
    expect(belohnungFuer('bronze')).toBeLessThan(belohnungFuer('silber'))
    expect(belohnungFuer('silber')).toBeLessThan(belohnungFuer('gold'))
  })

  it('gibt in der Mitte die volle Punktzahl und außen keine', () => {
    expect(trefferPunkte(0)).toBe(100)
    expect(trefferPunkte(1)).toBe(0)
    expect(trefferPunkte(0.5)).toBeLessThan(trefferPunkte(0.2))
    expect(trefferPunkte(-0.3)).toBe(trefferPunkte(0.3))
  })

  it('fängt Abstände außerhalb der Scheibe ab', () => {
    expect(trefferPunkte(5)).toBe(0)
    expect(trefferPunkte(-5)).toBe(0)
  })

  it('lässt starke KI im Schnitt besser schießen als schwache', () => {
    const mittel = (stufe: KiStufe) => {
      let summe = 0
      for (let i = 0; i <= 20; i++) summe += kiMinispielPunkte('ringschiessen', stufe, i / 20)
      return summe / 21
    }
    expect(mittel('leicht')).toBeLessThan(mittel('normal'))
    expect(mittel('normal')).toBeLessThan(mittel('schwer'))
  })

  it('lässt auch die stärkste KI nicht immer Gold holen', () => {
    expect(medailleFuer('ringschiessen', kiMinispielPunkte('ringschiessen', 'schwer', 0))).not.toBe(
      'gold',
    )
  })
})

describe('Handel', () => {
  it('weist ein Angebot über fremden Besitz zurück', () => {
    const s = kiPartie()
    const angebot: Handelsangebot = {
      vonId: 'p0',
      anId: 'p1',
      gebeFelder: ['kevelaer'],
      gebeTaler: 0,
      willFelder: [],
      willTaler: 0,
    }
    expect(pruefeHandel(s, angebot).gueltig).toBe(false)
  })

  it('weist ein Angebot über mehr Taler als vorhanden zurück', () => {
    const s = kiPartie()
    expect(
      pruefeHandel(s, {
        vonId: 'p0',
        anId: 'p1',
        gebeFelder: [],
        gebeTaler: 999_999,
        willFelder: [],
        willTaler: 0,
      }).gueltig,
    ).toBe(false)
  })

  it('weist ein leeres Angebot zurück', () => {
    const s = kiPartie()
    expect(
      pruefeHandel(s, { vonId: 'p0', anId: 'p1', gebeFelder: [], gebeTaler: 0, willFelder: [], willTaler: 0 })
        .gueltig,
    ).toBe(false)
  })

  it('weist bebaute Grundstücke zurück', () => {
    let s = gibFeld(kiPartie(), 'kevelaer', 'p0')
    s = { ...s, besitz: { ...s.besitz, kevelaer: { ...s.besitz['kevelaer']!, stufe: 1 } } }
    expect(
      pruefeHandel(s, {
        vonId: 'p0',
        anId: 'p1',
        gebeFelder: ['kevelaer'],
        gebeTaler: 0,
        willFelder: [],
        willTaler: 0,
      }).gueltig,
    ).toBe(false)
  })

  it('führt einen gültigen Tausch mit Ausgleich aus', () => {
    let s = gibFeld(gibFeld(kiPartie(), 'kevelaer', 'p0'), 'krefeld', 'p1')
    const vorherP0 = spielerMit(s, 'p0')!.taler
    const vorherP1 = spielerMit(s, 'p1')!.taler
    s = handelAusfuehren(s, {
      vonId: 'p0',
      anId: 'p1',
      gebeFelder: ['kevelaer'],
      gebeTaler: 300,
      willFelder: ['krefeld'],
      willTaler: 0,
    })
    expect(s.besitz['kevelaer']!.besitzerId).toBe('p1')
    expect(s.besitz['krefeld']!.besitzerId).toBe('p0')
    expect(spielerMit(s, 'p0')!.taler).toBe(vorherP0 - 300)
    expect(spielerMit(s, 'p1')!.taler).toBe(vorherP1 + 300)
  })

  it('lässt ein ungültiges Angebot den Zustand unberührt', () => {
    const s = kiPartie()
    expect(
      handelAusfuehren(s, {
        vonId: 'p0',
        anId: 'p1',
        gebeFelder: ['hannover'],
        gebeTaler: 0,
        willFelder: [],
        willTaler: 0,
      }),
    ).toBe(s)
  })

  it('bewertet ein Feld höher, das eine Gruppe schließt', () => {
    let s = kiPartie()
    const alleine = feldWert(s, 'krefeld', 'p0')
    s = gibFeld(gibFeld(s, 'kevelaer', 'p0'), 'grevenbroich', 'p0')
    expect(feldWert(s, 'krefeld', 'p0')).toBeGreaterThan(alleine)
  })

  it('rechnet den Nettowert eines Angebots aus Sicht des Empfängers', () => {
    const s = gibFeld(kiPartie(), 'krefeld', 'p1')
    const netto = bewerteAngebot(s, {
      vonId: 'p0',
      anId: 'p1',
      gebeFelder: [],
      gebeTaler: 5000,
      willFelder: ['krefeld'],
      willTaler: 0,
    })
    expect(netto).toBe(5000 - feldWert(s, 'krefeld', 'p1'))
  })

  it('listet nur unbebaute eigene Felder als handelbar', () => {
    let s = gibFeld(gibFeld(kiPartie(), 'kevelaer', 'p0'), 'krefeld', 'p0')
    s = { ...s, besitz: { ...s.besitz, krefeld: { ...s.besitz['krefeld']!, stufe: 2 } } }
    expect(handelbareFelder(s, 'p0')).toEqual(['kevelaer'])
  })
})

describe('KI-Entscheidungen', () => {
  it('kauft nichts, wofür das Geld nicht reicht', () => {
    let s = kiPartie(['normal', 'normal'])
    s = {
      ...s,
      kaufAngebot: { position: 39, feldId: 'hannover', preis: 3500 },
      spieler: s.spieler.map((p, i) => (i === 0 ? { ...p, taler: 100 } : p)),
    }
    expect(kiWillKaufen(s, s.spieler[0]!)).toBe(false)
  })

  it('greift zu, wenn ein Feld die Gruppe schließt', () => {
    let s = kiPartie(['schwer', 'normal'])
    s = gibFeld(gibFeld(s, 'kevelaer', 'p0'), 'grevenbroich', 'p0')
    s = { ...s, kaufAngebot: { position: 4, feldId: 'krefeld', preis: kaufpreis('krefeld') } }
    expect(kiWillKaufen(s, s.spieler[0]!)).toBe(true)
  })

  it('lässt die leichte KI nicht bis zum letzten Taler kaufen', () => {
    let s = kiPartie(['leicht', 'leicht'])
    s = {
      ...s,
      kaufAngebot: { position: 39, feldId: 'hannover', preis: 3500 },
      spieler: s.spieler.map((p, i) => (i === 0 ? { ...p, taler: 3600 } : p)),
    }
    expect(kiWillKaufen(s, s.spieler[0]!)).toBe(false)
  })

  it('baut erst, wenn die Gruppe komplett ist', () => {
    let s = gibFeld(kiPartie(), 'kevelaer', 'p0')
    expect(kiBaut(s, s.spieler[0]!)).toBe(s)
    for (const id of ['grevenbroich', 'krefeld']) s = gibFeld(s, id, 'p0')
    const gebaut = kiBaut(s, s.spieler[0]!)
    expect(besitzVon(gebaut, 'p0').some((b) => b.stufe > 0)).toBe(true)
  })

  it('behält beim Bauen eine Reserve zurück', () => {
    let s = kiPartie(['normal', 'normal'])
    for (const id of ['kevelaer', 'grevenbroich', 'krefeld']) s = gibFeld(s, id, 'p0')
    s = { ...s, spieler: s.spieler.map((p, i) => (i === 0 ? { ...p, taler: 1300 } : p)) }
    const gebaut = kiBaut(s, s.spieler[0]!)
    expect(spielerMit(gebaut, 'p0')!.taler).toBeGreaterThanOrEqual(1000)
  })

  it('lehnt ein Angebot ab, das ihr nichts bringt', () => {
    const s = gibFeld(kiPartie(), 'hannover', 'p1')
    expect(
      kiNimmtAn(s, {
        vonId: 'p0',
        anId: 'p1',
        gebeFelder: [],
        gebeTaler: 100,
        willFelder: ['hannover'],
        willTaler: 0,
      }),
    ).toBe(false)
  })

  it('nimmt ein deutlich zu gutes Angebot an', () => {
    const s = gibFeld(kiPartie(), 'kevelaer', 'p1')
    expect(
      kiNimmtAn(s, {
        vonId: 'p0',
        anId: 'p1',
        gebeFelder: [],
        gebeTaler: 5000,
        willFelder: ['kevelaer'],
        willTaler: 0,
      }),
    ).toBe(true)
  })

  it('gibt der schweren KI kein Feld, das dem Gegner die Gruppe schließt', () => {
    let s = kiPartie(['schwer', 'schwer'])
    s = gibFeld(gibFeld(s, 'kevelaer', 'p0'), 'grevenbroich', 'p0')
    s = gibFeld(s, 'krefeld', 'p1')
    const knapp = kiNimmtAn(s, {
      vonId: 'p0',
      anId: 'p1',
      gebeFelder: [],
      gebeTaler: kaufpreis('krefeld') + 300,
      willFelder: ['krefeld'],
      willTaler: 0,
    })
    expect(knapp).toBe(false)
  })

  it('rührt sich nicht, wenn ein Mensch am Zug ist', () => {
    const s = erstellePartie({
      seed: 3,
      spieler: [
        { name: 'Mensch', typ: 'mensch' },
        { name: 'Rechner', typ: 'ki', kiStufe: 'normal' },
      ],
    })
    const schritt = kiSchritt(s)
    expect(schritt.state).toBe(s)
    expect(schritt.aktion).toBe('nichts')
  })
})

/**
 * Ganze Partien. `kiSchritt` wird so lange gerufen, wie es die Oberfläche
 * täte -- nur ohne Pausen dazwischen.
 */
function spieleDurch(state: SpielZustand, maxSchritte = 8000): SpielZustand {
  let s = state
  for (let i = 0; i < maxSchritte; i++) {
    if (s.phase === 'ende') return s
    const schritt = kiSchritt(s)
    if (schritt.state === s && schritt.aktion === 'nichts') {
      throw new Error(`KI steckt fest in Phase ${s.phase} (Runde ${s.runde})`)
    }
    s = schritt.state
  }
  throw new Error(`Partie war nach ${maxSchritte} Schritten nicht zu Ende`)
}

describe('Ganze Partien', () => {
  it('spielt zwei KI-Gegner bis zum Sieger durch', () => {
    const s = spieleDurch(kiPartie(['normal', 'normal'], 11))
    expect(s.phase).toBe('ende')
    expect(s.siegerId).not.toBeNull()
  })

  it('spielt vier KI-Gegner aller Stufen durch', () => {
    const start = erstellePartie({
      seed: 2024,
      spieler: [
        { name: 'Leicht', typ: 'ki', kiStufe: 'leicht' },
        { name: 'Normal', typ: 'ki', kiStufe: 'normal' },
        { name: 'Schwer', typ: 'ki', kiStufe: 'schwer' },
        { name: 'Auch schwer', typ: 'ki', kiStufe: 'schwer' },
      ],
    })
    const s = spieleDurch(start)
    expect(s.phase).toBe('ende')
    expect(endstand(s)[0]!.spielerId).toBe(s.siegerId)
  })

  it('kommt mit zwanzig verschiedenen Startwerten immer zum Ende', () => {
    for (let seed = 0; seed < 20; seed++) {
      const s = spieleDurch(kiPartie(['leicht', 'normal', 'schwer'], seed))
      expect(s.phase).toBe('ende')
      expect(s.siegerId).not.toBeNull()
      // Kein Spieler darf mit negativem Kontostand enden.
      expect(s.spieler.every((p) => p.taler >= 0)).toBe(true)
      // Kein Feld darf einem ausgeschiedenen Spieler gehören.
      for (const b of Object.values(s.besitz)) {
        if (!b.besitzerId) continue
        expect(spielerMit(s, b.besitzerId)!.insolvent).toBe(false)
      }
    }
  })

  it('spielt aus demselben Startwert zweimal dasselbe', () => {
    const a = spieleDurch(kiPartie(['normal', 'schwer'], 99))
    const b = spieleDurch(kiPartie(['normal', 'schwer'], 99))
    expect(a.siegerId).toBe(b.siegerId)
    expect(a.spieler.map((p) => p.taler)).toEqual(b.spieler.map((p) => p.taler))
  })

  it('lässt die schwere KI häufiger gewinnen als die leichte', () => {
    let schwer = 0
    let leicht = 0
    for (let seed = 100; seed < 130; seed++) {
      const s = spieleDurch(
        erstellePartie({
          seed,
          spieler: [
            { name: 'Leicht', typ: 'ki', kiStufe: 'leicht' },
            { name: 'Schwer', typ: 'ki', kiStufe: 'schwer' },
          ],
        }),
      )
      if (s.siegerId === 'p0') leicht++
      if (s.siegerId === 'p1') schwer++
    }
    expect(schwer).toBeGreaterThan(leicht)
  })
})
