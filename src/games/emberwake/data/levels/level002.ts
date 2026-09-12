import type { LevelDef } from '../schema/types'

/**
 * Level 2 — Die erste Nacht.
 * Die Nacht wird eingeführt. Der Lichtradius ist sichtbar sicher.
 * Zwei sehr langsame Schleicher. Lehrt: Licht hält sie fern.
 */
export const LEVEL_002: LevelDef = {
  id: 2,
  worldId: 1,
  name: 'Die erste Nacht',
  subtitle: 'Halte den Kern am Leben, bis es hell wird.',
  seed: 0x4e4d5232,
  difficulty: 1,
  targetDuration: 360,

  terrain: {
    size: 130,
    elevation: 3,
    treeDensity: 0.6,
    rockDensity: 0.4,
  },

  camp: {
    unlockedBuildings: ['core', 'workbench'],
  },

  ember: {
    startCharge: 55,
    drainBase: 0.14,
    drainDistanceFactor: 1.4,
    drainRange: 65,
    regenPerWood: 4,
    lightRadiusMin: 4,
    lightRadiusMax: 13,
  },

  cycle: {
    dayDuration: 150,
    duskDuration: 20,
    nightDuration: 90,
    dawnDuration: 12,
    nights: 1,
    startPhase: 'day',
  },

  visibility: {
    dayRange: 90,
    nightRange: 26,
  },

  player: {
    hp: 100,
    carryCapacity: 16,
  },

  resources: [
    { resource: 'wood', count: 6, minDist: 8, maxDist: 18, amount: [3, 4] },
    { resource: 'wood', count: 9, minDist: 20, maxDist: 40, amount: [3, 5] },
    { resource: 'stone', count: 5, minDist: 12, maxDist: 32, amount: [2, 3] },
    { resource: 'food', count: 4, minDist: 10, maxDist: 30, amount: [2, 2] },
  ],

  waves: [
    { night: 1, delay: 15, enemies: { schleicher: 2 } },
    { night: 1, delay: 55, enemies: { schleicher: 1 } },
  ],

  objectives: {
    primary: { kind: 'survive_nights', nights: 1, text: 'Überstehe die Nacht' },
    secondary: { kind: 'core_never_below', threshold: 50, text: 'Kern nie unter 50 %' },
  },

  secret: {
    distance: 0.8,
    text: 'Eine ausgebrannte Lagerstelle. Jemand hat hier gewartet, bis nichts mehr zu warten war.',
    reward: { crystal: 1, food: 2 },
  },

  hints: [
    { trigger: 'start', text: 'Sammle vor der Nacht' },
    { trigger: 'dusk', text: 'Es dämmert. Zurück zum Kern.' },
    { trigger: 'enemy_seen', text: 'Sie meiden das Licht' },
    { trigger: 'core_low', text: 'Kern schwach. Holz nachlegen.' },
  ],

  rewards: {
    resources: { wood: 6, stone: 2 },
    unlocks: ['workbench'],
  },

  lore: ['Sie waren Träger wie du. Deshalb weichen sie dem Licht aus.'],
}
