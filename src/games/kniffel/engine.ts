/**
 * Kniffel -- der Spielablauf.
 *
 * Reine Logik, kein React. Jede Funktion nimmt einen Zustand und gibt
 * einen neuen zurück. Der Zufall steckt im Zustand (Startwert plus
 * Zähler), damit sich eine Partie speichern, fortsetzen und testen lässt
 * -- und damit später ein Server dieselbe Engine fahren kann.
 *
 * Ein Zug: bis zu drei Würfe, zwischendurch halten, was man behalten will,
 * dann in ein freies Feld eintragen. Eintragen darf man jederzeit, auch
 * nach dem ersten Wurf.
 */

import { createRng } from '@/games/rng'
import {
  WUERFEL_ANZAHL,
  WUERFE_JE_ZUG,
  blockVoll,
  freieFelder,
  gesamtpunkte,
  leererBlock,
  punkteFuer,
  type Block,
  type KategorieId,
} from './regeln'

export type SpielerTyp = 'mensch' | 'ki'
export type KiStufe = 'leicht' | 'normal' | 'schwer'

export const MIN_SPIELER = 1
export const MAX_SPIELER = 6

export interface KniffelSpieler {
  id: string
  name: string
  typ: SpielerTyp
  kiStufe: KiStufe | null
  block: Block
}

export type KniffelPhase = 'wurf' | 'eintragen' | 'ende'

export interface KniffelZustand {
  phase: KniffelPhase
  spieler: KniffelSpieler[]
  amZug: number
  /** Die fünf Würfel. Vor dem ersten Wurf einer Runde alle 0. */
  wuerfel: number[]
  /** Welche Würfel liegen bleiben. */
  gehalten: boolean[]
  /** Wie oft in diesem Zug schon gewürfelt wurde (0 bis 3). */
  wurfNummer: number
  /** Wievielte von dreizehn Runden. */
  runde: number
  protokoll: string[]
  seed: number
  rngZaehler: number
  siegerId: string | null
  version: number
}

export const ZUSTAND_VERSION = 1

export interface SpielerEinrichtung {
  name: string
  typ: SpielerTyp
  kiStufe?: KiStufe
}

export interface PartieOptionen {
  spieler: SpielerEinrichtung[]
  seed?: number
}

function pruefeNamen(spieler: SpielerEinrichtung[]): void {
  if (spieler.length < MIN_SPIELER) throw new Error(`Mindestens ${MIN_SPIELER} Spieler nötig`)
  if (spieler.length > MAX_SPIELER) throw new Error(`Maximal ${MAX_SPIELER} Spieler`)
  const gesehen = new Set<string>()
  for (const s of spieler) {
    const name = s.name.trim()
    if (!name) throw new Error('Jeder Spieler braucht einen Namen')
    if (gesehen.has(name.toLowerCase())) throw new Error(`Name doppelt: ${name}`)
    gesehen.add(name.toLowerCase())
  }
}

export function erstellePartie(optionen: PartieOptionen): KniffelZustand {
  pruefeNamen(optionen.spieler)
  const seed = optionen.seed ?? ((Date.now() ^ (Math.random() * 0x100000000)) >>> 0)
  return {
    phase: 'wurf',
    spieler: optionen.spieler.map((s, i) => ({
      id: `p${i}`,
      name: s.name.trim(),
      typ: s.typ,
      kiStufe: s.typ === 'ki' ? (s.kiStufe ?? 'normal') : null,
      block: leererBlock(),
    })),
    amZug: 0,
    wuerfel: Array(WUERFEL_ANZAHL).fill(0),
    gehalten: Array(WUERFEL_ANZAHL).fill(false),
    wurfNummer: 0,
    runde: 1,
    protokoll: ['Der Becher steht bereit. Viel Glück!'],
    seed,
    rngZaehler: 0,
    siegerId: null,
    version: ZUSTAND_VERSION,
  }
}

export function aktiverSpieler(state: KniffelZustand): KniffelSpieler {
  const s = state.spieler[state.amZug]
  if (!s) throw new Error(`Kein Spieler an Position ${state.amZug}`)
  return s
}

export function spielerMit(state: KniffelZustand, id: string): KniffelSpieler | undefined {
  return state.spieler.find((s) => s.id === id)
}

function mitLog(state: KniffelZustand, text: string): KniffelZustand {
  return { ...state, protokoll: [...state.protokoll, text].slice(-40) }
}

function mitSpieler(
  state: KniffelZustand,
  id: string,
  aenderung: Partial<KniffelSpieler>,
): KniffelZustand {
  return {
    ...state,
    spieler: state.spieler.map((s) => (s.id === id ? { ...s, ...aenderung } : s)),
  }
}

/* -------------------------------------------------------------- Würfeln */

