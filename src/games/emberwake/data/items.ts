import type { ItemDef, ItemId } from './schema/types'

/**
 * Jede Ressource hat genau eine klare Rolle. Keine Füllmaterialien.
 * Gewichte siehe docs/GAME_DESIGN.md §6.
 */
export const ITEMS: Record<ItemId, ItemDef> = {
  wood: {
    id: 'wood',
    name: 'Zunderholz',
    weight: 1.0,
    kind: 'resource',
    description: 'Nährt den Kern. Baumaterial für das Lager.',
    color: 0xc98f4a,
  },
  stone: {
    id: 'stone',
    name: 'Kernstein',
    weight: 2.5,
    kind: 'resource',
    description: 'Schwer. Für Befestigungen und Ausbau.',
    color: 0x8d94a3,
  },
  metal: {
    id: 'metal',
    name: 'Altmetall',
    weight: 2.0,
    kind: 'resource',
    description: 'Für Werkzeuge und Waffen.',
    color: 0x6f7a8c,
  },
  resin: {
    id: 'resin',
    name: 'Harz',
    weight: 0.5,
    kind: 'resource',
    description: 'Brennt hell und kurz.',
    color: 0xe0b34a,
  },
  food: {
    id: 'food',
    name: 'Nahrung',
    weight: 0.8,
    kind: 'resource',
    description: 'Heilt. Kurzzeitig mehr Traglast.',
    color: 0x9fc064,
  },
  moss: {
    id: 'moss',
    name: 'Heilmoos',
    weight: 0.4,
    kind: 'resource',
    description: 'Für Verbände.',
    color: 0x5fa678,
  },
  crystal: {
    id: 'crystal',
    name: 'Glutkristall',
    weight: 1.5,
    kind: 'resource',
    description: 'Hochwertige Kernladung. Selten.',
    color: 0xff9a4d,
  },
  artifact: {
    id: 'artifact',
    name: 'Artefakt',
    weight: 6.0,
    kind: 'resource',
    description: 'Einzigartig. Schwer. Es will getragen werden.',
    color: 0xffd28a,
  },
  axe: {
    id: 'axe',
    name: 'Axt',
    weight: 0,
    kind: 'tool',
    description: 'Verdoppelt das Sammeltempo bei Holz.',
    color: 0xb0b8c4,
  },
  torch: {
    id: 'torch',
    name: 'Fackel',
    weight: 0,
    kind: 'tool',
    description: 'Größerer Laternenradius für kurze Zeit.',
    color: 0xffb060,
  },
}

export const RESOURCE_IDS = [
  'wood',
  'stone',
  'metal',
  'resin',
  'food',
  'moss',
  'crystal',
  'artifact',
] as const
