/**
 * Mau-Mau und Letzte Karte -- der Ablauf.
 *
 * Reine Logik, kein React. Der Zufall steckt als Startwert im Zustand,
 * damit sich eine Partie nachspielen und prüfen lässt.
 *
 * Die drei Stellen, an denen es bei diesem Spiel klemmt, und wie es hier
 * gelöst ist:
 *
 *  1. DER STAPEL GEHT AUS. Dann wird die Ablage bis auf die oberste
 *     Karte neu gemischt. Passiert das nicht, steht die Partie still --
 *     und zwar erst nach zwanzig Minuten Spielzeit.
 *  2. NIEMAND KANN. Zieht reihum jeder, ohne legen zu können, und ist
 *     auch der Stapel leer, endet die Runde. Ohne diese Bremse dreht
 *     sich der Tisch endlos.
 *  3. „MAU" VERGESSEN. Wer seine vorletzte Karte legt, ohne Mau zu
 *     sagen, zieht zwei. Das ist die Regel, die das Spiel ausmacht --
 *     und sie muss VOR dem Legen erklärt werden, sonst ist sie nur eine
 *     Falle.
 */

import { createRng } from '@/games/rng'
import { gemischt, karteKurz, type Karte } from './karten'
import { SPIELARTEN, handPunkte, passt, spielbare, type Regeln, type Spielart } from './regeln'

export type KiStufe = 'leicht' | 'normal'

export interface MauSpieler {
  id: string
  name: string
  mensch: boolean
  kiStufe: KiStufe | null
  hand: Karte[]
  /** „Mau" angesagt -- gilt für den Zug, in dem die vorletzte Karte fällt. */
  mauGesagt: boolean
  platz: number | null
}

export interface MauZustand {
  spieler: MauSpieler[]
  amZug: number
  richtung: 1 | -1
  stapel: Karte[]
  ablage: Karte[]
  /** Gewünschte Farbe, bis jemand legt. */
  wunsch: string | null
  /** Wie viele Karten im Raum stehen (gestapelte Ziehkarten). */
  strafe: number
  /** Muss der nächste Spieler aussetzen? */
  aussetzen: boolean
  /**
   * Die eben gezogene Karte, die noch gelegt werden darf.
   * Solange sie gesetzt ist, ist derselbe Spieler am Zug.
   */
  gezogene: Karte | null
  /** Wie viele Runden lang niemand legen konnte -- die Notbremse. */
  leerlauf: number
  phase: 'laeuft' | 'ende'
  siegerId: string | null
  protokoll: string[]
  seed: number
  zaehler: number
  art: Spielart
}

export interface SpielerEinrichtung {
  name: string
  mensch: boolean
  kiStufe?: KiStufe
}

export interface PartieOptionen {
  spieler: SpielerEinrichtung[]
  art: Spielart
  seed?: number
}

export const MIN_SPIELER = 2
export const MAX_SPIELER = 4
export const ZUSTAND_VERSION = 1

export function regelnVon(state: MauZustand): Regeln {
  return SPIELARTEN[state.art]
}

export function oberste(state: MauZustand): Karte {
  return state.ablage[state.ablage.length - 1]!
}

export function amZugSpieler(state: MauZustand): MauSpieler {
  return state.spieler[state.amZug]!
}

export function meineSpielbaren(state: MauZustand, spieler: MauSpieler): Karte[] {
  if (state.gezogene) {
    // Nach dem Ziehen zählt nur noch die gezogene Karte.
    return passt(state.gezogene, oberste(state), state.wunsch, state.strafe, regelnVon(state))
      ? [state.gezogene]
      : []
  }
  return spielbare(spieler.hand, oberste(state), state.wunsch, state.strafe, regelnVon(state))
}

function kopie(state: MauZustand): MauZustand {
  return {
    ...state,
    spieler: state.spieler.map((s) => ({ ...s, hand: [...s.hand] })),
    stapel: [...state.stapel],
    ablage: [...state.ablage],
    protokoll: [...state.protokoll],
  }
}

