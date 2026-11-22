/**
 * Farbe und Anfangsbuchstabe eines Mitspielers -- für sein Bild bei der
 * Übergabe (`Spielerbild.tsx`).
 */

const FARBEN = [
  ['#6366f1', '#a855f7'],
  ['#f97316', '#ef4444'],
  ['#10b981', '#0ea5e9'],
  ['#ec4899', '#f43f5e'],
  ['#eab308', '#f97316'],
  ['#14b8a6', '#22c55e'],
  ['#3b82f6', '#6366f1'],
  ['#a855f7', '#ec4899'],
] as const

/** Eine feste Farbe je Name -- nicht zufällig, sonst wechselte sie jede Runde. */
export function farbeFuer(name: string): readonly [string, string] {
  let h = 0
  for (const c of name.trim().toLowerCase()) h = (h * 31 + c.codePointAt(0)!) >>> 0
  return FARBEN[h % FARBEN.length]!
}

/** Der erste Buchstabe, auch wenn der Name mit einem Emoji oder Leerzeichen beginnt. */
export function anfang(name: string): string {
  const zeichen = [...name.trim()]
  const buchstabe = zeichen.find((z) => /\p{L}|\p{N}/u.test(z))
  return (buchstabe ?? zeichen[0] ?? '?').toUpperCase()
}
