/**
 * Rückwärts – alle Stellwerte an einer Stelle.
 *
 * **Woher die Werte kommen -- und woher nicht.** Die erste Fassung hatte
 * eine feste Schwelle (0,02), unter der eine Aufnahme als leer galt. Sie
 * war nie an einem echten Mikrofon gemessen, nur an einer Tondatei, die
 * Chromium auf volle Lautstärke hochgeregelt hat. Am ersten Abend auf einem
 * echten Handy hieß es bei jeder Aufnahme „nichts zu hören" (10.11.2026):
 * Handys regeln die Stimme oft nicht hoch, und sie kommt dann mit einem
 * Hundertstel des vollen Ausschlags an.
 *
 * Seitdem gibt es keine feste Lautstärke mehr, die eine Stimme erreichen
 * muss. Gefragt wird, ob sich etwas vom Grundrauschen **abhebt** -- das
 * gilt für laute wie für leise Mikrofone. Nachgestellt ist das mit einer
 * leisen Tondatei und abgeschaltetem Hochregeln; an echten Geräten
 * gemessen sind die Werte weiterhin nicht. Wer sie ändert, weil ein Gerät
 * sich anders verhält, schreibt das Gerät dazu.
 */
export const RUECKWAERTS = {
  /** Länger nimmt das Spiel nicht auf. Ein Wort braucht zwei Sekunden, ein Satz fünf. */
  maxSekunden: 10,
  /**
   * Kürzer ist kein Wort, sondern ein Knacks. Bewusst knapp: „Ei" oder
   * „Ja" dauern keine Viertelsekunde, und ein zu Unrecht abgewiesenes Wort
   * ist schlimmer als ein durchgelassener Knacks -- den hört man und
   * spricht neu ein.
   */
  minSekunden: 0.12,
  /**
   * Unter diesem Wert kommt vom Mikrofon praktisch nichts an: stumm
   * geschaltet, von einer anderen App belegt, oder der Browser liefert
   * Nullen. Das ist ein anderer Fall als „zu leise" und bekommt eine
   * eigene Meldung.
   */
  keinTon: 0.0005,
  /**
   * Ab diesem Wert gilt eine Aufnahme ohne weitere Frage als Stimme --
   * auch wenn jemand vom ersten bis zum letzten Augenblick durchspricht
   * und es deshalb kein Grundrauschen zum Vergleichen gibt.
   */
  sicherLaut: 0.02,
  /**
   * Darunter muss sich die Stimme vom Grundrauschen abheben: Das lauteste
   * anhaltende Stück muss so viele Male lauter sein als das Rauschen.
   * Gleichmäßiges Rauschen liegt knapp über 1, Sprache weit darüber.
   * Bewusst niedrig angesetzt: Abgewiesen werden soll nur, wer gar nichts
   * gesagt hat. Im Zweifel wird angenommen -- eine verrauschte Aufnahme
   * kann man anhören und neu einsprechen, eine abgewiesene nicht.
   */
  abstandZumGrund: 1.6,
  /**
   * Das Grundrauschen ist der Wert, den die leisesten zehn Prozent der
   * Fenster gerade noch erreichen. Auch wer durchspricht, macht Pausen
   * von einem Fenster Länge -- deshalb ein niedriger Anteil.
   */
  grundAnteil: 0.1,
  /** Ein Fenster zählt erst als laut, wenn es das Rauschen so viele Male übertrifft. */
  grundFaktor: 2,
  /** Anteil am lautesten anhaltenden Stück, ab dem ein Fenster als laut zählt. */
  stilleAnteil: 0.12,
  /** Höher als dieser Anteil steigt die Schwelle nie, auch bei viel Rauschen nicht. */
  hoechsterSchwellenAnteil: 0.5,
  /** Länge eines Messfensters. */
  fensterSekunden: 0.02,
  /**
   * So viele laute Fenster müssen aufeinander folgen, damit dort Stimme
   * beginnt oder endet (hier: 60 ms). Der Fingertipp auf den Knopf ist
   * lauter als manches Wort, aber er ist nach einem Fenster vorbei -- ein
   * einzelnes lautes Fenster reicht deshalb nicht. (Ein Test hat das
   * gezeigt: Mit einem Fenster hing vor dem Wort die ganze Stille seit
   * dem Tipp.)
   */
  fensterInFolge: 3,
  /**
   * Rand, der vor und hinter der Stimme stehen bleibt. Großzügig, weil ein
   * „t" oder „k" am Wortende nach einer kurzen Pause kommt und selbst
   * kürzer ist als drei Fenster -- ohne Rand fehlte dem „Hut" das t.
   */
  randSekunden: 0.12,
  /**
   * Leise Aufnahmen werden verstärkt, bis ihr höchster Ausschlag hier
   * liegt -- sonst wäre das Wort vom Handy aus kaum zu hören. Mehr als
   * `maxVerstaerkung`-fach wird nicht verstärkt; darüber käme nur noch
   * Rauschen aus dem Lautsprecher.
   */
  zielGipfel: 0.9,
  maxVerstaerkung: 60,
  minSpieler: 2,
  maxSpieler: 12,
} as const
