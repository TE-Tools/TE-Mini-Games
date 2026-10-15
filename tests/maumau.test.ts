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
  KEIN_KONTER,
  SPIELARTEN,
  VOLLER_KONTER,
  aktiveRegeln,
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
    state.spieler.reduce((n, s) => n + s.hand.length, 0) + state.stapel.length + state.ablage.length
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
  const klassisch = aktiveRegeln('klassisch')

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

  it('lässt im Extremspiel jede Strafkarte weiterreichen', () => {
    const bunt = buntesBlatt()
    const b = (id: string) => bunt.find((c) => c.id === id)!
    const extrem = aktiveRegeln('extrem')
    expect(passt(b('blau-zwei-1'), b('rot-zwei-1'), null, 2, extrem)).toBe(true)
    expect(passt(b('vier-1'), b('rot-zwei-1'), null, 2, extrem)).toBe(true)
    expect(passt(b('blau-zwei-1'), b('vier-1'), null, 4, extrem)).toBe(true)
    expect(passt(b('vier-2'), b('vier-1'), null, 4, extrem)).toBe(true)
    // Eine gewöhnliche Karte kontert nie.
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
    const passende: Karte = {
      id: 'test-passt',
      farbe: liegt.farbe,
      text: '9',
      wirkung: 'keine',
      punkte: 9,
    }
    const andere: Karte = {
      id: 'test-rest',
      farbe: liegt.farbe,
      text: '10',
      wirkung: 'keine',
      punkte: 10,
    }
    state = {
      ...state,
      spieler: state.spieler.map((s) => (s.id === ich.id ? { ...s, hand: [passende, andere] } : s)),
    }
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
    const dreh: Karte = {
      id: 'test-dreh',
      farbe: liegt.farbe,
      text: '⇄',
      wirkung: 'richtung',
      punkte: 20,
    }
    const rest: Karte = {
      id: 'test-rest',
      farbe: liegt.farbe,
      text: '3',
      wirkung: 'keine',
      punkte: 3,
    }
    state = {
      ...state,
      spieler: state.spieler.map((s, i) => (i === 0 ? { ...s, hand: [dreh, rest] } : s)),
    }

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
    const liste = spielbare(
      ich.hand,
      oberste(state),
      state.wunsch,
      state.strafe,
      SPIELARTEN.klassisch,
    )
    for (const k of liste) expect(darfLegen(state, k)).toBe(true)
    for (const k of ich.hand.filter((c) => !liste.includes(c))) {
      expect(darfLegen(state, k)).toBe(false)
    }
  })
})

describe('Wer zuletzt gelegt hat', () => {
  it('steht im Zustand -- die Oberfläche lässt die Karte von dort losfliegen', () => {
    /*
     * Ohne diese Angabe müsste die Anzeige aus dem Protokolltext raten,
     * von welchem Platz die Karte kommt. Sie wird hier mitgeführt, weil
     * nur die Engine es sicher weiss.
     */
    let state = tisch('klassisch', 3, 31)
    expect(state.letzterLeger).toBeNull()

    for (let i = 0; i < 40 && state.phase !== 'ende'; i++) {
      const vorher = amZugSpieler(state).id
      const zug = kiZug(state)
      if (zug.art === 'legen') {
        state = legen(zug.mau ? mauSagen(state) : state, zug.karte, zug.wunsch)
        expect(state.letzterLeger).toBe(vorher)
        return
      }
      state = zug.art === 'ziehen' ? ziehen(state) : behalten(state)
    }
    throw new Error('In vierzig Zügen hat niemand gelegt')
  })
})

