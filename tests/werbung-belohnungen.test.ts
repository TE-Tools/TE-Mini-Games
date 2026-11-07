/**
 * Was Belohnungsvideos in den Spielen bewirken -- die reinen Regeln.
 *
 * Werbung kauft Hilfe oder Aussehen, nie Punkte (src/services/werbung.ts):
 * Eine Hilfe gibt es höchstens einmal je Versuch, eine Runde mit Hilfe
 * schreibt keinen Rekord und bekommt höchstens einen Stern, das nächste
 * Level ist trotzdem frei. Die Seiten prüft tests/werbung-spiele.test.tsx.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  createDumplingLevel,
  createDumplingMatch,
  moeglicheZuege,
  tausche,
  zeitAbgelaufen,
  ZUSATZ_SEKUNDEN,
  zeitAngebot,
  weiterMitZeit,
  wertungFuer as dumplingWertung,
  squishyDumplingsGame,
  SAMMEL_KNOEDEL,
  VIDEO_KNOEDEL,
  freigeschaltet,
  knoedelFuer,
  videoKnoedelFrei,
  schalteVideoKnoedelFrei,
} from '@/games/squishy-dumplings'
import {
  createMatch,
  tapSpalte,
  platzAngebot,
  welcherPlatz,
  raeumePlatz,
  wertungFuer as bienenWertung,
  bienenFlowGame,
  type BienenLevel,
  type BienenState,
} from '@/games/bienen-flow'
import {
  raetsel,
  levelNummer,
  hilfeAnbieten,
  entferneFalsche,
  falscheZiffern,
  werte,
  merkeAbschluss,
  levelStand,
  leseStand,
  loescheStand,
  STERNE_MIT_HILFE,
} from '@/games/sudoku'
import { saveGameResult, getPersonalRecord } from '@/offline'

beforeEach(() => {
  localStorage.clear()
})

/* ------------------------------------------------------------ Squishy */

describe('Squishy Dumplings: +15 Sekunden', () => {
  const verloren = () => zeitAbgelaufen(createDumplingMatch(createDumplingLevel(3)))

  it('gibt es nur, wenn die Zeit um ist', () => {
    expect(ZUSATZ_SEKUNDEN).toBe(15)
    expect(zeitAngebot(null)).toBe(false)
    expect(zeitAngebot(createDumplingMatch(createDumplingLevel(3)))).toBe(false)
    expect(zeitAngebot(verloren())).toBe(true)
  })

  it('spielt mit demselben Feld weiter und merkt sich die Hilfe', () => {
    const alt = verloren()
    const neu = weiterMitZeit(alt)
    expect(neu.phase).toBe('play')
    expect(neu.mitHilfe).toBe(true)
    expect(neu.feld).toEqual(alt.feld)
    expect(neu.gesammelt).toBe(alt.gesammelt)
  })

  it('höchstens einmal je Versuch -- auch nach dem nächsten Zug', () => {
    let s = weiterMitZeit(verloren())
    // Die Hilfe reist durch die Engine mit.
    const [a, b] = moeglicheZuege(s)[0]!
    s = tausche(s, a, b).state
    expect(s.mitHilfe).toBe(true)
    const wieder = zeitAbgelaufen(s)
    expect(zeitAngebot(wieder)).toBe(false)
    expect(weiterMitZeit(wieder)).toBe(wieder)
    // Ein neuer Versuch fängt ohne Hilfe an.
    expect(createDumplingMatch(createDumplingLevel(3)).mitHilfe).toBeUndefined()
  })

  it('eine Runde mit Hilfe bringt keine Punkte, keine XP und genau einen Stern', () => {
    const raw = { won: true, gesammelt: 40, restzeit: 30, besteKette: 4 }
    const ohne = dumplingWertung(12, raw, false)
    expect(ohne.score).toBe(squishyDumplingsGame.calculateScore(12, raw))
    expect(ohne.stars).toBeGreaterThan(1)
    expect(dumplingWertung(12, raw, true)).toEqual({ score: 0, xp: 0, stars: 1 })
  })
})

describe('Squishy Dumplings: der Sternschnuppen-Bao', () => {
  it('gibt es nur per Video, nicht über Level', () => {
    expect(VIDEO_KNOEDEL.nurPerVideo).toBe(true)
    expect(SAMMEL_KNOEDEL.some((k) => k.id === VIDEO_KNOEDEL.id)).toBe(false)
    expect(freigeschaltet(10_000).some((k) => k.id === VIDEO_KNOEDEL.id)).toBe(false)
  })

  it('hat eigene Farben', () => {
    for (const k of SAMMEL_KNOEDEL) {
      expect(k.hex).not.toBe(VIDEO_KNOEDEL.hex)
      expect(k.akzent).not.toBe(VIDEO_KNOEDEL.akzent)
    }
  })

  it('bleibt freigeschaltet und lässt sich als Figur nachschlagen', () => {
    expect(videoKnoedelFrei()).toBe(false)
    schalteVideoKnoedelFrei()
    expect(videoKnoedelFrei()).toBe(true)
    expect(localStorage.getItem('squishy-dumplings:video-knoedel')).toBe('1')
    expect(knoedelFuer(VIDEO_KNOEDEL.id)).toBe(VIDEO_KNOEDEL)
  })
})

