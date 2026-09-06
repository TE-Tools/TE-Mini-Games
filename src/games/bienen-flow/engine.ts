/**
 * Bienen-Flow – reine Spiellogik.
 *
 * - Brett: farbige Zellen, 0 = leer
 * - Tray antippen → Farbe in freien Slot
 * - Bienen räumen erreichbare Zellen der Slot-Farben
 * - Events für die Animationsschicht (Zellen in Räum-Reihenfolge)
 */

import type { BienenLevel, BienenState, CellColor } from './types'

function idx(row: number, col: number, cols: number): number {
  return row * cols + col
}

export function openMask(board: CellColor[], rows: number, cols: number): boolean[] {
  const open = new Array(board.length).fill(false)
  const q: number[] = []
  for (let c = 0; c < cols; c++) {
    const i = idx(0, c, cols)
    if (board[i] === 0) {
      open[i] = true
      q.push(i)
    }
  }
  for (let r = 0; r < rows; r++) {
    for (const c of [0, cols - 1]) {
      const i = idx(r, c, cols)
      if (board[i] === 0 && !open[i]) {
        open[i] = true
        q.push(i)
      }
    }
  }
  for (let c = 0; c < cols; c++) {
    const i = idx(rows - 1, c, cols)
    if (board[i] === 0 && !open[i]) {
      open[i] = true
      q.push(i)
    }
  }

  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]
  while (q.length) {
    const i = q.pop()!
    const r = Math.floor(i / cols)
    const c = i % cols
    for (const [dr, dc] of dirs) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
      const ni = idx(nr, nc, cols)
      if (board[ni] === 0 && !open[ni]) {
        open[ni] = true
        q.push(ni)
      }
    }
  }
  return open
}

export function reachableColors(
  board: CellColor[],
  rows: number,
  cols: number,
): Set<CellColor> {
  const open = openMask(board, rows, cols)
  const out = new Set<CellColor>()
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]
  for (let i = 0; i < board.length; i++) {
    const color = board[i]!
    if (color === 0) continue
    const r = Math.floor(i / cols)
    const c = i % cols
    if (r === 0) {
      out.add(color)
      continue
    }
    for (const [dr, dc] of dirs) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
        if (nr < 0) out.add(color)
        continue
      }
      if (open[idx(nr, nc, cols)]) {
        out.add(color)
        break
      }
    }
  }
  return out
}

function countColor(board: CellColor[], color: CellColor): number {
  let n = 0
  for (const c of board) if (c === color) n++
  return n
}

/** Indices der erreichbaren Zellen einer Farbe (oben→unten, links→rechts). */
function reachableCellIndices(
  board: CellColor[],
  rows: number,
  cols: number,
  color: CellColor,
): number[] {
  const open = openMask(board, rows, cols)
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]
  const found: number[] = []
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== color) continue
    const r = Math.floor(i / cols)
    const c = i % cols
    let ok = r === 0
    if (!ok) {
      for (const [dr, dc] of dirs) {
        const nr = r + dr
        const nc = c + dc
        if (nr < 0) {
          ok = true
          break
        }
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
        if (open[idx(nr, nc, cols)]) {
          ok = true
          break
        }
      }
    }
    if (ok) found.push(i)
  }
  return found
}

/** Ein Räum-Schritt für die Animation. */
export interface ClearWave {
  color: CellColor
  /** Slot-Index, der diese Farbe hält */
  slotIndex: number
  /** Zellen-Indizes (board flat), die in diesem Schritt verschwinden */
  cells: number[]
}

export interface TapResult {
  state: BienenState
  /** Wellen in der Reihenfolge, in der Bienen arbeiten */
  waves: ClearWave[]
  /** Slot, in den die Tray-Farbe gelegt wurde */
  deployedSlot: number
  deployedColor: CellColor
}

function resolveWithWaves(state: BienenState): { state: BienenState; waves: ClearWave[] } {
  let board = state.board.slice()
  let slots = state.slots.slice()
  const waves: ClearWave[] = []
  let guard = 0
  while (guard++ < 200) {
    const reach = reachableColors(board, state.rows, state.cols)
    let any = false
    for (let s = 0; s < slots.length; s++) {
      const color = slots[s]
      if (color == null) continue
      if (!reach.has(color)) continue
      const cells = reachableCellIndices(board, state.rows, state.cols, color)
      if (cells.length === 0) continue
      for (const i of cells) board[i] = 0
      waves.push({ color, slotIndex: s, cells })
      any = true
    }
    for (let s = 0; s < slots.length; s++) {
      const color = slots[s]
      if (color != null && countColor(board, color) === 0) {
        slots[s] = null
      }
    }
    if (!any) break
  }

  const empty = board.every((c) => c === 0)
  if (empty) {
    return { state: { ...state, board, slots, phase: 'won' }, waves }
  }

  const free = slots.some((s) => s == null)
  if (!free) {
    const reach = reachableColors(board, state.rows, state.cols)
    const anyUseful = slots.some((c) => c != null && reach.has(c))
    if (!anyUseful) {
      return { state: { ...state, board, slots, phase: 'lost' }, waves }
    }
  }

  return { state: { ...state, board, slots, phase: 'play' }, waves }
}

export function createMatch(level: BienenLevel): BienenState {
  return {
    level: level.level,
    rows: level.rows,
    cols: level.cols,
    board: level.board.slice(),
    tray: level.tray.slice(),
    slots: Array.from({ length: level.slotCount }, () => null),
    slotCount: level.slotCount,
    colorCount: level.colorCount,
    phase: 'play',
    moves: 0,
  }
}

/** Tray antippen – liefert Endzustand + Animationswellen. */
export function tapTrayDetailed(state: BienenState, trayIndex: number): TapResult | null {
  if (state.phase !== 'play') return null
  if (trayIndex < 0 || trayIndex >= state.tray.length) return null
  const freeIdx = state.slots.findIndex((s) => s == null)
  if (freeIdx < 0) return null

  const color = state.tray[trayIndex]!
  const tray = state.tray.slice()
  tray.splice(trayIndex, 1)
  const slots = state.slots.slice()
  slots[freeIdx] = color

  const mid: BienenState = {
    ...state,
    tray,
    slots,
    moves: state.moves + 1,
  }
  const { state: final, waves } = resolveWithWaves(mid)
  return {
    state: final,
    waves,
    deployedSlot: freeIdx,
    deployedColor: color,
  }
}

/** Kompatibel: nur Zustand. */
export function tapTray(state: BienenState, trayIndex: number): BienenState {
  return tapTrayDetailed(state, trayIndex)?.state ?? state
}

export function remainingCells(state: BienenState): number {
  return state.board.reduce((n, c) => n + (c === 0 ? 0 : 1), 0)
}

export function isWon(state: BienenState): boolean {
  return state.phase === 'won'
}

export function isLost(state: BienenState): boolean {
  return state.phase === 'lost'
}