describe('Hausregeln einzeln', () => {
  /*
   * Thomas am 15.10.2026: "man kann entscheiden, ob 2 auf plus 2 geht,
   * 4 auf plus 4 geht, schwarze Karte auf schwarze Karte geht ... das
   * als Auswahlmöglichkeit."
   *
   * Fünf Schalter, und jeder muss für sich wirken: Wer nur „2 auf 2"
   * anmacht, darf keine Vier dazulegen können. Deshalb wird hier jede
   * Regel einzeln angeschaltet und beide Richtungen geprüft.
   */
  const bunt = buntesBlatt()
  const b = (id: string) => bunt.find((c) => c.id === id)!
  const zwei = () => b('blau-zwei-1')
  const andereZwei = () => b('rot-zwei-1')
  const vier = () => b('vier-1')
  const andereVier = () => b('vier-2')
  const wunsch = () => b('wunsch-1')

  const mit = (an: Partial<typeof KEIN_KONTER>) => aktiveRegeln('bunt', { konter: an })

  it('zwei auf zwei', () => {
    const regeln = mit({ zweiAufZwei: true })
    expect(passt(zwei(), andereZwei(), null, 2, regeln)).toBe(true)
    // Nur diese eine Regel: Eine Vier geht damit noch nicht.
    expect(passt(vier(), andereZwei(), null, 2, regeln)).toBe(false)
  })

  it('vier auf vier', () => {
    const regeln = mit({ vierAufVier: true })
    expect(passt(vier(), andereVier(), null, 4, regeln)).toBe(true)
    expect(passt(zwei(), andereVier(), null, 4, regeln)).toBe(false)
  })

  it('zwei auf vier und vier auf zwei sind zwei verschiedene Regeln', () => {
    const nurZweiAufVier = mit({ zweiAufVier: true })
    expect(passt(zwei(), vier(), null, 4, nurZweiAufVier)).toBe(true)
    expect(passt(vier(), zwei(), null, 2, nurZweiAufVier)).toBe(false)

    const nurVierAufZwei = mit({ vierAufZwei: true })
    expect(passt(vier(), zwei(), null, 2, nurVierAufZwei)).toBe(true)
    expect(passt(zwei(), vier(), null, 4, nurVierAufZwei)).toBe(false)
  })

  it('schwarz auf schwarz: die Wunschkarte kontert, ohne zu erhöhen', () => {
    const regeln = mit({ schwarzAufSchwarz: true })
    expect(passt(wunsch(), vier(), null, 4, regeln)).toBe(true)
    expect(passt(wunsch(), zwei(), null, 2, regeln)).toBe(true)
    // Ohne die Regel geht sie nicht.
    expect(passt(wunsch(), vier(), null, 4, mit({}))).toBe(false)
  })

  it('ohne Konter wird gezogen, auch mit passender Farbe auf der Hand', () => {
    const ohne = aktiveRegeln('bunt')
    expect(ohne.konter).toEqual(KEIN_KONTER)
    expect(passt(zwei(), andereZwei(), null, 2, ohne)).toBe(false)
    expect(passt(b('rot-5-1'), andereZwei(), null, 2, ohne)).toBe(false)
  })

  it('Extrem hat alle fünf an, Bunt keine', () => {
    expect(aktiveRegeln('extrem').konter).toEqual(VOLLER_KONTER)
    expect(aktiveRegeln('bunt').konter).toEqual(KEIN_KONTER)
    // Und die Spielart bleibt nur die Voreinstellung.
    expect(aktiveRegeln('extrem', { konter: { zweiAufVier: false } }).konter.zweiAufVier).toBe(
      false,
    )
    expect(aktiveRegeln('extrem', { konter: { zweiAufVier: false } }).konter.vierAufVier).toBe(true)
  })

  it('trägt die Hausregeln in der laufenden Partie mit', () => {
    // Sonst hinge eine Partie an einer Tabelle, die der nächste Tisch
    // anders stellt.
    const state = erstellePartie({
      art: 'bunt',
      seed: 1,
      hausregeln: { konter: { zweiAufZwei: true }, ziehenBisPassend: true },
      spieler: [
        { name: 'Du', mensch: true },
        { name: 'Ida', mensch: false, kiStufe: 'normal' },
      ],
    })
    expect(state.regeln.konter.zweiAufZwei).toBe(true)
    expect(state.regeln.konter.vierAufVier).toBe(false)
    expect(state.regeln.ziehenBisPassend).toBe(true)
    expect(state.regeln.art).toBe('bunt')
  })
})

describe('Schwarz auf Schwarz im Spiel', () => {
  it('gibt die offene Strafe weiter, ohne sie zu erhöhen', () => {
    /*
     * Die Wunschkarte zieht selbst nichts. Wer mit ihr kontert, zieht
     * also nicht -- aber der Nächste steht vor derselben Zahl. Genau das
     * macht die Regel aus; würde die Strafe dabei verfallen, wäre die
     * Wunschkarte ein Freifahrtschein.
     */
    const bunt = buntesBlatt()
    const b = (id: string) => bunt.find((c) => c.id === id)!
    const wunsch = b('wunsch-1')

    let state = erstellePartie({
      art: 'bunt',
      seed: 2,
      hausregeln: { konter: { schwarzAufSchwarz: true } },
      spieler: [
        { name: 'Du', mensch: true },
        { name: 'Ida', mensch: false, kiStufe: 'normal' },
      ],
    })
    // Lage stellen: Eine Vier liegt, vier Karten stehen im Raum, ich
    // halte die Wunschkarte.
    state = {
      ...state,
      ablage: [...state.ablage, b('vier-1')],
      strafe: 4,
      amZug: 0,
      spieler: state.spieler.map((s, i) => (i === 0 ? { ...s, hand: [wunsch, b('rot-5-1')] } : s)),
    }

    expect(darfLegen(state, wunsch)).toBe(true)
    const nachher = legen(mauSagen(state), wunsch, 'blau')

    expect(nachher.strafe).toBe(4)
    expect(nachher.wunsch).toBe('blau')
    expect(nachher.amZug).toBe(1)
    // Ich habe nichts gezogen.
    expect(nachher.spieler[0]!.hand).toHaveLength(1)
  })
})
