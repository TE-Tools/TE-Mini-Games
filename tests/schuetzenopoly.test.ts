/**
 * Die Spielregeln: würfeln, kaufen, bauen, kassieren, ausscheiden, gewinnen.
 *
 * Alle Partien laufen mit festem Startwert -- sonst fiele hin und wieder
 * ein Test durch, ohne dass sich etwas geändert hätte.
 */
import { describe, it, expect } from 'vitest'
import {
  erstellePartie,
  wuerfeln,
  ankommen,
  kaufen,
  kaufAblehnen,
  bauen,
  abreissen,
  anBankVerkaufen,
  kannBauen,
  zugBeenden,
  zugOffen,
  karteAnwenden,
  minispielAbschliessen,
  koenigsaktion,
  strafbankFreikaufen,
  aufgeben,
  endstand,
  beenden,
  gebuehrFuer,
  grundstueckGebuehr,
  sonderfeldGebuehr,
  verbandGebuehr,
  gruppeKomplett,
  kaufpreis,
  baukosten,
  vermoegen,
  spielerMit,
  aktiverSpieler,
  besitzVon,
  START_KAPITAL,
  START_BONUS,
  STRAFBANK_GEBUEHR,
  FREIES_FEST_BONUS,
  GRUPPEN_FAKTOR,
  GRUPPEN_FAKTOR_PREMIUM,
  AUSBAU_FAKTOR,
  SONDERFELD_GEBUEHR,
  VERBAND_FAKTOR_EINER,
  VERBAND_FAKTOR_BEIDE,
  type SpielZustand,
} from '@/games/schuetzenopoly'

function partie(overrides: Partial<Parameters<typeof erstellePartie>[0]> = {}): SpielZustand {
  return erstellePartie({
    seed: 42,
    spieler: [
      { name: 'Anna', typ: 'mensch' },
      { name: 'Ben', typ: 'mensch' },
    ],
    ...overrides,
  })
}

/** Einen Spieler direkt auf ein Feld setzen -- spart 30 Würfe im Test. */
function setzeAuf(state: SpielZustand, spielerId: string, position: number): SpielZustand {
  return {
    ...state,
    spieler: state.spieler.map((s) => (s.id === spielerId ? { ...s, position } : s)),
  }
}

function gibFeld(state: SpielZustand, feldId: string, besitzerId: string | null, stufe = 0): SpielZustand {
  return {
    ...state,
    besitz: { ...state.besitz, [feldId]: { ...state.besitz[feldId]!, besitzerId, stufe: stufe as 0 } },
  }
}

describe('Aufstellung', () => {
  it('gibt jedem das gleiche Startkapital', () => {
    const s = partie()
    expect(s.spieler.every((p) => p.taler === START_KAPITAL)).toBe(true)
    expect(s.spieler.every((p) => p.position === 0)).toBe(true)
  })

  it('braucht mindestens zwei und höchstens vier Spieler', () => {
    expect(() => partie({ spieler: [{ name: 'Allein', typ: 'mensch' }] })).toThrow(/Mindestens/)
    expect(() =>
      partie({
        spieler: Array.from({ length: 5 }, (_, i) => ({ name: `S${i}`, typ: 'mensch' as const })),
      }),
    ).toThrow(/Maximal/)
  })

  it('lässt keine doppelten Namen zu', () => {
    expect(() =>
      partie({ spieler: [{ name: 'Anna', typ: 'mensch' }, { name: 'anna', typ: 'mensch' }] }),
    ).toThrow(/doppelt/)
  })

  it('verteilt unterschiedliche Rollen und Figuren', () => {
    const s = partie({
      spieler: [
        { name: 'A', typ: 'mensch' },
        { name: 'B', typ: 'ki' },
        { name: 'C', typ: 'ki' },
        { name: 'D', typ: 'ki' },
      ],
    })
    expect(new Set(s.spieler.map((p) => p.rolle)).size).toBe(4)
    expect(new Set(s.spieler.map((p) => p.figurId)).size).toBe(4)
  })

  it('gibt jedes kaufbare Feld unbesetzt aus', () => {
    const s = partie()
    expect(Object.keys(s.besitz)).toHaveLength(28)
    expect(Object.values(s.besitz).every((b) => b.besitzerId === null && b.stufe === 0)).toBe(true)
  })

  it('würfelt aus demselben Startwert dieselbe Partie', () => {
    const a = wuerfeln(partie())
    const b = wuerfeln(partie())
    expect(a.wuerfel).toEqual(b.wuerfel)
  })
})

