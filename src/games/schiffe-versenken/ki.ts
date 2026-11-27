/**
 * Der Computer zielt.
 *
 * Er sieht genau, was ein Mensch an seiner Stelle sähe: die eigenen Schüsse
 * mit Ergebnis und die Schiffe, die er schon versenkt hat (`sichtFuer`).
 * Die fremde Flotte bekommt er nie -- sonst wäre jede Stufe allwissend.
 *
 * Rein: Der Zufall kommt von außen (`zufall`), sonst nichts. Dieselbe Lage
 * mit demselben Zufall gibt denselben Schuss.
 */

import {
  FLOTTE,
  GROESSE,
  STUFEN,
  TREFFER_GEWICHT,
  type SchiffeRegeln,
  type SchiffeStufe,
} from './config'
import { feldVon, felderVon, reiheVon, spalteVon, type Richtung, type Schiff } from './flotte'
import type { Schuss } from './partie'

export interface KiLage {
  regeln: SchiffeRegeln
  /** Die eigenen Schüsse aufs fremde Meer. */
  schuesse: readonly Schuss[]
  /** Die fremden Schiffe, die schon gesunken sind -- samt Lage. */
  versenkte: readonly Schiff[]
}

const FELDER = GROESSE * GROESSE

function nachbarn4(feld: number): number[] {
  const x = spalteVon(feld)
  const y = reiheVon(feld)
  const n: number[] = []
  if (x > 0) n.push(feld - 1)
  if (x < GROESSE - 1) n.push(feld + 1)
  if (y > 0) n.push(feld - GROESSE)
  if (y < GROESSE - 1) n.push(feld + GROESSE)
  return n
}

function nachbarn8(feld: number): number[] {
  const x = spalteVon(feld)
  const y = reiheVon(feld)
  const n: number[] = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue
      const nx = x + dx
      const ny = y + dy
      if (nx >= 0 && ny >= 0 && nx < GROESSE && ny < GROESSE) n.push(feldVon(nx, ny))
    }
  }
  return n
}

/** Was aus der Lage folgt: beschossen, gesperrt, offene Treffer, übrige Schiffe. */
function lese(lage: KiLage) {
  const beschossen = new Set(lage.schuesse.map((s) => s.feld))
  const versenkt = new Set(lage.versenkte.flatMap((s) => felderVon(s)))
  // Dürfen Schiffe sich nicht berühren, liegt um jedes versenkte Wasser.
  const gesperrt = new Set(versenkt)
  if (lage.regeln.nichtBeruehren) {
    for (const f of versenkt) for (const n of nachbarn8(f)) gesperrt.add(n)
  }
  const offen = lage.schuesse
    .filter((s) => s.ergebnis !== 'wasser' && !versenkt.has(s.feld))
    .map((s) => s.feld)
  const weg = new Set(lage.versenkte.map((s) => s.id))
  const uebrig = FLOTTE.filter((a) => !weg.has(a.id)).map((a) => a.laenge)
  return { beschossen, gesperrt, offen, uebrig }
}

function waehle(felder: readonly number[], zufall: () => number): number {
  return felder[Math.floor(zufall() * felder.length)]!
}

function freieFelder(beschossen: ReadonlySet<number>, auch?: (f: number) => boolean): number[] {
  const frei: number[] = []
  for (let f = 0; f < FELDER; f++) if (!beschossen.has(f) && (!auch || auch(f))) frei.push(f)
  return frei
}

/**
 * Wo es nach offenen Treffern weitergeht: Liegen zwei in einer Linie, an
 * deren Enden; sonst rundherum.
 */
function jagdFelder(
  offen: readonly number[],
  beschossen: ReadonlySet<number>,
  gesperrt: ReadonlySet<number>,
): number[] {
  const offenSet = new Set(offen)
  const frei = (f: number) => !beschossen.has(f) && !gesperrt.has(f)
  const enden = new Set<number>()
  for (const f of offen) {
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
    ] as const) {
      const x = spalteVon(f)
      const y = reiheVon(f)
      const vor = x - dx >= 0 && y - dy >= 0 ? feldVon(x - dx, y - dy) : -1
      const nach = x + dx < GROESSE && y + dy < GROESSE ? feldVon(x + dx, y + dy) : -1
      if (!offenSet.has(vor) && !offenSet.has(nach)) continue
      // f liegt in einer Reihe aus Treffern: an beiden Enden weitersuchen.
      let a = f
      while (spalteVon(a) - dx >= 0 && reiheVon(a) - dy >= 0) {
        const n = feldVon(spalteVon(a) - dx, reiheVon(a) - dy)
        if (!offenSet.has(n)) break
        a = n
      }
      let b = f
      while (spalteVon(b) + dx < GROESSE && reiheVon(b) + dy < GROESSE) {
        const n = feldVon(spalteVon(b) + dx, reiheVon(b) + dy)
        if (!offenSet.has(n)) break
        b = n
      }
      if (spalteVon(a) - dx >= 0 && reiheVon(a) - dy >= 0) {
        const n = feldVon(spalteVon(a) - dx, reiheVon(a) - dy)
        if (frei(n)) enden.add(n)
      }
      if (spalteVon(b) + dx < GROESSE && reiheVon(b) + dy < GROESSE) {
        const n = feldVon(spalteVon(b) + dx, reiheVon(b) + dy)
        if (frei(n)) enden.add(n)
      }
    }
  }
  if (enden.size > 0) return [...enden]
  const rund = new Set<number>()
  for (const f of offen) for (const n of nachbarn4(f)) if (frei(n)) rund.add(n)
  return [...rund]
}