/* ---------------------------------------------------------- Bienen-Flow */

/** 3×3: ein Ring aus Farbe 1 um ein Pixel Farbe 2. */
const RING = [1, 1, 1, 1, 2, 1, 1, 1, 1]

function bienenLevel(spalten: { color: number; amount: number }[][]): BienenLevel {
  return {
    level: 4,
    motiv: 'Test',
    rows: 3,
    cols: 3,
    bild: RING,
    spalten: spalten.map((s, si) =>
      s.map((b, bi) => ({ id: `t${si}-${bi}`, color: b.color, amount: b.amount })),
    ),
    slotCount: 5,
    colorCount: 2,
    isGate: false,
    label: 'Test',
  }
}

/** Fünf Blöcke der verdeckten Farbe hoch: Die Kolonie steht. */
function festgefahren(mengen = [1, 1, 1, 1, 1]): BienenState {
  let s = createMatch(
    bienenLevel([mengen.map((amount) => ({ color: 2, amount })), [{ color: 1, amount: 8 }]]),
  )
  for (let i = 0; i < mengen.length; i++) s = tapSpalte(s, 0)!.state
  return s
}

describe('Bienen-Flow: einen Platz freiräumen', () => {
  it('gibt es nur, wenn die Kolonie steht', () => {
    expect(platzAngebot(null)).toBe(false)
    expect(platzAngebot(createMatch(bienenLevel([[{ color: 1, amount: 8 }]])))).toBe(false)
    const s = festgefahren()
    expect(s.phase).toBe('lost')
    expect(platzAngebot(s)).toBe(true)
  })

  it('räumt den Block mit der größten Zahl und stellt ihn hinten in die kürzeste Spalte', () => {
    const s = festgefahren([1, 3, 2, 3, 1])
    expect(welcherPlatz(s)).toEqual({ slot: 1, zurueck: true })
    const neu = raeumePlatz(s)
    expect(neu.phase).toBe('play')
    expect(neu.mitHilfe).toBe(true)
    expect(neu.slots[1]).toBeNull()
    expect(neu.slots.filter((x) => x != null)).toHaveLength(4)
    // Spalte 0 ist leer und damit die kürzeste; der Block steht dort hinten an.
    expect(neu.spalten[0]!.at(-1)).toEqual(s.slots[1])
    // Nichts geht verloren: Was die Farbe noch fassen kann, bleibt gleich.
    const fassung = (x: BienenState, farbe: number) =>
      [...x.slots, ...x.spalten.flat()].reduce(
        (n, b) => n + (b != null && b.color === farbe ? b.amount : 0),
        0,
      )
    expect(fassung(neu, 2)).toBe(fassung(s, 2))
    expect(fassung(neu, 1)).toBe(fassung(s, 1))
  })

  it('nimmt zuerst einen toten Block -- der verschwindet ganz', () => {
    const s = festgefahren()
    // Farbe 2 aus dem Bild nehmen: Alle fünf Blöcke sind jetzt tot.
    const tot: BienenState = { ...s, board: s.board.map((c) => (c === 2 ? 0 : c)) }
    expect(welcherPlatz(tot)).toEqual({ slot: 0, zurueck: false })
    const neu = raeumePlatz(tot)
    expect(neu.slots[0]).toBeNull()
    expect(neu.spalten.flat()).toHaveLength(s.spalten.flat().length)
    expect(neu.tote).toBe(4)
  })

  it('höchstens einmal je Versuch', () => {
    const einmal = raeumePlatz(festgefahren())
    const wieder = tapSpalte(einmal, 0)!.state
    expect(wieder.phase).toBe('lost')
    expect(wieder.mitHilfe).toBe(true)
    expect(platzAngebot(wieder)).toBe(false)
    expect(raeumePlatz(wieder)).toBe(wieder)
  })

  it('eine Runde mit Hilfe bringt keine Punkte, keine XP und genau einen Stern', () => {
    const raw = { won: true, tote: 0, slotCount: 5 }
    expect(bienenWertung(30, raw, false).score).toBe(bienenFlowGame.calculateScore(30, raw))
    expect(bienenWertung(30, raw, false).stars).toBe(5)
    expect(bienenWertung(30, raw, true)).toEqual({ score: 0, xp: 0, stars: 1 })
  })
})

/* -------------------------------------------------------------- Sudoku */