describe('Würfeln und Bewegen', () => {
  it('würfelt zwei Würfel mit Augen von eins bis sechs', () => {
    let s = partie()
    for (let i = 0; i < 100; i++) {
      s = wuerfeln({ ...s, phase: 'wuerfeln', paschSerie: 0 })
      const [a, b] = s.wuerfel!
      expect(a).toBeGreaterThanOrEqual(1)
      expect(a).toBeLessThanOrEqual(6)
      expect(b).toBeGreaterThanOrEqual(1)
      expect(b).toBeLessThanOrEqual(6)
      s = { ...s, rngZaehler: s.rngZaehler + 1 }
    }
  })

  it('setzt das Ziel auf Position plus Augensumme', () => {
    const s = wuerfeln(partie())
    const summe = s.wuerfel![0] + s.wuerfel![1]
    expect(s.zielPosition).toBe(summe % 40)
    expect(s.phase).toBe('bewegen')
  })

  it('zahlt den START-Bonus beim Überqueren', () => {
    let s = setzeAuf(partie(), 'p0', 38)
    s = wuerfeln(s)
    const vorher = spielerMit(s, 'p0')!.taler
    s = ankommen(s)
    expect(spielerMit(s, 'p0')!.taler).toBeGreaterThanOrEqual(vorher + START_BONUS - 5000)
    expect(spielerMit(s, 'p0')!.position).toBeLessThan(38)
  })

  it('schickt nach drei Pasch auf die Strafbank', () => {
    let s = partie()
    s = { ...s, paschSerie: 2 }
    // Solange würfeln, bis ein Pasch kommt.
    for (let i = 0; i < 200; i++) {
      const versuch = wuerfeln({ ...s, phase: 'wuerfeln', rngZaehler: i })
      if (versuch.wuerfel![0] === versuch.wuerfel![1]) {
        expect(spielerMit(versuch, 'p0')!.aufStrafbank).toBe(true)
        expect(versuch.paschSerie).toBe(0)
        return
      }
    }
    throw new Error('In 200 Würfen kein Pasch – das kann nicht stimmen')
  })
})

describe('Eckfelder', () => {
  it('zahlt auf dem Freien Fest einen Bonus', () => {
    let s = setzeAuf(partie(), 'p0', 18)
    s = { ...s, phase: 'bewegen', zielPosition: 20, wuerfel: [1, 1] }
    const vorher = spielerMit(s, 'p0')!.taler
    s = ankommen(s)
    expect(spielerMit(s, 'p0')!.taler).toBe(vorher + FREIES_FEST_BONUS)
  })

  it('schickt von "Zur Strafbank" sofort auf die Strafbank', () => {
    let s = setzeAuf(partie(), 'p0', 28)
    s = { ...s, phase: 'bewegen', zielPosition: 30, wuerfel: [1, 1] }
    s = ankommen(s)
    const p = spielerMit(s, 'p0')!
    expect(p.position).toBe(10)
    expect(p.aufStrafbank).toBe(true)
  })

  it('lässt die Strafbank als Besuch unbestraft', () => {
    let s = setzeAuf(partie(), 'p0', 8)
    s = { ...s, phase: 'bewegen', zielPosition: 10, wuerfel: [1, 1] }
    const vorher = spielerMit(s, 'p0')!.taler
    s = ankommen(s)
    expect(spielerMit(s, 'p0')!.aufStrafbank).toBe(false)
    expect(spielerMit(s, 'p0')!.taler).toBe(vorher)
  })

  it('lässt sich von der Strafbank freikaufen', () => {
    let s = partie()
    s = { ...s, spieler: s.spieler.map((p, i) => (i === 0 ? { ...p, aufStrafbank: true } : p)) }
    const vorher = spielerMit(s, 'p0')!.taler
    s = strafbankFreikaufen(s)
    expect(spielerMit(s, 'p0')!.aufStrafbank).toBe(false)
    expect(spielerMit(s, 'p0')!.taler).toBe(vorher - STRAFBANK_GEBUEHR)
  })
})

