/**
 * Die Regeln von Käsekästchen.
 *
 * Wer am Zug ist, zieht eine freie Linie zwischen zwei benachbarten
 * Punkten. Schließt sie ein Kästchen (oder zwei), gehören die dem
 * Ziehenden, und er zieht noch einmal. Sonst ist der Nächste dran. Vorbei
 * ist es, wenn alle Kästchen vergeben sind; die meisten gewinnen,
 * Gleichstand ist möglich.
 *
 * Eine Partie ist ein unveränderlicher Wert: `ziehe` gibt eine neue
 * zurück oder `null`, wenn die Linie nicht geht. Die Spieler sind
 * Nummern 0..n-1 in Zugreihenfolge; Namen und Farben kennt nur die Seite.
 */

import { SPIELER } from './config'
import { raster, type Raster } from './raster'

export interface Zug {
  linie: number
  spieler: number
  /** Die Kästchen, die diese Linie geschlossen hat (0, 1 oder 2). */
  geschlossen: readonly number[]
}

export interface Partie {
  raster: Raster
  spielerZahl: number
  /** Wer die Partie begonnen hat. */
  beginner: number
  /** Je Linie, wer sie gezogen hat; -1, solange sie frei ist. */
  linien: readonly number[]
  /** Je Kästchen, wem es gehört; -1, solange es offen ist. */
  besitzer: readonly number[]
  amZug: number
  zuege: readonly Zug[]
  /** Kästchen je Spieler. */
  punkte: readonly number[]
  vorbei: boolean
}

export function neuePartie(
  breite: number,
  hoehe: number,
  spielerZahl: number,
  beginner = 0,
): Partie {
  if (!Number.isInteger(spielerZahl) || spielerZahl < SPIELER.min || spielerZahl > SPIELER.max) {
    throw new Error(`Käsekästchen: ${spielerZahl} Spieler gehen nicht`)
  }
  const r = raster(breite, hoehe)
  const start = ((beginner % spielerZahl) + spielerZahl) % spielerZahl
  return {
    raster: r,
    spielerZahl,
    beginner: start,
    linien: Array<number>(r.anzahlLinien).fill(-1),
    besitzer: Array<number>(r.anzahlKaestchen).fill(-1),
    amZug: start,
    zuege: [],
    punkte: Array<number>(spielerZahl).fill(0),
    vorbei: false,
  }
}

/** Wie viele Seiten eines Kästchens schon gezogen sind. */
export function seitenZahl(p: Pick<Partie, 'raster' | 'linien'>, kaestchen: number): number {
  let n = 0
  for (const l of p.raster.seiten[kaestchen]!) if (p.linien[l]! >= 0) n++
  return n
}

export function istFrei(p: Partie, linie: number): boolean {
  return Number.isInteger(linie) && linie >= 0 && linie < p.linien.length && p.linien[linie] === -1
}

export function freieLinien(p: Partie): number[] {
  const frei: number[] = []
  p.linien.forEach((wer, l) => {
    if (wer === -1) frei.push(l)
  })
  return frei
}

/** Die Kästchen, die diese Linie schließen würde. */
export function schliesst(p: Partie, linie: number): number[] {
  if (!istFrei(p, linie)) return []
  return p.raster.kaestchenAn[linie]!.filter((k) => seitenZahl(p, k) === 3)
}

/**
 * Wer nach dieser Linie dran ist: derselbe, wenn sie ein Kästchen schließt,
 * sonst der Nächste. Online meldet der Ziehende genau das mit (online.ts).
 */
export function naechsterNach(p: Partie, linie: number): number {
  return schliesst(p, linie).length > 0 ? p.amZug : (p.amZug + 1) % p.spielerZahl
}

/** Eine Linie ziehen -- `null`, wenn sie nicht frei ist oder die Partie vorbei. */
export function ziehe(p: Partie, linie: number): Partie | null {
  if (p.vorbei || !istFrei(p, linie)) return null
  const zu = schliesst(p, linie)
  const linien = [...p.linien]
  linien[linie] = p.amZug
  const besitzer = [...p.besitzer]
  const punkte = [...p.punkte]
  for (const k of zu) {
    besitzer[k] = p.amZug
    punkte[p.amZug]! += 1
  }
  const vorbei = besitzer.every((b) => b >= 0)
  return {
    ...p,
    linien,
    besitzer,
    punkte,
    amZug: zu.length > 0 ? p.amZug : (p.amZug + 1) % p.spielerZahl,
    zuege: [...p.zuege, { linie, spieler: p.amZug, geschlossen: zu }],
    vorbei,
  }
}

/** Eine Partie aus der Liste ihrer Linien. Was nicht geht, bricht die Liste ab. */
export function partieAus(
  breite: number,
  hoehe: number,
  spielerZahl: number,
  linien: readonly number[],
  beginner = 0,
): Partie {
  let p = neuePartie(breite, hoehe, spielerZahl, beginner)
  for (const l of linien) {
    const weiter = ziehe(p, l)
    if (!weiter) break
    p = weiter
  }
  return p
}

/** Wer die meisten Kästchen hat -- bei Gleichstand mehrere. */
export function vorne(punkte: readonly number[], ohne: readonly number[] = []): number[] {
  const im = punkte.map((_, i) => i).filter((i) => !ohne.includes(i))
  const best = Math.max(...im.map((i) => punkte[i]!))
  return im.filter((i) => punkte[i] === best)
}

/** Die Sieger einer beendeten Partie; leer, solange sie läuft. */
export function sieger(p: Partie): number[] {
  return p.vorbei ? vorne(p.punkte) : []
}
