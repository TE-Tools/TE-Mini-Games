/**
 * Schützenrunde – roles and factions (v3).
 *
 * Idea and full specification: docs/ideas/schuetzenrunde/
 * A round is played locally: one human player against rule-based bots on one
 * device. No external AI, no network – see AGENTS.md rule 2 and 3.
 *
 * The deck grows with the round: the bigger the Bruderschaft, the more of the
 * special offices from the specification are handed out.
 */

export type Faction = 'bruderschaft' | 'saboteure'

export type RoleId =
  // Bruderschaft
  | 'brudermeister'
  | 'stellvertreter'
  | 'schiessmeister'
  | 'schuetze'
  | 'zeugwart'
  | 'oberst'
  | 'schriftfuehrer'
  | 'hornist'
  | 'kassierer'
  | 'musikbeauftragter'
  // Saboteure
  | 'saboteur'
  | 'intrigant'
  | 'falschspieler'
  | 'geruechtemacher'

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
  stellvertreter: {
    id: 'stellvertreter',
    name: 'Stellvertretender Brudermeister',
    faction: 'bruderschaft',
    description:
      'Solange der Brudermeister dabei ist, bist du einfaches Mitglied. Fällt er aus, zählt deine Stimme doppelt.',
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
    description: 'Du hast einen freien Schuss pro Partie – beim Schützenfest bis zu drei.',
    nightAction: true,
  },
  zeugwart: {
    id: 'zeugwart',
    name: 'Zeugwart',
    faction: 'bruderschaft',
    description:
      'Du schließt jede Nacht eine Person im Zeughaus ein – die Saboteure kommen dort nicht an sie heran. Zweimal hintereinander dieselbe Person geht nicht.',
    nightAction: true,
  },
  oberst: {
    id: 'oberst',
    name: 'Oberst',
    faction: 'bruderschaft',
    description: 'Alte Schule: Den ersten Anschlag der Saboteure überstehst du.',
    nightAction: false,
  },
  schriftfuehrer: {
    id: 'schriftfuehrer',
    name: 'Schriftführer',
    faction: 'bruderschaft',
    description:
      'Du führst Protokoll: Jede Nacht erfährst du über zwei Mitglieder, ob mindestens eines davon zu den Saboteuren gehört.',
    nightAction: false,
  },
  hornist: {
    id: 'hornist',
    name: 'Hornist',
    faction: 'bruderschaft',
    description: 'Einfaches Mitglied der Bruderschaft – deine Stimme entscheidet mit.',
    nightAction: false,
  },
  kassierer: {
    id: 'kassierer',
    name: 'Kassierer',
    faction: 'bruderschaft',
    description: 'Du führst die Kasse – im Spiel zählt allein deine Stimme.',
    nightAction: false,
  },
  musikbeauftragter: {
    id: 'musikbeauftragter',
    name: 'Musikbeauftragter',
    faction: 'bruderschaft',
    description: 'Du sorgst für die Musik – im Spiel zählt allein deine Stimme.',
    nightAction: false,
  },
  saboteur: {
    id: 'saboteur',
    name: 'Saboteur',
    faction: 'saboteure',
    description: 'Du schaltest gemeinsam mit deinen Partnern jede Nacht eine Person aus.',
    nightAction: true,
  },
  intrigant: {
    id: 'intrigant',
    name: 'Intrigant',
    faction: 'saboteure',
    description: 'Du sabotierst mit und lenkst am Tag den Verdacht auf andere.',
    nightAction: true,
  },
  falschspieler: {
    id: 'falschspieler',
    name: 'Falschspieler',
    faction: 'saboteure',
    description:
      'Du sabotierst mit – und beim Schießmeister erscheinst du als Mitglied der Bruderschaft.',
    nightAction: true,
  },
  geruechtemacher: {
    id: 'geruechtemacher',
    name: 'Gerüchtemacher',
    faction: 'saboteure',
    description:
      'Du sabotierst mit und bringst einmal pro Partie ein Mitglied ins Gerede – der Schießmeister hält es fortan für einen Saboteur.',
    nightAction: true,
  },
}

export function roleOf(id: RoleId): Role {
  return ROLES[id]
}

export function factionOf(id: RoleId): Faction {
  return ROLES[id].faction
}

/** Saboteurs in a round: 2 up to 11 players, 3 from 12 on. */
export function saboteurCount(size: number): number {
  return size >= 12 ? 3 : 2
}

/** Which saboteur offices are in play – the bigger the round, the trickier. */
function saboteurRoles(size: number): RoleId[] {
  if (size >= 14) return ['intrigant', 'falschspieler', 'geruechtemacher']
  if (size >= 12) return ['saboteur', 'intrigant', 'falschspieler']
  if (size >= 10) return ['falschspieler', 'intrigant']
  return ['saboteur', 'intrigant']
}

/** Special offices of the Bruderschaft and the round size they appear from. */
const BRUDERSCHAFT_SPECIALS: ReadonlyArray<{ role: RoleId; from: number }> = [
  { role: 'schiessmeister', from: 8 },
  { role: 'schuetze', from: 8 },
  { role: 'brudermeister', from: 8 },
  { role: 'zeugwart', from: 10 },
  { role: 'schriftfuehrer', from: 12 },
  { role: 'oberst', from: 14 },
  { role: 'stellvertreter', from: 16 },
]

/** Plain members without an ability – pure flavour from the specification. */
const PLAIN_MEMBERS: readonly RoleId[] = ['hornist', 'kassierer', 'musikbeauftragter']

/**
 * Role deck for a round of `size` players: the saboteurs, the special offices
 * that fit the size, then plain members.
 */
export function roleDeck(size: number): RoleId[] {
  const players = Math.max(4, Math.floor(size))
  const deck: RoleId[] = [...saboteurRoles(players)].slice(0, saboteurCount(players))
  for (const special of BRUDERSCHAFT_SPECIALS) {
    if (players >= special.from && deck.length < players) deck.push(special.role)
  }
  let plain = 0
  while (deck.length < players) {
    deck.push(PLAIN_MEMBERS[plain % PLAIN_MEMBERS.length]!)
    plain++
  }
  return deck.slice(0, players)
}