describe('Kaufen', () => {
  it('bietet ein freies Grundstück zum Kauf an', () => {
    let s = setzeAuf(partie(), 'p0', 0)
    s = { ...s, phase: 'bewegen', zielPosition: 1, wuerfel: [1, 0] }
    s = ankommen(s)
    expect(s.kaufAngebot).toEqual({ position: 1, feldId: 'kevelaer', preis: kaufpreis('kevelaer') })
    expect(s.phase).toBe('feld')
  })

  it('bucht den Kaufpreis ab und trägt den Besitzer ein', () => {
    let s = setzeAuf(partie(), 'p0', 0)
    s = ankommen({ ...s, phase: 'bewegen', zielPosition: 1, wuerfel: [1, 0] })
    const vorher = spielerMit(s, 'p0')!.taler
    s = kaufen(s)
    expect(spielerMit(s, 'p0')!.taler).toBe(vorher - kaufpreis('kevelaer'))
    expect(s.besitz['kevelaer']!.besitzerId).toBe('p0')
    expect(s.kaufAngebot).toBeNull()
    expect(s.phase).toBe('zug_ende')
  })

  it('lässt das Feld frei, wenn abgelehnt wird', () => {
    let s = setzeAuf(partie(), 'p0', 0)
    s = ankommen({ ...s, phase: 'bewegen', zielPosition: 1, wuerfel: [1, 0] })
    s = kaufAblehnen(s)
    expect(s.besitz['kevelaer']!.besitzerId).toBeNull()
    expect(s.phase).toBe('zug_ende')
  })

  it('kauft nichts, wofür das Geld nicht reicht', () => {
    let s = setzeAuf(partie(), 'p0', 38)
    s = { ...s, spieler: s.spieler.map((p, i) => (i === 0 ? { ...p, taler: 100 } : p)) }
    s = ankommen({ ...s, phase: 'bewegen', zielPosition: 39, wuerfel: [1, 0] })
    const vorher = s
    s = kaufen(s)
    expect(s).toBe(vorher)
  })
})

