/**
 * Tagesaufgaben: drei kleine Aufgaben pro Tag.
 *
 * Alles hier ist rein -- kein Speicher, kein Netz, keine Uhr außer der, die
 * man hineingibt. Die Aufgaben folgen allein aus dem Kalendertag (Ortszeit):
 * Am selben Tag hat jeder dieselben drei, auch ohne Netz, und um Mitternacht
 * gibt es neue. Gespeichert und gebucht wird in `tagesaufgabenBuchung.ts`.
 *
 * Regeln (docs/design/bindung/README.md):
 * - Belohnt wird das Spielen, nie die Wertung: Eine Aufgabe gibt XP, aber
 *   nie Punkte, Sterne oder einen Rekord.
 * - Was erledigt ist, bleibt erledigt. Um Mitternacht kommen neue Aufgaben,
 *   die alten verfallen ohne Strafe -- es geht nichts verloren, was schon
 *   verdient war.
 * - Es zählen Spiele, die ihr Ergebnis über `processAfterResult` melden,
 *   und die Partyspiele am Tisch über `meldePartyRunde` (partyRunde.ts):
 *   Die speichern kein Ergebnis, zählen aber als Runde. Eine eigene Aufgabe
 *   „Spiele N Runden <Partyspiel>" gibt es nicht -- dafür braucht es eine
 *   Runde Leute, und die hat man nicht jeden Tag.
 */

import type { GameId } from '@/games/types'
import { kachelFuer, gruppeVon, type SpielGruppe } from '@/pages/spiele-katalog'

/* ------------------------------------------------------------- Zahlen */

/**
 * XP je erledigter Aufgabe. Eine normale Runde bringt 30 bis 80 XP
 * (Kopfrechnen 50, Kniffel um 60, Levelspiele ähnlich): Eine Aufgabe ist
 * also etwa eine halbe Runde wert, alle drei samt Bonus knapp zwei Runden.
 * Bei Level 2 = 500 XP und Level 10 = 20 700 XP bleibt das ein Zuschlag
 * zum Spielen, kein Ersatz dafür.
 */
export const AUFGABE_XP = 30
/** Zusätzlich, wenn alle drei Aufgaben des Tages erledigt sind. */
export const ALLE_AUFGABEN_XP = 40
/** Höchstens so viel XP bringt ein Tag über die Aufgaben: 3 × 30 + 40. */
export const AUFGABEN_XP_PRO_TAG_MAX = 3 * AUFGABE_XP + ALLE_AUFGABEN_XP

/* ------------------------------------------------------------- Typen */

export type AufgabenArt =
  'rundenSpiel' | 'sterne' | 'neuesLevel' | 'verschiedene' | 'gruppe' | 'runden'

export interface Tagesaufgabe {
  /** Eindeutig innerhalb des Tages, z. B. `rundenSpiel:kniffel:1`. */
  id: string
  art: AufgabenArt
  /** Wie oft es gelingen muss. */
  ziel: number
  /** Bei `rundenSpiel`: welches Spiel. */
  gameId?: GameId
  /** Bei `gruppe`: welche Gruppe. */
  gruppe?: SpielGruppe
  /** Bei `sterne`: wie viele Sterne mindestens. */
  sterne?: number
}

/** Eine gemeldete Runde, so knapp wie möglich. */
export interface Spielzug {
  gameId: string
  level: number
  sterne: number
  /** Ein Level geschafft, das in diesem Spiel noch nie geschafft war. */
  neuesLevel: boolean
}

/** Der Stand eines Tages, wie er gespeichert wird. */
export interface Tagesstand {
  /** YYYY-MM-DD, Ortszeit. */
  datum: string
  zuege: Spielzug[]
  /** Ids der Aufgaben, deren XP schon gebucht ist. */
  erledigt: string[]
  /** Der Bonus für alle drei ist gebucht. */
  alleBelohnt: boolean
}

/* ----------------------------------------------------- Spiele-Gruppen */

/**
 * Spiele mit Levelstrecke: Nur hier gibt es Sterne je Level und „ein neues
 * Level". (Schützenrunde vergibt auch Sterne, aber für Sieg oder König --
 * das ist kein Level.)
 */
