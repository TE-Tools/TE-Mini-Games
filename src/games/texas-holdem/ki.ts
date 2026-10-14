/**
 * Der Rechner am Pokertisch.
 *
 * Kein Nachrechnen von Millionen Blättern -- das wäre auf einem Telefon
 * unangenehm langsam und würde auch keinen Spass machen. Stattdessen drei
 * Fragen, wie sie ein Mensch am Tisch auch stellt:
 *
 *   1. Wie gut ist meine Hand? (0 bis 1)
 *   2. Was kostet Mitgehen im Verhältnis zum Topf? (die Pot Odds)
 *   3. Wie viele sitzen noch drin? Gegen vier Leute gewinnt ein mittleres
 *      Blatt viel seltener als gegen einen.
 *
 * Vor dem Flop zählt eine Punktwertung der beiden Karten (hoher Wert,
 * Paar, gleiche Farbe, Abstand) -- die bekannte Chen-Rechnung, hier in
 * eigener Form. Danach zählt die tatsächliche Hand plus das, was noch
 * werden kann: Vier zu einer Farbe oder eine offene Straße sind etwas
 * wert, solange noch Karten kommen.
 *
 * Die Stufen unterscheiden sich nicht im Wissen, sondern im Mut:
 * „Leicht" geht zu oft mit und erhöht selten, „Schwer" rechnet mit den
 * Pot Odds und blufft hin und wieder. Eine KI, die nur stärker rechnet,
 * fühlt sich am Tisch nicht anders an -- eine, die anders setzt, schon.
 */

import { createRng } from '@/games/rng'
import type { Karte } from './karten'
import { HandKlasse, besteHand } from './wertung'
import {
  aktive,
  amZugSpieler,
  imRennen,
  moeglichkeiten,
  type Aktion,
  type KiStufe,
  type TexasZustand,
} from './engine'

/* ----------------------------------------------------------- Vor dem Flop */

function punkte(wert: number): number {
  if (wert === 14) return 10
  if (wert === 13) return 8
  if (wert === 12) return 7
  if (wert === 11) return 6
  return wert / 2
}

/**
 * Wie viel sind zwei Karten vor dem Flop wert? Ergebnis 0 bis 1.
 *
 * AA kommt auf 20 Punkte, 7-2 ungleichfarbig auf -1 -- das ist auch am
 * echten Tisch die schlechteste Hand.
 */
export function preflopStaerke(a: Karte, b: Karte): number {
  const hoch = Math.max(a.wert, b.wert)
  const tief = Math.min(a.wert, b.wert)
  let p = punkte(hoch)

  if (a.wert === b.wert) p = Math.max(5, p * 2)
  if (a.farbe === b.farbe) p += 2

  const luecke = hoch - tief - 1
  if (a.wert !== b.wert) {
    if (luecke === 1) p -= 1
    else if (luecke === 2) p -= 2
    else if (luecke === 3) p -= 4
    else if (luecke >= 4) p -= 5
    // Zwei kleine Karten dicht beieinander machen Straßen.
    if (luecke <= 1 && hoch < 12) p += 1
  }

  return Math.max(0, Math.min(1, (Math.ceil(p) + 2) / 22))
}

/* ------------------------------------------------------- Nach dem Flop */

const KLASSE_STAERKE: Record<HandKlasse, number> = {
  [HandKlasse.HoheKarte]: 0.12,
  [HandKlasse.Paar]: 0.38,
  [HandKlasse.ZweiPaare]: 0.58,
  [HandKlasse.Drilling]: 0.74,
  [HandKlasse.Strasse]: 0.84,
  [HandKlasse.Flush]: 0.9,
  [HandKlasse.FullHouse]: 0.95,
  [HandKlasse.Vierling]: 0.99,
  [HandKlasse.StraightFlush]: 1,
}

/** Vier zu einer Farbe? Dann fehlt nur eine. */
function flushZieher(karten: readonly Karte[]): boolean {
  const zaehler = new Map<string, number>()
  for (const k of karten) zaehler.set(k.farbe, (zaehler.get(k.farbe) ?? 0) + 1)
  return [...zaehler.values()].some((n) => n === 4)
}

/** Wie viele Karten fehlen noch zur Straße? 1 heisst: eine reicht. */
function strassenLuecke(karten: readonly Karte[]): number {
  const werte = new Set(karten.map((k) => k.wert))
  if (werte.has(14)) werte.add(1)
  let beste = 5
  for (let start = 1; start <= 10; start++) {
    let fehlt = 0
    for (let i = 0; i < 5; i++) if (!werte.has(start + i)) fehlt++
    beste = Math.min(beste, fehlt)
  }
  return beste
}

/**
 * Wie stark steht dieser Spieler gerade? 0 bis 1.
 *
 * `gegner` ist die Zahl der anderen, die noch dabei sind: Dasselbe Paar
 * ist gegen einen gut und gegen vier dünn.
 */