describe('Gebühren', () => {
  it('rechnet Gebühr = Grundgebühr × Ausbaufaktor', () => {
    let s = gibFeld(partie(), 'kevelaer', 'p1')
    expect(grundstueckGebuehr(s, 'kevelaer')).toBe(30)
    s = gibFeld(s, 'kevelaer', 'p1', 2)
    expect(grundstueckGebuehr(s, 'kevelaer')).toBe(30 * AUSBAU_FAKTOR[2])
  })

  it('gibt für eine komplette Gruppe den Aufschlag', () => {
    let s = partie()
    for (const id of ['kevelaer', 'grevenbroich', 'krefeld']) s = gibFeld(s, id, 'p1')
    expect(gruppeKomplett(s, 'kevelaer')).toBe(true)
    expect(grundstueckGebuehr(s, 'kevelaer')).toBe(Math.round(30 * GRUPPEN_FAKTOR))
  })

  it('gibt der Königsklasse den höheren Aufschlag', () => {
    let s = partie()
    s = gibFeld(gibFeld(s, 'neuss', 'p1'), 'hannover', 'p1')
    expect(grundstueckGebuehr(s, 'hannover')).toBe(Math.round(245 * GRUPPEN_FAKTOR_PREMIUM))
  })

  it('staffelt die Sonderfelder nach Anzahl im Besitz', () => {
    let s = partie()
    s = gibFeld(s, 'festzug', 'p1')
    expect(sonderfeldGebuehr(s, 'festzug')).toBe(SONDERFELD_GEBUEHR[1])
    s = gibFeld(s, 'musikzug', 'p1')
    expect(sonderfeldGebuehr(s, 'festzug')).toBe(SONDERFELD_GEBUEHR[2])
    s = gibFeld(gibFeld(s, 'schuetzenumzug', 'p1'), 'koenigsfahrt', 'p1')
    expect(sonderfeldGebuehr(s, 'festzug')).toBe(SONDERFELD_GEBUEHR[4])
  })

  it('rechnet Verbandsfelder mit der Würfelsumme', () => {
    let s = gibFeld(partie(), 'schiesssportverband', 'p1')
    expect(verbandGebuehr(s, 'schiesssportverband', 8)).toBe(8 * VERBAND_FAKTOR_EINER)
    s = gibFeld(s, 'schuetzenbund', 'p1')
    expect(verbandGebuehr(s, 'schiesssportverband', 8)).toBe(8 * VERBAND_FAKTOR_BEIDE)
  })

  it('verlangt nichts auf eigenem Grund', () => {
    const s = gibFeld(partie(), 'kevelaer', 'p0')
    expect(gebuehrFuer(s, 1, 7, 'p0')).toBeNull()
  })

  it('lässt den Besucher an den Besitzer zahlen', () => {
    let s = gibFeld(partie(), 'hannover', 'p1')
    s = setzeAuf(s, 'p0', 37)
    const vorherP0 = spielerMit(s, 'p0')!.taler
    const vorherP1 = spielerMit(s, 'p1')!.taler
    s = ankommen({ ...s, phase: 'bewegen', zielPosition: 39, wuerfel: [1, 1] })
    const gebuehr = 245
    expect(spielerMit(s, 'p0')!.taler).toBe(vorherP0 - gebuehr)
    expect(spielerMit(s, 'p1')!.taler).toBeGreaterThanOrEqual(vorherP1 + gebuehr)
  })

  it('verlangt nichts auf einem geschützten Grundstück', () => {
    let s = gibFeld(partie(), 'hannover', 'p1')
    s = { ...s, besitz: { ...s.besitz, hannover: { ...s.besitz['hannover']!, geschuetztBis: s.runde } } }
    const ergebnis = gebuehrFuer(s, 39, 7, 'p0')
    expect(ergebnis?.betrag).toBe(0)
    expect(ergebnis?.grund).toBe('geschuetzt')
  })

  it('verlangt nichts von einem ausgeschiedenen Besitzer', () => {
    let s = gibFeld(partie(), 'hannover', 'p1')
    s = { ...s, spieler: s.spieler.map((p) => (p.id === 'p1' ? { ...p, insolvent: true } : p)) }
    expect(gebuehrFuer(s, 39, 7, 'p0')).toBeNull()
  })
})

