/**
 * Bienen-Flow – 100 Level, Abschnitte à 20 mit Tor.
 *
 * Wellen innerhalb eines Segments (pos 0…19):
 *   0–6   sehr leicht
 *   7–13  etwas schwerer
 *   14–18 wieder leichter (der „Dip", damit es nicht nur bergauf geht)
 *   19    Tor – deutlich schwerer
 *
 * Über die Segmente hinweg steigt die Grundschwierigkeit.
 *
 * Zwei Regeln, ohne die das Spiel nicht aufgeht (06.09.2026):
 *
 * 1. Jede Farbe kommt in einem Vielfachen von drei vor. Sonst bliebe am Ende
 *    ein Rest übrig, der sich nie zu einem Dreier ergänzen lässt -- das Level
 *    wäre unlösbar, und zwar erst nach fünf Minuten sichtbar.
 * 2. Die Pollen liegen als Haufen von unten aufgeschichtet. Nur die
 *    Oberfläche liegt frei, deshalb ist die Reihenfolge eine Entscheidung.
 *
 * Die Schwierigkeit steckt in drei Schrauben: wie viele Farben gleichzeitig
 * im Spiel sind (jede angefangene belegt einen Platz), wie viele Plätze die
 * Leiste hat, und wie weit die Dreier auseinanderliegen. Die Zahlen unten
 * sind nicht geraten, sondern über einen Löser eingestellt (siehe
 * tests/bienen-flow.test.ts).
 */

import { SEGMENT_SIZE, isSegmentGate, segmentIndexForLevel } from '@/progression/zones'
import { BIENEN_MAX_LEVEL, MERGE_COUNT, type BienenLevel, type CellColor } from './types'

function mulberry(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n))
}

/** 0 = ganz leicht … 1.35 = Tor. */
function waveFactor(posInSeg: number): number {
  if (posInSeg >= 19) return 1.35
  if (posInSeg <= 6) return 0.35 + (posInSeg / 6) * 0.25
  if (posInSeg <= 13) return 0.6 + ((posInSeg - 7) / 6) * 0.45
  return 0.55 + ((posInSeg - 14) / 4) * 0.2
}

export function createBienenLevel(level: number): BienenLevel {
  const L = clamp(Math.floor(level), 1, BIENEN_MAX_LEVEL)
  const segment = segmentIndexForLevel(L)
  const pos = (L - 1) % SEGMENT_SIZE
  const wave = waveFactor(pos)
  const gate = isSegmentGate(L)
  const rng = mulberry(L * 9973 + 42)

  // Farben: die eigentliche Schraube. Mehr Farben als Plätze heißt, dass man
  // sich verzetteln kann -- weniger heißt, dass fast alles aufgeht.
  const maxFarben = gate ? 8 : segment >= 3 ? 7 : 6
  const colorCount = clamp(Math.round(2.4 + segment * 0.75 + wave * 1.6 + (gate ? 1 : 0)), 3, maxFarben)

  // Plätze: sieben ist die bequeme Leiste, am Tor wird sie enger.
  const slotCount = gate ? 5 : segment >= 4 ? 6 : 7

  const rows = clamp(Math.round(5 + segment * 0.8 + wave * 1.5), 5, 12)
  const cols = clamp(Math.round(5 + segment * 0.5 + wave), 5, 9)

  // Wie voll der Haufen ist -- bestimmt vor allem die Länge einer Partie.
  const fillRatio = clamp(0.5 + wave * 0.18 + segment * 0.03, 0.45, 0.85)
  // Auf ganze Dreier abrunden, aber mindestens einer je Farbe.
  const tiles = Math.floor(rows * cols * fillRatio)
  const triples = Math.max(colorCount, Math.floor(tiles / MERGE_COUNT))

  // Jede Farbe bekommt mindestens einen Dreier, der Rest wird verteilt.
  const proFarbe = new Array<number>(colorCount).fill(1)
  for (let t = colorCount; t < triples; t++) {
    proFarbe[Math.floor(rng() * colorCount)]! += 1
  }

  const pollen: CellColor[] = []
  for (let c = 0; c < colorCount; c++) {
    for (let k = 0; k < proFarbe[c]! * MERGE_COUNT; k++) pollen.push((c + 1) as CellColor)
  }

  // Die Dreier liegen zunächst beieinander -- so ist ein Level leicht. Je
  // schwerer, desto mehr wird gemischt, bis sie über den ganzen Haufen
  // verstreut sind und man Plätze belegen muss, ohne sie gleich zu schließen.
  const bloecke: CellColor[][] = []
  for (let i = 0; i < pollen.length; i += MERGE_COUNT) bloecke.push(pollen.slice(i, i + MERGE_COUNT))
  for (let i = bloecke.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = bloecke[i]!
    bloecke[i] = bloecke[j]!
    bloecke[j] = tmp
  }
  const folge = bloecke.flat()
  const streuung = Math.round(folge.length * clamp(wave * 0.85, 0.1, 1))
  for (let s = 0; s < streuung; s++) {
    const a = Math.floor(rng() * folge.length)
    const b = Math.floor(rng() * folge.length)
    const tmp = folge[a]!
    folge[a] = folge[b]!
    folge[b] = tmp
  }

  // Der Haufen: von unten aufgeschichtet, mit ausgefranster Oberkante.
  const plaetze: number[] = []
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = 0; c < cols; c++) plaetze.push(r * cols + c)
  }
  for (let i = plaetze.length - 1; i > 0; i--) {
    if (rng() < 0.3) {
      const j = Math.max(0, i - 1 - Math.floor(rng() * cols))
      const tmp = plaetze[i]!
      plaetze[i] = plaetze[j]!
      plaetze[j] = tmp
    }
  }

  const board: CellColor[] = new Array(rows * cols).fill(0)
  for (let i = 0; i < folge.length && i < plaetze.length; i++) {
    board[plaetze[i]!] = folge[i]!
  }

  const label = gate ? 'Tor' : wave >= 0.9 ? 'Knifflig' : wave >= 0.6 ? 'Mittel' : 'Locker'

  return { level: L, rows, cols, board, slotCount, colorCount, isGate: gate, label }
}