/**
 * Die Wahrscheinlichkeitskarte: Jedes übrige Schiff wird an jede Stelle
 * gelegt, an der es noch liegen kann. Gibt es offene Treffer, zählen nur
 * Lagen, die welche abdecken -- und zwar umso mehr, je mehr.
 */
export function wahrscheinlichkeiten(lage: KiLage): number[] {
  const { beschossen, gesperrt, offen, uebrig } = lese(lage)
  const offenSet = new Set(offen)
  const karte = new Array<number>(FELDER).fill(0)
  for (const laenge of uebrig) {
    for (const richtung of ['h', 'v'] as Richtung[]) {
      const maxX = GROESSE - (richtung === 'h' ? laenge : 1)
      const maxY = GROESSE - (richtung === 'v' ? laenge : 1)
      for (let y = 0; y <= maxY; y++) {
        for (let x = 0; x <= maxX; x++) {
          const felder = felderVon({ x, y, laenge, richtung })
          let deckt = 0
          let geht = true
          for (const f of felder) {
            if (gesperrt.has(f) || (beschossen.has(f) && !offenSet.has(f))) {
              geht = false
              break
            }
            if (offenSet.has(f)) deckt++
          }
          if (!geht) continue
          if (offen.length > 0 && deckt === 0) continue
          if (lage.regeln.nichtBeruehren && offen.length > 0) {
            // Ein offener Treffer gleich neben dieser Lage gehörte zu einem
            // Schiff, das sie berührte -- das darf nicht sein.
            const eigene = new Set(felder)
            const ruehrt = felder.some((f) =>
              nachbarn8(f).some((n) => offenSet.has(n) && !eigene.has(n)),
            )
            if (ruehrt) continue
          }
          const gewicht = TREFFER_GEWICHT ** deckt
          for (const f of felder) if (!beschossen.has(f)) karte[f]! += gewicht
        }
      }
    }
  }
  return karte
}

/** Der nächste Schuss des Computers. Gibt es kein freies Feld mehr, -1. */
export function waehleSchuss(lage: KiLage, stufe: SchiffeStufe, zufall: () => number): number {
  const werte = STUFEN[stufe]
  const { beschossen, gesperrt, offen, uebrig } = lese(lage)
  const alleFreien = freieFelder(beschossen)
  if (alleFreien.length === 0) return -1

  if (stufe === 'schwer') {
    const karte = wahrscheinlichkeiten(lage)
    let best = 0
    for (const f of alleFreien) best = Math.max(best, karte[f]!)
    if (best > 0)
      return waehle(
        alleFreien.filter((f) => karte[f] === best),
        zufall,
      )
    // Nichts mehr möglich (kommt nur bei unstimmiger Lage vor): irgendwohin.
    return waehle(alleFreien, zufall)
  }

  if (offen.length > 0 && zufall() < werte.nachsetzen) {
    const jagd =
      stufe === 'leicht'
        ? [...new Set(offen.flatMap(nachbarn4))].filter((f) => !beschossen.has(f))
        : jagdFelder(offen, beschossen, gesperrt)
    if (jagd.length > 0) return waehle(jagd, zufall)
  }

  if (stufe === 'leicht') return waehle(alleFreien, zufall)

  // Suchen: Schachbrettmuster nach dem kleinsten übrigen Schiff, Sperrgürtel auslassen.
  const kleinstes = Math.max(2, Math.min(...uebrig, GROESSE))
  const offenOhneGesperrt = freieFelder(beschossen, (f) => !gesperrt.has(f))
  if (werte.muster) {
    const muster = offenOhneGesperrt.filter((f) => (spalteVon(f) + reiheVon(f)) % kleinstes === 0)
    if (muster.length > 0) return waehle(muster, zufall)
  }
  if (offenOhneGesperrt.length > 0) return waehle(offenOhneGesperrt, zufall)
  return waehle(alleFreien, zufall)
}