describe('Bauen', () => {
  function mitKompletterGruppe(): SpielZustand {
    let s = partie()
    for (const id of ['kevelaer', 'grevenbroich', 'krefeld']) s = gibFeld(s, id, 'p0')
    return { ...s, phase: 'zug_ende' }
  }

  it('verlangt die komplette Gruppe', () => {
    const s = gibFeld(partie(), 'kevelaer', 'p0')
    expect(kannBauen(s, 'p0', 'kevelaer').erlaubt).toBe(false)
    expect(kannBauen(s, 'p0', 'kevelaer').grund).toMatch(/Gruppe/)
  })

  it('baut Stufe für Stufe und bucht die Kosten ab', () => {
    let s = mitKompletterGruppe()
    const vorher = spielerMit(s, 'p0')!.taler
    s = bauen(s, 'kevelaer')
    expect(s.besitz['kevelaer']!.stufe).toBe(1)
    expect(spielerMit(s, 'p0')!.taler).toBe(vorher - baukosten('kevelaer'))
  })

  it('verlangt gleichmäßiges Bauen innerhalb der Gruppe', () => {
    let s = mitKompletterGruppe()
    s = bauen(s, 'kevelaer')
    expect(kannBauen(s, 'p0', 'kevelaer').erlaubt).toBe(false)
    expect(kannBauen(s, 'p0', 'grevenbroich').erlaubt).toBe(true)
  })

  it('baut nicht über Stufe 4 hinaus', () => {
    let s = mitKompletterGruppe()
    for (let runde = 0; runde < 4; runde++) {
      for (const id of ['kevelaer', 'grevenbroich', 'krefeld']) s = bauen(s, id)
    }
    expect(s.besitz['kevelaer']!.stufe).toBe(4)
    expect(kannBauen(s, 'p0', 'kevelaer').erlaubt).toBe(false)
    const vorher = s
    expect(bauen(s, 'kevelaer')).toBe(vorher)
  })

  it('baut bei Baustopp gar nicht', () => {
    let s = mitKompletterGruppe()
    s = { ...s, spieler: s.spieler.map((p) => (p.id === 'p0' ? { ...p, bauverbotBis: s.runde } : p)) }
    expect(kannBauen(s, 'p0', 'kevelaer').grund).toBe('Baustopp')
  })

  it('erstattet beim Rückbau die Hälfte', () => {
    let s = bauen(mitKompletterGruppe(), 'kevelaer')
    const vorher = spielerMit(s, 'p0')!.taler
    s = abreissen(s, 'kevelaer')
    expect(s.besitz['kevelaer']!.stufe).toBe(0)
    expect(spielerMit(s, 'p0')!.taler).toBe(vorher + Math.round(baukosten('kevelaer') / 2))
  })

  it('gibt ein unbebautes Grundstück an die Bank zurück', () => {
    let s = gibFeld(partie(), 'kevelaer', 'p0')
    const vorher = spielerMit(s, 'p0')!.taler
    s = anBankVerkaufen(s, 'kevelaer')
    expect(s.besitz['kevelaer']!.besitzerId).toBeNull()
    expect(spielerMit(s, 'p0')!.taler).toBe(vorher + Math.round(kaufpreis('kevelaer') / 2))
  })

  it('verkauft kein bebautes Grundstück an die Bank', () => {
    const s = bauen(mitKompletterGruppe(), 'kevelaer')
    expect(anBankVerkaufen(s, 'kevelaer')).toBe(s)
  })
})

describe('Zahlungsnot und Insolvenz', () => {
  it('versilbert Gebäude, bevor jemand ausscheidet', () => {
    let s = partie()
    for (const id of ['kevelaer', 'grevenbroich', 'krefeld']) s = gibFeld(s, id, 'p0')
    s = { ...s, phase: 'zug_ende' }
    s = bauen(bauen(bauen(s, 'kevelaer'), 'grevenbroich'), 'krefeld')
    s = { ...s, spieler: s.spieler.map((p) => (p.id === 'p0' ? { ...p, taler: 50 } : p)) }
    s = gibFeld(s, 'hannover', 'p1')
    s = setzeAuf(s, 'p0', 37)
    s = ankommen({ ...s, phase: 'bewegen', zielPosition: 39, wuerfel: [1, 1] })
    expect(spielerMit(s, 'p0')!.insolvent).toBe(false)
    expect(besitzVon(s, 'p0').some((b) => b.stufe === 0)).toBe(true)
  })

  it('lässt ausscheiden, wer gar nichts mehr hat', () => {
    let s = gibFeld(partie(), 'hannover', 'p1', 4)
    s = gibFeld(s, 'neuss', 'p1')
    s = { ...s, spieler: s.spieler.map((p) => (p.id === 'p0' ? { ...p, taler: 10 } : p)) }
    s = setzeAuf(s, 'p0', 37)
    s = ankommen({ ...s, phase: 'bewegen', zielPosition: 39, wuerfel: [1, 1] })
    expect(spielerMit(s, 'p0')!.insolvent).toBe(true)
    expect(s.phase).toBe('ende')
    expect(s.siegerId).toBe('p1')
  })

  it('gibt den Besitz des Ausgeschiedenen an den Gläubiger', () => {
    let s = gibFeld(partie(), 'hannover', 'p1', 4)
    s = gibFeld(s, 'neuss', 'p1')
    s = gibFeld(s, 'kevelaer', 'p0')
    s = { ...s, spieler: s.spieler.map((p) => (p.id === 'p0' ? { ...p, taler: 10 } : p)) }
    s = setzeAuf(s, 'p0', 37)
    s = ankommen({ ...s, phase: 'bewegen', zielPosition: 39, wuerfel: [1, 1] })
    expect(s.besitz['kevelaer']!.besitzerId).toBe('p1')
  })
})