export const LEVEL_SPIELE: readonly GameId[] = [
  'perfect-second',
  'what-is-missing',
  'reihenfolge',
  'kopfrechnen',
  'sudoku',
  'bienen-flow',
  'squishy-dumplings',
  'trapbound',
  'emberwake',
]

/**
 * „Spiele N Runden X": jedes Spiel, das ein Ergebnis meldet, mit einer Zahl,
 * die in 5 bis 15 Minuten zu schaffen ist. Lange Partien (Kniffel, Schach,
 * Dame, Mühle, Texas) zählen einfach, schnelle Runden dreifach. Schützenopoly fehlt mit
 * Absicht: Eine Partie dauert länger als eine Tagesaufgabe.
 */
const RUNDEN_JE_SPIEL: readonly { gameId: GameId; ziel: number }[] = [
  { gameId: 'perfect-second', ziel: 3 },
  { gameId: 'what-is-missing', ziel: 3 },
  { gameId: 'reihenfolge', ziel: 3 },
  { gameId: 'kopfrechnen', ziel: 2 },
  { gameId: 'sudoku', ziel: 1 },
  { gameId: 'bienen-flow', ziel: 2 },
  { gameId: 'squishy-dumplings', ziel: 2 },
  { gameId: 'trapbound', ziel: 2 },
  { gameId: 'emberwake', ziel: 1 },
  { gameId: 'kniffel', ziel: 1 },
  { gameId: 'maumau', ziel: 2 },
  { gameId: 'letzte-karte', ziel: 2 },
  { gameId: 'texas-holdem', ziel: 1 },
  { gameId: 'schach', ziel: 1 },
  // Eine Partie auf dem mittleren Blatt dauert drei, vier Minuten.
  { gameId: 'kaesekaestchen', ziel: 2 },
  { gameId: 'dame', ziel: 1 },
  { gameId: 'muehle', ziel: 1 },
  // Eine Partie gegen den Computer dauert fünf bis zehn Minuten.
  { gameId: 'schiffe-versenken', ziel: 1 },
  { gameId: 'schuetzenrunde', ziel: 1 },
]

/** Gruppen für „Spiel N Runden aus …". Party mit einer Runde: Schützenrunde geht allein. */
const AUFGABEN_GRUPPEN: readonly { gruppe: SpielGruppe; ziel: number }[] = [
  { gruppe: 'knobeln', ziel: 2 },
  { gruppe: 'geschick', ziel: 2 },
  { gruppe: 'tisch', ziel: 1 },
  { gruppe: 'party', ziel: 1 },
]

/** Spiele, die ein Ergebnis melden und deshalb als Vorschlag taugen. */
const MELDENDE_SPIELE: readonly GameId[] = RUNDEN_JE_SPIEL.map((r) => r.gameId)

/**
 * Partyspiele, die über `meldePartyRunde` zählen. Vorgeschlagen werden sie
 * nur für die Party-Aufgabe, nie für „verschiedene Spiele" -- wer allein
 * auf dem Sofa sitzt, soll nicht zu Scharade geschickt werden.
 */
export const PARTY_SPIELE: readonly GameId[] = [
  'finde-den-imposter',
  'wer-bin-ich',
  'stadt-land-fluss',
  'scharade',
  'wortbombe',
  'wer-wuerde-eher',
  'rueckwaerts',
]

/* ------------------------------------------------------------ Zufall */

