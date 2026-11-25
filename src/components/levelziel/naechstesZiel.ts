/**
 * Das nächste Ziel nach einer Runde -- eine Zeile, die sagt, wie nah das
 * Nächste ist (Thomas, 25.11.2026: "dass man mehr gebunden wird an die
 * Spiele").
 *
 * Reine Rechnung aus dem, was das Spiel ohnehin weiß: Level, Punkte, der
 * bisherige Rekord und die Sternschwellen. Hier wird nichts gewertet und
 * keine Schwelle festgelegt -- die Sterne kommen als Funktion aus dem Spiel
 * (`calculateStars`), dieses Modul fragt sie nur ab. Den Satz baut die
 * Komponente aus dem Wörterbuch; hier entsteht nur die Art samt Zahlen.
 */

export type LevelZiel =
  /** Das letzte Level der Strecke ist geschafft. */
  | { art: 'allesGeschafft'; maxLevel: number }
  /** Mehr Punkte als der bisherige Rekord dieses Levels. */
  | { art: 'neuerRekord'; um: number }
  /** Den Rekord dieses Levels knapp nicht erreicht. */
  | { art: 'rekordVerpasst'; fehlend: number }
  /** So viele Punkte mehr, und es gäbe so viele Sterne. */
  | { art: 'sterne'; fehlend: number; sterne: number }
  /** Mit diesem Level ist das Tor des Abschnitts offen. */
  | { art: 'torOffen' }
  /** So viele Level noch bis zum nächsten Tor. */
  | { art: 'bisZumTor'; level: number }
  /** Die perfekte Sekunde: so knapp außerhalb der Toleranz. */
  | { art: 'knapp'; sekunden: number }

export interface NaechsterStern {
  /** So viele Punkte fehlen. */
  fehlend: number
  /** So viele Sterne gäbe es dann. */
  sterne: number
}

export interface ZielEingabe {
  /** Das gespielte Level, innerhalb der Strecke gezählt (Sudoku: Stufe 1–50). */
  level: number
  /** Letztes Level der Strecke. */
  maxLevel: number
  /** Level geschafft, das nächste ist frei. */
  geschafft: boolean
  /** Alle so viele Level steht ein Tor (Levelkarte: 20, Sudoku: 10). */
  abschnitt?: number
  /** Punkte dieser Runde. */
  punkte?: number
  /** Rekord dieses Levels VOR dieser Runde; `null`, wenn es noch keinen gab. */
  bisherBest?: number | null
  /** Der nächste Stern, aus `punkteBisNaechsterStern`. */
  naechsterStern?: NaechsterStern | null
  /** Mit Hilfe aus einem Video: keine Rekord- und keine Sternzeile. */
  mitHilfe?: boolean
  /** Nur Die perfekte Sekunde: so viele Sekunden lag der Fehlversuch außerhalb. */
  daneben?: number | null
  /**
   * Nur Die perfekte Sekunde: die Toleranz des Levels. "Knapp" heißt es nur,
   * solange der Fehlversuch höchstens eine Toleranz weiter daneben lag --
   * eine Sekunde zu früh ist nicht "fast".
   */
  toleranz?: number
}

/** Ab welcher Lücke "Rekord verpasst" nicht mehr knapp ist, sondern entmutigt. */
export const KNAPP_ANTEIL = 0.25

/**
 * Die kleinste Punktzahl über `punkte`, die mehr Sterne bringt -- als
 * Abstand samt Sternzahl. `null`, wenn es schon die meisten Sterne sind oder
 * bis `obergrenze` keiner mehr kommt (etwa weil das Spiel dort deckelt).
 *
 * Die Sternfunktion muss mit den Punkten steigen, das tun alle Spiele hier.
 * Gesucht wird halbierend, sie wird also nur ein paar Dutzend Mal gefragt.
 */
export function punkteBisNaechsterStern(
  sterneVon: (punkte: number) => number,
  punkte: number,
  obergrenze: number,
  maxSterne = 5,
): NaechsterStern | null {
  const jetzt = sterneVon(punkte)
  if (jetzt >= maxSterne) return null
  const ab = Math.floor(punkte)
  const bis = Math.floor(obergrenze)
  if (bis <= ab || sterneVon(bis) <= jetzt) return null
  let lo = ab
  let hi = bis
  while (hi - lo > 1) {
    const mitte = Math.floor((lo + hi) / 2)
    if (sterneVon(mitte) > jetzt) hi = mitte
    else lo = mitte
  }
  return { fehlend: hi - punkte, sterne: sterneVon(hi) }
}

/** Level bis zum nächsten Tor -- das gespielte mitgezählt, wenn es nicht geschafft ist. */
function levelBisTor(level: number, maxLevel: number, abschnitt: number, geschafft: boolean) {
  const tor = Math.min(maxLevel, Math.ceil(level / abschnitt) * abschnitt)
  return tor - level + (geschafft ? 0 : 1)
}

/**
 * Welche eine Zeile nach dieser Runde dasteht. Reihenfolge, wenn mehreres
 * stimmt: am Ende der Strecke -> neuer Rekord -> Rekord knapp verpasst ->
 * Punkte bis zum nächsten Stern -> Tor offen -> Level bis zum Tor.
 * Nicht geschafft: knapp daneben (Sekunde) -> Level bis zum Tor.
 */
export function naechstesZiel(e: ZielEingabe): LevelZiel {
  const abschnitt = Math.max(1, Math.floor(e.abschnitt ?? 20))
  const maxLevel = Math.max(1, Math.floor(e.maxLevel))
  const level = Math.max(1, Math.min(maxLevel, Math.floor(e.level)))

  if (!e.geschafft) {
    const knapp =
      e.daneben != null && e.daneben > 0 && (e.toleranz == null || e.daneben <= e.toleranz)
    if (knapp) return { art: 'knapp', sekunden: e.daneben! }
    return { art: 'bisZumTor', level: levelBisTor(level, maxLevel, abschnitt, false) }
  }

  if (level >= maxLevel) return { art: 'allesGeschafft', maxLevel }

  const punkte = e.punkte ?? 0
  const zaehlt = e.mitHilfe !== true && punkte > 0
  if (zaehlt && e.bisherBest != null && e.bisherBest > 0) {
    if (punkte > e.bisherBest) return { art: 'neuerRekord', um: punkte - e.bisherBest }
    const fehlend = e.bisherBest - punkte
    if (fehlend > 0 && fehlend <= e.bisherBest * KNAPP_ANTEIL) {
      return { art: 'rekordVerpasst', fehlend }
    }
  }

  const stern = e.naechsterStern
  if (zaehlt && stern != null && stern.fehlend > 0) {
    return { art: 'sterne', fehlend: stern.fehlend, sterne: stern.sterne }
  }

  if (level % abschnitt === 0) return { art: 'torOffen' }
  return { art: 'bisZumTor', level: levelBisTor(level, maxLevel, abschnitt, true) }
}
