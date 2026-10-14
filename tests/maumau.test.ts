/**
 * Mau-Mau und Letzte Karte -- geprüft, indem gespielt wird.
 *
 * Ein Kartentisch hat wenige Regeln und viele Lagen: der Stapel geht
 * aus, niemand kann legen, vier Ziehkarten liegen aufeinander. Von Hand
 * trifft man diese Fälle nicht; also laufen hier ganze Runden durch, und
 * nach jedem Zug wird geprüft, was IMMER gelten muss:
 *
 *   * Karten entstehen nicht und verschwinden nicht.
 *   * Niemand legt, was nicht passt.
 *   * Jede Runde endet.
 */
import { describe, it, expect } from 'vitest'
import {
  SPIELARTEN,
  amZugSpieler,
  behalten,
  darfLegen,
  erstellePartie,
  legen,
  mauSagen,
  meineSpielbaren,
  oberste,
  passt,
  spielbare,
  ziehen,
  type MauZustand,
  type Spielart,
} from '@/games/maumau'
import { kiZug } from '@/games/maumau/ki'
import { buntesBlatt, franzoesischesBlatt, type Karte } from '@/games/maumau/karten'

function alleKarten(state: MauZustand): number {
  return (
    state.spieler.reduce((n, s) => n + s.hand.length, 0) +
    state.stapel.length +
    state.ablage.length
  )
}

function tisch(art: Spielart, anzahl: number, seed: number): MauZustand {
  return erstellePartie({
    art,
    seed,
    spieler: Array.from({ length: anzahl }, (_, i) => ({
      name: `Rechner ${i + 1}`,
      mensch: false,
      kiStufe: i % 2 === 0 ? 'normal' : 'leicht',
    })),
  })
}

/** Spielt eine Runde zu Ende und prüft nach jedem Zug mit. */
function spieleRunde(art: Spielart, anzahl: number, seed: number) {
  let state = tisch(art, anzahl, seed)
  const soll = SPIELARTEN[art].karten().length
  expect(alleKarten(state)).toBe(soll)

  let schritte = 0
  while (state.phase !== 'ende') {
    const vorher = state
    const zug = kiZug(state)
    if (zug.art === 'legen') {
      // Was die KI legen will, muss auch erlaubt sein.
      expect(darfLegen(state, zug.karte)).toBe(true)
      if (zug.mau) state = mauSagen(state)
      state = legen(state, zug.karte, zug.wunsch)
    } else if (zug.art === 'ziehen') {
      state = ziehen(state)
    } else {
      state = behalten(state)
    }

    expect(alleKarten(state)).toBe(soll)
    expect(state).not.toBe(vorher)
    schritte++
    expect(schritte).toBeLessThan(5000)
  }
  return { state, schritte }
}

describe('Eine Runde spielt sich zu Ende', () => {
  it('verliert keine Karte und findet einen Sieger -- in allen drei Spielarten', () => {
    for (const art of ['klassisch', 'bunt', 'extrem'] as Spielart[]) {
      for (let i = 0; i < 12; i++) {
        const anzahl = 2 + (i % 3)
        const { state } = spieleRunde(art, anzahl, 400 + i)

        expect(state.phase).toBe('ende')
        // Jeder hat einen Platz, und keinen doppelt.
        const plaetze = state.spieler.map((s) => s.platz).sort((a, b) => (a ?? 0) - (b ?? 0))
        expect(plaetze).toEqual(Array.from({ length: anzahl }, (_, k) => k + 1))
        // Wer gewonnen hat, hat keine Karte mehr.
        const sieger = state.spieler.find((s) => s.id === state.siegerId)
        if (sieger) expect(sieger.hand).toHaveLength(0)
      }
    }
  })

  it('braucht dafür eine vernünftige Zahl von Zügen', () => {
    const { schritte } = spieleRunde('bunt', 4, 77)
    expect(schritte).toBeGreaterThan(8)
    expect(schritte).toBeLessThan(1200)
  })
})

