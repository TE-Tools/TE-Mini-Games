import type { WorldDef } from '../schema/types'

/**
 * Welt 1 — Der Aschenwald.
 * Farbkonzept: Die Welt ist entsättigt. Alles Warme ist Licht und
 * damit Sicherheit. Nacht ist tiefblau, nie schwarz (GAME_DESIGN.md §16).
 */
export const WORLD_01: WorldDef = {
  id: 1,
  name: 'Der Aschenwald',
  subtitle: 'Grundlagen: Lichtschuld, Ballast, die erste Nacht',
  levelIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  palette: {
    skyDay: 0x9aa7b8,
    skyNight: 0x0b1020,
    fogDay: 0xa8b2bf,
    fogNight: 0x0d1326,
    ground: 0x5d6b5a,
    groundDark: 0x3d4740,
    tree: 0x4f6a52,
    treeDark: 0x2f3f33,
    rock: 0x6b7280,
  },
}
