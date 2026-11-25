import { describe, expect, it } from 'vitest'
import {
  naechstesZiel,
  punkteBisNaechsterStern,
  KNAPP_ANTEIL,
} from '@/components/levelziel/naechstesZiel'
import { zielText } from '@/components/levelziel/zielText'
import { WOERTERBUECHER } from '@/i18n/sprache'
import { bienenFlowGame } from '@/games/bienen-flow'
import { kopfrechnenGame } from '@/games/kopfrechnen'
import { sterneFuer, maximalePunkte } from '@/games/sudoku'

const de = WOERTERBUECHER.de
const en = WOERTERBUECHER.en

describe('punkteBisNaechsterStern', () => {
  const sterne = (p: number) => (p >= 900 ? 5 : p >= 750 ? 4 : p >= 500 ? 3 : p >= 250 ? 2 : 1)

  it('findet die nächste Schwelle genau', () => {
    expect(punkteBisNaechsterStern(sterne, 620, 1000)).toEqual({ fehlend: 130, sterne: 4 })
    expect(punkteBisNaechsterStern(sterne, 749, 1000)).toEqual({ fehlend: 1, sterne: 4 })
    expect(punkteBisNaechsterStern(sterne, 100, 1000)).toEqual({ fehlend: 150, sterne: 2 })
  })

  it('gibt nichts bei vollen Sternen oder unerreichbarer Schwelle', () => {
    expect(punkteBisNaechsterStern(sterne, 950, 1000)).toBeNull()
    expect(punkteBisNaechsterStern(sterne, 800, 880)).toBeNull()
    expect(punkteBisNaechsterStern(sterne, 1000, 1000)).toBeNull()
  })

  it('liest die echten Schwellen der Spiele, ohne sie zu kennen', () => {
    // Bienen-Flow Level 5: Grund 440, drei Sterne ab Grund + 100.
    const bienen = (p: number) => bienenFlowGame.calculateStars?.(5, p) ?? 0
    expect(punkteBisNaechsterStern(bienen, 480, 720)).toEqual({ fehlend: 60, sterne: 3 })
    // Kopfrechnen: 9 von 10 richtig = 900 Punkte, vier Sterne; der fünfte bei 1000.
    const kopf = (p: number) => kopfrechnenGame.calculateStars?.(1, p) ?? 0
    expect(punkteBisNaechsterStern(kopf, 900, 1000)).toEqual({ fehlend: 100, sterne: 5 })
    // Sudoku: der Stern hängt am Anteil an der Höchstpunktzahl.
    const max = maximalePunkte(1)
    const s = punkteBisNaechsterStern((p) => sterneFuer(1, p), Math.floor(max * 0.6), max)
    expect(s?.sterne).toBe(3)
    expect(sterneFuer(1, Math.floor(max * 0.6) + s!.fehlend)).toBe(3)
    expect(sterneFuer(1, Math.floor(max * 0.6) + s!.fehlend - 1)).toBe(2)
  })
})

