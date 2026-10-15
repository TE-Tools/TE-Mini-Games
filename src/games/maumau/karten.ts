/**
 * Die Karten für Mau-Mau und Letzte Karte.
 *
 * Zwei Blätter, eine Engine:
 *
 *   franzoesisch  32 Karten (7 bis Ass) -- das klassische Mau-Mau, wie
 *                 es in jeder Küchenschublade liegt.
 *   bunt          108 Karten in vier Farben mit Aktionskarten -- das
 *                 Spiel, das alle kennen, mit eigenen Karten und eigenem
 *                 Namen. Die Regeln eines Kartenspiels gehören niemandem,
 *                 ein Markenname schon.
 *
 * Eine Karte weiss selbst, was sie bewirkt (`wirkung`) und was sie am
 * Ende zählt (`punkte`). Damit kommt die Engine ohne Tabellen aus, und
 * ein neues Blatt braucht keine neue Regel.
 */

import { shuffle } from '@/games/rng'

export type Wirkung =
  | 'keine'
  | 'zieh2'
  | 'aussetzen'
  | 'richtung'
  /** Farbe wünschen (Bube bzw. schwarze Karte). */
  | 'wunsch'
  | 'zieh4'
  /** Nur im Extremspiel: alle Hände wandern weiter. */
  | 'haende'

export interface Karte {
  /** Eindeutig im Spiel -- zwei gleiche Karten sind trotzdem zwei Karten. */
  id: string
  /** null heisst schwarz: passt auf alles und wünscht sich eine Farbe. */
  farbe: string | null
  /** Was draufsteht: '7', 'B', '5', '+2', '⊘', '⇄', '★'. */
  text: string
  wirkung: Wirkung
  punkte: number
}

export const FRANZ_FARBEN = ['herz', 'karo', 'pik', 'kreuz'] as const
export const BUNT_FARBEN = ['rot', 'blau', 'gruen', 'gelb'] as const

export const FARB_ZEICHEN: Record<string, string> = {
  herz: '♥',
  karo: '♦',
  pik: '♠',
  kreuz: '♣',
  rot: '●',
  blau: '●',
  gruen: '●',
  gelb: '●',
}

export const FARB_NAME: Record<string, string> = {
  herz: 'Herz',
  karo: 'Karo',
  pik: 'Pik',
  kreuz: 'Kreuz',
  rot: 'Rot',
  blau: 'Blau',
  gruen: 'Grün',
  gelb: 'Gelb',
}

/** Rot oder schwarz gedruckt -- nur beim französischen Blatt. */
export const FARB_ROT: Record<string, boolean> = {
  herz: true,
  karo: true,
  pik: false,
  kreuz: false,
}

/* ------------------------------------------------------- Französisch */

/**
 * Die Hausregeln, auf die sich die meisten Tische einigen:
 *
 *   7   der Nächste zieht zwei
 *   8   der Nächste setzt aus
 *   9   die Richtung dreht
 *   B   Farbe wünschen, passt auf alles
 *
 * Wer sie ändert, ändert sie hier -- nicht in der Engine.
 */
const FRANZ_KARTEN: { text: string; wirkung: Wirkung; punkte: number }[] = [
  { text: '7', wirkung: 'zieh2', punkte: 7 },
  { text: '8', wirkung: 'aussetzen', punkte: 8 },
  { text: '9', wirkung: 'richtung', punkte: 9 },
  { text: '10', wirkung: 'keine', punkte: 10 },
  { text: 'B', wirkung: 'wunsch', punkte: 20 },
  { text: 'D', wirkung: 'keine', punkte: 10 },
  { text: 'K', wirkung: 'keine', punkte: 10 },
  { text: 'A', wirkung: 'keine', punkte: 11 },
]

export function franzoesischesBlatt(): Karte[] {
  const karten: Karte[] = []
  for (const farbe of FRANZ_FARBEN) {
    for (const k of FRANZ_KARTEN) {
      karten.push({
        id: `${farbe}-${k.text}`,
        // Der Bube wünscht sich eine Farbe, hat aber selbst eine --
        // sonst könnte man ihn nicht auf den Tisch zurückverfolgen.
        farbe,
        text: k.text,
        wirkung: k.wirkung,
        punkte: k.punkte,
      })
    }
  }
  return karten
}

/* -------------------------------------------------------------- Bunt */

/**
 * Vier Farben zu je 0 einmal, 1 bis 9 zweimal, dazu je zweimal
 * Aussetzen, Richtungswechsel und Zwei-Ziehen -- und acht schwarze
 * Karten. Zusammen 108.
 */
export function buntesBlatt(): Karte[] {
  const karten: Karte[] = []
  for (const farbe of BUNT_FARBEN) {
    karten.push({ id: `${farbe}-0`, farbe, text: '0', wirkung: 'haende', punkte: 0 })
    for (let wert = 1; wert <= 9; wert++) {
      for (const n of [1, 2]) {
        karten.push({
          id: `${farbe}-${wert}-${n}`,
          farbe,
          text: String(wert),
          wirkung: 'keine',
          punkte: wert,
        })
      }
    }
    for (const n of [1, 2]) {
      karten.push({ id: `${farbe}-stop-${n}`, farbe, text: '⊘', wirkung: 'aussetzen', punkte: 20 })
      karten.push({ id: `${farbe}-dreh-${n}`, farbe, text: '⇄', wirkung: 'richtung', punkte: 20 })
      karten.push({ id: `${farbe}-zwei-${n}`, farbe, text: '+2', wirkung: 'zieh2', punkte: 20 })
    }
  }
  for (let n = 1; n <= 4; n++) {
    karten.push({ id: `wunsch-${n}`, farbe: null, text: '★', wirkung: 'wunsch', punkte: 50 })
    karten.push({ id: `vier-${n}`, farbe: null, text: '+4', wirkung: 'zieh4', punkte: 50 })
  }
  return karten
}

export function gemischt(karten: Karte[], rng: () => number): Karte[] {
  return shuffle(karten, rng)
}

/** Wie die Karte vorgelesen wird. */
export function karteName(k: Karte): string {
  const farbe = k.farbe ? FARB_NAME[k.farbe] : 'Schwarz'
  const was =
    k.wirkung === 'aussetzen'
      ? 'Aussetzen'
      : k.wirkung === 'richtung'
        ? 'Richtungswechsel'
        : k.wirkung === 'zieh2'
          ? 'Zwei ziehen'
          : k.wirkung === 'zieh4'
            ? 'Vier ziehen'
            : k.wirkung === 'wunsch'
              ? 'Farbwunsch'
              : k.text
  return `${farbe} ${was}`
}

/** Kurz fürs Protokoll: „Herz 7" oder „Rot +2". */
export function karteKurz(k: Karte): string {
  if (!k.farbe) return k.text === '+4' ? '+4' : 'Wunsch'
  const zeichen = FARB_ZEICHEN[k.farbe] ?? ''
  return k.farbe && FRANZ_FARBEN.includes(k.farbe as (typeof FRANZ_FARBEN)[number])
    ? `${k.text}${zeichen}`
    : `${FARB_NAME[k.farbe]} ${k.text}`
}
