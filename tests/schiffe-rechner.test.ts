/**
 * Der Computer bei Schiffe versenken: Er schießt nur auf freie Felder, sieht
 * nie die fremde Flotte -- und die Stufen unterscheiden sich messbar.
 */
import { describe, it, expect } from 'vitest'
import {
  STANDARD_REGELN,
  felderVon,
  neuePartie,
  schiesse,
  sichtFuer,
  waehleSchuss,
  wahrscheinlichkeiten,
  zufallsFlotte,
  type Partie,
  type SchiffeRegeln,
  type SchiffeStufe,
} from '@/games/schiffe-versenken'
import { mulberry32 } from '@/games/rng'

/** Wie viele Schüsse braucht eine Stufe, um eine zufällige Flotte ganz zu versenken? */
function schuesseBisVersenkt(stufe: SchiffeStufe, seed: number, regeln: SchiffeRegeln): number {
  const zufall = mulberry32(seed)
  // Spieler 1 schießt nie zurück: Nach jedem Schuss ist wieder Spieler 0 dran.
  let p: Partie = neuePartie(regeln, zufallsFlotte(regeln, zufall), zufallsFlotte(regeln, zufall))
  let n = 0
  while (!p.ende && n < 100) {
    p = { ...p, amZug: 0 }
    const sicht = sichtFuer(p, 0)
    const feld = waehleSchuss(
      { regeln: p.regeln, schuesse: sicht.eigeneSchuesse, versenkte: sicht.gegnerFlotte },
      stufe,
      zufall,
    )
    const neu = schiesse(p, feld)
    expect(neu, `${stufe}: Schuss auf ein beschossenes Feld`).not.toBeNull()
    p = neu!
    n++
  }
  return n
}

function schnitt(stufe: SchiffeStufe, regeln: SchiffeRegeln = STANDARD_REGELN, partien = 60) {
  let summe = 0
  for (let i = 0; i < partien; i++) summe += schuesseBisVersenkt(stufe, 1000 + i, regeln)
  return summe / partien
}

describe('Der Computer', () => {
  it('schwer braucht deutlich weniger Schüsse als mittel, mittel weniger als leicht', () => {
    const leicht = schnitt('leicht')
    const mittel = schnitt('mittel')
    const schwer = schnitt('schwer')
    expect(leicht).toBeGreaterThan(mittel + 5)
    expect(mittel).toBeGreaterThan(schwer + 3)
    expect(leicht - schwer).toBeGreaterThan(20)
    // Zur Einordnung: Zufall allein braucht im Schnitt rund 95 Schüsse.
    expect(schwer).toBeLessThan(55)
  })

  it('auch ohne „nicht berühren"', () => {
    const regeln = { nichtBeruehren: false, nochmalNachTreffer: false }
    expect(schnitt('leicht', regeln, 30)).toBeGreaterThan(schnitt('schwer', regeln, 30) + 15)
  })

  it('jagt nach einem Treffer am Schiff entlang (mittel und schwer)', () => {
    const regeln = STANDARD_REGELN
    for (const stufe of ['mittel', 'schwer'] as const) {
      const feld = waehleSchuss(
        {
          regeln,
          schuesse: [
            { feld: 44, ergebnis: 'treffer' },
            { feld: 45, ergebnis: 'treffer' },
          ],
          versenkte: [],
        },
        stufe,
        mulberry32(3),
      )
      expect([43, 46]).toContain(feld)
    }
  })

  it('schwer lässt den Wassergürtel um versenkte Schiffe aus', () => {
    const versenkt = { id: 'schnellboot' as const, laenge: 2, x: 4, y: 4, richtung: 'h' as const }
    const karte = wahrscheinlichkeiten({
      regeln: STANDARD_REGELN,
      schuesse: felderVon(versenkt).map((feld, i) => ({
        feld,
        ergebnis: i === 1 ? ('versenkt' as const) : ('treffer' as const),
        ...(i === 1 ? { schiff: 'schnellboot' as const } : {}),
      })),
      versenkte: [versenkt],
    })
    for (const f of [33, 34, 35, 36, 43, 46, 53, 54, 55, 56]) expect(karte[f]).toBe(0)
    expect(karte[0]).toBeGreaterThan(0)
  })

  it('ist schnell genug fürs Handy', () => {
    const start = performance.now()
    schuesseBisVersenkt('schwer', 42, STANDARD_REGELN)
    // Eine ganze Partie, also bis zu hundert Karten, deutlich unter einer Sekunde.
    expect(performance.now() - start).toBeLessThan(1500)
  })
})
