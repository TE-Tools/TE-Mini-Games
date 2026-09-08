/**
 * Bienen-Flow – reine Spiellogik (kein React, kein DOM).
 *
 * Ein Zug ist: obersten Block einer Spalte auf einen freien Platz schieben.
 * Danach arbeiten die Bienen, bis nichts mehr geht -- das ist der Teil, den
 * die Anzeige tröpfchenweise vorführt.
 */

import type { BienenBlock, BienenLevel, BienenState, CellColor } from './types'

const DIRS: readonly [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

function idx(row: number, col: number, cols: number): number {
  return row * cols + col
}

/**
 * Luft, an die eine Biene herankommt: leere Felder, die mit dem Rand
 * zusammenhängen. Eine eingeschlossene Lücke mitten im Bild zählt nicht --
 * sonst könnte man von innen heraus abtragen, und die Reihenfolge wäre egal.
 */
export function luftMaske(board: CellColor[], rows: number, cols: number): boolean[] {
  const luft: boolean[] = new Array(board.length).fill(false)
  const q: number[] = []
  const start = (i: number) => {
    if (board[i] === 0 && !luft[i]) {
      luft[i] = true
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
  return luft
}

/**
 * Welche Pixel zugänglich sind: die am Rand des Bildes und die, die an Luft
 * grenzen. Das Bild wird dadurch von außen nach innen abgetragen.
 */
export function zugaenglich(board: CellColor[], rows: number, cols: number): boolean[] {
  const luft = luftMaske(board, rows, cols)
  const frei: boolean[] = new Array(board.length).fill(false)
  for (let i = 0; i < board.length; i++) {
    if (board[i] === 0) continue
    const r = Math.floor(i / cols)
    const c = i % cols
    if (r === 0 || c === 0 || r === rows - 1 || c === cols - 1) {
      frei[i] = true
      continue
    }
    for (const [dr, dc] of DIRS) {
      if (luft[idx(r + dr, c + dc, cols)]) {
        frei[i] = true
        break
      }
    }
  }
  return frei
}

/**
 * In welcher Schälrunde eine Farbe zum ersten Mal zugänglich wird.
 *
 * Runde 0 heißt: liegt gleich zu Beginn frei. Je höher die Zahl, desto
 * länger wartet ein Block dieser Farbe auf seinem Platz. Der Levelbau
 * braucht das, um zu wissen, welche Blöcke den Weg versperren.
 */
export function schichtJeFarbe(
  bild: CellColor[],
  rows: number,
  cols: number,
): Map<CellColor, number> {
  const tiefe = new Map<CellColor, number>()
  const board = bild.slice()
  for (let runde = 0; runde < 500; runde++) {
    const frei = zugaenglich(board, rows, cols)
    let etwas = false
    for (let i = 0; i < board.length; i++) {
      if (!frei[i]) continue
      etwas = true
      if (!tiefe.has(board[i]!)) tiefe.set(board[i]!, runde)
    }
    if (!etwas) break
    for (let i = 0; i < board.length; i++) if (frei[i]) board[i] = 0
  }
  return tiefe
}

/** Farben, die gerade zugänglich sind. */
export function zugaenglicheFarben(state: BienenState): Set<CellColor> {
  const frei = zugaenglich(state.board, state.rows, state.cols)
  const out = new Set<CellColor>()
  for (let i = 0; i < frei.length; i++) if (frei[i]) out.add(state.board[i]!)
  return out
}

/** Wie viele Pixel einer Farbe noch im Bild liegen. */
export function pixelDerFarbe(state: BienenState, farbe: CellColor): number {
  let n = 0
  for (const c of state.board) if (c === farbe) n++
  return n
}

/** Ein einzelner Handgriff einer Biene – die Anzeige spielt sie nacheinander ab. */
export interface Schritt {
  zelle: number
  slot: number
  farbe: CellColor
}

/**
 * Eine Runde Bienenarbeit.
 *
 * Jeder arbeitsfähige Block holt genau einen Pixel, in der Reihenfolge
 * kleinste Restzahl zuerst -- Thomas' Regel: "wenn nur einer geht, hat immer
 * der mit der kleinsten Zahl als erstes weg gehend".
 *
 * Warum das in Runden läuft und nicht in einem Rutsch (07.09.2026): Vorher
 * arbeitete ein Block sofort komplett ab, und sein Platz war beim nächsten
 * Tipp längst wieder frei. Thomas: "wenn ich 2 anklicke, soll der 2. in die
 * 2. Wabe springen" -- genau das geht nur, wenn die Arbeit Zeit braucht und
 * die Blöcke solange auf ihren Plätzen liegen bleiben. Die Anzeige ruft
 * deshalb `tick` im Takt auf; jeder Tipp dazwischen legt seinen Block auf den
 * nächsten freien Platz.
 */
export function tick(state: BienenState): { state: BienenState; schritte: Schritt[] } {
  if (state.phase !== 'play') return { state, schritte: [] }

  const board = state.board.slice()
  const slots = state.slots.slice()
  const schritte: Schritt[] = []
  const frei = zugaenglich(board, state.rows, state.cols)

  const reihenfolge = slots
    .map((b, i) => ({ b, i }))
    .filter((x): x is { b: BienenBlock; i: number } => x.b != null)
    .sort((x, y) => x.b.amount - y.b.amount || x.i - y.i)

  for (const { b, i } of reihenfolge) {
    const zelle = naechsteZelle(frei, board, state.rows, state.cols, b.color)
    if (zelle < 0) continue
    board[zelle] = 0
    frei[zelle] = false
    const rest = b.amount - 1
    schritte.push({ zelle, slot: i, farbe: b.color })
    slots[i] = rest > 0 ? { ...b, amount: rest } : null
  }

  return { state: bewerte({ ...state, board, slots }), schritte }
}

/**
 * Welchen Pollen eine Biene als Nächstes holt: den, der dem Nest am nächsten
 * liegt -- also unten in der Mitte, wo die Ameisenstraße hinführt.
 *
 * Im Original (Video von Thomas, 07.09.2026) frisst sich die Kolonie von der
 * unteren Kante nach oben durch. Vorher nahm ich schlicht den ersten in
 * Leserichtung, und das Bild löste sich von oben links auf -- gegen die
 * Richtung, aus der die Bienen kommen.
 */
function naechsteZelle(
  frei: boolean[],
  board: CellColor[],
  rows: number,
  cols: number,
  farbe: CellColor,
): number {
  let beste = -1
  let besteEntfernung = Infinity
  const nestZeile = rows + 1.5
  const nestSpalte = (cols - 1) / 2
  for (let i = 0; i < board.length; i++) {
    if (!frei[i] || board[i] !== farbe) continue
    const r = Math.floor(i / cols)
    const c = i % cols
    const d = (nestZeile - r) ** 2 + (nestSpalte - c) ** 2
    if (d < besteEntfernung) {
      besteEntfernung = d
      beste = i
    }
  }
  return beste
}

/** Ob überhaupt noch eine Biene fliegen kann. */
export function arbeitMoeglich(state: BienenState): boolean {
  const frei = zugaenglich(state.board, state.rows, state.cols)
  for (const b of state.slots) {
    if (!b) continue
    if (frei.some((f, z) => f && state.board[z] === b.color)) return true
  }
  return false
}

/**
 * Phase und Zähler nachziehen.
 *
 * Verloren ist es, wenn alle Plätze belegt sind und keiner davon noch etwas
 * holen kann -- dann ändert sich nie wieder etwas, denn abtragen können nur
 * Blöcke auf Plätzen.
 */
function bewerte(state: BienenState): BienenState {
  const leer = state.board.every((c) => c === 0)
  const belegt = state.slots.reduce((n, s) => n + (s == null ? 0 : 1), 0)
  const tote = state.slots.reduce(
    (n, s) => n + (s != null && pixelDerFarbe(state, s.color) === 0 ? 1 : 0),
    0,
  )
  const klemmt = belegt >= state.slotCount && !arbeitMoeglich(state)
  return { ...state, tote, phase: leer ? 'won' : klemmt ? 'lost' : 'play' }
}

/** Arbeiten lassen, bis nichts mehr geht -- für Tests und den Löser. */
export function arbeiteAus(state: BienenState): { state: BienenState; schritte: Schritt[] } {
  let s = state
  const alle: Schritt[] = []
  for (let runde = 0; runde < 10_000; runde++) {
    const r = tick(s)
    if (r.schritte.length === 0) return { state: r.state, schritte: alle }
    alle.push(...r.schritte)
    s = r.state
    if (s.phase !== 'play') break
  }
  return { state: s, schritte: alle }
}

/**
 * Eine Runde aufsetzen.
 *
 * `zusatzPlaetze` ist der Bonus-Platz: Wer an einem Level zehnmal scheitert,
 * bekommt einen sechsten Platz und damit genau den Puffer, an dem es
 * gehakt hat. Die Regeln ändert er nicht -- nur die Zahl der Plätze.
 */
export function createMatch(level: BienenLevel, zusatzPlaetze = 0): BienenState {
  const plaetze = level.slotCount + Math.max(0, Math.floor(zusatzPlaetze))
  return {
    level: level.level,
    rows: level.rows,
    cols: level.cols,
    board: level.bild.slice(),
    spalten: level.spalten.map((s) => s.map((b) => ({ ...b }))),
    slots: Array.from({ length: plaetze }, () => null),
    slotCount: plaetze,
    colorCount: level.colorCount,
    phase: 'play',
    moves: 0,
    tote: 0,
  }
}

export function obersterBlock(state: BienenState, spalte: number): BienenBlock | null {
  return state.spalten[spalte]?.[0] ?? null
}

export function freieSlots(state: BienenState): number {
  let n = 0
  for (const s of state.slots) if (s == null) n++
  return n
}

export function kannTippen(state: BienenState, spalte: number): boolean {
  if (state.phase !== 'play') return false
  if (spalte < 0 || spalte >= state.spalten.length) return false
  if (!obersterBlock(state, spalte)) return false
  return freieSlots(state) > 0
}

/**
 * Ob ein Block überhaupt noch voll werden kann. Der Ring in der Anzeige
 * hängt daran: Wer mehr Kapazität hochschickt, als die Farbe noch hergibt,
 * verliert den Platz.
 */
export function passtNoch(state: BienenState, block: BienenBlock | null): boolean {
  if (!block) return false
  const imBild = pixelDerFarbe(state, block.color)
  const schonBestellt = state.slots.reduce(
    (n, s) => n + (s != null && s.color === block.color ? s.amount : 0),
    0,
  )
  return block.amount + schonBestellt <= imBild
}

export interface TapResult {
  state: BienenState
  slot: number
  block: BienenBlock
}

/**
 * Obersten Block einer Spalte auf den nächsten freien Platz schieben.
 *
 * Gearbeitet wird hier NICHT -- das übernimmt `tick`. So bleibt der Block
 * sichtbar auf seinem Platz liegen, und der nächste Tipp landet daneben.
 */
export function tapSpalte(state: BienenState, spalte: number): TapResult | null {
  if (!kannTippen(state, spalte)) return null
  const spalten = state.spalten.map((s) => s.map((b) => ({ ...b })))
  const block = spalten[spalte]!.shift()!
  const slots = state.slots.slice()
  const platz = slots.findIndex((s) => s == null)
  slots[platz] = block

  return {
    state: bewerte({ ...state, spalten, slots, moves: state.moves + 1 }),
    slot: platz,
    block,
  }
}

/** Was die Anzeige zeigen darf: die obersten drei Reihen. */
export function sichtbareSpalten(state: BienenState, tiefe: number): BienenBlock[][] {
  return state.spalten.map((s) => s.slice(0, tiefe))
}

export function verdeckteBloecke(state: BienenState, tiefe: number): number {
  return state.spalten.reduce((n, s) => n + Math.max(0, s.length - tiefe), 0)
}

export function restPixel(state: BienenState): number {
  return state.board.reduce((n, c) => n + (c === 0 ? 0 : 1), 0)
}

export function isWon(state: BienenState): boolean {
  return state.phase === 'won'
}

export function isLost(state: BienenState): boolean {
  return state.phase === 'lost'
}
