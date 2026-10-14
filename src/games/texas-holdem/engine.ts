/**
 * Texas Hold'em -- der Ablauf.
 *
 * Reine Logik, kein React. Jede Funktion nimmt einen Zustand und gibt
 * einen neuen zurück; der Zufall steckt als Startwert im Zustand, damit
 * sich eine Partie nachspielen und prüfen lässt.
 *
 * Die drei Stellen, an denen Hold'em-Nachbauten üblicherweise falsch sind,
 * und wie es hier gelöst ist:
 *
 *  1. WANN IST EINE SETZRUNDE VORBEI? Nicht "wenn alle einmal dran waren",
 *     sondern: jeder, der noch mitredet, hat gehandelt UND hält denselben
 *     Einsatz. Eine Erhöhung macht das Handeln der anderen ungültig --
 *     sie müssen noch einmal.
 *  2. MINDESTERHÖHUNG. Erhöht wird um mindestens so viel wie zuletzt
 *     erhöht wurde (vor dem Flop: um den grossen Blind). Sonst lässt sich
 *     ein Tisch mit Ein-Chip-Erhöhungen blockieren.
 *  3. NEBENPOTS. Wer all-in geht, kann nur gewinnen, was er bezahlt hat.
 *     Deshalb wird am Ende schichtweise abgerechnet, nicht in einem Topf.
 *
 * Heads-up gelten andere Plätze als am vollen Tisch: Der Geber zahlt den
 * kleinen Blind und beginnt vor dem Flop, danach beginnt der andere.
 */

import { createRng } from '@/games/rng'
import { gemischtesDeck, karteText, type Karte } from './karten'
import { besteHand, handText, vergleicheHand, type Handwert } from './wertung'
import { BLIND_STUFEN, HAENDE_JE_STUFE, MAX_SPIELER, MIN_SPIELER, START_CHIPS } from './config'

export type SpielerStatus = 'aktiv' | 'gefoldet' | 'allin' | 'raus'
export type Phase = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'ende'
export type KiStufe = 'leicht' | 'normal' | 'schwer'

export interface TexasSpieler {
  id: string
  name: string
  mensch: boolean
  kiStufe: KiStufe | null
  chips: number
  /** Einsatz in der laufenden Setzrunde. */
  einsatz: number
  /** Einsatz in dieser Hand insgesamt -- die Grundlage der Nebenpots. */
  gesamt: number
  karten: Karte[]
  status: SpielerStatus
  /** Hat in dieser Setzrunde schon gehandelt? Eine Erhöhung setzt es zurück. */
  gehandelt: boolean
  /** Auf welchem Platz ausgeschieden (1 = Sieger). Null, solange dabei. */
  platz: number | null
}

export type Aktion =
  | { art: 'folden' }
  | { art: 'schieben' }
  | { art: 'mitgehen' }
  /** Auf diesen Gesamteinsatz in der Setzrunde erhöhen. */
  | { art: 'erhoehen'; auf: number }

export interface Gewinnanteil {
  spielerId: string
  betrag: number
  hand: Handwert | null
}

export interface HandErgebnis {
  anteile: Gewinnanteil[]
  /** Wurden die Karten gezeigt, oder haben alle anderen weggeworfen? */
  gezeigt: boolean
  board: Karte[]
  text: string
}

export interface TexasZustand {
  spieler: TexasSpieler[]
  /** Platz des Gebers. */
  dealer: number
  handNr: number
  blindStufe: number
  phase: Phase
  board: Karte[]
  /** Was aus abgeschlossenen Setzrunden schon im Topf liegt. */
  pot: number
  /** Der höchste Einsatz der laufenden Setzrunde. */
  hoechsterEinsatz: number
  /** Um wie viel zuletzt erhöht wurde -- die Mindesterhöhung. */
  letzteErhoehung: number
  amZug: number
  deck: Karte[]
  seed: number
  protokoll: string[]
  ergebnis: HandErgebnis | null
  /** Steht fest, wer das Turnier gewonnen hat? */
  siegerId: string | null
}

export interface SpielerEinrichtung {
  name: string
  mensch: boolean
  kiStufe?: KiStufe
}