/** Fünf Augen aus dem Zustand -- nur die nicht gehaltenen werden neu. */
export function wuerfelWurf(
  alte: readonly number[],
  gehalten: readonly boolean[],
  seed: number,
  zaehler: number,
): { wuerfel: number[]; zaehler: number } {
  const wuerfel = [...alte]
  let z = zaehler
  for (let i = 0; i < WUERFEL_ANZAHL; i++) {
    if (gehalten[i] && (alte[i] ?? 0) > 0) continue
    const rng = createRng(`${seed}:${z}`)
    wuerfel[i] = 1 + Math.floor(rng() * 6)
    z++
  }
  return { wuerfel, zaehler: z }
}

export function darfWuerfeln(state: KniffelZustand): boolean {
  return state.phase !== 'ende' && state.wurfNummer < WUERFE_JE_ZUG
}

export function wuerfeln(state: KniffelZustand): KniffelZustand {
  if (!darfWuerfeln(state)) return state
  const { wuerfel, zaehler } = wuerfelWurf(
    state.wuerfel,
    state.wurfNummer === 0 ? Array(WUERFEL_ANZAHL).fill(false) : state.gehalten,
    state.seed,
    state.rngZaehler,
  )
  const wurfNummer = state.wurfNummer + 1
  return {
    ...state,
    wuerfel,
    rngZaehler: zaehler,
    wurfNummer,
    phase: 'eintragen',
  }
}

/** Einen Würfel festhalten oder wieder freigeben. */
export function halten(state: KniffelZustand, index: number): KniffelZustand {
  if (state.phase === 'ende' || state.wurfNummer === 0) return state
  if (state.wurfNummer >= WUERFE_JE_ZUG) return state
  if (index < 0 || index >= WUERFEL_ANZAHL) return state
  const gehalten = [...state.gehalten]
  gehalten[index] = !gehalten[index]
  return { ...state, gehalten }
}

/** Alle Würfel freigeben -- praktisch nach einem Fehlgriff. */
export function alleFreigeben(state: KniffelZustand): KniffelZustand {
  if (state.phase === 'ende') return state
  return { ...state, gehalten: Array(WUERFEL_ANZAHL).fill(false) }
}

/* ------------------------------------------------------------ Eintragen */

export function darfEintragen(state: KniffelZustand, feld: KategorieId): boolean {
  if (state.phase !== 'eintragen' || state.wurfNummer === 0) return false
  return aktiverSpieler(state).block[feld] === null
}

/**
 * In ein Feld eintragen und den Zug abgeben. Ein Feld mit 0 zu streichen
 * ist erlaubt -- irgendwann bleibt einem nichts anderes übrig, und genau
 * das macht die zweite Hälfte einer Partie spannend.
 */
export function eintragen(state: KniffelZustand, feld: KategorieId): KniffelZustand {
  if (!darfEintragen(state, feld)) return state
  const spieler = aktiverSpieler(state)
  const punkte = punkteFuer(feld, state.wuerfel)

  let s = mitSpieler(state, spieler.id, { block: { ...spieler.block, [feld]: punkte } })
  s = mitLog(
    s,
    punkte > 0
      ? `${spieler.name} trägt ${punkte} Punkte ein.`
      : `${spieler.name} muss ein Feld streichen.`,
  )
  return naechsterZug(s)
}

function naechsterZug(state: KniffelZustand): KniffelZustand {
  const alleVoll = state.spieler.every((s) => blockVoll(s.block))
  if (alleVoll) return beenden(state)

  const naechster = (state.amZug + 1) % state.spieler.length
  const neueRunde = naechster === 0 ? state.runde + 1 : state.runde

  return {
    ...state,
    amZug: naechster,
    runde: neueRunde,
    wuerfel: Array(WUERFEL_ANZAHL).fill(0),
    gehalten: Array(WUERFEL_ANZAHL).fill(false),
    wurfNummer: 0,
    phase: 'wurf',
  }
}

/* --------------------------------------------------------------- Ende */

export interface Endstand {
  spielerId: string
  name: string
  punkte: number
}

export function endstand(state: KniffelZustand): Endstand[] {
  return state.spieler
    .map((s) => ({ spielerId: s.id, name: s.name, punkte: gesamtpunkte(s.block) }))
    .sort((a, b) => b.punkte - a.punkte)
}

export function beenden(state: KniffelZustand): KniffelZustand {
  const tabelle = endstand(state)
  const sieger = tabelle[0]
  let s: KniffelZustand = { ...state, phase: 'ende', siegerId: sieger?.spielerId ?? null }
  if (sieger) {
    s = mitLog(
      s,
      state.spieler.length === 1
        ? `Endstand: ${sieger.punkte} Punkte.`
        : `${sieger.name} gewinnt mit ${sieger.punkte} Punkten.`,
    )
  }
  return s
}

/** Wie viele Züge noch kommen -- für die Anzeige „Runde x von 13". */
export function offeneZuege(state: KniffelZustand): number {
  return state.spieler.reduce((summe, s) => summe + freieFelder(s.block).length, 0)
}
