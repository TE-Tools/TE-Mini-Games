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
    // Seit 27.11.2026 näher an echtem Wald: sattes Grün statt Graugrün,
    // ein Himmel mit Blau darin, Fels mit einem Hauch Braun.
    skyDay: 0x8fb2cf,
    skyNight: 0x0a1222,
    fogDay: 0xa6bccb,
    fogNight: 0x0c1528,
    ground: 0x5a7343,
    groundDark: 0x33452b,
    tree: 0x3c6144,
    treeDark: 0x213a29,
    rock: 0x7a7a78,
  },
}