export interface PartieOptionen {
  spieler: SpielerEinrichtung[]
  seed?: number
  startChips?: number
}

export const ZUSTAND_VERSION = 1

/* ------------------------------------------------------------ Hilfen */

export function blinds(stufe: number): { klein: number; gross: number } {
  return BLIND_STUFEN[Math.min(stufe, BLIND_STUFEN.length - 1)]!
}

/** Wer noch Karten hält und mitreden darf. */
export function aktive(state: TexasZustand): TexasSpieler[] {
  return state.spieler.filter((s) => s.status === 'aktiv')
}

/** Wer noch im Rennen um den Pot ist -- all-in zählt mit. */
export function imRennen(state: TexasZustand): TexasSpieler[] {
  return state.spieler.filter((s) => s.status === 'aktiv' || s.status === 'allin')
}

/** Wer noch Chips hat und die nächste Hand mitspielt. */
export function nochDabei(state: TexasZustand): TexasSpieler[] {
  return state.spieler.filter((s) => s.status !== 'raus')
}

export function spielerMit(state: TexasZustand, id: string): TexasSpieler | undefined {
  return state.spieler.find((s) => s.id === id)
}

export function amZugSpieler(state: TexasZustand): TexasSpieler | undefined {
  return state.spieler[state.amZug]
}

/** Der nächste Platz im Uhrzeigersinn, der noch handeln darf. */
function naechsterAktiver(state: TexasZustand, ab: number): number {
  const n = state.spieler.length
  for (let i = 1; i <= n; i++) {
    const platz = (ab + i) % n
    if (state.spieler[platz]?.status === 'aktiv') return platz
  }
  return ab
}

function naechsterMitChips(spieler: readonly TexasSpieler[], ab: number): number {
  const n = spieler.length
  for (let i = 1; i <= n; i++) {
    const platz = (ab + i) % n
    if (spieler[platz]?.status !== 'raus') return platz
  }
  return ab
}

function kopie(state: TexasZustand): TexasZustand {
  return {
    ...state,
    spieler: state.spieler.map((s) => ({ ...s, karten: [...s.karten] })),
    board: [...state.board],
    deck: [...state.deck],
    protokoll: [...state.protokoll],
  }
}

function notiere(state: TexasZustand, zeile: string): void {
  state.protokoll.push(zeile)
  if (state.protokoll.length > 60) state.protokoll.shift()
}

/** Setzt Chips -- mehr als da ist geht nicht, dann ist es all-in. */
function setze(state: TexasZustand, platz: number, betrag: number): number {
  const s = state.spieler[platz]!
  const echt = Math.min(betrag, s.chips)
  s.chips -= echt
  s.einsatz += echt
  s.gesamt += echt
  if (s.chips === 0 && s.status === 'aktiv') s.status = 'allin'
  if (s.einsatz > state.hoechsterEinsatz) state.hoechsterEinsatz = s.einsatz
  return echt
}

/* ----------------------------------------------------- Partie anlegen */

export function erstellePartie(opt: PartieOptionen): TexasZustand {
  const anzahl = opt.spieler.length
  if (anzahl < MIN_SPIELER) throw new Error(`Mindestens ${MIN_SPIELER} Spieler nötig`)
  if (anzahl > MAX_SPIELER) throw new Error(`Höchstens ${MAX_SPIELER} Spieler`)

  const chips = opt.startChips ?? START_CHIPS
  const spieler: TexasSpieler[] = opt.spieler.map((e, i) => ({
    id: `p${i}`,
    name: e.name.trim() || `Spieler ${i + 1}`,
    mensch: e.mensch,
    kiStufe: e.kiStufe ?? null,
    chips,
    einsatz: 0,
    gesamt: 0,
    karten: [],
    status: 'aktiv',
    gehandelt: false,
    platz: null,
  }))

  const roh: TexasZustand = {
    spieler,
    dealer: 0,
    handNr: 0,
    blindStufe: 0,
    phase: 'preflop',
    board: [],
    pot: 0,
    hoechsterEinsatz: 0,
    letzteErhoehung: 0,
    amZug: 0,
    deck: [],
    seed: opt.seed ?? Math.floor(Math.random() * 1_000_000),
    protokoll: [],
    ergebnis: null,
    siegerId: null,
  }
  // Der Geber beginnt links vom letzten Platz, damit die erste Hand mit
  // Platz 0 als kleinem Blind anfängt und der Mensch nicht sofort dran ist,
  // ohne zu wissen, was gespielt wird.
  roh.dealer = spieler.length - 1
  return teileAus(roh)
}

