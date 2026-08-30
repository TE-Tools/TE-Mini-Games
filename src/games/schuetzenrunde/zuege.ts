/**
 * Züge – the social groups of the specification.
 *
 * A Zug is the little platoon a member belongs to. In the local round it is the
 * team you play for: your Zug collects points for every match you win or
 * survive, and the balance is added up from the stored results (no extra table,
 * no server).
 */

export interface Zug {
  id: string
  name: string
  /** Short badge shown next to a member. */
  badge: string
}

export const ZUEGE: readonly Zug[] = [
  { id: 'jaeger', name: 'Jägerzug', badge: '🌿' },
  { id: 'grenadier', name: 'Grenadierzug', badge: '🛡️' },
  { id: 'fahnen', name: 'Fahnenzug', badge: '🚩' },
  { id: 'hornisten', name: 'Hornistenzug', badge: '🎺' },
]

export function zugById(id: string): Zug {
  return ZUEGE.find((z) => z.id === id) ?? ZUEGE[0]!
}

/** Three Züge in a small round, four from twelve members on. */
export function zugCount(size: number): number {
  return size >= 12 ? 4 : 3
}

/**
 * Points a match is worth for the player's own Zug: a win counts most,
 * surviving still counts.
 */
export function zugPointsFor(won: boolean, survived: boolean, king: boolean): number {
  return (won ? 3 : 0) + (survived ? 1 : 0) + (king ? 2 : 0)
}
