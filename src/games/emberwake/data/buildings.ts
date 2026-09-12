import type { BuildingDef, BuildingId } from './schema/types'

/**
 * Feste Bauplätze rund um den Kern, kein Freibau (GAME_DESIGN.md §7).
 * Basisfortschritt ist kampagnenweit persistent.
 */
export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  core: {
    id: 'core',
    name: 'Kernstelle',
    description: 'Das Herz des Lagers. Licht, Energie, Sicherheit.',
    levels: [
      {
        cost: {},
        emberCost: 0,
        description: 'Ein Splitter des letzten Lichts.',
        effects: {},
      },
      {
        cost: { wood: 10, stone: 4 },
        emberCost: 8,
        description: 'Gefasster Kern. Mehr Kapazität, weiterer Radius.',
        effects: { coreCapacity: 20, lightRadius: 3 },
      },
      {
        cost: { wood: 18, stone: 10 },
        emberCost: 12,
        description: 'Gehüteter Kern. Regeneriert langsam von selbst.',
        effects: { coreCapacity: 30, lightRadius: 5, coreRegen: 0.08 },
      },
    ],
  },
  workbench: {
    id: 'workbench',
    name: 'Werkbank',
    description: 'Werkzeuge herstellen. Kostet Kernenergie.',
    levels: [
      {
        cost: { wood: 8, stone: 3 },
        emberCost: 6,
        description: 'Einfache Werkzeuge.',
        effects: {},
      },
      {
        cost: { wood: 14, stone: 8, metal: 4 },
        emberCost: 10,
        description: 'Verbesserte Werkzeuge.',
        effects: {},
      },
    ],
  },
  storage: {
    id: 'storage',
    name: 'Speicher',
    description: 'Schützt Vorräte. Erhöht die Traglast des Trägers.',
    levels: [
      {
        cost: { wood: 12, stone: 6 },
        emberCost: 5,
        description: 'Ein Rucksackgestell und ein trockener Unterstand.',
        effects: { carryCapacity: 8 },
      },
      {
        cost: { wood: 20, stone: 12, metal: 4 },
        emberCost: 8,
        description: 'Verstärkte Gurte, verschlossene Kisten.',
        effects: { carryCapacity: 14 },
      },
    ],
  },
  tower: {
    id: 'tower',
    name: 'Wachturm',
    description: 'Wirft Licht und Glut auf Angreifer. Verbraucht Kern.',
    levels: [
      {
        cost: { wood: 15, stone: 12 },
        emberCost: 10,
        description: 'Eine Laterne auf einem Pfahl.',
        effects: { towerDamage: 4, towerRange: 9 },
      },
    ],
  },
}