export function staerke(eigene: readonly Karte[], board: readonly Karte[], gegner: number): number {
  if (eigene.length < 2) return 0
  if (board.length === 0) {
    const roh = preflopStaerke(eigene[0]!, eigene[1]!)
    return Math.max(0.02, roh ** (1 + Math.max(0, gegner - 1) * 0.25))
  }

  const alle = [...eigene, ...board]
  const hand = besteHand(alle)
  let wert = KLASSE_STAERKE[hand.klasse]

  // Zählt die Hand überhaupt mir, oder liegt sie für alle auf dem Tisch?
  if (hand.klasse <= HandKlasse.Paar) {
    const brettHand = besteHand(board)
    if (brettHand.klasse === hand.klasse && brettHand.werte[0] === hand.werte[0]) {
      // Das Brett spielt -- meine Karten tragen nichts bei.
      wert *= 0.55
    }
  }

  // Was noch werden kann, solange Karten kommen.
  if (board.length < 5) {
    if (flushZieher(alle) && hand.klasse < HandKlasse.Flush) wert += 0.18
    const luecke = strassenLuecke(alle)
    if (luecke === 1 && hand.klasse < HandKlasse.Strasse) wert += 0.12
  }

  wert = Math.max(0, Math.min(1, wert))
  // Gegen mehrere muss es für mehrere reichen.
  return wert ** (1 + Math.max(0, gegner - 1) * 0.3)
}

/* ------------------------------------------------------------ Entscheiden */

interface Zuschnitt {
  /** Ab welcher Stärke über den Pot Odds mitgegangen wird. */
  aufschlag: number
  /** Ab welcher Stärke erhöht wird. */
  erhoehenAb: number
  /** Wie oft ohne Hand geblufft wird. */
  bluff: number
}

/*
 * Die drei Zuschnitte, nachgemessen statt geschätzt.
 *
 * Thomas am 14.10.2026: „normal ist zu zahm bitte etwas mutiger machen."
 * Das war belegt: In 60 durchgespielten Turnieren zu sechst erhöhte
 * „normal" in 7,5 Prozent seiner Entscheidungen und warf 46 Prozent
 * weg -- zusammen mit dem Schieben also 84 Prozent, in denen nichts
 * passierte. Am Tisch fühlt sich das an wie Alleinspielen.
 *
 * Jetzt (dieselbe Messung): erhöht 17 Prozent, wirft 39 Prozent weg; zu
 * dritt sogar 21 Prozent Erhöhungen bei 23 Prozent Würfen. Das ist ein
 * Gegner, der um Töpfe kämpft.
 *
 * Die Reihenfolge der Stufen hält `tests/texas-engine.test.ts` fest.
 */
const STUFEN: Record<KiStufe, Zuschnitt> = {
  // Geht fast immer mit, erhöht fast nie -- der klassische Anfängerfehler,
  // und für den Menschen am Tisch gut auszurechnen.
  leicht: { aufschlag: -0.12, erhoehenAb: 0.82, bluff: 0.02 },
  // Spielt mit: geht etwas unter den Pot Odds mit, erhöht ab der Hälfte
  // und blufft in jedem sechsten freien Topf.
  normal: { aufschlag: -0.03, erhoehenAb: 0.52, bluff: 0.18 },
  // Rechnet knapp und setzt Druck auf, wo es billig ist.
  schwer: { aufschlag: 0.0, erhoehenAb: 0.46, bluff: 0.3 },
}

/** Ein eigener Zufall je Entscheidung -- damit dieselbe Lage gleich ausgeht. */
function wuerfel(state: TexasZustand): number {
  return createRng(
    `${state.seed}:ki:${state.handNr}:${state.phase}:${state.amZug}:${state.protokoll.length}`,
  )()
}

export function kiAktion(state: TexasZustand): Aktion {
  const ich = amZugSpieler(state)
  const m = moeglichkeiten(state)
  if (!ich || ich.status !== 'aktiv') return { art: 'folden' }

  const zuschnitt = STUFEN[ich.kiStufe ?? 'normal']
  const gegner = Math.max(1, imRennen(state).length - 1)
  const kraft = staerke(ich.karten, state.board, gegner)
  const zufall = wuerfel(state)

  const zuZahlen = m.mitgehen ?? 0
  const topf = state.pot + state.spieler.reduce((n, s) => n + s.einsatz, 0)
  const potOdds = zuZahlen > 0 ? zuZahlen / (topf + zuZahlen) : 0

  /* ------------------------------------------------ Nichts zu bezahlen */

  if (m.schieben) {
    const setztAn = kraft >= zuschnitt.erhoehenAb || zufall < zuschnitt.bluff
    if (setztAn && m.erhoehen) {
      const halberTopf = Math.round(topf * (kraft > 0.85 ? 0.75 : 0.5))
      const auf = Math.max(m.erhoehen.min, Math.min(m.erhoehen.max, ich.einsatz + halberTopf))
      return { art: 'erhoehen', auf }
    }
    return { art: 'schieben' }
  }

  /* ------------------------------------------------------ Es kostet etwas */

  // Was hier verlangt wird, gemessen am eigenen Stapel: Den letzten Chip
  // gibt man nicht für ein mittleres Blatt her.
  const anteilVomStapel = zuZahlen / Math.max(1, ich.chips)
  const schwelle = potOdds + zuschnitt.aufschlag + anteilVomStapel * 0.25

  if (kraft < schwelle) {
    // Ganz billig bleibt man schon mal drin, wenn etwas werden kann.
    if (zuZahlen <= topf * 0.08 && kraft > 0.25) return { art: 'mitgehen' }
    return { art: 'folden' }
  }

  if (kraft >= zuschnitt.erhoehenAb && m.erhoehen && aktive(state).length > 1) {
    const zulage = Math.round(topf * (kraft > 0.9 ? 0.9 : 0.6))
    const auf = Math.max(m.erhoehen.min, Math.min(m.erhoehen.max, state.hoechsterEinsatz + zulage))
    return { art: 'erhoehen', auf }
  }

  return { art: 'mitgehen' }
}
