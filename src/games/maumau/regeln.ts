/**
 * Was gilt an diesem Tisch.
 *
 * Drei Spielarten, eine Engine. Die Unterschiede sind Daten, keine
 * Sonderfälle im Ablauf -- wer eine vierte erfinden will, schreibt hier
 * eine Zeile dazu.
 *
 *   klassisch  Französisches Blatt, die Hausregeln aus der Schublade.
 *   bunt       Das bunte Blatt mit Aktionskarten.
 *   extrem     Dasselbe Blatt, aber Strafkarten lassen sich weiterreichen,
 *              gezogen wird bis es passt, und die Null schiebt alle
 *              Hände weiter.
 *
 * Die Spielart ist dabei nur die Voreinstellung. Jede einzelne Hausregel
 * lässt sich davor umlegen -- Thomas am 15.10.2026: „man kann
 * entscheiden, ob 2 auf plus 2 geht, 4 auf plus 4 geht, schwarze Karte
 * auf schwarze Karte geht ... das als Auswahlmöglichkeit." Genau dafür
 * steht das Kontern nicht als ein Schalter da, sondern als fünf.
 */

import { buntesBlatt, franzoesischesBlatt, type Karte } from './karten'

export type Spielart = 'klassisch' | 'bunt' | 'extrem'

/**
 * Womit sich eine Strafe weiterreichen lässt.
 *
 * Jede Zeile ist eine Hausregel, über die sich Tische streiten -- und
 * genau deshalb kann hier jede einzeln an und aus.
 */
export interface Konter {
  /** Zwei auf Zwei: die verbreitetste Regel überhaupt. */
  zweiAufZwei: boolean
  /** Vier auf Vier. */
  vierAufVier: boolean
  /** Zwei auf Vier -- die Strafe wächst von vier auf sechs. */
  zweiAufVier: boolean
  /** Vier auf Zwei. */
  vierAufZwei: boolean
  /**
   * Schwarz auf Schwarz: Eine Wunschkarte zählt als Konter.
   *
   * Sie bringt keine Karten dazu, gibt die offene Strafe aber weiter --
   * und wünscht sich dabei eine Farbe. Wer so kontert, zieht nicht,
   * erhöht aber auch nicht.
   */
  schwarzAufSchwarz: boolean
}

export const KEIN_KONTER: Konter = {
  zweiAufZwei: false,
  vierAufVier: false,
  zweiAufVier: false,
  vierAufZwei: false,
  schwarzAufSchwarz: false,
}

export const VOLLER_KONTER: Konter = {
  zweiAufZwei: true,
  vierAufVier: true,
  zweiAufVier: true,
  vierAufZwei: true,
  schwarzAufSchwarz: true,
}

/** Die Regeln, nach denen eine laufende Partie gespielt wird. */
export interface AktiveRegeln {
  art: Spielart
  handkarten: number
  konter: Konter
  /** Muss gezogen werden, bis eine Karte passt? */
  ziehenBisPassend: boolean
  /** Schiebt die Null alle Hände weiter? */
  haendeWandern: boolean
}

export interface Spielartbeschreibung {
  art: Spielart
  name: string
  erklaerung: string
  handkarten: number
  konter: Konter
  ziehenBisPassend: boolean
  haendeWandern: boolean
  karten: () => Karte[]
}

export const SPIELARTEN: Record<Spielart, Spielartbeschreibung> = {
  klassisch: {
    art: 'klassisch',
    name: 'Mau-Mau',
    erklaerung: '32 Karten. 7 zieht zwei, 8 setzt aus, 9 dreht, der Bube wünscht sich eine Farbe.',
    handkarten: 5,
    konter: KEIN_KONTER,
    ziehenBisPassend: false,
    haendeWandern: false,
    karten: franzoesischesBlatt,
  },
  bunt: {
    art: 'bunt',
    name: 'Bunt',
    erklaerung: '108 Karten in vier Farben, mit Aussetzen, Richtungswechsel und Ziehkarten.',
    handkarten: 7,
    konter: KEIN_KONTER,
    ziehenBisPassend: false,
    haendeWandern: false,
    karten: buntesBlatt,
  },
  extrem: {
    art: 'extrem',
    name: 'Extrem',
    erklaerung:
      'Wie Bunt, aber Strafkarten lassen sich weiterreichen, es wird gezogen bis es passt, und die Null schiebt alle Hände weiter.',
    handkarten: 7,
    konter: VOLLER_KONTER,
    ziehenBisPassend: true,
    haendeWandern: true,
    karten: buntesBlatt,
  },
}