/* -------------------------------------------------------- Hand starten */

/** Mischt, verteilt, zahlt die Blinds und setzt den ersten Spieler an den Zug. */
export function teileAus(vorher: TexasZustand): TexasZustand {
  const state = kopie(vorher)
  state.handNr += 1
  state.blindStufe = Math.min(
    Math.floor((state.handNr - 1) / HAENDE_JE_STUFE),
    BLIND_STUFEN.length - 1,
  )
  state.phase = 'preflop'
  state.board = []
  state.pot = 0
  state.hoechsterEinsatz = 0
  state.ergebnis = null

  for (const s of state.spieler) {
    s.einsatz = 0
    s.gesamt = 0
    s.karten = []
    s.gehandelt = false
    if (s.chips <= 0 && s.status !== 'raus') s.status = 'raus'
    else if (s.status !== 'raus') s.status = 'aktiv'
  }

  const dabei = nochDabei(state)
  if (dabei.length <= 1) {
    state.phase = 'ende'
    state.siegerId = dabei[0]?.id ?? null
    if (dabei[0]) dabei[0].platz = 1
    return state
  }

  state.deck = gemischtesDeck(createRng(`${state.seed}:hand:${state.handNr}`))
  for (const s of dabei) s.karten = [state.deck.pop()!, state.deck.pop()!]

  const { klein, gross } = blinds(state.blindStufe)
  const heads = dabei.length === 2
  // Heads-up zahlt der Geber den kleinen Blind; am vollen Tisch der Platz
  // links von ihm.
  const sbPlatz = heads ? state.dealer : naechsterMitChips(state.spieler, state.dealer)
  const bbPlatz = naechsterMitChips(state.spieler, sbPlatz)

  setze(state, sbPlatz, klein)
  setze(state, bbPlatz, gross)
  state.hoechsterEinsatz = Math.max(
    state.spieler[sbPlatz]!.einsatz,
    state.spieler[bbPlatz]!.einsatz,
  )
  state.letzteErhoehung = gross

  notiere(
    state,
    `Hand ${state.handNr} · Blinds ${klein}/${gross} · ${state.spieler[sbPlatz]!.name} und ${state.spieler[bbPlatz]!.name} zahlen`,
  )

  // Vor dem Flop beginnt der Platz nach dem grossen Blind -- heads-up ist
  // das der Geber selbst, weil er den kleinen Blind hält.
  state.amZug = heads ? sbPlatz : naechsterAktiver(state, bbPlatz)
  if (state.spieler[state.amZug]?.status !== 'aktiv') {
    state.amZug = naechsterAktiver(state, state.amZug)
  }

  // Alle all-in durch die Blinds? Dann wird nur noch aufgedeckt.
  if (aktive(state).length <= 1 && imRennen(state).length > 1) {
    return setzrundeFertig(state)
  }
  return state
}

/* ------------------------------------------------------- Was geht gerade */

export interface Moeglichkeiten {
  folden: boolean
  schieben: boolean
  /** Was Mitgehen kostet. Null, wenn nichts zu bezahlen ist. */
  mitgehen: number | null
  /** Auf welchen Gesamteinsatz erhöht werden darf. Null, wenn gar nicht. */
  erhoehen: { min: number; max: number } | null
}

