/**
 * Karten für Texas Hold'em.
 *
 * Ein Wert von 2 bis 14 statt Buchstaben: So vergleicht sich eine Hand mit
 * `-`, und das Ass ist die 14. Nur beim Rad (A-2-3-4-5) zählt es als 1 --
 * das ist der einzige Sonderfall im ganzen Spiel und steht in `wertung.ts`.
 */

import { shuffle } from '@/games/rng'

export type Farbe = 'pik' | 'herz' | 'karo' | 'kreuz'

export interface Karte {
  /** 2 bis 14, wobei 11=Bube, 12=Dame, 13=König, 14=Ass. */
  wert: number
  farbe: Farbe
}

export const FARBEN: readonly Farbe[] = ['pik', 'herz', 'karo', 'kreuz']
export const WERTE: readonly number[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]

export const FARB_ZEICHEN: Record<Farbe, string> = {
  pik: '♠',
  herz: '♥',
  karo: '♦',
  kreuz: '♣',
}

/** Rot oder schwarz -- fürs Einfärben. */
export const FARB_ROT: Record<Farbe, boolean> = {
  pik: false,
  herz: true,
  karo: true,
  kreuz: false,
}

const WERT_KURZ: Record<number, string> = {
  11: 'B',
  12: 'D',
  13: 'K',
  14: 'A',
}

const WERT_NAME: Record<number, string> = {
  2: 'Zwei',
  3: 'Drei',
  4: 'Vier',
  5: 'Fünf',
  6: 'Sechs',
  7: 'Sieben',
  8: 'Acht',
  9: 'Neun',
  10: 'Zehn',
  11: 'Bube',
  12: 'Dame',
  13: 'König',
  14: 'Ass',
}

const WERT_MEHRZAHL: Record<number, string> = {
  2: 'Zweien',
  3: 'Dreien',
  4: 'Vieren',
  5: 'Fünfen',
  6: 'Sechsen',
  7: 'Siebenen',
  8: 'Achten',
  9: 'Neunen',
  10: 'Zehnen',
  11: 'Buben',
  12: 'Damen',
  13: 'Könige',
  14: 'Asse',
}

export function wertKurz(wert: number): string {
  return WERT_KURZ[wert] ?? String(wert)
}

export function wertName(wert: number): string {
  return WERT_NAME[wert] ?? String(wert)
}

export function wertMehrzahl(wert: number): string {
  return WERT_MEHRZAHL[wert] ?? `${wert}er`
}

/** Kurzschreibweise wie "A♠" -- für Protokoll und Tests. */
export function karteText(k: Karte): string {
  return `${wertKurz(k.wert)}${FARB_ZEICHEN[k.farbe]}`
}

export function neuesDeck(): Karte[] {
  const deck: Karte[] = []
  for (const farbe of FARBEN) {
    for (const wert of WERTE) deck.push({ wert, farbe })
  }
  return deck
}

/** Ein gemischtes Deck aus einem Startwert -- dieselbe Zahl, dasselbe Blatt. */
export function gemischtesDeck(rng: () => number): Karte[] {
  return shuffle(neuesDeck(), rng)
}

/**
 * Karten aus einem Kurztext lesen: "As Kh 7d" oder "AsKh7d".
 *
 * Nur für Tests und das Protokoll gedacht -- im Spiel entstehen Karten nie
 * aus Text. Aber ein Test, der eine Hand als "As Ks Qs Js Ts" hinschreibt,
 * liest sich wie das, was er prüft.
 */
export function karteAus(text: string): Karte {
  const t = text.trim()
  const farbZeichen = t.slice(-1).toLowerCase()
  const wertTeil = t.slice(0, -1).toUpperCase()
  const farbe: Farbe | undefined = { s: 'pik', h: 'herz', d: 'karo', c: 'kreuz' }[farbZeichen] as
    Farbe | undefined
  if (!farbe) throw new Error(`Unbekannte Farbe in "${text}"`)
  const wert =
    wertTeil === 'A'
      ? 14
      : wertTeil === 'K'
        ? 13
        : wertTeil === 'Q' || wertTeil === 'D'
          ? 12
          : wertTeil === 'J' || wertTeil === 'B'
            ? 11
            : wertTeil === 'T'
              ? 10
              : Number(wertTeil)
  if (!Number.isInteger(wert) || wert < 2 || wert > 14) {
    throw new Error(`Unbekannter Wert in "${text}"`)
  }
  return { wert, farbe }
}

export function kartenAus(text: string): Karte[] {
  const teile = text.trim().includes(' ')
    ? text.trim().split(/\s+/)
    : (text.trim().match(/.{2}/g) ?? [])
  return teile.map(karteAus)
}
