/**
 * Der Spielzustand.
 *
 * Alles, was eine Partie ausmacht, steht in einem einzigen serialisierbaren
 * Objekt -- kein verstecktes Wissen in Closures, keine Klassen mit
 * Innenleben. Nur so lässt sich eine Partie speichern, fortsetzen, testen
 * und später von einem Server aus fahren.
 *
 * Der Zufall steckt ebenfalls im Zustand: `seed` plus `rngZaehler` ergeben
 * jeden Wurf reproduzierbar. Ein geladener Spielstand würfelt danach genau
 * so weiter, wie er es ohne Unterbrechung getan hätte.
 */

import { createRng } from '@/games/rng'
import type { AusbauStufe, Medaille } from './config'
import {
  MAX_SPIELER,
  MIN_SPIELER,
  START_KAPITAL,
  STANDARD_RUNDEN_LIMIT,
  MIN_RUNDEN_LIMIT,
  MAX_RUNDEN_LIMIT,
} from './config'
import { BRETT, kaufbareFelder } from './brett'
import { EREIGNISKARTEN, VEREINSKARTEN, type Karte } from './karten'
import { ROLLEN, type RollenId } from './rollen'
import { FIGUREN } from './figuren'

export type SpielerTyp = 'mensch' | 'ki'
export type KiStufe = 'leicht' | 'normal' | 'schwer'

export type MinispielId = 'koenigsschiessen' | 'ringschiessen' | 'praezision'

export interface Spieler {
  id: string
  name: string
  typ: SpielerTyp
  /** Nur bei typ === 'ki' gesetzt. */
  kiStufe: KiStufe | null
  rolle: RollenId
  figurId: string
  taler: number
  position: number
  aufStrafbank: boolean
  strafbankVersuche: number
  /** IDs der Karten auf der Hand (Freikarte, Vorstandsbeschluss …). */
  handkarten: string[]
  insolvent: boolean

  /** In welcher Runde der Gebührenrabatt zuletzt genutzt wurde. */
  rabattRunde: number | null
  duellGenutzt: boolean
  schutzGenutzt: boolean
  karteNeuGenutzt: boolean
  koenigsaktionGenutzt: boolean

  /** Nächste fällige Gebühr entfällt (Vereinsfreundschaft). */
  gebuehrErlassen: boolean
  /** Nächste schlechte Ereigniskarte verfällt (Vorstandsbeschluss). */
  schutzschild: boolean
  /** Bis einschließlich dieser Runde darf nicht gebaut werden. */
  bauverbotBis: number | null

  /** Statistik für die Auswertung am Ende. */
  medaillen: Medaille[]
  gezahlteGebuehren: number
  kassierteGebuehren: number
}

export interface Besitz {
  /** Grundstück-, Sonderfeld- oder Verbands-ID. */
  feldId: string
  position: number
  besitzerId: string | null
  stufe: AusbauStufe
  /** Bis einschließlich dieser Runde fällt hier keine Gebühr an. */
  geschuetztBis: number | null
}

export type Phase =
  /** Der Spieler am Zug muss würfeln. */
  | 'wuerfeln'
  /** Gewürfelt, die Figur läuft (die Oberfläche animiert). */
  | 'bewegen'
  /** Angekommen -- offene Entscheidung oder Karte abarbeiten. */
  | 'feld'
  /** Zug abgeschlossen; bauen und handeln ist noch erlaubt. */
  | 'zug_ende'
  | 'ende'

export interface LogEintrag {
  runde: number
  spielerId: string | null
  text: string
  art: 'info' | 'geld' | 'kauf' | 'bau' | 'karte' | 'strafe' | 'minispiel' | 'ende'
  /**
   * Dieselbe Zeile als Daten -- damit die Oberfläche sie in ihrer Sprache
   * sagen kann. `text` bleibt deutsch; Tests und Logs lesen ihn. Fehlt bei
   * Partien, die vor dem 06.11.2026 gespeichert wurden.
   *
   * An den Regeln ändert das nichts, und am Zugbuch auch nicht: Die Meldung
   * entsteht beim Nachspielen genauso wie der Text daneben.
   */
  meldung?: ProtokollMeldung
}

