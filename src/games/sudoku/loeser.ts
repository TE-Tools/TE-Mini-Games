/**
 * Der Rechenlöser -- Rückverfolgung mit Bitmasken.
 *
 * Er weiß nichts von Techniken; er probiert. Dafür ist er schnell genug,
 * um beim Erzeugen nach jeder weggenommenen Vorgabe zu prüfen, ob das
 * Rätsel noch genau eine Lösung hat. Er nimmt immer die Zelle mit den
 * wenigsten Kandidaten zuerst (MRV) -- das hält den Suchbaum klein.
 */

import { ALLE_ZIFFERN, N, ZELLEN, kastenVon, spalteVon, zeileVon, type Gitter } from './gitter'

interface Suche {
  g: Gitter
  zeilen: Int32Array
  spalten: Int32Array
  kaesten: Int32Array
  gefunden: number
  maximal: number
  loesung: Gitter | null
  /** Besuchte Knoten -- ein Maß dafür, wie viel Raten nötig war. */
  knoten: number
}

function vorbereiten(g: Gitter, maximal: number): Suche | null {
  const s: Suche = {
    g: new Uint8Array(g),
    zeilen: new Int32Array(N),
    spalten: new Int32Array(N),
    kaesten: new Int32Array(N),
    gefunden: 0,
    maximal,
    loesung: null,
    knoten: 0,
  }
  for (let i = 0; i < ZELLEN; i++) {
    const w = g[i]!
    if (w === 0) continue
    const bit = 1 << w
    const r = zeileVon(i)
    const c = spalteVon(i)
    const k = kastenVon(i)
    // Ein Widerspruch in der Vorgabe: keine Lösung.
    if (s.zeilen[r]! & bit || s.spalten[c]! & bit || s.kaesten[k]! & bit) return null
    s.zeilen[r]! |= bit
    s.spalten[c]! |= bit
    s.kaesten[k]! |= bit
  }
  return s
}

function suche(s: Suche): void {
  if (s.gefunden >= s.maximal) return
  s.knoten++
  // Zelle mit den wenigsten Kandidaten.
  let beste = -1
  let besteMaske = 0
  let besteAnzahl = 10
  for (let i = 0; i < ZELLEN; i++) {
    if (s.g[i] !== 0) continue
    const maske =
      ALLE_ZIFFERN & ~(s.zeilen[zeileVon(i)]! | s.spalten[spalteVon(i)]! | s.kaesten[kastenVon(i)]!)
    if (maske === 0) return
    let n = 0
    let m = maske
    while (m) {
      m &= m - 1
      n++
    }
    if (n < besteAnzahl) {
      besteAnzahl = n
      beste = i
      besteMaske = maske
      if (n === 1) break
    }
  }
  if (beste === -1) {
    s.gefunden++
    if (!s.loesung) s.loesung = new Uint8Array(s.g)
    return
  }
  const r = zeileVon(beste)
  const c = spalteVon(beste)
  const k = kastenVon(beste)
  for (let d = 1; d <= N; d++) {
    const bit = 1 << d
    if (!(besteMaske & bit)) continue
    s.g[beste] = d
    s.zeilen[r]! |= bit
    s.spalten[c]! |= bit
    s.kaesten[k]! |= bit
    suche(s)
    s.zeilen[r]! &= ~bit
    s.spalten[c]! &= ~bit
    s.kaesten[k]! &= ~bit
    s.g[beste] = 0
    if (s.gefunden >= s.maximal) return
  }
}

/** Zählt Lösungen, hört aber bei `maximal` auf -- mehr will man selten wissen. */
export function zaehleLoesungen(g: Gitter, maximal = 2): number {
  const s = vorbereiten(g, maximal)
  if (!s) return 0
  suche(s)
  return s.gefunden
}

export function istEindeutig(g: Gitter): boolean {
  return zaehleLoesungen(g, 2) === 1
}

/** Die erste gefundene Lösung, oder null. */
export function loese(g: Gitter): Gitter | null {
  const s = vorbereiten(g, 1)
  if (!s) return null
  suche(s)
  return s.loesung
}

/**
 * Wie viele Knoten der Rechenlöser bis zur ersten Lösung besucht. Bei einem
 * Rätsel, das sich nur mit Singles lösen lässt, sind das 82 oder weniger --
 * jede Zahl mehr ist ein Ratepunkt.
 */
export function suchaufwand(g: Gitter): number {
  const s = vorbereiten(g, 1)
  if (!s) return 0
  suche(s)
  return s.knoten
}