function notiere(state: MauZustand, zeile: string): void {
  state.protokoll.push(zeile)
  if (state.protokoll.length > 60) state.protokoll.shift()
}

/** Wie jemand angesprochen wird: der Mensch ist „Du". */
function wer(s: MauSpieler): string {
  return s.mensch ? 'Du' : s.name
}

function sagt(s: MauSpieler, du: string, andere: string): string {
  return s.mensch ? `Du ${du}` : `${s.name} ${andere}`
}

/* --------------------------------------------------------- Nachziehen */

/**
 * Eine Karte vom Stapel. Ist er leer, wird die Ablage neu gemischt --
 * bis auf die oberste Karte, die liegen bleibt.
 */
function zieheKarte(state: MauZustand): Karte | null {
  if (state.stapel.length === 0) {
    if (state.ablage.length <= 1) return null
    const oben = state.ablage.pop()!
    const rng = createRng(`${state.seed}:misch:${state.zaehler}`)
    state.zaehler += 1
    state.stapel = gemischt(state.ablage, rng)
    state.ablage = [oben]
    notiere(state, 'Der Stapel wird neu gemischt')
  }
  return state.stapel.pop() ?? null
}

function gib(state: MauZustand, platz: number, anzahl: number): number {
  let gegeben = 0
  for (let i = 0; i < anzahl; i++) {
    const k = zieheKarte(state)
    if (!k) break
    state.spieler[platz]!.hand.push(k)
    gegeben++
  }
  return gegeben
}

/* ------------------------------------------------------ Partie anlegen */

export function erstellePartie(opt: PartieOptionen): MauZustand {
  if (opt.spieler.length < MIN_SPIELER) throw new Error(`Mindestens ${MIN_SPIELER} Spieler nötig`)
  if (opt.spieler.length > MAX_SPIELER) throw new Error(`Höchstens ${MAX_SPIELER} Spieler`)

  const regeln = SPIELARTEN[opt.art]
  const seed = opt.seed ?? Math.floor(Math.random() * 1_000_000)
  const rng = createRng(`${seed}:start`)
  const stapel = gemischt(regeln.karten(), rng)

  const state: MauZustand = {
    spieler: opt.spieler.map((e, i) => ({
      id: `p${i}`,
      name: e.name.trim() || `Spieler ${i + 1}`,
      mensch: e.mensch,
      kiStufe: e.kiStufe ?? null,
      hand: [],
      mauGesagt: false,
      platz: null,
    })),
    amZug: 0,
    richtung: 1,
    stapel,
    ablage: [],
    wunsch: null,
    strafe: 0,
    aussetzen: false,
    gezogene: null,
    leerlauf: 0,
    phase: 'laeuft',
    siegerId: null,
    protokoll: [],
    seed,
    zaehler: 0,
    art: opt.art,
  }

  for (let i = 0; i < regeln.handkarten; i++) {
    for (let p = 0; p < state.spieler.length; p++) gib(state, p, 1)
  }

  // Die erste Karte darf keine Aktion sein -- sonst beginnt die Partie
  // mit einer Strafe für jemanden, der noch gar nichts getan hat.
  let erste = state.stapel.pop()!
  let versuche = 0
  while (erste.wirkung !== 'keine' && versuche < 60) {
    state.stapel.unshift(erste)
    erste = state.stapel.pop()!
    versuche++
  }
  state.ablage = [erste]
  notiere(state, `Es liegt ${karteKurz(erste)}`)
  return state
}

/* ------------------------------------------------------------- Ziehen */

