/**
 * Spielfiguren. Stilisiert und freundlich -- keine Waffen, wie im Konzept
 * festgehalten. Die Figur ist reine Zier: sie ändert nichts an den Regeln.
 */

export interface FigurDaten {
  id: string
  name: string
  icon: string
  farbe: string
}

export const FIGUREN: readonly FigurDaten[] = [
  { id: 'schuetze', name: 'Schütze', icon: '🎯', farbe: '#4ade80' },
  { id: 'offizier', name: 'Offizier', icon: '🎖️', farbe: '#38bdf8' },
  { id: 'koenig', name: 'Schützenkönig', icon: '👑', farbe: '#f0c84a' },
  { id: 'musiker', name: 'Musiker', icon: '🎺', farbe: '#f472b6' },
  { id: 'tambour', name: 'Tambour', icon: '🥁', farbe: '#fb923c' },
  { id: 'fahnentraeger', name: 'Fahnenträger', icon: '🚩', farbe: '#f87171' },
  { id: 'vereinsmitglied', name: 'Vereinsmitglied', icon: '🍺', farbe: '#c084fc' },
  { id: 'marketenderin', name: 'Marketenderin', icon: '🥨', farbe: '#2dd4bf' },
] as const

const NACH_ID = new Map(FIGUREN.map((f) => [f.id, f]))

export function figur(id: string): FigurDaten {
  return NACH_ID.get(id) ?? FIGUREN[0]!
}
