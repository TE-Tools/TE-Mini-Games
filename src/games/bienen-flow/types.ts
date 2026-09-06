/** Bienen-Flow – Colony-Flow-Klon mit Bienen statt Ameisen. */

export type CellColor = number // 0 = leer, 1..N Farben

export interface BienenLevel {
  level: number
  rows: number
  cols: number
  /** rows*cols flat, row-major; 0 = empty */
  board: CellColor[]
  /** Warteschlange unten: Farbe pro Stapel (ein Tipp = eine Farbe) */
  tray: CellColor[]
  slotCount: number
  /** Anzahl unterschiedlicher Farben (1-basiert max) */
  colorCount: number
  /** true = Segment-Tor (20, 40, … 100) */
  isGate: boolean
  label: string
}

export type BienenPhase = 'map' | 'play' | 'won' | 'lost'

export interface BienenState {
  level: number
  rows: number
  cols: number
  board: CellColor[]
  tray: CellColor[]
  /** Belegte Slots (Farbe) – Länge = slotCount, null = frei */
  slots: (CellColor | null)[]
  slotCount: number
  colorCount: number
  phase: 'play' | 'won' | 'lost'
  moves: number
}

export const BIENEN_MAX_LEVEL = 100

export const COLOR_HEX: readonly string[] = [
  '#000000', // 0 unused
  '#e74c3c', // rot
  '#3498db', // blau
  '#2ecc71', // grün
  '#f1c40f', // gelb
  '#9b59b6', // lila
  '#e67e22', // orange
  '#1abc9c', // türkis
  '#e91e63', // pink
]