/** Feld-IDs statt Namen: Die Oberfläche schlägt den Namen in ihrer Sprache nach. */
export type ProtokollMeldung =
  | { art: 'start' }
  | { art: 'wurf'; name: string; a: number; b: number }
  | { art: 'dritterPasch'; name: string }
  | { art: 'paschFrei'; name: string; felder: number }
  | { art: 'strafbankBezahlt'; name: string; betrag: number }
  | { art: 'keinPasch'; name: string; versuch: number; von: number }
  | { art: 'freigekauft'; name: string; betrag: number }
  | { art: 'fuersprache'; name: string }
  | { art: 'startBonus'; name: string; betrag: number }
  | { art: 'besuch'; name: string }
  | { art: 'freiesFest'; name: string; betrag: number }
  | { art: 'zurStrafbank'; name: string }
  | { art: 'geschuetzt'; feldId: string }
  | { art: 'gebuehrErlassen'; name: string }
  | { art: 'rabatt'; name: string }
  | { art: 'gebuehr'; name: string; betrag: number; an: string | null; feldId: string }
  | { art: 'kauf'; name: string; feldId: string; preis: number }
  | { art: 'karteNeu'; name: string }
  | { art: 'baustopp'; name: string }
  | { art: 'hausrecht'; feldId: string }
  | { art: 'tausch'; meinFeldId: string; fremdFeldId: string }
  | { art: 'schiessstandLeer'; name: string }
  | { art: 'medaille'; name: string; medaille: Medaille; betrag: number }
  | { art: 'duell'; name: string }
  | { art: 'koenigsaktion'; name: string; betrag: number }
  | { art: 'bau'; name: string; feldId: string; stufe: number }
  | { art: 'rueckbau'; name: string; feldId: string; betrag: number }
  | { art: 'rueckgabe'; name: string; feldId: string; betrag: number }
  | { art: 'sieg'; name: string; vermoegen: number }
  | { art: 'aufgabe'; name: string }
  | { art: 'versilbern'; name: string; feldId: string; betrag: number }
  | { art: 'pleite'; name: string; betrag: number }
  | {
      art: 'handel'
      von: string
      an: string
      gebeFelder: string[]
      gebeTaler: number
      willFelder: string[]
      willTaler: number
    }
  | { art: 'karte'; name: string; karteId: string }
  | { art: 'vorstand' }
  | { art: 'nichtsZuReparieren' }

export interface KaufAngebot {
  position: number
  feldId: string
  preis: number
}

/** Eine Karte verlangt eine Auswahl, bevor es weitergeht. */
export type OffeneWahl = { art: 'baustopp' } | { art: 'schutz' } | { art: 'tausch' }

export interface MinispielAuftrag {
  spielerId: string
  minispiel: MinispielId
  /** Woher der Auftrag kommt -- die Oberfläche erklärt es dem Spieler. */
  anlass: 'feld' | 'karte' | 'duell'
}

export interface SpielZustand {
  phase: Phase
  spieler: Spieler[]
  amZug: number
  /** Schlüssel ist die Feld-ID. */
  besitz: Record<string, Besitz>
  wuerfel: [number, number] | null
  /** Ziel der laufenden Bewegung -- nur während 'bewegen' gesetzt. */
  zielPosition: number | null
  paschSerie: number
  runde: number
  rundenLimit: number

  ereignisStapel: string[]
  ereignisIndex: number
  vereinsStapel: string[]
  vereinsIndex: number

  offeneKarte: Karte | null
  kaufAngebot: KaufAngebot | null
  offenesMinispiel: MinispielAuftrag | null
  offeneWahl: OffeneWahl | null

  protokoll: LogEintrag[]
  seed: number
  rngZaehler: number
  siegerId: string | null
  /** Version des Spielstands -- ältere Stände werden verworfen statt geraten. */
  version: number
}

export const ZUSTAND_VERSION = 1

export interface SpielerEinrichtung {
  name: string
  typ: SpielerTyp
  kiStufe?: KiStufe
  rolle?: RollenId
  figurId?: string
}

export interface PartieOptionen {
  spieler: SpielerEinrichtung[]
  rundenLimit?: number
  seed?: number
}

/** Eine Zufallszahl aus dem Zustand -- verändert den Zähler mit. */
export function ziehZahl(state: SpielZustand): { wert: number; zaehler: number } {
  const rng = createRng(`${state.seed}:${state.rngZaehler}`)
  return { wert: rng(), zaehler: state.rngZaehler + 1 }
}

function mische<T>(items: readonly T[], seed: number): T[] {
  const rng = createRng(`mix:${seed}`)
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
  }
  return arr
}

function pruefeNamen(spieler: SpielerEinrichtung[]): void {
  if (spieler.length < MIN_SPIELER) throw new Error(`Mindestens ${MIN_SPIELER} Spieler nötig`)
  if (spieler.length > MAX_SPIELER) throw new Error(`Maximal ${MAX_SPIELER} Spieler`)
  const gesehen = new Set<string>()
  for (const s of spieler) {
    const name = s.name.trim()
    if (!name) throw new Error('Jeder Spieler braucht einen Namen')
    const key = name.toLowerCase()
    if (gesehen.has(key)) throw new Error(`Name doppelt: ${name}`)
    gesehen.add(key)
  }
}