export function ziehen(vorher: MauZustand): MauZustand {
  if (vorher.phase === 'ende' || vorher.gezogene) return vorher
  const state = kopie(vorher)
  const spieler = amZugSpieler(state)
  const regeln = regelnVon(state)

  if (state.strafe > 0) {
    const gezogen = gib(state, state.amZug, state.strafe)
    notiere(state, sagt(spieler, `ziehst ${gezogen}`, `zieht ${gezogen}`))
    state.strafe = 0
    state.leerlauf = 0
    return naechster(state)
  }

  // Eine Karte -- oder bis es passt, wenn die Spielart das verlangt.
  let gezogen = 0
  for (;;) {
    const k = zieheKarte(state)
    if (!k) break
    spieler.hand.push(k)
    gezogen++
    const passend = passt(k, oberste(state), state.wunsch, 0, regeln)
    if (!regeln.ziehenBisPassend) {
      // Die eine gezogene Karte darf gelegt werden, wenn sie passt.
      state.gezogene = passend ? k : null
      break
    }
    if (passend) {
      state.gezogene = k
      break
    }
    // Höchstens vier. „Ziehen bis es passt" ist im Extremspiel gewollt,
    // aber nach einem Farbwunsch zieht man sonst den halben Stapel --
    // im Browser gesehen: zwölf Karten auf einmal. Das ist keine
    // Zuspitzung mehr, das ist Strafarbeit.
    if (gezogen >= 4) break
  }

  if (gezogen === 0) {
    // Nichts mehr da: Diese Runde ist vorbei.
    notiere(state, 'Der Stapel ist leer')
    return beende(state)
  }

  notiere(state, sagt(spieler, `ziehst ${gezogen}`, `zieht ${gezogen}`))
  state.leerlauf += 1
  if (state.gezogene) return state
  return naechster(state)
}

/** Den Zug beenden, ohne die gezogene Karte zu legen. */
export function behalten(vorher: MauZustand): MauZustand {
  if (vorher.phase === 'ende' || !vorher.gezogene) return vorher
  const state = kopie(vorher)
  state.gezogene = null
  return naechster(state)
}

/* ------------------------------------------------------------- Legen */

export function darfLegen(state: MauZustand, karte: Karte): boolean {
  if (state.phase === 'ende') return false
  const spieler = amZugSpieler(state)
  if (!spieler.hand.some((k) => k.id === karte.id)) return false
  return meineSpielbaren(state, spieler).some((k) => k.id === karte.id)
}

/**
 * Eine Karte legen. `wunschFarbe` ist nötig, wenn die Karte sich eine
 * Farbe wünscht; fehlt sie, wählt die Engine die Farbe, von der der
 * Spieler am meisten hat.
 */
export function legen(vorher: MauZustand, karte: Karte, wunschFarbe?: string): MauZustand {
  if (!darfLegen(vorher, karte)) return vorher
  const state = kopie(vorher)
  const spieler = amZugSpieler(state)
  const regeln = regelnVon(state)

  spieler.hand = spieler.hand.filter((k) => k.id !== karte.id)
  state.ablage.push(karte)
  state.gezogene = null
  state.wunsch = null
  state.leerlauf = 0
  notiere(state, sagt(spieler, `legst ${karteKurz(karte)}`, `legt ${karteKurz(karte)}`))

  /* „Mau" -- die Regel, an der das Spiel hängt. */
  if (spieler.hand.length === 1) {
    if (spieler.mauGesagt) {
      notiere(state, `${wer(spieler)}: Mau!`)
    } else {
      const gezogen = gib(state, state.amZug, 2)
      notiere(
        state,
        sagt(
          spieler,
          `hast Mau vergessen und ziehst ${gezogen}`,
          `hat Mau vergessen und zieht ${gezogen}`,
        ),
      )
    }
  }
  spieler.mauGesagt = false

  /* Was die Karte bewirkt. */
  switch (karte.wirkung) {
    case 'zieh2':
      state.strafe += 2
      break
    case 'zieh4':
      state.strafe += 4
      state.wunsch = wunschFarbe ?? haeufigsteFarbe(spieler)
      break
    case 'wunsch':
      state.wunsch = wunschFarbe ?? haeufigsteFarbe(spieler)
      break
    case 'aussetzen':
      state.aussetzen = true
      break
    case 'richtung':
      // Zu zweit ist ein Richtungswechsel dasselbe wie Aussetzen --
      // sonst legt der Gegner, dreht zurück und ist sofort wieder dran.
      if (state.spieler.filter((s) => s.platz === null).length === 2) state.aussetzen = true
      else state.richtung = state.richtung === 1 ? -1 : 1
      break
    case 'haende':
      if (regeln.haendeWandern) {
        haendeWeiter(state)
        notiere(state, 'Die Hände wandern weiter')
      }
      break
    default:
      break
  }

  if (spieler.hand.length === 0) {
    spieler.platz = 1
    state.siegerId = spieler.id
    return beende(state)
  }

  return naechster(state)
}

