/**
 * Die Farben der Mitspieler -- je Platz in der Zugreihenfolge eine, gut zu
 * unterscheiden, auch nebeneinander auf dem Blatt. Die erste ist die
 * Farbe der Kachel.
 */
export const SPIELER_FARBEN = ['#a21caf', '#0891b2', '#d97706', '#16a34a'] as const

export function farbeVon(spieler: number): string {
  return SPIELER_FARBEN[spieler % SPIELER_FARBEN.length]!
}

/**
 * Der erste Buchstabe eines Namens, groß -- fürs Kästchen. Endet der Name
 * auf eine Zahl („Computer 2"), kommt sie dazu: Sonst stünde bei drei
 * Computern dreimal dasselbe C auf dem Blatt.
 */
export function initiale(name: string): string {
  const getrimmt = name.trim()
  const erster = [...getrimmt][0]
  if (!erster) return '?'
  const zahl = /\s(\d)$/.exec(getrimmt)?.[1] ?? ''
  return erster.toLocaleUpperCase() + zahl
}
