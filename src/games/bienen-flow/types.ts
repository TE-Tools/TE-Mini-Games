/**
 * Bienen-Flow – Colony-Flow-Klon mit Bienen statt Ameisen.
 *
 * Umgebaut am 06.09.2026: Vorher tippte man unten Pollen-Stapel an, und ein
 * Slot saugte damit eine ganze Farbe vom Brett. Nachgemessen war das kein
 * Spiel -- ein Löser gewann alle 100 Level, Level 1 in zwei, Level 100 in
 * acht Tipps, verlieren war praktisch unmöglich. Jetzt wie im Original:
 * Man tippt einen erreichbaren Pollen auf dem Brett an, die Biene trägt
 * genau diesen einen in die Wabenleiste, und drei gleiche Farben in der
 * Leiste verschmelzen. Volle Leiste ohne Dreier heißt verloren.
 */

export type CellColor = number // 0 = leer, 1..N Farben

export interface BienenLevel {
  level: number
  rows: number
  cols: number
  /** rows*cols flach, zeilenweise; 0 = leer */
  board: CellColor[]
  /** Plätze in der Wabenleiste */
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
  /**
   * Wabenleiste. Belegte Plätze stehen links, nach Farbe gruppiert -- so
   * liegen die Kandidaten für einen Dreier immer nebeneinander.
   */
  slots: (CellColor | null)[]
  slotCount: number
  colorCount: number
  phase: 'play' | 'won' | 'lost'
  /** Getippte Pollen. Beim Sieg immer gleich der Zahl der Pollen. */
  moves: number
  /**
   * Wie voll die Leiste im schlimmsten Moment war (nach dem Verschmelzen).
   * Das ist das eigentliche Maß für sauberes Spiel: Wer immer gleich Dreier
   * schließt, kommt nie über zwei. Die Zahl der Züge taugt dafür nicht --
   * jeder Pollen muss genau einmal angetippt werden, sie ist also für alle
   * gleich.
   */
  peakSlots: number
}

export const BIENEN_MAX_LEVEL = 100

/** So viele gleiche Pollen in der Leiste verschmelzen zu Honig. */
export const MERGE_COUNT = 3

export const COLOR_HEX: readonly string[] = [
  '#000000', // 0 unbenutzt
  '#e74c3c', // rot
  '#3498db', // blau
  '#2ecc71', // grün
  '#f1c40f', // gelb
  '#9b59b6', // lila
  '#e67e22', // orange
  '#1abc9c', // türkis
  '#e91e63', // pink
]
