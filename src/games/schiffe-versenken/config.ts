/**
 * Schiffe versenken – alle Stellwerte an einer Stelle.
 *
 * Gespielt wird auf zwei Meeren zu 10 × 10 Feldern. Die Flotte ist Daten
 * (`FLOTTE`), keine Annahme im Ablauf: Wer eine andere Flotte will, ändert
 * sie hier -- und in der SQL-Fassung (Migration 035, `sv_flotte_def`), die
 * `scripts/pruefe-schiffe-sql.mjs` dagegen nachrechnet.
 *
 * Was eine Hausregel ist, steht als Daten in `SchiffeRegeln`. Eine laufende
 * Partie trägt ihre Regeln im Zustand mit (`Partie.regeln`) -- wer mitten in
 * der Partie die Voreinstellung im Menü ändert, ändert nicht die Partie.
 */

/** Kantenlänge eines Meeres. */
export const GROESSE = 10

export type SchiffId = 'traeger' | 'kreuzer' | 'fregatte' | 'korvette' | 'schnellboot'

export interface SchiffArt {
  id: SchiffId
  laenge: number
}

/**
 * Die Flotte: ein Fünfer, ein Vierer, zwei Dreier, ein Zweier -- 17 Felder.
 * Das ist die Verteilung, die man vom Karopapier kennt; sie lässt auf 100
 * Feldern auch mit der Regel „nicht berühren" immer genug Platz.
 * Die Namen sind Schiffsgattungen, keine Namen eines Handelsprodukts.
 */
export const FLOTTE: readonly SchiffArt[] = [
  { id: 'traeger', laenge: 5 },
  { id: 'kreuzer', laenge: 4 },
  { id: 'fregatte', laenge: 3 },
  { id: 'korvette', laenge: 3 },
  { id: 'schnellboot', laenge: 2 },
]

export type SchiffeStufe = 'leicht' | 'mittel' | 'schwer'

export interface SchiffeRegeln {
  /**
   * Schiffe dürfen sich nicht berühren -- auch nicht über Eck. Dann liegt
   * um jedes Schiff ein Rand aus Wasser, und wer ein Schiff versenkt hat,
   * weiß, wo keines mehr liegen kann.
   */
  nichtBeruehren: boolean
  /** Wer trifft, schießt gleich noch einmal. Aus: Nach jedem Schuss ist der andere dran. */
  nochmalNachTreffer: boolean
}

export const STANDARD_REGELN: SchiffeRegeln = {
  nichtBeruehren: true,
  nochmalNachTreffer: false,
}

/** Die Hausregeln in der Reihenfolge, in der das Menü sie zeigt. */
export const HAUSREGELN: readonly (keyof SchiffeRegeln)[] = ['nichtBeruehren', 'nochmalNachTreffer']

/**
 * Regeln aus einer unsicheren Quelle (Gerätespeicher, Server) lesen. Was
 * fehlt oder kein Wahrheitswert ist, bekommt die Voreinstellung.
 */
export function regelnAus(roh: unknown): SchiffeRegeln {
  const r = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>
  const wert = (k: keyof SchiffeRegeln) =>
    typeof r[k] === 'boolean' ? (r[k] as boolean) : STANDARD_REGELN[k]
  return {
    nichtBeruehren: wert('nichtBeruehren'),
    nochmalNachTreffer: wert('nochmalNachTreffer'),
  }
}

/**
 * Die drei Stufen des Computers. Er sieht nie die fremde Flotte, nur was
 * jeder Spieler sieht: seine Schüsse und was dabei herauskam.
 *
 * - **leicht** schießt meist irgendwohin. Hat er etwas getroffen, sucht er
 *   nur manchmal daneben weiter (`nachsetzen`).
 * - **mittel** jagt: nach einem Treffer die Nachbarn, nach zweien die Linie
 *   entlang, bis das Schiff sinkt. Sonst schießt er im Schachbrettmuster und
 *   lässt den Rand versenkter Schiffe aus, wenn sie sich nicht berühren dürfen.
 * - **schwer** legt über alle Lagen, die die übrigen Schiffe noch haben
 *   können, eine Wahrscheinlichkeitskarte und schießt aufs wahrscheinlichste Feld.
 */
export interface StufenWerte {
  /** Wie oft er nach einem offenen Treffer daneben weitersucht (0 bis 1). Nur leicht. */
  nachsetzen: number
  /** Schachbrettmuster beim Suchen. */
  muster: boolean
}

export const STUFEN: Record<SchiffeStufe, StufenWerte> = {
  leicht: { nachsetzen: 0.45, muster: false },
  mittel: { nachsetzen: 1, muster: true },
  schwer: { nachsetzen: 1, muster: true },
}

/**
 * Bei „schwer": Wie stark eine Lage zählt, die offene Treffer abdeckt. Je
 * Treffer wird mit diesem Faktor multipliziert -- eine Lage durch zwei
 * Treffer zählt also hundertmal so viel wie eine ins Leere.
 */
export const TREFFER_GEWICHT = 10

/**
 * Was eine Partie wert ist. Ein Sieg gegen einen stärkeren Gegner zählt
 * mehr. Wer knapp verliert, bekommt etwas für die versenkten Schiffe.
 */
export const PUNKTE = {
  sieg: { leicht: 60, mittel: 120, schwer: 240, online: 200 },
  /** Für jedes versenkte gegnerische Schiff, auch in einer verlorenen Partie. */
  jeVersenktem: 4,
  niederlage: 10,
} as const

/** Wie lange der Computer mindestens „zielt", nachdem die eigene Rakete eingeschlagen ist. */
export const DENKZEIT_MS = 650

/** Unter diesem Schlüssel liegt eine unterbrochene Partie im Gerät. */
export const SPEICHER_SCHLUESSEL = 'te-schiffe-partie'
/** Die zuletzt gewählten Hausregeln. */
export const REGELN_SCHLUESSEL = 'te-schiffe-regeln'
