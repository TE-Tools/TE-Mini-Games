/**
 * Schützenrunde – roles and factions (v1).
 *
 * Idea and full specification: docs/ideas/schuetzenrunde/
 * v1 is a local round: one human player against rule-based bots on one device.
 * No external AI, no network – see AGENTS.md rule 2 and 3.
 */

export type Faction = 'bruderschaft' | 'saboteure'

export type RoleId =
  | 'brudermeister'
  | 'schiessmeister'
  | 'schuetze'
  | 'hornist'
  | 'saboteur'
  | 'intrigant'

export interface Role {
  id: RoleId
  name: string
  faction: Faction
  /** One sentence the player sees when the role is dealt. */
  description: string
  /** Has a night action the player actively uses. */
  nightAction: boolean
}

export const ROLES: Record<RoleId, Role> = {
  brudermeister: {
    id: 'brudermeister',
    name: 'Brudermeister',
    faction: 'bruderschaft',
    description: 'Deine Stimme zählt bei der Abstimmung doppelt.',
    nightAction: false,
  },
  schiessmeister: {
    id: 'schiessmeister',
    name: 'Schießmeister',
    faction: 'bruderschaft',
    description: 'Du prüfst jede Nacht eine Person und erfährst ihre Fraktion.',
    nightAction: true,
  },
  schuetze: {
    id: 'schuetze',
    name: 'Schütze',
    faction: 'bruderschaft',
    description: 'Du hast einen einzigen freien Schuss pro Partie.',
    nightAction: true,
  },
  hornist: {
    id: 'hornist',
    name: 'Hornist',
    faction: 'bruderschaft',
    description: 'Einfaches Mitglied der Bruderschaft – deine Stimme entscheidet mit.',
    nightAction: false,
  },
  saboteur: {
    id: 'saboteur',
    name: 'Saboteur',
    faction: 'saboteure',
    description: 'Du schaltest gemeinsam mit deinem Partner jede Nacht eine Person aus.',
    nightAction: true,
  },
  intrigant: {
    id: 'intrigant',
    name: 'Intrigant',
    faction: 'saboteure',
    description: 'Du sabotierst mit und lenkst am Tag den Verdacht auf andere.',
    nightAction: true,
  },
}

export function roleOf(id: RoleId): Role {
  return ROLES[id]
}

export function factionOf(id: RoleId): Faction {
  return ROLES[id].faction
}

/** Role deck for a round of `size` players: always 2 saboteurs. */
export function roleDeck(size: number): RoleId[] {
  const deck: RoleId[] = ['saboteur', 'intrigant', 'schiessmeister', 'schuetze', 'brudermeister']
  while (deck.length < size) deck.push('hornist')
  return deck.slice(0, size)
}
