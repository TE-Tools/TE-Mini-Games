/**
 * Welche fünf Karten gelten -- und welche Hand gewinnt.
 *
 * Aus sieben Karten (zwei eigene, fünf auf dem Tisch) wird die beste
 * Fünferhand gesucht. Nicht über alle 21 Kombinationen, sondern direkt:
 * zählen, gruppieren, der Reihe nach von oben nach unten prüfen. Das ist
 * schneller und, wichtiger, es benennt die Hand gleich mit -- "Zwei Paare,
 * Damen und Siebenen" steht sonst nirgends.
 *
 * Ein Handwert ist eine Klasse plus eine Liste von Werten. Verglichen wird
 * erst die Klasse, dann die Liste von vorn. Damit hat jeder Vergleich
 * dieselbe Form, vom Kicker bis zum Straight Flush.
 *
 * Der einzige Sonderfall ist das Rad: A-2-3-4-5 ist eine Straße, und das
 * Ass zählt darin als 1. Eine Straße K-A-2 gibt es nicht.
 */

import { wertMehrzahl, wertName, type Karte } from './karten'

export const enum HandKlasse {
  HoheKarte = 1,
  Paar = 2,
  ZweiPaare = 3,
  Drilling = 4,
  Strasse = 5,
  Flush = 6,
  FullHouse = 7,
  Vierling = 8,
  StraightFlush = 9,
}

export interface Handwert {
  klasse: HandKlasse
  /** Entscheidet bei gleicher Klasse, von vorn nach hinten. */
  werte: number[]
  /** Die fünf Karten, die gelten -- für die Anzeige. */
  karten: Karte[]
}

const KLASSE_NAME: Record<HandKlasse, string> = {
  [HandKlasse.HoheKarte]: 'Hohe Karte',
  [HandKlasse.Paar]: 'Ein Paar',
  [HandKlasse.ZweiPaare]: 'Zwei Paare',
  [HandKlasse.Drilling]: 'Drilling',
  [HandKlasse.Strasse]: 'Straße',
  [HandKlasse.Flush]: 'Flush',
  [HandKlasse.FullHouse]: 'Full House',
  [HandKlasse.Vierling]: 'Vierling',
  [HandKlasse.StraightFlush]: 'Straight Flush',
}

export function klasseName(klasse: HandKlasse): string {
  return KLASSE_NAME[klasse]
}

function absteigend(a: number, b: number): number {
  return b - a
}

/** Die höchste Straße in diesen Werten, oder 0. Gibt die höchste Karte zurück. */
function hoechsteStrasse(werte: readonly number[]): number {
  const da = new Set(werte)
  // Das Rad: Das Ass darf unten anschließen.
  if (da.has(14)) da.add(1)
  const sortiert = [...da].sort(absteigend)
  let folge = 1
  for (let i = 1; i < sortiert.length; i++) {
    if (sortiert[i] === (sortiert[i - 1] ?? 0) - 1) {
      folge++
      // Die höchste Karte der Folge liegt vier Plätze weiter vorn --
      // sortiert wird absteigend, und die Folge ist fünf lang.
      if (folge >= 5) return sortiert[i - 4] ?? 0
    } else {
      folge = 1
    }
  }
  return 0
}

/** Die fünf Karten einer Straße, die bei `hoch` endet. */
function strassenKarten(karten: readonly Karte[], hoch: number): Karte[] {
  const gesucht = [hoch, hoch - 1, hoch - 2, hoch - 3, hoch - 4].map((w) => (w === 1 ? 14 : w))
  const aus: Karte[] = []
  for (const w of gesucht) {
    const treffer = karten.find((k) => k.wert === w && !aus.includes(k))
    if (treffer) aus.push(treffer)
  }
  return aus
}

/**
 * Die beste Fünferhand aus fünf bis sieben Karten.
 *
 * Weniger als fünf Karten sind kein Fehler -- vor dem Flop gibt es nur
 * zwei. Dann wird bewertet, was da ist; die Klasse stimmt, die Hand ist
 * eben kürzer.
 */
