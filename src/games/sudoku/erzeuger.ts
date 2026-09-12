/**
 * Der Generator -- baut Rätsel, die genau eine Lösung haben.
 *
 * Zwei Schritte: erst ein volles, gültiges Gitter würfeln, dann Vorgaben
 * wegnehmen, solange die Lösung eindeutig bleibt. Wie schwer das Ergebnis
 * ist, entscheidet sich dabei nur nebenbei -- deshalb bewertet
 * `scripts/build-sudoku-levels.mjs` jedes Rätsel hinterher mit dem
 * Menschenlöser und sortiert es in Leicht, Mittel oder Schwer ein. Die
 * 150 ausgewählten Rätsel liegen dann fertig in `daten.ts`; im Spiel wird
 * nichts mehr erzeugt.
 *
 * Alles hängt am Startwert: derselbe Startwert liefert dasselbe Rätsel.
 */

import { createRng, shuffle } from '@/games/rng'
import { ALLE_ZIFFERN, N, ZELLEN, kastenVon, spalteVon, zeileVon, type Gitter } from './gitter'
import { istEindeutig } from './loeser'

/** Ein volles, gültiges Gitter -- gewürfelt, per Rückverfolgung. */
export function volleLoesung(rng: () => number): Gitter {
  const g = new Uint8Array(ZELLEN)
  const zeilen = new Int32Array(N)
  const spalten = new Int32Array(N)
  const kaesten = new Int32Array(N)
  const ziffern = Array.from({ length: N }, (_, i) => i + 1)

  const fuelle = (i: number): boolean => {
    if (i === ZELLEN) return true
    const r = zeileVon(i)
    const c = spalteVon(i)
    const k = kastenVon(i)
    const frei = ALLE_ZIFFERN & ~(zeilen[r]! | spalten[c]! | kaesten[k]!)
    for (const d of shuffle(ziffern, rng)) {
      const bit = 1 << d
      if (!(frei & bit)) continue
      g[i] = d
      zeilen[r]! |= bit
      spalten[c]! |= bit
      kaesten[k]! |= bit
      if (fuelle(i + 1)) return true
      zeilen[r]! &= ~bit
      spalten[c]! &= ~bit
      kaesten[k]! &= ~bit
      g[i] = 0
    }
    return false
  }
  fuelle(0)
  return g
}

export interface GrabOptionen {
  /** Punktsymmetrisch wegnehmen -- sieht schöner aus, lässt mehr Vorgaben stehen. */
  symmetrisch: boolean
  /** Aufhören, sobald so wenige Vorgaben übrig sind (0 = so weit es geht). */
  mindestens: number
}

/**
 * Vorgaben wegnehmen. Jede Zelle kommt einmal dran; was ohne die Zelle
 * mehrdeutig würde, bleibt stehen. Das Ergebnis ist ein Rätsel, aus dem
 * sich in der gewählten Reihenfolge nichts mehr streichen lässt -- außer
 * man hält vorher bei `mindestens` an.
 */
export function grabe(loesung: Gitter, rng: () => number, opt: GrabOptionen): Gitter {
  const g = new Uint8Array(loesung)
  const reihenfolge = shuffle(
    Array.from({ length: ZELLEN }, (_, i) => i),
    rng,
  )
  let vorgaben = ZELLEN
  for (const i of reihenfolge) {
    if (opt.mindestens > 0 && vorgaben <= opt.mindestens) break
    if (g[i] === 0) continue
    const partner = ZELLEN - 1 - i
    const paar = opt.symmetrisch && partner !== i && g[partner] !== 0
    const altA = g[i]!
    const altB = g[partner]!
    g[i] = 0
    if (paar) g[partner] = 0
    if (istEindeutig(g)) {
      vorgaben -= paar ? 2 : 1
      continue
    }
    // Zurück -- beim Paar noch einmal nur die eine Zelle versuchen.
    g[i] = altA
    if (paar) {
      g[partner] = altB
      g[i] = 0
      if (istEindeutig(g)) {
        vorgaben -= 1
        continue
      }
      g[i] = altA
    }
  }
  return g
}

export interface Erzeugt {
  vorgabe: Gitter
  loesung: Gitter
}

export function erzeugeRaetsel(seed: string, opt: GrabOptionen): Erzeugt {
  const rng = createRng(seed)
  const loesung = volleLoesung(rng)
  const vorgabe = grabe(loesung, rng, opt)
  return { vorgabe, loesung }
}