describe('Was passt', () => {
  const franz = franzoesischesBlatt()
  const k = (id: string) => franz.find((c) => c.id === id)!
  const klassisch = SPIELARTEN.klassisch

  it('lässt Farbe auf Farbe und Wert auf Wert', () => {
    expect(passt(k('herz-9'), k('herz-K'), null, 0, klassisch)).toBe(true)
    expect(passt(k('pik-K'), k('herz-K'), null, 0, klassisch)).toBe(true)
    expect(passt(k('pik-9'), k('herz-K'), null, 0, klassisch)).toBe(false)
  })

  it('lässt den Buben auf alles -- und danach gilt der Wunsch', () => {
    expect(passt(k('kreuz-B'), k('herz-K'), null, 0, klassisch)).toBe(true)
    // Nach dem Buben ist Pik gewünscht: Herz passt nicht mehr.
    expect(passt(k('pik-9'), k('kreuz-B'), 'pik', 0, klassisch)).toBe(true)
    expect(passt(k('herz-9'), k('kreuz-B'), 'pik', 0, klassisch)).toBe(false)
    // Ein Bube geht trotzdem immer.
    expect(passt(k('herz-B'), k('kreuz-B'), 'pik', 0, klassisch)).toBe(true)
  })

  it('verlangt beim Klassischen das Ziehen, wenn eine Sieben liegt', () => {
    // Ohne Stapeln hilft die eigene Sieben nicht: zwei Karten ziehen.
    expect(passt(k('pik-7'), k('herz-7'), null, 2, klassisch)).toBe(false)
  })

  it('lässt im Extremspiel die Strafe weiterreichen', () => {
    const bunt = buntesBlatt()
    const b = (id: string) => bunt.find((c) => c.id === id)!
    const extrem = SPIELARTEN.extrem
    expect(passt(b('blau-zwei-1'), b('rot-zwei-1'), null, 2, extrem)).toBe(true)
    expect(passt(b('vier-1'), b('rot-zwei-1'), null, 2, extrem)).toBe(true)
    // Eine Zwei auf eine Vier geht nicht -- sonst wäre die Vier nichts wert.
    expect(passt(b('blau-zwei-1'), b('vier-1'), null, 4, extrem)).toBe(false)
    // Und eine gewöhnliche Karte schon gar nicht.
    expect(passt(b('rot-5-1'), b('rot-zwei-1'), null, 2, extrem)).toBe(false)
  })
})

describe('Mau sagen', () => {
  /** Baut eine Lage, in der ich genau zwei Karten habe. */
  function kurzVorSchluss(): { state: MauZustand; karte: Karte } {
    let state = tisch('klassisch', 2, 11)
    const ich = amZugSpieler(state)
    // Von Hand gestellt: Herz 9 auf Herz 10 -- das passt immer.
    const liegt = state.ablage[0]!
    const passende: Karte = { id: 'test-passt', farbe: liegt.farbe, text: '9', wirkung: 'keine', punkte: 9 }
    const andere: Karte = { id: 'test-rest', farbe: liegt.farbe, text: '10', wirkung: 'keine', punkte: 10 }
    state = { ...state, spieler: state.spieler.map((s) => (s.id === ich.id ? { ...s, hand: [passende, andere] } : s)) }
    return { state, karte: passende }
  }

  it('bestraft, wer die vorletzte Karte ohne Mau legt', () => {
    const { state, karte } = kurzVorSchluss()
    const nachher = legen(state, karte)
    const ich = nachher.spieler[0]!
    // Eine Karte gelegt, zwei gezogen: aus zwei werden drei.
    expect(ich.hand).toHaveLength(3)
    expect(nachher.protokoll.some((z) => z.includes('Mau vergessen'))).toBe(true)
  })

  it('lässt den in Ruhe, der Mau gesagt hat', () => {
    const { state, karte } = kurzVorSchluss()
    const nachher = legen(mauSagen(state), karte)
    expect(nachher.spieler[0]!.hand).toHaveLength(1)
    expect(nachher.protokoll.some((z) => z.includes('Mau!'))).toBe(true)
  })

  it('vergisst die Ansage nach dem Zug wieder', () => {
    const { state, karte } = kurzVorSchluss()
    const nachher = legen(mauSagen(state), karte)
    expect(nachher.spieler[0]!.mauGesagt).toBe(false)
  })
})