/**
 * Die Regeln einer Spielart, mit einzeln geänderten Hausregeln.
 *
 * Die Spielart gibt vor, was üblich ist; was der Tisch davon anders
 * will, kommt als zweites Argument dazu.
 */
export function aktiveRegeln(
  art: Spielart,
  aenderungen?: {
    konter?: Partial<Konter>
    ziehenBisPassend?: boolean
    haendeWandern?: boolean
  },
): AktiveRegeln {
  const vorlage = SPIELARTEN[art]
  return {
    art,
    handkarten: vorlage.handkarten,
    konter: { ...vorlage.konter, ...aenderungen?.konter },
    ziehenBisPassend: aenderungen?.ziehenBisPassend ?? vorlage.ziehenBisPassend,
    haendeWandern: aenderungen?.haendeWandern ?? vorlage.haendeWandern,
  }
}

/** Das Blatt, mit dem diese Spielart gespielt wird. */
export function blattVon(art: Spielart): Karte[] {
  return SPIELARTEN[art].karten()
}

/**
 * Darf diese Karte eine offene Strafe weiterreichen?
 *
 * `oberste` ist die Karte, die die Strafe ausgelöst hat -- auf eine Vier
 * zu kontern ist etwas anderes, als auf eine Zwei zu kontern.
 */
export function kontert(karte: Karte, oberste: Karte, konter: Konter): boolean {
  const aufVier = oberste.wirkung === 'zieh4'
  if (karte.wirkung === 'zieh2') return aufVier ? konter.zweiAufVier : konter.zweiAufZwei
  if (karte.wirkung === 'zieh4') return aufVier ? konter.vierAufVier : konter.vierAufZwei
  // Die reine Wunschkarte zieht nichts, kann die Strafe aber weitergeben.
  if (karte.wirkung === 'wunsch') return konter.schwarzAufSchwarz && karte.farbe === null
  return false
}

/**
 * Darf diese Karte jetzt gelegt werden?
 *
 * `strafe` ist die Zahl der Karten, die gerade im Raum stehen: Dann geht
 * nur noch, was die Strafe weiterreicht -- und das auch nur, wenn der
 * Tisch es erlaubt. Sonst wird gezogen.
 *
 * `wunsch` ist die gewünschte Farbe; sie ersetzt die Farbe der obersten
 * Karte, bis jemand gelegt hat.
 */
export function passt(
  karte: Karte,
  oberste: Karte,
  wunsch: string | null,
  strafe: number,
  regeln: AktiveRegeln,
): boolean {
  if (strafe > 0) return kontert(karte, oberste, regeln.konter)

  // Schwarze Karten passen auf alles -- und der Bube ist beim
  // französischen Blatt genau das. Diese Prüfung steht VOR dem Wunsch:
  // Ein Bube geht auch dann, wenn sich jemand eine andere Farbe
  // gewünscht hat. (Zuerst stand sie danach -- dann liess sich auf einen
  // Buben kein Bube legen.)
  if (karte.farbe === null) return true
  if (regeln.art === 'klassisch' && karte.wirkung === 'wunsch') return true

  if (wunsch) return karte.farbe === wunsch

  if (karte.farbe === oberste.farbe) return true
  // Gleicher Aufdruck zählt auch: Zahl auf Zahl, Aktion auf Aktion.
  if (karte.text === oberste.text) return true
  return false
}

/** Alle Karten einer Hand, die gerade gelegt werden dürfen. */
export function spielbare(
  hand: readonly Karte[],
  oberste: Karte,
  wunsch: string | null,
  strafe: number,
  regeln: AktiveRegeln,
): Karte[] {
  return hand.filter((k) => passt(k, oberste, wunsch, strafe, regeln))
}

/** Was eine Hand am Ende zählt. */
export function handPunkte(hand: readonly Karte[]): number {
  return hand.reduce((n, k) => n + k.punkte, 0)
}
