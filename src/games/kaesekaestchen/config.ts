/**
 * Käsekästchen – alle Stellwerte an einer Stelle.
 *
 * Die Größen zählen Kästchen, nicht Punkte: 4 × 4 Kästchen sind 5 × 5
 * Punkte und 40 Linien. Der Computer unterscheidet sich je Stufe darin,
 * was er sieht (siehe docs/design/kaesekaestchen/README.md):
 *
 * - **leicht** zieht meist irgendeine Linie, nimmt ein offenes Kästchen
 *   nur manchmal mit und passt nur manchmal auf, keine dritte Seite
 *   herzugeben.
 * - **mittel** nimmt jedes offene Kästchen und gibt keine dritte Seite
 *   her, solange es geht. Muss er, opfert er die kürzeste Kette.
 * - **schwer** zählt am Ende Ketten und Ringe, rechnet die letzten
 *   sicheren Züge auf die richtige Anzahl hin durch und lässt mit dem
 *   „Doppelkreuz" die letzten zwei Kästchen einer Kette liegen, wenn ihm
 *   das den Rest einbringt.
 */

export type KaestchenStufe = 'leicht' | 'mittel' | 'schwer'

export type KaestchenGroesse = 'klein' | 'mittel' | 'gross' | 'riesig'

export interface GroessenWerte {
  /** Kästchen nebeneinander. */
  breite: number
  /** Kästchen untereinander. */
  hoehe: number
  /** Faktor auf die Punkte: Ein größeres Blatt dauert länger. */
  punkteFaktor: number
}

export const GROESSEN: Record<KaestchenGroesse, GroessenWerte> = {
  klein: { breite: 3, hoehe: 3, punkteFaktor: 0.75 },
  mittel: { breite: 4, hoehe: 4, punkteFaktor: 1 },
  gross: { breite: 5, hoehe: 5, punkteFaktor: 1.25 },
  riesig: { breite: 6, hoehe: 6, punkteFaktor: 1.5 },
}

export const GROESSEN_REIHE: readonly KaestchenGroesse[] = ['klein', 'mittel', 'gross', 'riesig']

export const STANDARD_GROESSE: KaestchenGroesse = 'mittel'

/** Kleinste und größte Seitenlänge, die die Engine (und der Server) annimmt. */
export const KANTE = { min: 2, max: 8 } as const

/** Wie viele an einem Blatt mitspielen -- am Gerät und online. */
export const SPIELER = { min: 2, max: 4 } as const

/** Gegen wie viele Computer man spielen kann -- mit einem selbst höchstens SPIELER.max. */
export const GEGNER = { min: 1, max: 3 } as const

export interface StufenWerte {
  /** So oft nimmt er ein Kästchen, das nur noch eine Linie braucht. */
  nimmFrei: number
  /** So oft meidet er eine Linie, die einem Kästchen die dritte Seite gibt. */
  meideDritte: number
  /** Muss er etwas hergeben: die kürzeste Kette statt irgendeiner Linie. */
  kleinstesOpfer: boolean
  /** Ketten und Ringe zählen, durchrechnen, Doppelkreuz. */
  kettenRegel: boolean
  /**
   * Bis zu so vielen sicheren Linien rechnet er alle Reihenfolgen durch
   * (wer am Ende die erste Kette öffnen muss). Darüber zieht er eine
   * beliebige sichere Linie -- so früh entscheidet sich noch nichts, und
   * auf dem Handy soll er nach einem Augenblick ziehen.
   */
  suchGrenze: number
}

export const STUFEN: Record<KaestchenStufe, StufenWerte> = {
  leicht: {
    nimmFrei: 0.6,
    meideDritte: 0.35,
    kleinstesOpfer: false,
    kettenRegel: false,
    suchGrenze: 0,
  },
  mittel: { nimmFrei: 1, meideDritte: 1, kleinstesOpfer: true, kettenRegel: false, suchGrenze: 0 },
  schwer: { nimmFrei: 1, meideDritte: 1, kleinstesOpfer: true, kettenRegel: true, suchGrenze: 14 },
}

/**
 * Was eine Partie wert ist -- für Verlauf, XP und Bestwert. Ein Sieg gegen
 * einen stärkeren Gegner zählt mehr; eine Partie ist kürzer als Schach,
 * deshalb liegen die Zahlen darunter. Auch eine Niederlage bringt etwas.
 */
export const PUNKTE = {
  sieg: { leicht: 60, mittel: 120, schwer: 240, online: 150 },
  /** Gleichstand ist die Hälfte eines Siegs. */
  remisAnteil: 0.5,
  /**
   * Zuschlag auf einen Sieg je weiterem Computer: Gegen drei ist der Sieg
   * schwerer, denn jeder von ihnen nimmt, was man ihm lässt.
   */
  mehrGegner: 0.25,
  niederlage: 10,
} as const

/** Wie lange der Computer mindestens „überlegt" -- je Linie, damit man jede sieht. */
export const DENKZEIT_MS = 420