describe('Zugfolge', () => {
  it('gibt nach dem Zug an den nächsten Spieler weiter', () => {
    let s: SpielZustand = { ...partie(), phase: 'zug_ende' }
    s = zugBeenden(s)
    expect(s.amZug).toBe(1)
    expect(s.phase).toBe('wuerfeln')
  })

  it('zählt eine Runde hoch, wenn alle dran waren', () => {
    let s: SpielZustand = { ...partie(), phase: 'zug_ende' }
    s = zugBeenden(s)
    s = zugBeenden({ ...s, phase: 'zug_ende' })
    expect(s.amZug).toBe(0)
    expect(s.runde).toBe(2)
  })

  it('überspringt ausgeschiedene Spieler', () => {
    let s = partie({
      spieler: [
        { name: 'A', typ: 'mensch' },
        { name: 'B', typ: 'mensch' },
        { name: 'C', typ: 'mensch' },
      ],
    })
    s = {
      ...s,
      phase: 'zug_ende',
      spieler: s.spieler.map((p) => (p.id === 'p1' ? { ...p, insolvent: true } : p)),
    }
    s = zugBeenden(s)
    expect(s.amZug).toBe(2)
  })

  it('lässt bei Pasch denselben Spieler noch einmal', () => {
    let s: SpielZustand = { ...partie(), phase: 'zug_ende', paschSerie: 1 }
    s = zugBeenden(s)
    expect(s.amZug).toBe(0)
    expect(s.phase).toBe('wuerfeln')
  })

  it('beendet den Zug nicht, solange etwas offen ist', () => {
    const s: SpielZustand = {
      ...partie(),
      phase: 'feld',
      kaufAngebot: { position: 1, feldId: 'kevelaer', preis: 400 },
    }
    expect(zugOffen(s)).toBe(true)
    expect(zugBeenden(s)).toBe(s)
  })

  it('endet mit Erreichen des Rundenlimits', () => {
    // Weniger als MIN_RUNDEN_LIMIT geht nicht, das begrenzt erstellePartie.
    let s: SpielZustand = { ...partie({ rundenLimit: 5 }), phase: 'zug_ende' }
    expect(s.rundenLimit).toBe(5)
    for (let i = 0; i < 10 && s.phase !== 'ende'; i++) {
      s = zugBeenden({ ...s, phase: 'zug_ende' })
    }
    expect(s.phase).toBe('ende')
    expect(s.runde).toBe(6)
    expect(s.siegerId).not.toBeNull()
  })
})

describe('Spielende', () => {
  it('sortiert den Endstand nach Vermögen', () => {
    const s = gibFeld(partie(), 'hannover', 'p1')
    const tabelle = endstand(s)
    expect(tabelle[0]!.spielerId).toBe('p1')
    expect(tabelle[0]!.vermoegen).toBeGreaterThan(tabelle[1]!.vermoegen)
  })

  it('rechnet Vermögen aus Bargeld, Grundstücken und Gebäuden', () => {
    const s = gibFeld(partie(), 'kevelaer', 'p0', 2)
    expect(vermoegen(s, 'p0')).toBe(
      START_KAPITAL + kaufpreis('kevelaer') + baukosten('kevelaer') * 2,
    )
  })

  it('zählt ausgeschiedene Spieler mit null', () => {
    let s = partie()
    s = { ...s, spieler: s.spieler.map((p) => (p.id === 'p1' ? { ...p, insolvent: true } : p)) }
    expect(endstand(s).find((e) => e.spielerId === 'p1')!.vermoegen).toBe(0)
  })

  it('beendet die Partie beim Aufgeben des vorletzten Spielers', () => {
    const s = aufgeben(partie(), 'p1')
    expect(s.phase).toBe('ende')
    expect(s.siegerId).toBe('p0')
  })

  it('gibt aufgegebene Grundstücke an die Bank zurück', () => {
    let s = gibFeld(
      partie({
        spieler: [
          { name: 'A', typ: 'mensch' },
          { name: 'B', typ: 'mensch' },
          { name: 'C', typ: 'mensch' },
        ],
      }),
      'kevelaer',
      'p1',
    )
    s = aufgeben(s, 'p1')
    expect(s.besitz['kevelaer']!.besitzerId).toBeNull()
    expect(s.phase).not.toBe('ende')
  })

  it('kürt beim manuellen Beenden den Reichsten', () => {
    const s = beenden(gibFeld(partie(), 'hannover', 'p1'))
    expect(s.siegerId).toBe('p1')
  })
})

