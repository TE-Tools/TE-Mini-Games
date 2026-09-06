/**
 * Bienen-Flow – 100 Level, Abschnitte à 20 mit Tor.
 *
 * Wellen innerhalb eines Segments (pos 0…19):
 *   0–6   sehr leicht
 *   7–13  etwas schwerer
 *   14–18 wieder leichter
 *   19    Tor – deutlich schwerer
 *
 * Über die Segmente hinweg steigt die Grundschwierigkeit.
 */

import { SEGMENT_SIZE, isSegmentGate, segmentIndexForLevel } from '@/progression/zones'
import { BIENEN_MAX_LEVEL, type BienenLevel, type CellColor } from './types'

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

/** 0 = easy wave, 1 = mid, 0.4 = dip, 1.3 = gate boost inside segment */
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

  const baseColors = clamp(2 + Math.floor((segment - 1) * 0.9), 2, 6)
  const colorCount = clamp(Math.round(baseColors + wave * 1.2 + (gate ? 1 : 0)), 2, 8)

  const baseRows = 5 + segment
  const baseCols = 5 + Math.floor(segment / 2)
  const rows = clamp(Math.round(baseRows + wave * 1.5), 5, 12)
  const cols = clamp(Math.round(baseCols + wave), 5, 10)

  const slotCount = gate ? 4 : 5

  const board: CellColor[] = new Array(rows * cols).fill(0)
  const fillRatio = clamp(0.45 + wave * 0.25 + segment * 0.04, 0.4, 0.85)
  const cellsToFill = Math.floor(rows * cols * fillRatio)

  const weights = Array.from({ length: colorCount }, (_, i) => colorCount - i)
  const weightSum = weights.reduce((a, b) => a + b, 0)
  function pickColor(): CellColor {
    let r = rng() * weightSum
    for (let i = 0; i < colorCount; i++) {
      r -= weights[i]!
      if (r <= 0) return i + 1
    }
    return colorCount
  }

  let filled = 0
  const order: number[] = []
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = 0; c < cols; c++) order.push(r * cols + c)
  }
  for (let i = order.length - 1; i > 0; i--) {
    if (rng() < 0.35) {
      const j = Math.floor(rng() * (i + 1))
      const tmp = order[i]!
      order[i] = order[j]!
      order[j] = tmp
    }
  }
  for (const i of order) {
    if (filled >= cellsToFill) break
    board[i] = pickColor()
    filled++
  }

  const present = new Set<CellColor>()
  for (const c of board) if (c > 0) present.add(c)
  const tray: CellColor[] = []
  const copies = gate ? 3 : 2
  for (const c of present) {
    for (let k = 0; k < copies; k++) tray.push(c)
  }
  const extras = Math.floor(wave * 2) + (gate ? 2 : 0)
  for (let e = 0; e < extras; e++) {
    const list = [...present]
    tray.push(list[Math.floor(rng() * list.length)]!)
  }
  for (let i = tray.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = tray[i]!
    tray[i] = tray[j]!
    tray[j] = tmp
  }

  let label = 'Locker'
  if (gate) label = 'Tor'
  else if (wave >= 0.9) label = 'Knifflig'
  else if (wave >= 0.6) label = 'Mittel'
  else label = 'Locker'

  return {
    level: L,
    rows,
    cols,
    board,
    tray,
    slotCount,
    colorCount,
    isGate: gate,
    label,
  }
}
