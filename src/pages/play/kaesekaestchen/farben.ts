/**
 * Die Farben der Mitspieler -- je Platz in der Zugreihenfolge eine, gut zu
 * unterscheiden, auch nebeneinander auf dem Blatt. Die erste ist die
 * Farbe der Kachel.
 */
export const SPIELER_FARBEN = ['#a21caf', '#0891b2', '#d97706', '#16a34a'] as const

export function farbeVon(spieler: number): string {
  return SPIELER_FARBEN[spieler % SPIELER_FARBEN.length]!
}

/** Der erste Buchstabe eines Namens, groß -- fürs Kästchen. */
export function initiale(name: string): string {
  const erster = [...name.trim()][0]
  return erster ? erster.toLocaleUpperCase() : '?'
}
