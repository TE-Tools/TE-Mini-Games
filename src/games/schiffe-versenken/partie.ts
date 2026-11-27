/**
 * Eine Partie Schiffe versenken: zwei Flotten, die Schüsse der beiden
 * Seiten, wer dran ist, und ob es vorbei ist.
 *
 * Eine Partie ist ein unveränderlicher Wert. `schiesse` gibt eine neue
 * Partie zurück oder null, wenn der Schuss nicht geht -- nie eine halb
 * geänderte.
 *
 * Dieselbe Form steht als jsonb in Migration 035, und die Funktionen hier
 * haben dort je eine Schwester (`sv_neue_partie`, `sv_schuss`, `sv_aufgabe`,
 * `sv_sicht`). `scripts/pruefe-schiffe-sql.mjs` schickt dieselben Partien
 * durch beide und vergleicht -- wer hier eine Regel ändert, ändert sie dort.
 */

import { FLOTTE, GROESSE, type SchiffeRegeln, type SchiffId } from './config'
import { felderVon, type Schiff } from './flotte'

export type Spieler = 0 | 1
export type Ergebnis = 'wasser' | 'treffer' | 'versenkt'

export interface Schuss {
  feld: number
  ergebnis: Ergebnis
  /**
   * Nur bei `versenkt`: welches Schiff gesunken ist. Bei einem bloßen
   * Treffer sagt man nicht, was man getroffen hat.
   */
  schiff?: SchiffId
}

export type EndeArt = 'versenkt' | 'aufgabe'

export interface Ende {
  art: EndeArt
  sieger: Spieler
}

export interface Partie {
  regeln: SchiffeRegeln
  /** flotten[i]: die Flotte von Spieler i. */
  flotten: [Schiff[], Schiff[]]
  /** schuesse[i]: die Schüsse, die Spieler i abgegeben hat -- auf das Meer des anderen. */
  schuesse: [Schuss[], Schuss[]]
  amZug: Spieler
  ende: Ende | null
}

export const anderer = (s: Spieler): Spieler => (s === 0 ? 1 : 0)

export function neuePartie(
  regeln: SchiffeRegeln,
  flotte0: Schiff[],
  flotte1: Schiff[],
  beginner: Spieler = 0,
): Partie {
  return { regeln, flotten: [flotte0, flotte1], schuesse: [[], []], amZug: beginner, ende: null }
}

/** Hat `schuetze` dieses Feld schon beschossen? */
export function schonBeschossen(p: Partie, schuetze: Spieler, feld: number): boolean {
  return p.schuesse[schuetze].some((s) => s.feld === feld)
}

/** Ist dieses Schiff unter diesen Schüssen gesunken? */
export function istVersenkt(schiff: Schiff, schuesse: readonly Schuss[]): boolean {
  const getroffen = new Set(schuesse.filter((s) => s.ergebnis !== 'wasser').map((s) => s.feld))
  return felderVon(schiff).every((f) => getroffen.has(f))
}

/**
 * Ein Schuss von dem, der dran ist. null, wenn er nicht geht: Partie aus,
 * Feld außerhalb, Feld schon beschossen.
 */
export function schiesse(p: Partie, feld: number): Partie | null {
  if (p.ende) return null
  if (!Number.isInteger(feld) || feld < 0 || feld >= GROESSE * GROESSE) return null
  const wer = p.amZug
  if (schonBeschossen(p, wer, feld)) return null

  const ziel = p.flotten[anderer(wer)]
  const schiff = ziel.find((s) => felderVon(s).includes(feld))
  let schuss: Schuss
  if (!schiff) schuss = { feld, ergebnis: 'wasser' }
  else if (istVersenkt(schiff, [...p.schuesse[wer], { feld, ergebnis: 'treffer' }])) {
    schuss = { feld, ergebnis: 'versenkt', schiff: schiff.id }
  } else schuss = { feld, ergebnis: 'treffer' }

  const meine = [...p.schuesse[wer], schuss]
  const schuesse: [Schuss[], Schuss[]] = wer === 0 ? [meine, p.schuesse[1]] : [p.schuesse[0], meine]
  const alleWeg = ziel.every((s) => istVersenkt(s, meine))
  const nochmal = schuss.ergebnis !== 'wasser' && p.regeln.nochmalNachTreffer
  return {
    ...p,
    schuesse,
    amZug: alleWeg || nochmal ? wer : anderer(wer),
    ende: alleWeg ? { art: 'versenkt', sieger: wer } : null,
  }
}

