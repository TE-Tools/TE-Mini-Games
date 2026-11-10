/**
 * Rückwärts – alle Stellwerte an einer Stelle.
 *
 * Die Werte sind am echten Mikrofon entstanden, nicht am Schreibtisch:
 * Wer „Aufnahme starten" tippt, spricht nicht im selben Augenblick, und
 * wer fertig ist, tippt nicht sofort auf Stopp. Ohne Stutzen beginnt die
 * Rückwärtsfassung deshalb mit einer halben Sekunde Stille -- genau dem
 * Stück, das am Ende der Aufnahme hing.
 */
export const RUECKWAERTS = {
  /** Länger nimmt das Spiel nicht auf. Ein Wort braucht zwei Sekunden, ein Satz fünf. */
  maxSekunden: 10,
  /** Kürzer ist kein Wort, sondern ein Versehen (Doppeltipp auf den Knopf). */
  minSekunden: 0.25,
  /**
   * Unter diesem Ausschlag (0 bis 1) gilt eine Aufnahme als leer. Ein
   * stilles Zimmer liegt bei 0,002 bis 0,01, leises Sprechen bei 0,05.
   */
  minAusschlag: 0.02,
  /** Anteil am lautesten Fenster, ab dem ein Fenster als laut zählt. */
  stilleAnteil: 0.12,
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
  minSpieler: 2,
  maxSpieler: 12,
} as const
