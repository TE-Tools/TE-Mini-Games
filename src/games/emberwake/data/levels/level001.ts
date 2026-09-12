import type { LevelDef } from '../schema/types'

/**
 * Level 1 — Erste Glut.
 * Tutorial ohne Textwände (LEVEL_DESIGN.md §4).
 * Keine Nacht, keine Gegner. Der Kern steht sichtbar niedrig — der
 * Spieler will ihn füllen. Holz liegt in Blickrichtung. Beim Aufsammeln
 * füllt sich der Ballastbalken. Zu schwer beladen wird er langsam.
 */
export const LEVEL_001: LevelDef = {
  id: 1,
  worldId: 1,
  name: 'Erste Glut',
  subtitle: 'Nähre den Kern mit Zunderholz.',
  seed: 0x4e4d5231,
  difficulty: 1,
  targetDuration: 240,

  terrain: {
    size: 120,
    elevation: 2.5,
    treeDensity: 0.55,
    rockDensity: 0.35,
  },

  camp: {
    unlockedBuildings: ['core'],
  },

  ember: {
    startCharge: 30,
    drainBase: 0.12,
    drainDistanceFactor: 1.2,
    drainRange: 60,
    regenPerWood: 4,
    lightRadiusMin: 4,
    lightRadiusMax: 12,
  },

  cycle: {
    dayDuration: 600,
    duskDuration: 30,
    nightDuration: 60,
    dawnDuration: 15,
    nights: 0,
    startPhase: 'day',
  },

  visibility: {
    dayRange: 90,
    nightRange: 30,
  },

  player: {
    hp: 100,
    carryCapacity: 16,
  },

  resources: [
    { resource: 'wood', count: 5, minDist: 8, maxDist: 16, amount: [3, 4] },
    { resource: 'wood', count: 8, minDist: 18, maxDist: 34, amount: [3, 5] },
    { resource: 'stone', count: 4, minDist: 14, maxDist: 30, amount: [2, 3] },
    { resource: 'food', count: 3, minDist: 10, maxDist: 26, amount: [2, 2] },
  ],

  waves: [],

  objectives: {
    // Zwei Touren nötig: sammeln, einlagern, nähren — der ganze Kreislauf.
    primary: { kind: 'core_charge', threshold: 80, text: 'Bring den Kern auf 80 %' },
    secondary: { kind: 'time_under', seconds: 300, text: 'In unter fünf Minuten' },
  },

  secret: {
    distance: 0.78,
    text: 'Eine alte Laterne, kalt seit Jahren. In ihrem Sockel glimmt noch ein Kristall.',
    reward: { crystal: 1 },
  },

  hints: [
    { trigger: 'start', text: 'Sammle Zunderholz für den Kern' },
    { trigger: 'first_pickup', text: 'Dein Ballast wächst' },
    { trigger: 'heavy', text: 'Zu schwer. Du wirst langsam.' },
    { trigger: 'at_core_with_loot', text: 'Einlagern und Kern nähren' },
  ],

  rewards: {
    resources: { wood: 4 },
    unlocks: [],
  },

  lore: ['Der Herd ist fort. Was bleibt, trägst du.'],
}