/** Alle Hände einen Platz weiter -- in Spielrichtung. */
function haendeWeiter(state: MauZustand): void {
  const dabei = state.spieler.filter((s) => s.platz === null)
  if (dabei.length < 2) return
  const haende = dabei.map((s) => s.hand)
  for (let i = 0; i < dabei.length; i++) {
    const quelle = (i - state.richtung + dabei.length * 2) % dabei.length
    dabei[i]!.hand = haende[quelle]!
  }
}

/** Die Farbe, von der dieser Spieler am meisten hat. */
export function haeufigsteFarbe(spieler: MauSpieler): string {
  const zaehler = new Map<string, number>()
  for (const k of spieler.hand) {
    if (!k.farbe) continue
    zaehler.set(k.farbe, (zaehler.get(k.farbe) ?? 0) + 1)
  }
  let beste: string | null = null
  let hoechste = -1
  for (const [farbe, n] of zaehler) {
    if (n > hoechste) {
      hoechste = n
      beste = farbe
    }
  }
  return beste ?? 'rot'
}

/* ----------------------------------------------------------- Mau sagen */

/** Vor dem Legen angesagt -- danach ist es zu spät. */
export function mauSagen(vorher: MauZustand): MauZustand {
  if (vorher.phase === 'ende') return vorher
  const state = kopie(vorher)
  amZugSpieler(state).mauGesagt = true
  return state
}

/* ------------------------------------------------------- Weiterschalten */

function naechster(vorher: MauZustand): MauZustand {
  const state = vorher
  if (state.phase === 'ende') return state

  // Dreht sich der Tisch, ohne dass jemand legen kann, ist Schluss.
  if (state.leerlauf > state.spieler.length * 3) {
    notiere(state, 'Niemand kann mehr legen')
    return beende(state)
  }

  const n = state.spieler.length
  let schritte = 1
  if (state.aussetzen) {
    schritte = 2
    state.aussetzen = false
  }
  let platz = state.amZug
  for (let i = 0; i < schritte; i++) {
    platz = (platz + state.richtung + n) % n
  }
  state.amZug = platz
  state.gezogene = null
  return state
}

function beende(state: MauZustand): MauZustand {
  state.phase = 'ende'
  // Wer noch Karten hat, wird nach Punkten platziert -- wenig ist besser.
  const offen = state.spieler.filter((s) => s.platz === null)
  offen.sort((a, b) => handPunkte(a.hand) - handPunkte(b.hand))
  const beginn = state.spieler.filter((s) => s.platz !== null).length
  offen.forEach((s, i) => {
    s.platz = beginn + i + 1
  })
  return state
}

/** Was der Mensch am Ende bekommt. */
export function endstand(state: MauZustand): {
  platz: number
  eigenePunkte: number
  fremdePunkte: number
  gewonnen: boolean
} {
  const ich = state.spieler.find((s) => s.mensch)
  const platz = ich?.platz ?? state.spieler.length
  return {
    platz,
    eigenePunkte: handPunkte(ich?.hand ?? []),
    fremdePunkte: state.spieler
      .filter((s) => !s.mensch)
      .reduce((n, s) => n + handPunkte(s.hand), 0),
    gewonnen: platz === 1,
  }
}
