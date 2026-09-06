/**
 * Bienen-Flow – reine Spiellogik (kein React, kein DOM).
 *
 * Ablauf (06.09.2026, nach dem Umbau auf die Mechanik des Originals):
 *   1. Auf dem Brett liegen Pollen. Antippen darf man nur, was frei liegt --
 *      die Oberfläche des Haufens, nicht das, was darunter steckt.
 *   2. Eine Biene trägt genau diesen einen Pollen in die Wabenleiste.
 *   3. Drei gleiche Farben in der Leiste verschmelzen zu Honig und geben
 *      ihre Plätze wieder frei.
 *   4. Volle Leiste ohne Dreier: verloren. Leeres Brett: gewonnen.
 *
 * Die Spannung kommt allein aus der Leiste: Jede Farbe, die man anfängt und
 * nicht zu dritt bekommt, blockiert einen Platz bis zum Schluss.
 */

import { MERGE_COUNT, type BienenLevel, type BienenState, type CellColor } from './types'

function idx(row: number, col: number, cols: number): number {
  return row * cols + col
}

const DIRS: readonly [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

/**
 * Leere Felder, die mit dem Rand zusammenhängen -- also Luft, durch die eine
 * Biene an einen Pollen herankommt. Eine eingeschlossene Lücke mitten im
 * Haufen zählt nicht.
 */
export function openMask(board: CellColor[], rows: number, cols: number): boolean[] {
  const open: boolean[] = new Array(board.length).fill(false)
  const q: number[] = []

  const start = (i: number) => {
    if (board[i] === 0 && !open[i]) {
      open[i] = true
      q.push(i)
    }
  }
  for (let c = 0; c < cols; c++) {
    start(idx(0, c, cols))
    start(idx(rows - 1, c, cols))
  }
  for (let r = 0; r < rows; r++) {
    start(idx(r, 0, cols))
    start(idx(r, cols - 1, cols))
  }

  while (q.length) {
    const i = q.pop()!
    const r = Math.floor(i / cols)
    const c = i % cols
    for (const [dr, dc] of DIRS) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
      start(idx(nr, nc, cols))
    }
  }
  return open
}

/**
 * Welche Pollen frei liegen: alles, was an offene Luft grenzt oder in der
 * obersten Reihe liegt. Der Haufen wird also von oben und von den Lücken her
 * abgetragen -- deshalb ist die Reihenfolge überhaupt eine Entscheidung.
 */
export function reachableMask(board: CellColor[], rows: number, cols: number): boolean[] {
  const open = openMask(board, rows, cols)
  const frei: boolean[] = new Array(board.length).fill(false)
  for (let i = 0; i < board.length; i++) {
    if (board[i] === 0) continue
    const r = Math.floor(i / cols)
    const c = i % cols
    if (r === 0) {
      frei[i] = true
      continue
    }
    for (const [dr, dc] of DIRS) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
      if (open[idx(nr, nc, cols)]) {
        frei[i] = true
        break
      }
    }
  }
  return frei
}

/** Farben, die gerade frei liegen -- für das Ausgrauen in der Anzeige. */
export function reachableColors(
  board: CellColor[],
  rows: number,
  cols: number,
): Set<CellColor> {
  const frei = reachableMask(board, rows, cols)
  const out = new Set<CellColor>()
  for (let i = 0; i < board.length; i++) if (frei[i]) out.add(board[i]!)
  return out
}

/** Indizes aller frei liegenden Pollen (oben→unten, links→rechts). */
export function reachableCells(state: BienenState): number[] {
  const frei = reachableMask(state.board, state.rows, state.cols)
  const out: number[] = []
  for (let i = 0; i < frei.length; i++) if (frei[i]) out.push(i)
  return out
}