export function besteHand(karten: readonly Karte[]): Handwert {
  const nachWert = new Map<number, Karte[]>()
  const nachFarbe = new Map<string, Karte[]>()
  for (const k of karten) {
    const w = nachWert.get(k.wert) ?? []
    w.push(k)
    nachWert.set(k.wert, w)
    const f = nachFarbe.get(k.farbe) ?? []
    f.push(k)
    nachFarbe.set(k.farbe, f)
  }

  const werteAbsteigend = [...nachWert.keys()].sort(absteigend)
  /** Werte mit genau/mindestens n Karten, höchster zuerst. */
  const mitAnzahl = (n: number) =>
    werteAbsteigend.filter((w) => (nachWert.get(w)?.length ?? 0) >= n)

  const flushFarbe = [...nachFarbe.entries()].find(([, k]) => k.length >= 5)?.[0]

  /* ------------------------------------------------- Straight Flush */

  if (flushFarbe) {
    const farbkarten = nachFarbe.get(flushFarbe) ?? []
    const hoch = hoechsteStrasse(farbkarten.map((k) => k.wert))
    if (hoch > 0) {
      return {
        klasse: HandKlasse.StraightFlush,
        werte: [hoch],
        karten: strassenKarten(farbkarten, hoch),
      }
    }
  }

  /* ------------------------------------------------------- Vierling */

  const vierlinge = mitAnzahl(4)
  const vierling = vierlinge[0]
  if (vierling !== undefined) {
    const kicker = werteAbsteigend.find((w) => w !== vierling)
    const karten5 = [...(nachWert.get(vierling) ?? [])]
    if (kicker !== undefined) karten5.push(nachWert.get(kicker)![0]!)
    return { klasse: HandKlasse.Vierling, werte: [vierling, kicker ?? 0], karten: karten5 }
  }

  /* ----------------------------------------------------- Full House */

  const drillinge = mitAnzahl(3)
  const bestesDrilling = drillinge[0]
  if (bestesDrilling !== undefined) {
    // Das Paar darf auch ein zweiter Drilling sein -- dann zählen zwei
    // seiner Karten. Genau daran scheitern selbstgebaute Wertungen gern.
    const paar = werteAbsteigend.find(
      (w) => w !== bestesDrilling && (nachWert.get(w)?.length ?? 0) >= 2,
    )
    if (paar !== undefined) {
      return {
        klasse: HandKlasse.FullHouse,
        werte: [bestesDrilling, paar],
        karten: [...nachWert.get(bestesDrilling)!, ...nachWert.get(paar)!.slice(0, 2)],
      }
    }
  }

  /* ---------------------------------------------------------- Flush */

  if (flushFarbe) {
    const fuenf = (nachFarbe.get(flushFarbe) ?? [])
      .slice()
      .sort((a, b) => b.wert - a.wert)
      .slice(0, 5)
    return { klasse: HandKlasse.Flush, werte: fuenf.map((k) => k.wert), karten: fuenf }
  }

  /* --------------------------------------------------------- Straße */

  const strasse = hoechsteStrasse(werteAbsteigend)
  if (strasse > 0) {
    return {
      klasse: HandKlasse.Strasse,
      werte: [strasse],
      karten: strassenKarten(
        [...karten].sort((a, b) => b.wert - a.wert),
        strasse,
      ),
    }
  }

  /* ------------------------------------------------------- Drilling */

  if (bestesDrilling !== undefined) {
    const kicker = werteAbsteigend.filter((w) => w !== bestesDrilling).slice(0, 2)
    return {
      klasse: HandKlasse.Drilling,
      werte: [bestesDrilling, ...kicker],
      karten: [...nachWert.get(bestesDrilling)!, ...kicker.map((w) => nachWert.get(w)![0]!)],
    }
  }

  /* -------------------------------------------------- Paare, Rest */

  const paare = mitAnzahl(2)
  if (paare.length >= 2) {
    const [hoch, tief] = paare
    const kicker = werteAbsteigend.find((w) => w !== hoch && w !== tief)
    const karten5 = [...nachWert.get(hoch!)!.slice(0, 2), ...nachWert.get(tief!)!.slice(0, 2)]
    if (kicker !== undefined) karten5.push(nachWert.get(kicker)![0]!)
    return { klasse: HandKlasse.ZweiPaare, werte: [hoch!, tief!, kicker ?? 0], karten: karten5 }
  }

  const paar = paare[0]
  if (paar !== undefined) {
    const kicker = werteAbsteigend.filter((w) => w !== paar).slice(0, 3)
    return {
      klasse: HandKlasse.Paar,
      werte: [paar, ...kicker],
      karten: [...nachWert.get(paar)!.slice(0, 2), ...kicker.map((w) => nachWert.get(w)![0]!)],
    }
  }

  const fuenf = [...karten].sort((a, b) => b.wert - a.wert).slice(0, 5)
  return { klasse: HandKlasse.HoheKarte, werte: fuenf.map((k) => k.wert), karten: fuenf }
}