/** `wer` gibt auf. Eine beendete Partie bleibt, wie sie ist. */
export function gibAuf(p: Partie, wer: Spieler): Partie {
  if (p.ende) return p
  return { ...p, ende: { art: 'aufgabe', sieger: anderer(wer) } }
}

/** Die Schiffe einer Flotte, die unter diesen Schüssen gesunken sind. */
export function versenkteSchiffe(flotte: readonly Schiff[], schuesse: readonly Schuss[]): Schiff[] {
  return flotte.filter((s) => istVersenkt(s, schuesse))
}

/**
 * Was ein Spieler von der Partie sehen darf. Genau das schickt der Server
 * jedem Mitspieler (`sv_sicht`): die eigene Flotte ganz, von der fremden nur
 * die versenkten Schiffe -- alle erst, wenn die Partie vorbei ist.
 */
export interface Sicht {
  ich: Spieler
  regeln: SchiffeRegeln
  amZug: Spieler
  ende: Ende | null
  eigeneFlotte: Schiff[]
  /** Meine Schüsse aufs fremde Meer. */
  eigeneSchuesse: Schuss[]
  /** Die Schüsse des anderen auf mein Meer. */
  gegnerSchuesse: Schuss[]
  /** Von der fremden Flotte, was ich sehen darf. */
  gegnerFlotte: Schiff[]
}

export function sichtFuer(p: Partie, ich: Spieler): Sicht {
  const er = anderer(ich)
  return {
    ich,
    regeln: p.regeln,
    amZug: p.amZug,
    ende: p.ende,
    eigeneFlotte: p.flotten[ich],
    eigeneSchuesse: p.schuesse[ich],
    gegnerSchuesse: p.schuesse[er],
    gegnerFlotte: p.ende ? p.flotten[er] : versenkteSchiffe(p.flotten[er], p.schuesse[ich]),
  }
}

/** Wie viele Schiffe `schuetze` schon versenkt hat. */
export function versenktZahl(schuesse: readonly Schuss[]): number {
  return schuesse.filter((s) => s.ergebnis === 'versenkt').length
}

/** Wie viele Schiffe hat die Flotte insgesamt? */
export const SCHIFFE_JE_FLOTTE = FLOTTE.length

/**
 * Eine Partie aus dem Gerätespeicher: Regeln, Flotten, Beginner und die
 * Schüsse der Reihe nach. Nachgespielt, nicht übernommen -- was sich nicht
 * nachspielen lässt, ist kein Spielstand.
 */
export function partieAusZuegen(
  regeln: SchiffeRegeln,
  flotten: [Schiff[], Schiff[]],
  beginner: Spieler,
  felder: readonly number[],
): Partie | null {
  let p: Partie | null = neuePartie(regeln, flotten[0], flotten[1], beginner)
  for (const f of felder) {
    p = schiesse(p, f)
    if (!p) return null
  }
  return p
}

/** Die Felder der Schüsse in der Reihenfolge, in der sie fielen. */
export function feldFolge(p: Partie, beginner: Spieler): number[] {
  // Wer dran war, ergibt sich aus den Ergebnissen: Nachspielen genügt.
  const folge: number[] = []
  const zeiger: [number, number] = [0, 0]
  let wer: Spieler = beginner
  const gesamt = p.schuesse[0].length + p.schuesse[1].length
  while (folge.length < gesamt) {
    const s = p.schuesse[wer][zeiger[wer]]
    if (!s) break
    folge.push(s.feld)
    zeiger[wer]++
    const nochmal = s.ergebnis !== 'wasser' && p.regeln.nochmalNachTreffer
    if (!nochmal) wer = anderer(wer)
  }
  return folge
}