export function canTap(state: BienenState, cellIndex: number): boolean {
  if (state.phase !== 'play') return false
  if (cellIndex < 0 || cellIndex >= state.board.length) return false
  if (state.board[cellIndex] === 0) return false
  if (belegteSlots(state.slots) >= state.slotCount) return false
  return reachableMask(state.board, state.rows, state.cols)[cellIndex] === true
}

function belegteSlots(slots: (CellColor | null)[]): number {
  let n = 0
  for (const s of slots) if (s != null) n++
  return n
}

/** Ein Zug für die Animationsschicht. */
export interface TapResult {
  state: BienenState
  /** Der Flug: von dieser Zelle auf diesen Platz. */
  flight: { cell: number; slot: number; color: CellColor }
  /** Entstand ein Dreier, dann diese Plätze -- sonst null. */
  merge: { color: CellColor; slots: number[] } | null
}

/**
 * Pollen einsortieren. Gleiche Farben liegen in der Leiste beieinander,
 * damit man den Dreier kommen sieht; alles Belegte rutscht nach links.
 */
function einsortieren(
  slots: (CellColor | null)[],
  color: CellColor,
  slotCount: number,
): { slots: (CellColor | null)[]; position: number } {
  const tiles = slots.filter((s): s is CellColor => s != null)
  let pos = tiles.length
  const letzte = tiles.lastIndexOf(color)
  if (letzte >= 0) pos = letzte + 1
  tiles.splice(pos, 0, color)
  const neu: (CellColor | null)[] = Array.from({ length: slotCount }, (_, i) => tiles[i] ?? null)
  return { slots: neu, position: pos }
}

/** Pollen antippen – liefert Endzustand, Flug und den Dreier, falls einer fällt. */
export function tapCell(state: BienenState, cellIndex: number): TapResult | null {
  if (!canTap(state, cellIndex)) return null
  const color = state.board[cellIndex]!

  const board = state.board.slice()
  board[cellIndex] = 0

  const { slots, position } = einsortieren(state.slots, color, state.slotCount)

  // Drei gleiche verschmelzen. Es kann pro Zug nur einer entstehen -- es
  // kommt ja nur ein Pollen dazu.
  const gleiche: number[] = []
  for (let i = 0; i < slots.length; i++) if (slots[i] === color) gleiche.push(i)

  let merge: TapResult['merge'] = null
  let nachMerge = slots
  if (gleiche.length >= MERGE_COUNT) {
    const weg = new Set(gleiche.slice(0, MERGE_COUNT))
    const rest = slots.filter((s, i) => s != null && !weg.has(i)) as CellColor[]
    nachMerge = Array.from({ length: state.slotCount }, (_, i) => rest[i] ?? null)
    merge = { color, slots: gleiche.slice(0, MERGE_COUNT) }
  }

  const leer = board.every((c) => c === 0)
  const belegt = belegteSlots(nachMerge)
  const phase: BienenState['phase'] =
    leer && belegt === 0 ? 'won' : belegt >= state.slotCount ? 'lost' : 'play'

  return {
    state: {
      ...state,
      board,
      slots: nachMerge,
      moves: state.moves + 1,
      peakSlots: Math.max(state.peakSlots, belegt),
      phase,
    },
    flight: { cell: cellIndex, slot: position, color },
    merge,
  }
}

export function createMatch(level: BienenLevel): BienenState {
  return {
    level: level.level,
    rows: level.rows,
    cols: level.cols,
    board: level.board.slice(),
    slots: Array.from({ length: level.slotCount }, () => null),
    slotCount: level.slotCount,
    colorCount: level.colorCount,
    phase: 'play',
    moves: 0,
    peakSlots: 0,
  }
}

export function remainingCells(state: BienenState): number {
  return state.board.reduce((n, c) => n + (c === 0 ? 0 : 1), 0)
}

export function usedSlots(state: BienenState): number {
  return belegteSlots(state.slots)
}

export function isWon(state: BienenState): boolean {
  return state.phase === 'won'
}

export function isLost(state: BienenState): boolean {
  return state.phase === 'lost'
}