export function moeglichkeiten(state: TexasZustand): Moeglichkeiten {
  const s = amZugSpieler(state)
  if (!s || s.status !== 'aktiv' || state.phase === 'showdown' || state.phase === 'ende') {
    return { folden: false, schieben: false, mitgehen: null, erhoehen: null }
  }
  const zuZahlen = state.hoechsterEinsatz - s.einsatz
  const kannErhoehen =
    s.chips > zuZahlen &&
    // Allein gegen lauter All-ins lässt sich nicht mehr erhöhen.
    aktive(state).length > 1
  const min = Math.min(state.hoechsterEinsatz + state.letzteErhoehung, s.einsatz + s.chips)
  return {
    folden: true,
    schieben: zuZahlen === 0,
    mitgehen: zuZahlen > 0 ? Math.min(zuZahlen, s.chips) : null,
    erhoehen: kannErhoehen ? { min, max: s.einsatz + s.chips } : null,
  }
}

export function istMenschDran(state: TexasZustand): boolean {
  const s = amZugSpieler(state)
  return Boolean(s?.mensch && s.status === 'aktiv' && state.phase !== 'ende')
}

/* ----------------------------------------------------------- Handeln */

export function handle(vorher: TexasZustand, aktion: Aktion): TexasZustand {
  if (vorher.phase === 'ende' || vorher.phase === 'showdown') return vorher
  const moegl = moeglichkeiten(vorher)
  const state = kopie(vorher)
  const platz = state.amZug
  const s = state.spieler[platz]
  if (!s || s.status !== 'aktiv') return vorher

  switch (aktion.art) {
    case 'folden': {
      s.status = 'gefoldet'
      s.gehandelt = true
      notiere(state, `${s.name} wirft weg`)
      break
    }
    case 'schieben': {
      if (!moegl.schieben) return vorher
      s.gehandelt = true
      notiere(state, `${s.name} schiebt`)
      break
    }
    case 'mitgehen': {
      if (moegl.mitgehen === null) return vorher
      const gezahlt = setze(state, platz, moegl.mitgehen)
      s.gehandelt = true
      notiere(state, `${s.name} geht mit ${gezahlt}`)
      break
    }
    case 'erhoehen': {
      if (!moegl.erhoehen) return vorher
      const auf = Math.max(moegl.erhoehen.min, Math.min(aktion.auf, moegl.erhoehen.max))
      const vorherHoechst = state.hoechsterEinsatz
      setze(state, platz, auf - s.einsatz)
      // Eine Erhöhung unter der Mindestgrösse ist nur als All-in möglich;
      // sie eröffnet dann keine neue Mindesterhöhung.
      const differenz = state.hoechsterEinsatz - vorherHoechst
      if (differenz >= state.letzteErhoehung) state.letzteErhoehung = differenz
      s.gehandelt = true
      // Alle anderen müssen noch einmal ran.
      for (const a of state.spieler) {
        if (a !== s && a.status === 'aktiv') a.gehandelt = false
      }
      notiere(
        state,
        vorherHoechst === 0
          ? `${s.name} setzt ${state.hoechsterEinsatz}`
          : `${s.name} erhöht auf ${state.hoechsterEinsatz}`,
      )
      break
    }
  }

  return weiter(state)
}

/** Ist die Setzrunde durch? */
function setzrundeDurch(state: TexasZustand): boolean {
  const dran = aktive(state)
  if (dran.length === 0) return true
  if (imRennen(state).length <= 1) return true
  return dran.every((s) => s.gehandelt && s.einsatz === state.hoechsterEinsatz)
}

function weiter(state: TexasZustand): TexasZustand {
  // Nur noch einer übrig: Der bekommt den Pot, ohne zu zeigen.
  if (imRennen(state).length <= 1) return beendeHand(state, false)
  if (!setzrundeDurch(state)) {
    state.amZug = naechsterAktiver(state, state.amZug)
    return state
  }
  return setzrundeFertig(state)
}

function einsaetzeEinsammeln(state: TexasZustand): void {
  for (const s of state.spieler) {
    state.pot += s.einsatz
    s.einsatz = 0
    s.gehandelt = false
  }
  state.hoechsterEinsatz = 0
  state.letzteErhoehung = blinds(state.blindStufe).gross
}

