/**
 * Schach – alle Stellwerte an einer Stelle.
 *
 * Die drei Stufen des Computers unterscheiden sich nicht im Wissen, sondern
 * darin, wie weit er vorausschaut und wie sehr er sich verschätzen darf:
 *
 * - **leicht** schaut einen Halbzug weit und sieht nicht, was danach
 *   zurückgeschlagen wird. Er nimmt deshalb gern eine gedeckte Figur mit
 *   der Dame -- so verliert man am Anfang auch gegen Menschen. Dazu
 *   verschätzt er sich ein wenig und zieht ab und zu einfach irgendetwas.
 * - **mittel** schaut zwei Halbzüge weit und rechnet Schlagabtausche zu
 *   Ende. Er stellt nichts mehr ein, plant aber nicht.
 * - **schwer** schaut so weit, wie er in gut einer Sekunde kommt (meist
 *   vier bis sechs Halbzüge), ohne sich zu verschätzen.
 */

export type SchachStufe = 'leicht' | 'mittel' | 'schwer'

export interface StufenWerte {
  /** Wie viele Halbzüge weit gerechnet wird -- bei schwer: höchstens. */
  tiefe: number
  /** Schlagabtausche am Ende zu Ende rechnen (Ruhesuche). */
  ruhesuche: boolean
  /** So weit (in Hundertstel Bauern) darf er sich je Zug verschätzen. */
  rauschen: number
  /** So oft zieht er einfach irgendeinen erlaubten Zug. */
  zufall: number
  /** Bedenkzeit; bei leicht und mittel ohne Belang, die sind schneller. */
  zeitMs: number
}

export const STUFEN: Record<SchachStufe, StufenWerte> = {
  leicht: { tiefe: 1, ruhesuche: false, rauschen: 90, zufall: 0.2, zeitMs: 2000 },
  mittel: { tiefe: 2, ruhesuche: true, rauschen: 25, zufall: 0, zeitMs: 2000 },
  schwer: { tiefe: 6, ruhesuche: true, rauschen: 0, zufall: 0, zeitMs: 1200 },
}

/** Figurenwerte in Hundertstel Bauern. */
export const WERTE = [0, 100, 320, 330, 500, 900, 0]

/**
 * Was eine Partie wert ist -- für Verlauf, XP und Bestwert. Ein Sieg gegen
 * einen stärkeren Gegner zählt mehr. Auch eine Niederlage bringt etwas:
 * Eine glatte Null nimmt dem Abend den Rest.
 */
export const PUNKTE = {
  sieg: { leicht: 100, mittel: 200, schwer: 400, online: 300 },
  /** Remis ist die Hälfte eines Siegs. */
  remisAnteil: 0.5,
  niederlage: 10,
} as const

/** Nach so vielen Zügen wird eine unterbrochene Partie gegen den Rechner gespeichert. */
export const SPEICHER_SCHLUESSEL = 'te-schach-partie'
