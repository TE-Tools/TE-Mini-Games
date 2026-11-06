/**
 * Texas Hold'em in der Sprache der Oberfläche.
 *
 * Engine und Server schreiben ihr Protokoll deutsch -- Tests und das
 * SQL-Gegenstück lesen genau diese Zeilen, und an den Regeln ändert die
 * Übersetzung nichts. Die Seite liest deshalb jede Zeile, erkennt, was
 * passiert ist (wer, was, wie viel, mit welcher Hand), und sagt es mit dem
 * Wörterbuch neu. Eine Zeile, die sie nicht erkennt, bleibt, wie sie ist.
 *
 * Die deutsche Fassung im Wörterbuch muss dabei genau die Zeile der Engine
 * ergeben; tests/texas-text.test.ts spielt dafür Partien durch.
 */

import {
  FARB_ZEICHEN,
  HandKlasse,
  handTextMit,
  wertKurz,
  type Farbe,
  type Handwert,
  type Karte,
} from '@/games/texas-holdem'
import type { Texte } from '@/i18n/sprache'

type Nachschlag = Record<number, string | undefined>

/** Was auf der Karte steht: in Deutsch B, D, K, A -- in Englisch J, Q, K, A. */
export function wertKurzText(t: Texte, wert: number): string {
  return (t.texas.kurz as Nachschlag)[wert] ?? String(wert)
}

export function wertNameText(t: Texte, wert: number): string {
  return (t.texas.wertName as Nachschlag)[wert] ?? String(wert)
}

export function wertMehrzahlText(t: Texte, wert: number): string {
  return (t.texas.wertMehrzahl as Nachschlag)[wert] ?? String(wert)
}

/** Wie eine Karte vorgelesen wird. */
export function karteVorlesen(t: Texte, k: Karte): string {
  return t.texas.karte.name(wertNameText(t, k.wert), t.texas.farben[k.farbe])
}

export function karteKurzText(t: Texte, k: Karte): string {
  return `${wertKurzText(t, k.wert)}${FARB_ZEICHEN[k.farbe]}`
}

/** Was von einer Hand für den Satz zählt: die Klasse und die ersten zwei Werte. */
export type HandKern = Pick<Handwert, 'klasse' | 'werte'>

/** Die Hand, wie sie nach „mit" / „with" steht. */
export function handSatz(t: Texte, h: HandKern): string {
  const w = t.texas.hand
  const [erst = 0, zweit = 0] = h.werte
  const name = (x: number) => wertNameText(t, x)
  const mehr = (x: number) => wertMehrzahlText(t, x)
  switch (h.klasse) {
    case HandKlasse.StraightFlush:
      return erst === 14 ? w.royalFlush : w.straightFlush(name(erst))
    case HandKlasse.Vierling:
      return w.vierling(mehr(erst))
    case HandKlasse.FullHouse:
      return w.fullHouse(mehr(erst), mehr(zweit))
    case HandKlasse.Flush:
      return w.flush(name(erst))
    case HandKlasse.Strasse:
      return w.strasse(name(erst))
    case HandKlasse.Drilling:
      return w.drilling(mehr(erst))
    case HandKlasse.ZweiPaare:
      return w.zweiPaare(mehr(erst), mehr(zweit))
    case HandKlasse.Paar:
      return w.paar(mehr(erst))
    default:
      return w.hoheKarte(name(erst))
  }
}

/** „Du gewinnst 40 mit …" -- `wer` ist null, wenn man selbst gemeint ist. */
export function gewinnSatz(
  t: Texte,
  wer: string | null,
  betrag: number,
  hand: HandKern | null,
): string {
  const p = t.texas.protokoll
  const satz = wer === null ? p.duGewinnst(betrag) : p.gewinnt(wer, betrag)
  return hand ? p.mitHand(satz, handSatz(t, hand)) : satz
}

/* ------------------------------------------------- Protokoll lesen */

/**
 * Alle Hände, wie die Engine sie nach „mit" schreibt -- rückwärts
 * nachgeschlagen. Es sind wenige hundert; gerechnet wird einmal.
 */
let handNachText: Map<string, HandKern> | null = null

function handAusText(text: string): HandKern | null {
  if (!handNachText) {
    const karte = new Map<string, HandKern>()
    const merke = (klasse: HandKlasse, werte: number[]) => {
      const kern = { klasse, werte }
      karte.set(handTextMit({ ...kern, karten: [] }), kern)
    }
    for (let a = 2; a <= 14; a++) {
      merke(HandKlasse.HoheKarte, [a])
      merke(HandKlasse.Paar, [a])
      merke(HandKlasse.Drilling, [a])
      merke(HandKlasse.Vierling, [a])
      merke(HandKlasse.Flush, [a])
      if (a >= 5) {
        merke(HandKlasse.Strasse, [a])
        merke(HandKlasse.StraightFlush, [a])
      }
      for (let b = 2; b <= 14; b++) {
        if (b === a) continue
        merke(HandKlasse.FullHouse, [a, b])
        if (b < a) merke(HandKlasse.ZweiPaare, [a, b])
      }
    }
    handNachText = karte
  }
  return handNachText.get(text) ?? null
}

