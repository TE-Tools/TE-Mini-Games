/**
 * Das Brett und die Grundstücke: Zusammensetzung, Reihenfolge, Preise.
 *
 * Diese Prüfungen sind stumpf, aber sie fangen genau die Fehler ab, die
 * man beim Umbauen des Bretts macht -- ein Feld doppelt, eines vergessen,
 * eine Gruppe halb verteilt.
 */
import { describe, it, expect } from 'vitest'
import {
  BRETT,
  FELDER,
  GRUNDSTUECKE,
  GRUPPEN,
  SONDERFELDER,
  VERBANDSFELDER,
  ECKE_START,
  ECKE_STRAFBANK,
  ECKE_FREIES_FEST,
  ECKE_ZUR_STRAFBANK,
  AUSBAU_NAMEN,
  feldAn,
  kaufbareFelder,
  grundstueckeDerGruppe,
} from '@/games/schuetzenopoly'

describe('Brettaufbau', () => {
  it('hat genau 40 Felder', () => {
    expect(BRETT).toHaveLength(FELDER)
    expect(BRETT.map((f) => f.position)).toEqual(Array.from({ length: 40 }, (_, i) => i))
  })

  it('setzt sich zusammen wie im Konzept festgelegt', () => {
    const zaehle = (typ: string) => BRETT.filter((f) => f.typ === typ).length
    expect(zaehle('grundstueck')).toBe(22)
    expect(zaehle('sonderfeld')).toBe(4)
    expect(zaehle('verband')).toBe(2)
    expect(zaehle('ereignis')).toBe(3)
    expect(zaehle('vereinskarte')).toBe(3)
    expect(zaehle('minispiel')).toBe(2)
    expect(zaehle('start') + zaehle('strafbank') + zaehle('freies_fest') + zaehle('zur_strafbank')).toBe(4)
  })

  it('legt die vier Ecken auf 0, 10, 20 und 30', () => {
    expect(feldAn(ECKE_START).typ).toBe('start')
    expect(feldAn(ECKE_STRAFBANK).typ).toBe('strafbank')
    expect(feldAn(ECKE_FREIES_FEST).typ).toBe('freies_fest')
    expect(feldAn(ECKE_ZUR_STRAFBANK).typ).toBe('zur_strafbank')
  })

  it('führt jedes Grundstück genau einmal', () => {
    const aufDemBrett = BRETT.filter((f) => f.typ === 'grundstueck').map((f) => f.grundstueckId)
    expect(new Set(aufDemBrett).size).toBe(22)
    expect(new Set(aufDemBrett)).toEqual(new Set(GRUNDSTUECKE.map((g) => g.id)))
  })

  it('rechnet bei Positionen über das Brett hinaus im Kreis', () => {
    expect(feldAn(40)).toBe(feldAn(0))
    expect(feldAn(-1)).toBe(feldAn(39))
  })

  it('macht 28 Felder käuflich', () => {
    expect(kaufbareFelder()).toHaveLength(28)
  })

  it('verteilt starke Gruppen nicht an einem Stück', () => {
    for (const gruppe of GRUPPEN) {
      const positionen = grundstueckeDerGruppe(gruppe.id)
        .map((g) => BRETT.find((f) => f.grundstueckId === g.id)!.position)
        .sort((a, b) => a - b)
      // Zwischen erstem und letztem Feld einer Gruppe liegt immer noch etwas anderes.
      expect(positionen[positionen.length - 1]! - positionen[0]!).toBeGreaterThan(
        positionen.length - 1,
      )
    }
  })
})

describe('Grundstücke', () => {
  it('sind 22 Stück in 8 Gruppen', () => {
    expect(GRUNDSTUECKE).toHaveLength(22)
    expect(GRUPPEN).toHaveLength(8)
    const summe = GRUPPEN.reduce((n, g) => n + grundstueckeDerGruppe(g.id).length, 0)
    expect(summe).toBe(22)
  })

  it('hat keine Gruppe mit weniger als zwei Feldern', () => {
    for (const g of GRUPPEN) {
      expect(grundstueckeDerGruppe(g.id).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('macht Hannover zum teuersten und Neuss zum zweitteuersten Feld', () => {
    const sortiert = [...GRUNDSTUECKE].sort((a, b) => b.preis - a.preis)
    expect(sortiert[0]!.id).toBe('hannover')
    expect(sortiert[1]!.id).toBe('neuss')
  })

  it('lässt die Gebühr mit dem Preis steigen', () => {
    const sortiert = [...GRUNDSTUECKE].sort((a, b) => a.preis - b.preis)
    for (let i = 1; i < sortiert.length; i++) {
      expect(sortiert[i]!.grundgebuehr).toBeGreaterThanOrEqual(sortiert[i - 1]!.grundgebuehr)
    }
  })

  it('gibt zu jedem Grundstück eine Angabe zur Veranstaltung', () => {
    for (const g of GRUNDSTUECKE) {
      expect(g.veranstaltung.length).toBeGreaterThan(3)
      expect(g.fakt.length).toBeGreaterThan(20)
    }
  })

  it('nennt die Düsseldorfer Rheinkirmes nicht Schützenfest', () => {
    const d = GRUNDSTUECKE.find((g) => g.id === 'duesseldorf')!
    expect(d.art).toBe('kirmes')
    expect(d.veranstaltung.toLowerCase()).not.toContain('schützenfest')
  })

  it('nennt den Münchner Umzug nicht Schützenfest', () => {
    const m = GRUNDSTUECKE.find((g) => g.id === 'muenchen')!
    expect(m.art).toBe('umzug')
  })
})

describe('Namensdisziplin', () => {
  it('benutzt kein Gebäudewort als Sonderfeldname', () => {
    const gebaeude = AUSBAU_NAMEN.map((n) => n.toLowerCase())
    for (const s of SONDERFELDER) {
      expect(gebaeude).not.toContain(s.name.toLowerCase())
    }
    // "Schützenplatz" und "Festplatz" waren im Konzept ausdrücklich verboten.
    const verboten = ['schützenplatz', 'festplatz', 'schützenhalle', 'schützenzentrum']
    for (const s of SONDERFELDER) {
      expect(verboten).not.toContain(s.name.toLowerCase())
    }
  })

  it('hat vier Sonderfelder und zwei Verbandsfelder mit eigenen Namen', () => {
    expect(SONDERFELDER).toHaveLength(4)
    expect(VERBANDSFELDER).toHaveLength(2)
    const namen = [...SONDERFELDER, ...VERBANDSFELDER].map((f) => f.name)
    expect(new Set(namen).size).toBe(6)
  })
})