describe('Sudoku: falsche Ziffern entfernen', () => {
  const nr = levelNummer('schwer', 1)
  const r = raetsel(nr)
  const leer = Array.from(r.vorgabe).findIndex((v) => v === 0)
  /** Volles Gitter mit genau einer falschen Ziffer. */
  const mitFehler = () => {
    const w = Array.from(r.loesung)
    w[leer] = (r.loesung[leer]! % 9) + 1
    return w
  }
  const lage = (werteJetzt: number[], fehlerSichtbar = false, mitHilfe = false) => ({
    werte: werteJetzt,
    vorgabe: r.vorgabe,
    loesung: r.loesung,
    fehlerSichtbar,
    mitHilfe,
  })

  beforeEach(() => loescheStand())

  it('wird nur angeboten, wenn das volle Gitter nicht stimmt und man nicht sieht, wo', () => {
    expect(hilfeAnbieten(lage(mitFehler()))).toBe(true)
    expect(hilfeAnbieten(lage(Array.from(r.loesung)))).toBe(false)
    expect(hilfeAnbieten(lage(mitFehler(), true))).toBe(false)
    // Noch nicht voll: Ein Angebot verriete den Fehler schon ohne Video.
    const halb = mitFehler()
    halb[Array.from(r.vorgabe).findIndex((v, i) => v === 0 && i !== leer)] = 0
    expect(hilfeAnbieten(lage(halb))).toBe(false)
  })

  it('höchstens einmal je Versuch', () => {
    expect(hilfeAnbieten(lage(mitFehler(), false, true))).toBe(false)
  })

  it('nimmt nur die falschen eigenen Ziffern heraus', () => {
    const w = mitFehler()
    expect(falscheZiffern(w, r.vorgabe, r.loesung)).toEqual([leer])
    const neu = entferneFalsche(w, r.vorgabe, r.loesung)
    expect(neu[leer]).toBe(0)
    for (let i = 0; i < 81; i++) if (i !== leer) expect(neu[i]).toBe(r.loesung[i])
  })

  it('zählt wie ein Tipp, gibt höchstens einen Stern und nie mehr als ohne Video', () => {
    const e = { geloest: true, sekunden: 60, fehler: 0, tipps: 0 }
    const ohne = werte(nr, e)
    const mitTipp = werte(nr, { ...e, tipps: 1 })
    const mit = werte(nr, { ...e, mitHilfe: true })
    expect(ohne.sterne).toBe(5)
    expect(mit.punkte).toBe(mitTipp.punkte)
    expect(mit.sterne).toBe(STERNE_MIT_HILFE)
    expect(mit.xp).toBeLessThanOrEqual(mitTipp.xp)
    expect(mit.xp).toBeLessThan(ohne.xp)
  })

  it('schreibt keine Bestzeit und keine Bestpunkte, öffnet aber das nächste Level', () => {
    merkeAbschluss({ nr, sekunden: 50, punkte: 1200, sterne: 1, mitHilfe: true })
    let l = levelStand(nr)
    expect(l.fertig).toBe(true)
    expect(l.sterne).toBe(1)
    expect(l.bestePunkte).toBe(0)
    expect(Number.isFinite(l.besteZeit)).toBe(false)
    expect(leseStand().frei.schwer).toBe(2)

    // Ein späterer Lauf ohne Hilfe zählt ganz normal.
    merkeAbschluss({ nr, sekunden: 600, punkte: 900, sterne: 3 })
    l = levelStand(nr)
    expect(l.besteZeit).toBe(600)
    expect(l.bestePunkte).toBe(900)
    expect(l.sterne).toBe(3)

    // Und ein Lauf mit Hilfe danach überschreibt nichts davon.
    merkeAbschluss({ nr, sekunden: 30, punkte: 1300, sterne: 5, mitHilfe: true })
    expect(levelStand(nr)).toEqual(l)
  })
})

/* --------------------------------------------------------- Speichern */

describe('Ergebnis einer Runde mit Hilfe', () => {
  it('wird gespeichert, schreibt aber keinen persönlichen Rekord', async () => {
    const gespeichert = await saveGameResult({
      gameId: 'bienen-flow',
      level: 77,
      score: 0,
      xp: 0,
      stars: 1,
      resultData: { won: true, mitHilfe: true },
      isPersonalRecord: true,
      ohneRekord: true,
    })
    expect(gespeichert.isPersonalRecord).toBe(false)
    expect(await getPersonalRecord('bienen-flow', 77)).toBeUndefined()

    // Gegenprobe: Ohne Hilfe entsteht der Rekord wie immer.
    const normal = await saveGameResult({
      gameId: 'bienen-flow',
      level: 77,
      score: 500,
      xp: 20,
      stars: 3,
      resultData: { won: true },
    })
    expect(normal.isPersonalRecord).toBe(true)
    expect((await getPersonalRecord('bienen-flow', 77))?.bestScore).toBe(500)
  })
})
