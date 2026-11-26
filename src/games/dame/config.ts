/**
 * Dame – alle Stellwerte an einer Stelle.
 *
 * Gespielt wird die deutsche Dame (Regeln in docs/design/dame/README.md).
 * Was eine Hausregel ist, steht hier als Daten in `DameRegeln` -- der
 * Zuggenerator (`brett.ts`) liest sie, statt Sonderfälle zu kennen. Eine
 * laufende Partie trägt ihre Regeln im Zustand mit (`Partie.regeln`), so
 * wie die Mau-Mau-Hausregeln: Wer mitten in der Partie die Voreinstellung
 * ändert, ändert nicht die Partie.
 */

export type DameStufe = 'leicht' | 'mittel' | 'schwer'

export interface DameRegeln {
  /** Wer schlagen kann, muss schlagen. Aus: Schlagen ist erlaubt, aber frei. */
  schlagzwang: boolean
  /**
   * Unter mehreren Schlagfolgen muss die genommen werden, die die meisten
   * Steine schlägt. Aus (Voreinstellung): freie Wahl.
   */
  mehrheitsschlag: boolean
  /** Die Dame zieht und schlägt beliebig weit. Aus: nur ein Feld, wie ein Stein. */
  fliegendeDame: boolean
  /** Steine schlagen auch rückwärts. Aus: nur vorwärts. */
  steinSchlaegtRueckwaerts: boolean
}

/** Die deutsche Dame, wie sie im Verein gespielt wird. */
export const STANDARD_REGELN: DameRegeln = {
  schlagzwang: true,
  mehrheitsschlag: false,
  fliegendeDame: true,
  steinSchlaegtRueckwaerts: true,
}

/** Die Hausregeln in der Reihenfolge, in der das Menü sie zeigt. */
export const HAUSREGELN: readonly (keyof DameRegeln)[] = [
  'schlagzwang',
  'fliegendeDame',
  'steinSchlaegtRueckwaerts',
  'mehrheitsschlag',
]

/**
 * Regeln aus einer unsicheren Quelle (Gerätespeicher, Server) lesen. Was
 * fehlt oder kein Wahrheitswert ist, bekommt die Voreinstellung -- eine
 * Partie bricht nie an einem kaputten Regelsatz ab.
 */
export function regelnAus(roh: unknown): DameRegeln {
  const r = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>
  const wert = (k: keyof DameRegeln) =>
    typeof r[k] === 'boolean' ? (r[k] as boolean) : STANDARD_REGELN[k]
  return {
    schlagzwang: wert('schlagzwang'),
    mehrheitsschlag: wert('mehrheitsschlag'),
    fliegendeDame: wert('fliegendeDame'),
    steinSchlaegtRueckwaerts: wert('steinSchlaegtRueckwaerts'),
  }
}

/** Wann eine Partie von selbst Remis ist. */
export const REMIS = {
  /** So oft dieselbe Stellung mit derselben Seite am Zug. */
  wiederholungen: 3,
  /**
   * So viele Halbzüge ohne Schlagen und ohne Steinzug -- 25 Züge je Seite,
   * in denen nur Damen hin- und herziehen.
   */
  halbzuegeOhneFortschritt: 50,
} as const

/**
 * Die drei Stufen des Computers. Sie unterscheiden sich nicht im Wissen,
 * sondern darin, wie weit er vorausschaut und wie sehr er sich verschätzt:
 *
 * - **leicht** schaut einen Halbzug weit und sieht nicht, was danach
 *   zurückgeschlagen wird. Dazu verschätzt er sich kräftig und zieht ab und
 *   zu irgendetwas. Man kann ihm Steine abnehmen -- so soll es sein.
 * - **mittel** schaut vier Halbzüge weit und rechnet Schlagfolgen zu Ende.
 *   Einfache Fallen sieht er, lange Pläne nicht.
 * - **schwer** schaut so weit, wie er in gut einer Sekunde kommt (auf dem
 *   Handy meist acht bis zwölf Halbzüge), ohne sich zu verschätzen.
 */
export interface StufenWerte {
  /** Wie viele Halbzüge weit gerechnet wird -- bei schwer: höchstens. */
  tiefe: number
  /** Schlagfolgen am Ende zu Ende rechnen (Ruhesuche). */
  ruhesuche: boolean
  /** So weit (in Hundertstel Steinen) darf er sich je Zug verschätzen. */
  rauschen: number
  /** So oft zieht er einfach irgendeinen erlaubten Zug. */
  zufall: number
  /** Bedenkzeit in Millisekunden; bei leicht und mittel ohne Belang. */
  zeitMs: number
  /** Darf man gegen diese Stufe Züge zurücknehmen? Wie beim Schach nur bei leicht. */
  zuruecknehmen: boolean
}

export const STUFEN: Record<DameStufe, StufenWerte> = {
  leicht: {
    tiefe: 1,
    ruhesuche: false,
    rauschen: 90,
    zufall: 0.3,
    zeitMs: 1000,
    zuruecknehmen: true,
  },
  mittel: {
    tiefe: 4,
    ruhesuche: true,
    rauschen: 12,
    zufall: 0,
    zeitMs: 1000,
    zuruecknehmen: false,
  },
  schwer: {
    tiefe: 40,
    ruhesuche: true,
    rauschen: 0,
    zufall: 0,
    zeitMs: 1100,
    zuruecknehmen: false,
  },
}

/** Die Bewertung einer Stellung, in Hundertstel Steinen. */
export const WERTE = {
  stein: 100,
  /** Eine fliegende Dame ist viel stärker als eine, die nur ein Feld geht. */
  dame: 320,
  dameKurz: 220,
  /** Je Reihe, die ein Stein vorgerückt ist. Kurz vor der Umwandlung mehr. */
  vorruecken: [0, 0, 3, 6, 10, 16, 24, 0],
  /** Ein Stein oder eine Dame auf einem der acht Mittelfelder. */
  mitte: 6,
  /** Ein Stein auf der eigenen Grundreihe hält dem Gegner die Umwandlung zu. */
  rueckreihe: 10,
  /** Liegt man vorn, ist jeder Tausch gut: Wert je fehlendem Stein auf dem Brett. */
  tauschen: 4,
} as const

/**
 * Was eine Partie wert ist -- für Verlauf, XP und Bilanz. Ein Sieg gegen
 * einen stärkeren Gegner zählt mehr; zu zweit an einem Gerät gibt es einen
 * festen Betrag, denn dort gewinnt immer einer von beiden am selben Gerät.
 */
export const PUNKTE = {
  sieg: { leicht: 80, mittel: 160, schwer: 320, online: 240 },
  /** Remis ist die Hälfte eines Siegs. */
  remisAnteil: 0.5,
  niederlage: 10,
  zuZweit: 40,
} as const

/** Unter diesem Schlüssel liegt eine unterbrochene Partie im Gerät. */
export const SPEICHER_SCHLUESSEL = 'te-dame-partie'
/** Die zuletzt gewählten Hausregeln. */
export const REGELN_SCHLUESSEL = 'te-dame-regeln'