export function erstellePartie(optionen: PartieOptionen): SpielZustand {
  pruefeNamen(optionen.spieler)
  const seed = optionen.seed ?? (Date.now() ^ (Math.random() * 0x100000000)) >>> 0
  const rundenLimit = Math.max(
    MIN_RUNDEN_LIMIT,
    Math.min(MAX_RUNDEN_LIMIT, optionen.rundenLimit ?? STANDARD_RUNDEN_LIMIT),
  )

  const rollenPool = mische(ROLLEN, seed)
  const figurenPool = mische(FIGUREN, seed + 1)

  const spieler: Spieler[] = optionen.spieler.map((s, i) => ({
    id: `p${i}`,
    name: s.name.trim(),
    typ: s.typ,
    kiStufe: s.typ === 'ki' ? (s.kiStufe ?? 'normal') : null,
    rolle: s.rolle ?? rollenPool[i % rollenPool.length]!.id,
    figurId: s.figurId ?? figurenPool[i % figurenPool.length]!.id,
    taler: START_KAPITAL,
    position: 0,
    aufStrafbank: false,
    strafbankVersuche: 0,
    handkarten: [],
    insolvent: false,
    rabattRunde: null,
    duellGenutzt: false,
    schutzGenutzt: false,
    karteNeuGenutzt: false,
    koenigsaktionGenutzt: false,
    gebuehrErlassen: false,
    schutzschild: false,
    bauverbotBis: null,
    medaillen: [],
    gezahlteGebuehren: 0,
    kassierteGebuehren: 0,
  }))

  const besitz: Record<string, Besitz> = {}
  for (const feld of kaufbareFelder()) {
    besitz[feld.grundstueckId!] = {
      feldId: feld.grundstueckId!,
      position: feld.position,
      besitzerId: null,
      stufe: 0,
      geschuetztBis: null,
    }
  }

  return {
    phase: 'wuerfeln',
    spieler,
    amZug: 0,
    besitz,
    wuerfel: null,
    zielPosition: null,
    paschSerie: 0,
    runde: 1,
    rundenLimit,
    ereignisStapel: mische(EREIGNISKARTEN, seed + 2).map((k) => k.id),
    ereignisIndex: 0,
    vereinsStapel: mische(VEREINSKARTEN, seed + 3).map((k) => k.id),
    vereinsIndex: 0,
    offeneKarte: null,
    kaufAngebot: null,
    offenesMinispiel: null,
    offeneWahl: null,
    protokoll: [
      {
        runde: 1,
        spielerId: null,
        text: 'Das Fest beginnt. Viel Erfolg!',
        art: 'info',
        meldung: { art: 'start' },
      },
    ],
    seed,
    rngZaehler: 0,
    siegerId: null,
    version: ZUSTAND_VERSION,
  }
}

export function aktiverSpieler(state: SpielZustand): Spieler {
  const s = state.spieler[state.amZug]
  if (!s) throw new Error(`Kein Spieler an Position ${state.amZug}`)
  return s
}

export function spielerMit(state: SpielZustand, id: string): Spieler | undefined {
  return state.spieler.find((s) => s.id === id)
}

export function aktiveSpieler(state: SpielZustand): Spieler[] {
  return state.spieler.filter((s) => !s.insolvent)
}

/** Besitz eines Spielers, nach Brettreihenfolge. */
export function besitzVon(state: SpielZustand, spielerId: string): Besitz[] {
  return Object.values(state.besitz)
    .filter((b) => b.besitzerId === spielerId)
    .sort((a, b) => a.position - b.position)
}

export function feldName(feldId: string): string {
  const feld = BRETT.find((f) => f.grundstueckId === feldId)
  return feld?.name ?? feldId
}

/** Neuer Zustand mit einem Protokolleintrag mehr. Das Protokoll bleibt kurz. */
export function mitLog(
  state: SpielZustand,
  // Die Meldung ist hier Pflicht: Eine neue Zeile ohne sie bliebe auf Englisch deutsch.
  eintrag: Omit<LogEintrag, 'runde' | 'meldung'> & { meldung: ProtokollMeldung },
): SpielZustand {
  const protokoll = [...state.protokoll, { ...eintrag, runde: state.runde }]
  return { ...state, protokoll: protokoll.slice(-60) }
}

/** Einen Spieler ersetzen, ohne die übrigen anzufassen. */
export function mitSpieler(
  state: SpielZustand,
  spielerId: string,
  aenderung: Partial<Spieler>,
): SpielZustand {
  return {
    ...state,
    spieler: state.spieler.map((s) => (s.id === spielerId ? { ...s, ...aenderung } : s)),
  }
}

export function mitBesitz(
  state: SpielZustand,
  feldId: string,
  aenderung: Partial<Besitz>,
): SpielZustand {
  const alt = state.besitz[feldId]
  if (!alt) return state
  return { ...state, besitz: { ...state.besitz, [feldId]: { ...alt, ...aenderung } } }
}
