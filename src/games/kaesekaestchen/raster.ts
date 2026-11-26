/**
 * Das Blatt: Punkte, Linien, Kästchen -- nur Geometrie, keine Regel.
 *
 * Die Linien sind durchnummeriert, erst alle waagrechten Zeile für Zeile,
 * dann alle senkrechten. Diese Nummer steht online im Zugbuch; wer die
 * Reihenfolge ändert, macht jedes laufende Online-Blatt unlesbar.
 *
 * Bei `breite` × `hoehe` Kästchen:
 *   waagrecht (Zeile z = 0..hoehe, Spalte s = 0..breite-1): z * breite + s
 *   senkrecht (Zeile z = 0..hoehe-1, Spalte s = 0..breite):
 *     (hoehe + 1) * breite + z * (breite + 1) + s
 */

import { KANTE } from './config'

export interface Raster {
  breite: number
  hoehe: number
  anzahlLinien: number
  anzahlKaestchen: number
  /** Je Linie die ein oder zwei Kästchen, an denen sie liegt. */
  kaestchenAn: readonly (readonly number[])[]
  /** Je Kästchen seine vier Linien: oben, unten, links, rechts. */
  seiten: readonly (readonly [number, number, number, number])[]
}

export interface LinienLage {
  art: 'waagrecht' | 'senkrecht'
  /** Zeile des linken bzw. oberen Punkts, ab 0. */
  zeile: number
  /** Spalte des linken bzw. oberen Punkts, ab 0. */
  spalte: number
}

const ZWISCHENSPEICHER = new Map<string, Raster>()

export function gueltigeKante(n: number): boolean {
  return Number.isInteger(n) && n >= KANTE.min && n <= KANTE.max
}

export function anzahlLinien(breite: number, hoehe: number): number {
  return (hoehe + 1) * breite + hoehe * (breite + 1)
}

export function raster(breite: number, hoehe: number): Raster {
  if (!gueltigeKante(breite) || !gueltigeKante(hoehe)) {
    throw new Error(`Käsekästchen: ${breite} × ${hoehe} ist keine erlaubte Größe`)
  }
  const schluessel = `${breite}x${hoehe}`
  const fertig = ZWISCHENSPEICHER.get(schluessel)
  if (fertig) return fertig

  const waagrecht = (z: number, s: number) => z * breite + s
  const senkrecht = (z: number, s: number) => (hoehe + 1) * breite + z * (breite + 1) + s
  const linien = anzahlLinien(breite, hoehe)
  const kaestchenAn: number[][] = Array.from({ length: linien }, () => [])
  const seiten: [number, number, number, number][] = []

  for (let z = 0; z < hoehe; z++) {
    for (let s = 0; s < breite; s++) {
      const k = z * breite + s
      const vier: [number, number, number, number] = [
        waagrecht(z, s),
        waagrecht(z + 1, s),
        senkrecht(z, s),
        senkrecht(z, s + 1),
      ]
      seiten.push(vier)
      for (const l of vier) kaestchenAn[l]!.push(k)
    }
  }

  const neu: Raster = {
    breite,
    hoehe,
    anzahlLinien: linien,
    anzahlKaestchen: breite * hoehe,
    kaestchenAn,
    seiten,
  }
  ZWISCHENSPEICHER.set(schluessel, neu)
  return neu
}

/** Wo eine Linie liegt -- zum Zeichnen und für die Beschriftung. */
export function lageVon(r: Raster, linie: number): LinienLage {
  const waagrechte = (r.hoehe + 1) * r.breite
  if (linie < waagrechte) {
    return { art: 'waagrecht', zeile: Math.floor(linie / r.breite), spalte: linie % r.breite }
  }
  const rest = linie - waagrechte
  return {
    art: 'senkrecht',
    zeile: Math.floor(rest / (r.breite + 1)),
    spalte: rest % (r.breite + 1),
  }
}