/** Die nächste Karte (oder drei) aufdecken und die nächste Runde eröffnen. */
function setzrundeFertig(state: TexasZustand): TexasZustand {
  einsaetzeEinsammeln(state)

  const naechste: Record<string, Phase> = {
    preflop: 'flop',
    flop: 'turn',
    turn: 'river',
    river: 'showdown',
  }
  const neu = naechste[state.phase] ?? 'showdown'
  state.phase = neu

  if (neu === 'flop') state.board.push(state.deck.pop()!, state.deck.pop()!, state.deck.pop()!)
  else if (neu === 'turn' || neu === 'river') state.board.push(state.deck.pop()!)

  if (neu !== 'showdown') {
    notiere(
      state,
      `${neu === 'flop' ? 'Flop' : neu === 'turn' ? 'Turn' : 'River'}: ${state.board.map(karteText).join(' ')}`,
    )
  }

  if (neu === 'showdown') return beendeHand(state, true)

  // Kann niemand mehr handeln (alle all-in), läuft es von selbst weiter.
  if (aktive(state).length <= 1) return setzrundeFertig(state)

  // Nach dem Flop beginnt der erste Spieler links vom Geber.
  state.amZug = naechsterAktiver(state, state.dealer)
  return state
}

/* ------------------------------------------------------ Pot verteilen */

export interface Schicht {
  betrag: number
  berechtigte: string[]
}

/** Was eine Schicht über einen Spieler wissen muss -- mehr nicht. */
export interface SchichtAnteil {
  id: string
  gesamt: number
  status: SpielerStatus
}

/**
 * Nebenpots: Wer all-in ist, kann nur gewinnen, was er selbst bezahlt hat.
 *
 * Deshalb wird in Schichten abgerechnet. Jede Schicht geht bis zum
 * nächsthöheren Gesamteinsatz; wer so viel bezahlt hat, ist berechtigt --
 * ausser er hat weggeworfen, dann zahlt sein Geld mit, gewinnt aber nicht.
 */
export function schichten(spieler: readonly SchichtAnteil[]): Schicht[] {
  const rest = spieler.map((s) => ({
    id: s.id,
    offen: s.gesamt,
    imRennen: s.status === 'aktiv' || s.status === 'allin',
  }))
  const aus: Schicht[] = []
  for (;;) {
    const positiv = rest.filter((r) => r.offen > 0)
    if (positiv.length === 0) break
    const stufe = Math.min(...positiv.map((r) => r.offen))
    let betrag = 0
    const berechtigte: string[] = []
    for (const r of rest) {
      if (r.offen <= 0) continue
      const teil = Math.min(stufe, r.offen)
      r.offen -= teil
      betrag += teil
      if (r.imRennen) berechtigte.push(r.id)
    }
    if (betrag > 0) aus.push({ betrag, berechtigte })
  }
  return aus
}

function verteile(state: TexasZustand): Gewinnanteil[] {
  const haende = new Map<string, Handwert>()
  for (const s of imRennen(state)) {
    haende.set(s.id, besteHand([...s.karten, ...state.board]))
  }

  const anteile = new Map<string, Gewinnanteil>()
  const gib = (id: string, betrag: number) => {
    const da = anteile.get(id)
    if (da) da.betrag += betrag
    else anteile.set(id, { spielerId: id, betrag, hand: haende.get(id) ?? null })
    const s = spielerMit(state, id)
    if (s) s.chips += betrag
  }

  for (const schicht of schichten(state.spieler)) {
    if (schicht.berechtigte.length === 0) continue
    let besteIds: string[] = []
    let beste: Handwert | null = null
    for (const id of schicht.berechtigte) {
      const h = haende.get(id)
      if (!h) continue
      const v = beste ? vergleicheHand(h, beste) : 1
      if (v > 0) {
        beste = h
        besteIds = [id]
      } else if (v === 0) {
        besteIds.push(id)
      }
    }
    if (besteIds.length === 0) continue
    const je = Math.floor(schicht.betrag / besteIds.length)
    for (const id of besteIds) gib(id, je)
    // Was durch die Teilung übrig bleibt, bekommt der erste Berechtigte
    // links vom Geber -- so wird es am Tisch auch gemacht.
    const rest = schicht.betrag - je * besteIds.length
    if (rest > 0) {
      const reihenfolge = state.spieler
        .map((s, i) => ({ s, i }))
        .sort(
          (a, b) =>
            ((a.i - state.dealer - 1 + state.spieler.length) % state.spieler.length) -
            ((b.i - state.dealer - 1 + state.spieler.length) % state.spieler.length),
        )
      const erster = reihenfolge.find((e) => besteIds.includes(e.s.id))
      if (erster) gib(erster.s.id, rest)
    }
  }

  return [...anteile.values()]
}

