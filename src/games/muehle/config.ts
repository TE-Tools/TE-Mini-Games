/**
 * Mühle – alle Stellwerte an einer Stelle.
 *
 * Gespielt wird die deutsche Standardmühle (Regeln in
 * docs/design/muehle/README.md). Was eine Hausregel ist, steht hier als
 * Daten in `MuehleRegeln` -- der Zuggenerator (`brett.ts`) liest sie, statt
 * Spielarten zu kennen. Eine laufende Partie trägt ihre Regeln im Zustand
 * mit (`Partie.regeln`), wie bei Dame: Wer mitten in der Partie die
 * Voreinstellung ändert, ändert nicht die Partie.
 */

export type MuehleStufe = 'leicht' | 'mittel' | 'schwer'

export interface MuehleRegeln {
  /**
   * Wer nur noch drei Steine hat, darf springen: einen Stein auf jeden
   * freien Punkt setzen. Aus: auch mit drei Steinen nur entlang der Linien.
   */
  springen: boolean
  /**
   * Steine in einer geschlossenen Mühle dürfen immer geschlagen werden.
   * Aus (Voreinstellung): nur, wenn alle gegnerischen Steine in Mühlen stehen.
   */
  schlagenAusMuehle: boolean
  /**
   * Wer mit einem Stein zwei Mühlen auf einmal schließt, schlägt zwei
   * Steine. Aus (Voreinstellung): einen.
   */
  doppelSchlag: boolean
}

/** Die deutsche Standardmühle. */
export const STANDARD_REGELN: MuehleRegeln = {
  springen: true,
  schlagenAusMuehle: false,
  doppelSchlag: false,
}

/** Die Hausregeln in der Reihenfolge, in der das Menü sie zeigt. */
export const HAUSREGELN: readonly (keyof MuehleRegeln)[] = [
  'springen',
  'schlagenAusMuehle',
  'doppelSchlag',
]

/**
 * Regeln aus einer unsicheren Quelle (Gerätespeicher, Server) lesen. Was
 * fehlt oder kein Wahrheitswert ist, bekommt die Voreinstellung -- eine
 * Partie bricht nie an einem kaputten Regelsatz ab.
 */
export function regelnAus(roh: unknown): MuehleRegeln {
  const r = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>
  const wert = (k: keyof MuehleRegeln) =>
    typeof r[k] === 'boolean' ? (r[k] as boolean) : STANDARD_REGELN[k]
  return {
    springen: wert('springen'),
    schlagenAusMuehle: wert('schlagenAusMuehle'),
    doppelSchlag: wert('doppelSchlag'),
  }
}

/** Wie viele Steine jede Seite hat und ab wann sie verliert. */
export const STEINE = {
  /** Steine je Seite zu Beginn, alle in der Hand. */
  jeSeite: 9,
  /** Mit so vielen Steinen (Hand und Brett) darf man springen. */
  springenBei: 3,
  /** Wer weniger hat, hat verloren. */
  mindestens: 3,
} as const

/** Wann eine Partie von selbst Remis ist. */
export const REMIS = {
  /** So oft dieselbe Stellung mit derselben Seite am Zug. */
  wiederholungen: 3,
  /** So viele Halbzüge in der Zugphase ohne Mühle -- 25 Züge je Seite. */
  halbzuegeOhneMuehle: 50,
  /** Springen beide (je drei Steine), so viele Halbzüge ohne Mühle -- 10 je Seite. */
  halbzuegeBeideSpringen: 20,
} as const

/**
 * Die drei Stufen des Computers. Sie unterscheiden sich nicht im Wissen,
 * sondern darin, wie weit er vorausschaut und wie sehr er sich verschätzt:
 *
 * - **leicht** schaut einen Halbzug weit -- er sieht nicht, welche Mühle
 *   der Gegner danach schließt. Dazu verschätzt er sich kräftig und zieht
 *   ab und zu irgendetwas.
 * - **mittel** schaut drei Halbzüge weit: eigene Mühle, Antwort, nächste
 *   Mühle. Eine Zwickmühle, die man ihm baut, sieht er oft zu spät.
 * - **schwer** schaut so weit, wie er in knapp einer Sekunde kommt, ohne
 *   sich zu verschätzen.
 */
export interface StufenWerte {
  /** Wie viele Halbzüge weit gerechnet wird -- bei schwer: höchstens. */
  tiefe: number
  /**
   * Am Ende der Rechnung noch die Mühlen nachrechnen, die gerade zu
   * schließen sind -- sonst übersieht er die Mühle gleich hinter dem Horizont.
   */
  ruhesuche: boolean
  /** So weit (in Hundertstel Steinen) darf er sich je Zug verschätzen. */
  rauschen: number
  /** So oft zieht er einfach irgendeinen erlaubten Zug. */
  zufall: number
  /** Bedenkzeit in Millisekunden; bei leicht und mittel ohne Belang. */
  zeitMs: number
  /** Darf man gegen diese Stufe Züge zurücknehmen? Wie bei Dame nur bei leicht. */
  zuruecknehmen: boolean
}

export const STUFEN: Record<MuehleStufe, StufenWerte> = {
  leicht: {
    tiefe: 1,
    ruhesuche: false,
    rauschen: 80,
    zufall: 0.25,
    zeitMs: 800,
    zuruecknehmen: true,
  },
  mittel: {
    tiefe: 3,
    ruhesuche: true,
    rauschen: 15,
    zufall: 0,
    zeitMs: 800,
    zuruecknehmen: false,
  },
  schwer: {
    tiefe: 30,
    ruhesuche: true,
    rauschen: 0,
    zufall: 0,
    zeitMs: 900,
    zuruecknehmen: false,
  },
}

/** Die Bewertung einer Stellung, in Hundertstel Steinen. */
export const WERTE = {
  /** Ein Stein, ob in der Hand oder auf dem Brett. */
  stein: 100,
  /** Eine geschlossene Mühle. */
  muehle: 30,
  /** Zwei eigene Steine und der dritte Punkt der Linie frei: eine offene Mühle. */
  offeneMuehle: 22,
  /**
   * Eine Zwickmühle: Ein Stein pendelt zwischen zwei Mühlen und schließt
   * bei jedem Zug eine. Fast so gut wie ein Stein mehr.
   */
  zwickmuehle: 70,
  /** Je möglichem Zug in der Zugphase. */
  beweglichkeit: 6,
  /** Ein Stein, der nicht ziehen kann. */
  blockiert: 8,
  /** Ein Stein auf einem Kreuzungspunkt (vier Nachbarn) -- vor allem beim Setzen. */
  kreuzung: 10,
} as const

/**
 * Was eine Partie wert ist -- für Verlauf, XP und Bilanz. Ein Sieg gegen
 * einen stärkeren Gegner zählt mehr. Zu zweit an einem Gerät wird nichts
 * gebucht (wessen Sieg wäre es?), die Runde meldet `meldePartyRunde`.
 */
export const PUNKTE = {
  sieg: { leicht: 70, mittel: 140, schwer: 280, online: 220 },
  /** Remis ist die Hälfte eines Siegs. */
  remisAnteil: 0.5,
  niederlage: 10,
  /** XP sind ein Viertel der Punkte. */
  xpTeiler: 4,
} as const

/** Unter diesem Schlüssel liegt eine unterbrochene Partie im Gerät. */
export const SPEICHER_SCHLUESSEL = 'te-muehle-partie'
/** Die zuletzt gewählten Hausregeln. */
export const REGELN_SCHLUESSEL = 'te-muehle-regeln'