describe('Karten und Rollen', () => {
  it('wendet eine Geldkarte an und legt sie ab', () => {
    let s = setzeAuf(partie(), 'p0', 1)
    s = ankommen({ ...s, phase: 'bewegen', zielPosition: 2, wuerfel: [1, 0] })
    expect(s.offeneKarte).not.toBeNull()
    const vorher = spielerMit(s, 'p0')!.taler
    s = karteAnwenden(s)
    expect(s.offeneKarte).toBeNull()
    expect(spielerMit(s, 'p0')!.taler).not.toBe(vorher)
  })

  it('zahlt die Königsaktion nur einmal je Partie', () => {
    let s = partie()
    s = { ...s, spieler: s.spieler.map((p) => (p.id === 'p0' ? { ...p, rolle: 'koenig' as const } : p)) }
    const vorher = spielerMit(s, 'p0')!.taler
    s = koenigsaktion(s)
    expect(spielerMit(s, 'p0')!.taler).toBe(vorher + 1500)
    const nachher = s
    s = koenigsaktion(s)
    expect(s).toBe(nachher)
  })

  it('gibt dem Schützen mehr Minispiel-Belohnung', () => {
    let s = partie()
    s = { ...s, spieler: s.spieler.map((p) => (p.id === 'p0' ? { ...p, rolle: 'schuetze' as const } : p)) }
    s = { ...s, offenesMinispiel: { spielerId: 'p0', minispiel: 'praezision', anlass: 'feld' } }
    const vorher = spielerMit(s, 'p0')!.taler
    s = minispielAbschliessen(s, 'gold')
    expect(spielerMit(s, 'p0')!.taler).toBe(vorher + Math.round(3000 * 1.25))
    expect(spielerMit(s, 'p0')!.medaillen).toEqual(['gold'])
  })

  it('zahlt bei "keine Medaille" nichts aus', () => {
    let s = partie()
    s = { ...s, offenesMinispiel: { spielerId: 'p0', minispiel: 'praezision', anlass: 'feld' } }
    const vorher = spielerMit(s, 'p0')!.taler
    s = minispielAbschliessen(s, 'keine')
    expect(spielerMit(s, 'p0')!.taler).toBe(vorher)
  })

  it('erlässt mit Vereinsfreundschaft genau eine Gebühr', () => {
    let s = gibFeld(partie(), 'hannover', 'p1')
    s = { ...s, spieler: s.spieler.map((p) => (p.id === 'p0' ? { ...p, gebuehrErlassen: true } : p)) }
    s = setzeAuf(s, 'p0', 37)
    const vorher = spielerMit(s, 'p0')!.taler
    s = ankommen({ ...s, phase: 'bewegen', zielPosition: 39, wuerfel: [1, 1] })
    expect(spielerMit(s, 'p0')!.taler).toBe(vorher)
    expect(spielerMit(s, 'p0')!.gebuehrErlassen).toBe(false)
  })
})

describe('Der aktive Spieler', () => {
  it('ist der, der am Zug ist', () => {
    const s = partie()
    expect(aktiverSpieler(s).id).toBe('p0')
    expect(aktiverSpieler({ ...s, amZug: 1 }).id).toBe('p1')
  })
})