describe('naechstesZiel', () => {
  it('neuer Rekord geht vor allem anderen', () => {
    expect(
      naechstesZiel({
        level: 7,
        maxLevel: 500,
        geschafft: true,
        punkte: 820,
        bisherBest: 700,
        naechsterStern: { fehlend: 80, sterne: 5 },
      }),
    ).toEqual({ art: 'neuerRekord', um: 120 })
  })

  it('knapp verpasster Rekord, aber kein entmutigend weiter', () => {
    expect(
      naechstesZiel({ level: 7, maxLevel: 500, geschafft: true, punkte: 650, bisherBest: 700 }),
    ).toEqual({ art: 'rekordVerpasst', fehlend: 50 })
    const weit = 700 - Math.ceil(700 * KNAPP_ANTEIL) - 1
    expect(
      naechstesZiel({ level: 7, maxLevel: 500, geschafft: true, punkte: weit, bisherBest: 700 })
        .art,
    ).toBe('bisZumTor')
  })

  it('ohne Rekord (erstes Mal): Punkte bis zum nächsten Stern', () => {
    expect(
      naechstesZiel({
        level: 3,
        maxLevel: 500,
        geschafft: true,
        punkte: 380,
        bisherBest: null,
        naechsterStern: { fehlend: 120, sterne: 3 },
      }),
    ).toEqual({ art: 'sterne', fehlend: 120, sterne: 3 })
  })

  it('gleich viel wie der Rekord: weiter zum Tor', () => {
    expect(
      naechstesZiel({ level: 13, maxLevel: 500, geschafft: true, punkte: 1000, bisherBest: 1000 }),
    ).toEqual({ art: 'bisZumTor', level: 7 })
  })

  it('das Torlevel öffnet das Tor', () => {
    expect(naechstesZiel({ level: 20, maxLevel: 500, geschafft: true, punkte: 1000 })).toEqual({
      art: 'torOffen',
    })
    // Sudoku: Tore alle zehn Stufen.
    expect(
      naechstesZiel({ level: 10, maxLevel: 50, abschnitt: 10, geschafft: true, punkte: 500 }),
    ).toEqual({ art: 'torOffen' })
  })

  it('am Ende der Strecke: alles geschafft, auch über das Maximum hinaus', () => {
    expect(naechstesZiel({ level: 500, maxLevel: 500, geschafft: true, punkte: 900 })).toEqual({
      art: 'allesGeschafft',
      maxLevel: 500,
    })
    expect(naechstesZiel({ level: 999, maxLevel: 50, geschafft: true })).toEqual({
      art: 'allesGeschafft',
      maxLevel: 50,
    })
  })

  it('kurz vor dem Ende zählt das letzte Level als Tor', () => {
    expect(naechstesZiel({ level: 147, maxLevel: 150, geschafft: true })).toEqual({
      art: 'bisZumTor',
      level: 3,
    })
  })

  it('nicht geschafft: das Level selbst zählt mit', () => {
    expect(naechstesZiel({ level: 18, maxLevel: 500, geschafft: false })).toEqual({
      art: 'bisZumTor',
      level: 3,
    })
    expect(naechstesZiel({ level: 20, maxLevel: 500, geschafft: false })).toEqual({
      art: 'bisZumTor',
      level: 1,
    })
  })

  it('Die perfekte Sekunde: knapp außerhalb der Toleranz', () => {
    expect(naechstesZiel({ level: 4, maxLevel: 500, geschafft: false, daneben: 0.03 })).toEqual({
      art: 'knapp',
      sekunden: 0.03,
    })
    // Genau auf der Grenze ist kein "knapp" -- dann bleibt das Tor.
    expect(naechstesZiel({ level: 4, maxLevel: 500, geschafft: false, daneben: 0 }).art).toBe(
      'bisZumTor',
    )
  })

  it('mit Hilfe aus dem Video: weder Rekord noch Sterne', () => {
    expect(
      naechstesZiel({
        level: 7,
        maxLevel: 500,
        geschafft: true,
        punkte: 900,
        bisherBest: 500,
        naechsterStern: { fehlend: 10, sterne: 5 },
        mitHilfe: true,
      }),
    ).toEqual({ art: 'bisZumTor', level: 13 })
  })

  it('weit daneben ist nicht "knapp" -- höchstens eine Toleranz zählt', () => {
    expect(
      naechstesZiel({ level: 1, maxLevel: 500, geschafft: false, daneben: 0.05, toleranz: 0.1 }),
    ).toEqual({ art: 'knapp', sekunden: 0.05 })
    expect(
      naechstesZiel({ level: 1, maxLevel: 500, geschafft: false, daneben: 0.8, toleranz: 0.1 }),
    ).toEqual({ art: 'bisZumTor', level: 20 })
  })

  it('null Punkte ergeben keinen Rekordvergleich', () => {
    expect(
      naechstesZiel({ level: 2, maxLevel: 500, geschafft: true, punkte: 0, bisherBest: 400 }),
    ).toEqual({ art: 'bisZumTor', level: 18 })
  })
})

describe('zielText', () => {
  it('jede Art hat einen Satz, deutsch und englisch', () => {
    const faelle = [
      [{ art: 'neuerRekord', um: 120 }, '120 Punkte mehr', '120 points more'],
      [{ art: 'rekordVerpasst', fehlend: 1 }, 'um 1 Punkt verpasst', 'by 1 point'],
      [
        { art: 'sterne', fehlend: 120, sterne: 3 },
        'Noch 120 Punkte bis ⭐⭐⭐',
        '120 more points for ⭐⭐⭐',
      ],
      [{ art: 'torOffen' }, 'Tor offen', 'Gate open'],
      [{ art: 'bisZumTor', level: 2 }, 'Noch 2 Level bis zum Tor', '2 more levels to the gate'],
      [{ art: 'bisZumTor', level: 1 }, 'Noch 1 Level bis zum Tor', '1 more level to the gate'],
      [{ art: 'allesGeschafft', maxLevel: 500 }, 'Alle 500 Level', 'All 500 levels'],
      [{ art: 'knapp', sekunden: 0.03 }, 'Nur 0.030 s', 'Only 0.030 s'],
    ] as const
    for (const [ziel, deutsch, englisch] of faelle) {
      expect(zielText(de, ziel)).toContain(deutsch)
      expect(zielText(en, ziel)).toContain(englisch)
    }
  })
})