function beendeHand(vorher: TexasZustand, gezeigt: boolean): TexasZustand {
  const state = kopie(vorher)
  einsaetzeEinsammeln(state)
  state.phase = 'showdown'

  const anteile = verteile(state)
  const gewinner = anteile.filter((a) => a.betrag > 0)
  const summe = gewinner.reduce((n, a) => n + a.betrag, 0)

  const text = gewinner
    .map((a) => {
      const s = spielerMit(state, a.spielerId)
      const wer = s?.mensch ? 'Du gewinnst' : `${s?.name} gewinnt`
      return gezeigt && a.hand ? `${wer} ${a.betrag} mit ${handText(a.hand)}` : `${wer} ${a.betrag}`
    })
    .join(' · ')

  state.ergebnis = { anteile: gewinner, gezeigt, board: [...state.board], text }
  state.pot = Math.max(0, state.pot - summe)
  notiere(state, text)

  // Wer jetzt nichts mehr hat, ist raus -- und bekommt seinen Platz.
  const vorhanden = state.spieler.filter((s) => s.status !== 'raus')
  const pleite = vorhanden.filter((s) => s.chips <= 0)
  if (pleite.length > 0) {
    const uebrig = vorhanden.length - pleite.length
    // Mehrere gleichzeitig: Wer mehr Chips in die Hand gelegt hatte, wird
    // besser platziert. Das ist die übliche Regel und die einzige, die
    // ohne Zufall auskommt.
    const sortiert = [...pleite].sort((a, b) => b.gesamt - a.gesamt)
    sortiert.forEach((s, i) => {
      s.status = 'raus'
      s.platz = uebrig + sortiert.length - i
      notiere(state, `${s.name} ist raus (Platz ${s.platz})`)
    })
  }

  const dabei = state.spieler.filter((s) => s.status !== 'raus')
  const mensch = state.spieler.find((s) => s.mensch)
  if (dabei.length <= 1) {
    const sieger = dabei[0]
    if (sieger) {
      sieger.platz = 1
      state.siegerId = sieger.id
    }
    state.phase = 'ende'
  } else if (mensch && mensch.status === 'raus') {
    /*
     * Der Mensch ist draussen. Weiterzuspielen hiesse, dem Rechner beim
     * Alleinsein zuzusehen -- und fuer den Menschen steht das Ergebnis
     * ohnehin fest. Die Uebrigen werden nach Chips platziert; wer mehr
     * hat, stand besser da.
     */
    const nachChips = [...dabei].sort((a, b) => b.chips - a.chips)
    nachChips.forEach((s, i) => {
      s.platz = i + 1
    })
    state.siegerId = nachChips[0]?.id ?? null
    state.phase = 'ende'
  }
  return state
}

/* ----------------------------------------------------- Nächste Hand */

export function naechsteHand(vorher: TexasZustand): TexasZustand {
  if (vorher.phase !== 'showdown') return vorher
  const state = kopie(vorher)
  state.dealer = naechsterMitChips(state.spieler, state.dealer)
  return teileAus(state)
}

/** Steht die Partie? */
export function istEnde(state: TexasZustand): boolean {
  return state.phase === 'ende'
}

/**
 * Der Platz des Menschen -- auch wenn das Turnier noch liefe.
 *
 * Ist der Mensch draussen, hat die Partie für ihn ein Ergebnis, und
 * weiterzuspielen hiesse, dem Rechner beim Alleinsein zuzusehen.
 */
export function menschlicherPlatz(state: TexasZustand): number | null {
  const ich = state.spieler.find((s) => s.mensch)
  if (!ich) return null
  if (ich.platz !== null) return ich.platz
  if (state.siegerId === ich.id) return 1
  return null
}

export { MAX_SPIELER, MIN_SPIELER, START_CHIPS }