/** Grösser null heisst: a gewinnt. Null heisst: geteilter Pot. */
export function vergleicheHand(a: Handwert, b: Handwert): number {
  if (a.klasse !== b.klasse) return a.klasse - b.klasse
  const laenge = Math.max(a.werte.length, b.werte.length)
  for (let i = 0; i < laenge; i++) {
    const x = a.werte[i] ?? 0
    const y = b.werte[i] ?? 0
    if (x !== y) return x - y
  }
  return 0
}

/**
 * Dieselbe Hand, wie sie nach „mit" steht.
 *
 * Im Deutschen ändert sich dabei die Form: Es heisst „Zwei Paare", aber
 * „mit zwei Paaren". Ohne diese zweite Fassung stand am Tisch „Du
 * gewinnst 40 mit Zwei Paare, Siebenen und Sechsen" -- im Browser
 * aufgefallen, nicht im Test.
 */
export function handTextMit(h: Handwert): string {
  const [erst = 0, zweit = 0] = h.werte
  switch (h.klasse) {
    case HandKlasse.StraightFlush:
      return erst === 14 ? 'einem Royal Flush' : `einem Straight Flush bis ${wertName(erst)}`
    case HandKlasse.Vierling:
      return `einem Vierling ${wertMehrzahl(erst)}`
    case HandKlasse.FullHouse:
      return `einem Full House, ${wertMehrzahl(erst)} über ${wertMehrzahl(zweit)}`
    case HandKlasse.Flush:
      return `einem Flush bis ${wertName(erst)}`
    case HandKlasse.Strasse:
      return erst === 5 ? 'einer Straße bis Fünf' : `einer Straße bis ${wertName(erst)}`
    case HandKlasse.Drilling:
      return `einem Drilling ${wertMehrzahl(erst)}`
    case HandKlasse.ZweiPaare:
      return `zwei Paaren, ${wertMehrzahl(erst)} und ${wertMehrzahl(zweit)}`
    case HandKlasse.Paar:
      return `einem Paar ${wertMehrzahl(erst)}`
    default:
      return `${wertName(erst)} hoch`
  }
}

/** Wie die Hand am Tisch angesagt wird. */
export function handText(h: Handwert): string {
  const [erst = 0, zweit = 0] = h.werte
  switch (h.klasse) {
    case HandKlasse.StraightFlush:
      return erst === 14 ? 'Royal Flush' : `Straight Flush bis ${wertName(erst)}`
    case HandKlasse.Vierling:
      return `Vierling ${wertMehrzahl(erst)}`
    case HandKlasse.FullHouse:
      return `Full House, ${wertMehrzahl(erst)} über ${wertMehrzahl(zweit)}`
    case HandKlasse.Flush:
      return `Flush bis ${wertName(erst)}`
    case HandKlasse.Strasse:
      return erst === 5 ? 'Straße bis Fünf' : `Straße bis ${wertName(erst)}`
    case HandKlasse.Drilling:
      return `Drilling ${wertMehrzahl(erst)}`
    case HandKlasse.ZweiPaare:
      return `Zwei Paare, ${wertMehrzahl(erst)} und ${wertMehrzahl(zweit)}`
    case HandKlasse.Paar:
      return `Ein Paar ${wertMehrzahl(erst)}`
    default:
      return `${wertName(erst)} hoch`
  }
}