/** FNV-1a über den Text: aus dem Datum eine Zahl, überall dieselbe. */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: klein, schnell, reproduzierbar. */
function zufall(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let x = a
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

function waehle<T>(liste: readonly T[], r: () => number): T {
  return liste[Math.floor(r() * liste.length)]!
}

/* --------------------------------------------------------- Erzeugung */

/** Tage seit 1970 für ein YYYY-MM-DD -- fortlaufend, ohne Zeitumstellung. */
function tagNummer(datum: string): number {
  const [y, m, d] = datum.split('-').map(Number)
  return Math.floor(Date.UTC(y!, m! - 1, d!) / 86_400_000)
}

/**
 * Schrittweite durch die Spieleliste. Teilerfremd zu ihrer Länge (19), damit
 * jedes Spiel drankommt; kein Vielfaches davon, damit der Folgetag ein
 * anderes Spiel hat. `tests/bindung.test.ts` prüft beides.
 */
const SPIEL_SCHRITT = 7

/**
 * Die drei Aufgaben eines Tages.
 *
 * Drei Fächer, aus jedem eine, damit sich der Tag nicht wiederholt:
 * 1. ein bestimmtes Spiel („Spiele 2 Runden Kniffel"),
 * 2. etwas Breites (verschiedene Spiele, Runden insgesamt, eine Gruppe),
 * 3. etwas Können (Sterne in einem Levelspiel, ein neues Level).
 * Fach 2 nimmt keine Gruppe, in der das Spiel aus Fach 1 schon steht --
 * sonst erledigte eine Runde zwei Aufgaben auf einmal.
 */
export function aufgabenFuerTag(datum: string): Tagesaufgabe[] {
  const r = zufall(hash(`tagesaufgaben:${datum}`))

  // Das Spiel geht nicht nach dem Würfel, sondern in Siebenerschritten
  // durch die Liste: So kommt jedes Spiel einmal in neunzehn Tagen dran,
  // durcheinander, und nie zweimal hintereinander.
  const n = RUNDEN_JE_SPIEL.length
  const index = (((tagNummer(datum) * SPIEL_SCHRITT) % n) + n) % n
  const spiel = RUNDEN_JE_SPIEL[index]!
  const erste: Tagesaufgabe = {
    id: `rundenSpiel:${spiel.gameId}:${spiel.ziel}`,
    art: 'rundenSpiel',
    ziel: spiel.ziel,
    gameId: spiel.gameId,
  }

  const spielGruppe = gruppeVon(spiel.gameId)
  const breit: Tagesaufgabe[] = [
    { id: 'verschiedene:2', art: 'verschiedene', ziel: 2 },
    { id: 'verschiedene:3', art: 'verschiedene', ziel: 3 },
    { id: 'runden:3', art: 'runden', ziel: 3 },
    { id: 'runden:4', art: 'runden', ziel: 4 },
    ...AUFGABEN_GRUPPEN.filter((g) => g.gruppe !== spielGruppe).map((g): Tagesaufgabe => ({
      id: `gruppe:${g.gruppe}:${g.ziel}`,
      art: 'gruppe',
      ziel: g.ziel,
      gruppe: g.gruppe,
    })),
  ]
  const zweite = waehle(breit, r)

  const koennen: Tagesaufgabe[] = [
    { id: 'sterne:3', art: 'sterne', ziel: 1, sterne: 3 },
    { id: 'sterne:4', art: 'sterne', ziel: 1, sterne: 4 },
    { id: 'neuesLevel:1', art: 'neuesLevel', ziel: 1 },
    { id: 'neuesLevel:2', art: 'neuesLevel', ziel: 2 },
  ]
  const dritte = waehle(koennen, r)

  return [erste, zweite, dritte]
}

/* ---------------------------------------------------------- Zählung */

function istLevelSpiel(gameId: string): boolean {
  return (LEVEL_SPIELE as readonly string[]).includes(gameId)
}

/** Wie weit eine Aufgabe ist, höchstens bis zu ihrem Ziel. */
export function fortschritt(aufgabe: Tagesaufgabe, zuege: readonly Spielzug[]): number {
  let ist = 0
  switch (aufgabe.art) {
    case 'rundenSpiel':
      ist = zuege.filter((z) => z.gameId === aufgabe.gameId).length
      break
    case 'sterne':
      ist = zuege.filter((z) => istLevelSpiel(z.gameId) && z.sterne >= (aufgabe.sterne ?? 3)).length
      break
    case 'neuesLevel':
      ist = zuege.filter((z) => istLevelSpiel(z.gameId) && z.neuesLevel).length
      break
    case 'verschiedene':
      ist = new Set(zuege.map((z) => z.gameId)).size
      break
    case 'gruppe':
      ist = zuege.filter(
        (z) => kachelFuer(z.gameId) && gruppeVon(z.gameId as GameId) === aufgabe.gruppe,
      ).length
      break
    case 'runden':
      ist = zuege.length
      break
  }
  return Math.min(aufgabe.ziel, ist)
}

export function istErledigt(aufgabe: Tagesaufgabe, zuege: readonly Spielzug[]): boolean {
  return fortschritt(aufgabe, zuege) >= aufgabe.ziel
}

/* ---------------------------------------------------------- Buchung */

/** Ein leerer Tag. */
export function neuerTag(datum: string): Tagesstand {
  return { datum, zuege: [], erledigt: [], alleBelohnt: false }
}

/**
 * Der Stand für `datum`: Der gespeicherte, wenn er von heute ist, sonst ein
 * leerer -- das ist der ganze Mitternachtswechsel.
 */
export function standFuer(gespeichert: Tagesstand | null | undefined, datum: string): Tagesstand {
  return gespeichert && gespeichert.datum === datum ? gespeichert : neuerTag(datum)
}

/** So viele Züge hebt ein Tag höchstens auf -- mehr braucht keine Aufgabe. */
const ZUEGE_MAX = 60

export interface Tageswertung {
  stand: Tagesstand
  /** Aufgaben, die mit diesem Zug fertig wurden (je genau einmal). */
  neuErledigt: Tagesaufgabe[]
  /** Mit diesem Zug sind alle drei fertig geworden. */
  alleNeu: boolean
  /** Zu buchende XP: 30 je neuer Aufgabe, 40 für alle drei. */
  xp: number
}

/**
 * Einen Zug in den Tag eintragen und ausrechnen, was dadurch fertig wurde.
 * Eine Aufgabe wird nur einmal belohnt, auch wenn man weiterspielt.
 */
export function zugEintragen(
  gespeichert: Tagesstand | null | undefined,
  zug: Spielzug,
  datum: string,
): Tageswertung {
  const vorher = standFuer(gespeichert, datum)
  const zuege = [...vorher.zuege, zug].slice(-ZUEGE_MAX)
  const aufgaben = aufgabenFuerTag(datum)

  const neuErledigt = aufgaben.filter(
    (a) => !vorher.erledigt.includes(a.id) && istErledigt(a, zuege),
  )
  const erledigt = [...vorher.erledigt, ...neuErledigt.map((a) => a.id)]
  const alleNeu = !vorher.alleBelohnt && aufgaben.every((a) => erledigt.includes(a.id))

  return {
    stand: { datum, zuege, erledigt, alleBelohnt: vorher.alleBelohnt || alleNeu },
    neuErledigt,
    alleNeu,
    xp: neuErledigt.length * AUFGABE_XP + (alleNeu ? ALLE_AUFGABEN_XP : 0),
  }
}

/* -------------------------------------------------------- Vorschlag */

/**
 * Wohin das Antippen einer Aufgabe führt: in ein Spiel, das sie voranbringt.
 * Bei „verschiedene Spiele" eines, das heute noch nicht dran war.
 */
export function vorschlagFuer(
  aufgabe: Tagesaufgabe,
  zuege: readonly Spielzug[],
  datum: string,
): GameId {
  const gespielt = new Set(zuege.map((z) => z.gameId))
  const r = zufall(hash(`vorschlag:${datum}:${aufgabe.id}`))
  switch (aufgabe.art) {
    case 'rundenSpiel':
      return aufgabe.gameId ?? 'perfect-second'
    case 'sterne':
    case 'neuesLevel': {
      // Wer heute schon in einem Levelspiel war, macht dort weiter.
      const zuletzt = [...zuege].reverse().find((z) => istLevelSpiel(z.gameId))
      return (zuletzt?.gameId as GameId | undefined) ?? waehle(LEVEL_SPIELE, r)
    }
    case 'gruppe': {
      // Für Party zuerst Schützenrunde: Die geht auch allein.
      const passend = [...MELDENDE_SPIELE, ...PARTY_SPIELE].filter(
        (g) => gruppeVon(g) === aufgabe.gruppe,
      )
      if (aufgabe.gruppe === 'party') return passend[0] ?? 'schuetzenrunde'
      return waehle(passend.length > 0 ? passend : MELDENDE_SPIELE, r)
    }
    case 'verschiedene':
    case 'runden': {
      const offen = MELDENDE_SPIELE.filter((g) => !gespielt.has(g))
      return waehle(offen.length > 0 ? offen : MELDENDE_SPIELE, r)
    }
  }
}
