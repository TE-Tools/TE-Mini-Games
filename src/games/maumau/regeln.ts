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
 *              Hände weiter. Eine Partie, in der niemand sicher führt.
 */

import { buntesBlatt, franzoesischesBlatt, type Karte } from './karten'

export type Spielart = 'klassisch' | 'bunt' | 'extrem'

export interface Regeln {
  art: Spielart
  name: string
  erklaerung: string
  handkarten: number
  /** Dürfen Strafkarten weitergereicht werden (+2 auf +2)? */
  stapeln: boolean
  /** Muss gezogen werden, bis eine Karte passt? */
  ziehenBisPassend: boolean
  /** Schiebt die Null alle Hände weiter? */
  haendeWandern: boolean
  karten: () => Karte[]
}

export const SPIELARTEN: Record<Spielart, Regeln> = {
  klassisch: {
    art: 'klassisch',
    name: 'Mau-Mau',
    erklaerung: '32 Karten. 7 zieht zwei, 8 setzt aus, 9 dreht, der Bube wünscht sich eine Farbe.',
    handkarten: 5,
    stapeln: false,
    ziehenBisPassend: false,
    haendeWandern: false,
    karten: franzoesischesBlatt,
  },
  bunt: {
    art: 'bunt',
    name: 'Bunt',
    erklaerung: '108 Karten in vier Farben, mit Aussetzen, Richtungswechsel und Ziehkarten.',
    handkarten: 7,
    stapeln: false,
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
    stapeln: true,
    ziehenBisPassend: true,
    haendeWandern: true,
    karten: buntesBlatt,
  },
}

/**
 * Darf diese Karte jetzt gelegt werden?
 *
 * `strafe` ist die Zahl der Karten, die gerade im Raum stehen: Dann geht
 * nur noch, was die Strafe weiterreicht -- und das auch nur, wenn die
 * Spielart es erlaubt. Sonst wird gezogen.
 *
 * `wunsch` ist die gewünschte Farbe; sie ersetzt die Farbe der obersten
 * Karte, bis jemand gelegt hat.
 */
export function passt(
  karte: Karte,
  oberste: Karte,
  wunsch: string | null,
  strafe: number,
  regeln: Regeln,
): boolean {
  if (strafe > 0) {
    if (!regeln.stapeln) return false
    // Eine Vier geht immer obendrauf, eine Zwei nur auf eine Zwei.
    if (karte.wirkung === 'zieh4') return true
    if (karte.wirkung === 'zieh2') return oberste.wirkung === 'zieh2'
    return false
  }

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
  regeln: Regeln,
): Karte[] {
  return hand.filter((k) => passt(k, oberste, wunsch, strafe, regeln))
}

/** Was eine Hand am Ende zählt. */
export function handPunkte(hand: readonly Karte[]): number {
  return hand.reduce((n, k) => n + k.punkte, 0)
}
