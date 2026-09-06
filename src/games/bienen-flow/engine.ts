/**
 * Bienen-Flow – reine Spiellogik.
 *
 * - Brett: farbige Zellen, 0 = leer
 * - Unten: Tray (Stapel antippen → Farbe in freien Slot)
 * - Slots: begrenzte Warteplätze
 * - Bienen räumen alle *erreichbaren* Zellen der Slot-Farben ab
 *   (Erreichbarkeit = angrenzend an „offenen“ Raum von oben/leer)
 * - Slot wird frei, wenn keine Zelle dieser Farbe mehr auf dem Brett ist
 * - Sieg: Brett leer · Niederlage: alle Slots voll und keine erreichbare Slot-Farbe
 */

import type { BienenLevel, BienenState, CellColor } from './types'

function idx(row: number, col: number, cols: number): number {
  return row * cols + col
}

/** Offene Zellen: Flood von oben durch leere Zellen. */
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

/** Farbe ist erreichbar, wenn mind. eine Zelle an offenen Raum grenzt. */
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
      const ni = idx(nr, nc, cols)
      if (open[ni]) {
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

function clearReachableOf(
  board: CellColor[],
  rows: number,
  cols: number,
  color: CellColor,
): { board: CellColor[]; cleared: number } {
  const open = openMask(board, rows, cols)
  const next = board.slice()
  let cleared = 0
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]
  for (let i = 0; i < next.length; i++) {
    if (next[i] !== color) continue
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
    if (ok) {
      next[i] = 0
      cleared++
    }
  }
  return { board: next, cleared }
}

/** Nach Slot-Änderung: so lange räumen, bis nichts mehr geht; Spots freigeben. */
function resolve(state: BienenState): BienenState {
  let board = state.board.slice()
  let slots = state.slots.slice()
  let changed = true
  while (changed) {
    changed = false
    const reach = reachableColors(board, state.rows, state.cols)
    for (let s = 0; s < slots.length; s++) {
      const color = slots[s]
      if (color == null) continue
      if (!reach.has(color)) continue
      const { board: nb, cleared } = clearReachableOf(board, state.rows, state.cols, color)
      if (cleared > 0) {
        board = nb
        changed = true
      }
    }
    for (let s = 0; s < slots.length; s++) {
      const color = slots[s]
      if (color != null && countColor(board, color) === 0) {
        slots[s] = null
        changed = true
      }
    }
  }

  const empty = board.every((c) => c === 0)
  if (empty) {
    return { ...state, board, slots, phase: 'won' }
  }

  const free = slots.some((s) => s == null)
  if (!free) {
    const reach = reachableColors(board, state.rows, state.cols)
    const anyUseful = slots.some((c) => c != null && reach.has(c))
    if (!anyUseful) {
      return { ...state, board, slots, phase: 'lost' }
    }
  }

  return { ...state, board, slots, phase: 'play' }
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

/** Tray-Stapel antippen → Farbe in freien Slot, dann auflösen. */
export function tapTray(state: BienenState, trayIndex: number): BienenState {
  if (state.phase !== 'play') return state
  if (trayIndex < 0 || trayIndex >= state.tray.length) return state
  const freeIdx = state.slots.findIndex((s) => s == null)
  if (freeIdx < 0) return state

  const color = state.tray[trayIndex]!
  const tray = state.tray.slice()
  tray.splice(trayIndex, 1)
  const slots = state.slots.slice()
  slots[freeIdx] = color

  return resolve({
    ...state,
    tray,
    slots,
    moves: state.moves + 1,
  })
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
