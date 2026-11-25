/**
 * Ob "So geht's" schon einmal gebraucht wurde: Nach der ersten Runde eines
 * Spiels klappt die Anleitung zusammen. Gemerkt im localStorage, je Spiel --
 * ein gesperrter oder voller Speicher darf nie das Spiel aufhalten, dann
 * steht die Anleitung eben wieder offen da.
 */

const PRAEFIX = 'so-gehts:'

export function soGehtsGesehen(spiel: string): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(PRAEFIX + spiel) === '1'
  } catch {
    return false
  }
}

/** Beim Start einer Runde: ab jetzt zusammengeklappt. */
export function merkeSoGehtsGesehen(spiel: string): void {
  try {
    localStorage.setItem(PRAEFIX + spiel, '1')
  } catch {
    // Gesperrter Speicher: nächstes Mal eben wieder offen.
  }
}
