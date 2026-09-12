import type { RecipeDef } from './schema/types'

export const RECIPES: RecipeDef[] = [
  {
    id: 'axe',
    result: 'axe',
    name: 'Axt',
    cost: { wood: 5, stone: 2 },
    emberCost: 5,
    requires: { building: 'workbench', level: 1 },
    description: 'Verdoppelt das Sammeltempo bei Holz. Etwas mehr Schlagkraft.',
  },
  {
    id: 'torch',
    result: 'torch',
    name: 'Fackel',
    cost: { wood: 3, resin: 2 },
    emberCost: 3,
    requires: { building: 'workbench', level: 1 },
    description: 'Größerer Laternenradius für kurze Zeit.',
  },
]