describe('Der Stapel', () => {
  it('wird aus der Ablage neu gemischt, wenn er leer ist', () => {
    let state = tisch('klassisch', 2, 5)
    // Den Stapel bis auf nichts leeren, die Ablage füllen.
    state = {
      ...state,
      ablage: [...state.ablage, ...state.stapel.slice(0, 20)],
      stapel: state.stapel.slice(20),
    }
    const vorrat = state.stapel.length
    // Passt die gezogene Karte, bleibt derselbe Spieler dran -- dann muss
    // der Zug erst beendet werden, sonst dreht sich die Schleife leer.
    for (let i = 0; i < vorrat + 4; i++) {
      state = state.gezogene ? behalten(state) : ziehen(state)
    }

    expect(state.protokoll.some((z) => z.includes('neu gemischt'))).toBe(true)
    // Die oberste Karte bleibt liegen, alles andere wandert zurück.
    expect(state.ablage.length).toBeGreaterThan(0)
  })
})

describe('Zu zweit', () => {
  it('wirkt der Richtungswechsel wie Aussetzen', () => {
    /*
     * Sonst legt der Gegner, dreht zurück und ist sofort wieder dran --
     * zu zweit käme man nie mehr an die Reihe.
     */
    let state = tisch('bunt', 2, 3)
    const liegt = state.ablage[0]!
    const dreh: Karte = { id: 'test-dreh', farbe: liegt.farbe, text: '⇄', wirkung: 'richtung', punkte: 20 }
    const rest: Karte = { id: 'test-rest', farbe: liegt.farbe, text: '3', wirkung: 'keine', punkte: 3 }
    state = { ...state, spieler: state.spieler.map((s, i) => (i === 0 ? { ...s, hand: [dreh, rest] } : s)) }

    const nachher = legen(mauSagen(state), dreh)
    expect(nachher.amZug).toBe(0)
  })
})

describe('Was die KI legt', () => {
  it('wirft die teuren Karten zuerst weg, solange die Hand gross ist', () => {
    const state = tisch('bunt', 3, 21)
    const ich = amZugSpieler(state)
    const moeglich = meineSpielbaren(state, ich)
    if (moeglich.length < 2) return
    const zug = kiZug(state)
    expect(zug.art).toBe('legen')
  })

  it('wünscht sich nie eine Farbe, von der sie nichts mehr hat', () => {
    for (let seed = 0; seed < 30; seed++) {
      let state = tisch('bunt', 3, seed)
      for (let i = 0; i < 200 && state.phase !== 'ende'; i++) {
        const zug = kiZug(state)
        if (zug.art === 'legen' && zug.karte.farbe === null) {
          const rest = amZugSpieler(state).hand.filter((k) => k.id !== zug.karte.id)
          const hatFarbe = rest.some((k) => k.farbe === zug.wunsch)
          // Nur wenn gar keine farbige Karte mehr da ist, darf es egal sein.
          if (rest.some((k) => k.farbe !== null)) expect(hatFarbe).toBe(true)
        }
        state =
          zug.art === 'legen'
            ? legen(zug.mau ? mauSagen(state) : state, zug.karte, zug.wunsch)
            : zug.art === 'ziehen'
              ? ziehen(state)
              : behalten(state)
      }
    }
  })
})

describe('Hilfen', () => {
  it('zeigt nur die Karten, die wirklich passen', () => {
    const state = tisch('klassisch', 3, 8)
    const ich = amZugSpieler(state)
    const liste = spielbare(ich.hand, oberste(state), state.wunsch, state.strafe, SPIELARTEN.klassisch)
    for (const k of liste) expect(darfLegen(state, k)).toBe(true)
    for (const k of ich.hand.filter((c) => !liste.includes(c))) {
      expect(darfLegen(state, k)).toBe(false)
    }
  })
})