const FARBE_NACH_ZEICHEN = new Map<string, Farbe>(
  (Object.entries(FARB_ZEICHEN) as [Farbe, string][]).map(([farbe, zeichen]) => [zeichen, farbe]),
)

/** „B♠ 7♥ 2♦" zurück in Karten -- oder null, wenn etwas nicht passt. */
function kartenAusProtokoll(text: string): Karte[] | null {
  const aus: Karte[] = []
  for (const teil of text.split(' ')) {
    const farbe = FARBE_NACH_ZEICHEN.get(teil.slice(-1))
    const kurz = teil.slice(0, -1)
    const wert = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].find((w) => wertKurz(w) === kurz)
    if (!farbe || wert === undefined) return null
    aus.push({ wert, farbe })
  }
  return aus
}

/** Wer gemeint ist: „Du" ist man selbst -- so schreibt es die Engine. */
function name(t: Texte, wer: string): string {
  return wer === 'Du' ? t.texas.du : wer
}

/** Ein Stück einer Zeile; null, wenn es nicht erkannt wird. */
function teilSagen(t: Texte, teil: string): string | null {
  const p = t.texas.protokoll
  let m: RegExpMatchArray | null

  if ((m = teil.match(/^Hand (\d+)$/))) return p.hand(Number(m[1]))
  if ((m = teil.match(/^Blinds (\d+)\/(\d+)$/))) return p.blinds(Number(m[1]), Number(m[2]))
  if ((m = teil.match(/^(.+) und (.+) zahlen$/))) return p.zahlen(name(t, m[1]!), name(t, m[2]!))

  if ((m = teil.match(/^(Flop|Turn|River): (.+)$/))) {
    const karten = kartenAusProtokoll(m[2]!)
    return karten ? `${m[1]}: ${karten.map((k) => karteKurzText(t, k)).join(' ')}` : null
  }

  if (teil === 'Du wirfst weg') return p.duWirfstWeg
  if (teil === 'Du schiebst') return p.duSchiebst
  if ((m = teil.match(/^Du gehst mit (\d+)$/))) return p.duGehstMit(Number(m[1]))
  if ((m = teil.match(/^Du setzt (\d+)$/))) return p.duSetzt(Number(m[1]))
  if ((m = teil.match(/^Du erhöhst auf (\d+)$/))) return p.duErhoehst(Number(m[1]))
  if ((m = teil.match(/^Du bist raus \(Platz (\d+)\)$/))) return p.duBistRaus(Number(m[1]))

  if ((m = teil.match(/^(.+) wirft weg$/))) return p.wirftWeg(m[1]!)
  if ((m = teil.match(/^(.+) schiebt$/))) return p.schiebt(m[1]!)
  if ((m = teil.match(/^(.+) geht mit (\d+)$/))) return p.gehtMit(m[1]!, Number(m[2]))
  if ((m = teil.match(/^(.+) setzt (\d+)$/))) return p.setzt(m[1]!, Number(m[2]))
  if ((m = teil.match(/^(.+) erhöht auf (\d+)$/))) return p.erhoeht(m[1]!, Number(m[2]))
  if ((m = teil.match(/^(.+) ist raus \(Platz (\d+)\)$/))) return p.istRaus(m[1]!, Number(m[2]))

  m =
    teil.match(/^Du gewinnst (\d+)(?: mit (.+))?$/) ??
    teil.match(/^(.+) gewinnt (\d+)(?: mit (.+))?$/)
  if (m) {
    const du = m.length === 3
    const wer = du ? null : m[1]!
    const betrag = Number(du ? m[1] : m[2])
    const handText = du ? m[2] : m[3]
    if (handText === undefined) return gewinnSatz(t, wer, betrag, null)
    const hand = handAusText(handText)
    return hand ? gewinnSatz(t, wer, betrag, hand) : null
  }
  return null
}

/**
 * Eine Zeile aus Protokoll oder Ergebnis in der Sprache der Oberfläche.
 *
 * Zeilen bestehen aus Stücken mit „ · " dazwischen (Hand, Blinds, wer
 * zahlt; oder mehrere Gewinner). Jedes Stück wird für sich gelesen;
 * was nicht erkannt wird, bleibt stehen.
 */
export function protokollZeile(t: Texte, zeile: string): string {
  return zeile
    .split(' · ')
    .map((teil) => teilSagen(t, teil) ?? teil)
    .join(' · ')
}
