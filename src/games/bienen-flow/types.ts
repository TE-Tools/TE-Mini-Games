/**
 * Bienen-Flow – Colony-Flow-Klon mit Bienen statt Ameisen.
 *
 * Die Mechanik steht seit dem 07.09.2026 so da, wie Thomas sie am echten
 * Spiel abgelesen hat (Bildschirmfotos aus Level 254):
 *
 *   - Oben ein Pixelbild, das gefüllt werden will. Jede Farbe darin braucht
 *     genau so viele Pollen, wie sie Pixel hat.
 *   - Unten der Nachschub: Blöcke mit einer Farbe UND einer Anzahl, in vier
 *     Spalten gestapelt. Nur der oberste Block jeder Spalte lässt sich
 *     antippen; darunter wartet der Rest abgedunkelt.
 *   - Dazwischen fünf Plätze. Ein angetippter Block wandert dorthin, die
 *     Bienen tragen seine Pollen ins Bild, die Zahl zählt herunter. Bei null
 *     verschwindet der Block und gibt den Platz frei.
 *   - Es muss exakt aufgehen. Schickt man mehr Pollen einer Farbe hoch, als
 *     das Bild noch braucht, bleibt der Rest im Block liegen -- dieser Platz
 *     ist für den Rest des Levels verloren.
 *   - Sind alle fünf Plätze so verstopft, ist das Level verloren.
 *
 * Die Vorgänger-Fassungen lagen daneben: erst räumte ein Platz eine ganze
 * Farbe vom Brett (nachgemessen 100 von 100 Leveln gewonnen), dann baute ich
 * ein Dreier-Verschmelzen ein, das es im Original gar nicht gibt.
 */

export type CellColor = number // 0 = kein Pixel, 1..N Farben

/** Ein Block aus dem Nachschub: Farbe plus Anzahl Pollen. */
export interface BienenBlock {
  id: string
  color: CellColor
  /** Wie viele Pollen noch drin sind. */
  amount: number
}

export interface BienenLevel {
  level: number
  /** Name des Motivs, für die Anzeige. */
  motiv: string
  rows: number
  cols: number
  /** rows*cols flach, zeilenweise; 0 = gehört nicht zum Bild. */
  bild: CellColor[]
  /** Nachschub als Spalten; Index 0 jeder Spalte liegt oben und ist antippbar. */
  spalten: BienenBlock[][]
  slotCount: number
  colorCount: number
  isGate: boolean
  label: string
}

export type BienenPhase = 'map' | 'play' | 'won' | 'lost'

export interface BienenState {
  level: number
  rows: number
  cols: number
  /** Das Bild, wie es gerade aussieht: 0 = noch offen, sonst gefüllte Farbe. */
  gefuellt: CellColor[]
  /** Das Ziel-Bild -- ändert sich nie. */
  bild: CellColor[]
  /** Offene Pixel je Farbe (1-basiert: index 0 bleibt leer). */
  offen: number[]
  spalten: BienenBlock[][]
  /** Fünf Plätze; null = frei. */
  slots: (BienenBlock | null)[]
  slotCount: number
  colorCount: number
  phase: 'play' | 'won' | 'lost'
  /** Angetippte Blöcke. */
  moves: number
  /** Blöcke, die nicht mehr leer werden können -- jeder kostet einen Platz. */
  verstopft: number
}

export const BIENEN_MAX_LEVEL = 100

/** So viele Plätze hat die Kolonie. Im Original sind es fünf. */
export const SLOT_COUNT = 5

/** So viele Spalten hat der Nachschub. */
export const SPALTEN = 4

/**
 * So tief sieht man in den Nachschub hinein.
 *
 * Thomas am 07.09.2026: "die Blöcke rücken nach oben nach, man sieht nicht
 * alle." Genau deshalb kann man ein Level nicht am Anfang durchrechnen --
 * und genau deshalb sagen alle Anleitungen zum Original, man solle immer
 * einen Platz frei halten. Ohne diese Grenze wäre das Spiel eine
 * Rechenaufgabe mit vollständiger Information.
 */
export const SICHTBARE_REIHEN = 3

export const COLOR_HEX: readonly string[] = [
  '#000000', // 0 unbenutzt
  '#e74c3c', // rot
  '#3498db', // blau
  '#2ecc71', // grün
  '#f1c40f', // gelb
  '#9b59b6', // lila
  '#e67e22', // orange
  '#1abc9c', // türkis
  '#ec7fa9', // rosa
  '#4a4458', // dunkel
  '#f5f2e8', // hell
]
