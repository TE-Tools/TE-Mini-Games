/**
 * Bienen-Flow – Colony-Flow-Klon mit Bienen statt Ameisen.
 *
 * Die Regeln, wie Thomas sie am Original abgelesen und am 07.09.2026
 * bestätigt hat:
 *
 *   - Oben liegt ein Pixelbild, von Anfang an vollständig. Es wird
 *     ABGETRAGEN, nicht gefüllt. Leer heißt gewonnen.
 *   - Geholt werden kann nur, was zugänglich ist: Ein Pixel am Rand oder an
 *     einer Stelle, die schon leer ist und mit dem Rand zusammenhängt.
 *     Alles, was eingeschlossen liegt, ist verdeckt.
 *   - Unten der Nachschub in vier Spalten. Nehmen kann man nur den obersten
 *     Block jeder Spalte; von unten rückt nach, und sichtbar sind drei
 *     Reihen -- darunter warten mehr, die man nicht sieht.
 *   - Ein Block hat eine Farbe und eine Zahl: seine Restkapazität. Auf einen
 *     der fünf Plätze geschoben, holen die Bienen tröpfchenweise zugängliche
 *     Pixel dieser Farbe; jeder senkt die Zahl um eins. Bei null ist der
 *     Block voll und gibt den Platz frei.
 *   - Mehrere Blöcke derselben Farbe arbeiten gleichzeitig. Ist nur ein
 *     Pixel zu holen, bekommt es der Block mit der kleinsten Zahl.
 *   - Ein Block, dessen Farbe gerade nirgends zugänglich ist, wartet -- und
 *     macht weiter, sobald ringsum abgetragen wurde.
 *   - Verloren: alle fünf Plätze belegt und keine dieser Farben zugänglich.
 *   - Es muss genau aufgehen: Die Blöcke einer Farbe fassen zusammen genau
 *     so viele Pixel, wie das Bild von ihr hat. Ein Block zu viel wird nie
 *     voll und belegt seinen Platz bis zum Schluss.
 *
 * Zwei Fassungen davor lagen daneben (ein Platz räumte eine ganze Farbe ab;
 * dann Dreier-Verschmelzen; dann das Bild füllen statt abtragen). Deshalb
 * steht die Herleitung hier und nicht nur im Commit.
 */

export type CellColor = number // 0 = abgetragen/kein Pixel, 1..N Farben

/** Ein Block aus dem Nachschub: Farbe plus Restkapazität. */
export interface BienenBlock {
  id: string
  color: CellColor
  /** Wie viele Pixel er noch aufnehmen kann. Bei 0 ist er voll. */
  amount: number
}

export interface BienenLevel {
  level: number
  motiv: string
  rows: number
  cols: number
  /** rows*cols flach, zeilenweise; 0 = dort war nie ein Pixel. */
  bild: CellColor[]
  /** Nachschub als Spalten; Index 0 liegt oben und ist antippbar. */
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
  /** Das Bild, wie es gerade aussieht; 0 = abgetragen. */
  board: CellColor[]
  spalten: BienenBlock[][]
  /** Fünf Plätze; null = frei. */
  slots: (BienenBlock | null)[]
  slotCount: number
  colorCount: number
  phase: 'play' | 'won' | 'lost'
  /** Wie oft ein Block hochgeschoben wurde. */
  moves: number
  /** Blöcke auf Plätzen, deren Farbe es im Bild nicht mehr gibt. */
  tote: number
}

/**
 * 300 Level, in 15 Abschnitten zu je 20 (jeder zwanzigste ist ein Tor).
 *
 * Angefangen hatte es mit zehn zum Anspielen; nachdem die Mechanik stimmte,
 * hat Thomas am 07.09.2026 auf 300 aufgestockt.
 */
export const BIENEN_MAX_LEVEL = 300

/** So viele Plätze hat die Kolonie. Im Original sind es fünf. */
export const SLOT_COUNT = 5

/** So viele Spalten hat der Nachschub. */
export const SPALTEN = 4

/** So tief sieht man hinein -- darunter rückt Unbekanntes nach. */
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
  '#dfe7ee', // hell (kühl, damit es sich vom warmen Grund abhebt)
]
