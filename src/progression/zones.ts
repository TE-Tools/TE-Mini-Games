/**
 * Level zones – the 1–500 "Zeitreise" map.
 *
 * Design spec: docs/design/level-map-500/README.md
 * Zone data mirrors docs/design/level-map-500/zones.json.
 *
 * Five biomes of 100 levels each, walked bottom→top:
 *   Urwald → Vulkanland → Felswüste → Eiszeit → Gletschergipfel.
 *
 * Games stay independent of this module unless they want zone-aware difficulty;
 * the level map uses it for theming.
 */

export const MAX_LEVEL = 500
export const LEVELS_PER_ZONE = 100

export type ZoneId = 'jungle' | 'volcanic' | 'canyon' | 'iceage' | 'glacier'

export interface ZonePalette {
  ground: string
  groundLight: string
  accent: string
  path: string
  sky: string
  /** Colour of the scattered blobs on the map (water, lava, sand, ice …) */
  blob: string
}

export interface LevelZone {
  id: ZoneId
  /** 1-based zone number (1 = Urwald … 5 = Gletschergipfel) */
  index: number
  name: string
  levelFrom: number
  levelTo: number
  description: string
  /** Short decorative glyphs for the map background */
  creatures: readonly string[]
  palette: ZonePalette
  /** Level that closes the zone (100, 200, … 500) */
  gateLevel: number
  gateName: string
}

export const ZONES: readonly LevelZone[] = [
  {
    id: 'jungle',
    index: 1,
    name: 'Urwald',
    levelFrom: 1,
    levelTo: 100,
    description: 'Dichter, saftig grüner Dschungel mit Palmen, Farnen und Erdpfad.',
    creatures: ['🦕', '🦖', '🌴', '🌿'],
    palette: {
      ground: '#4d8a32',
      groundLight: '#7ec850',
      accent: '#2f7d32',
      path: '#cbb27a',
      sky: '#47b6d6',
      blob: '#4fa8c8',
    },
    gateLevel: 100,
    gateName: 'Tor zum Vulkanland',
  },
  {
    id: 'volcanic',
    index: 2,
    name: 'Vulkanland',
    levelFrom: 101,
    levelTo: 200,
    description:
      'Trockene, felsige Vulkanlandschaft, rauchige Luft, kleine aktive Vulkane im Hintergrund.',
    creatures: ['🌋', '🦖', '🔥', '🪨'],
    palette: {
      ground: '#8a4b2a',
      groundLight: '#c4703a',
      accent: '#e2542a',
      path: '#b9a07e',
      sky: '#6b5b52',
      blob: '#e2542a',
    },
    gateLevel: 200,
    gateName: 'Tor zur Felswüste',
  },
  {
    id: 'canyon',
    index: 3,
    name: 'Felswüste',
    levelFrom: 201,
    levelTo: 300,
    description: 'Karge Felswüste und Canyons, der Weg ist in tiefen Fels geschlagen.',
    creatures: ['🏜️', '🦖', '🪨', '🌵'],
    palette: {
      ground: '#c98b52',
      groundLight: '#e0b077',
      accent: '#7a4b28',
      path: '#d9c39a',
      sky: '#8fc7dd',
      blob: '#d9c39a',
    },
    gateLevel: 300,
    gateName: 'Tor zur Eiszeit',
  },
  {
    id: 'iceage',
    index: 4,
    name: 'Eiszeit',
    levelFrom: 301,
    levelTo: 400,
    description: 'Schnee, Gletscher und gefrorene Wasserfälle; harter Übergang von Fels zu Eis.',
    creatures: ['🦣', '🐯', '❄️', '🏔️'],
    palette: {
      ground: '#8fc3de',
      groundLight: '#cfe9f5',
      accent: '#5a93b8',
      path: '#e6eef2',
      sky: '#79c4e0',
      blob: '#eaf6fb',
    },
    gateLevel: 400,
    gateName: 'Tor zum Gletschergipfel',
  },
  {
    id: 'glacier',
    index: 5,
    name: 'Gletschergipfel',
    levelFrom: 401,
    levelTo: 500,
    description:
      'Höchster, vollständig vergletscherter Gipfel bei extremem Frost; endet am Eispalast auf Level 500.',
    creatures: ['🏔️', '❄️', '🧊', '🦣'],
    palette: {
      ground: '#a9ddf2',
      groundLight: '#dff3fb',
      accent: '#7fd4ff',
      path: '#f2fbff',
      sky: '#63b9dd',
      blob: '#ffffff',
    },
    gateLevel: 500,
    gateName: 'Eispalast',
  },
]

/** Clamp any input to a valid map level (1 … MAX_LEVEL). */
export function clampMapLevel(level: number): number {
  if (!Number.isFinite(level)) return 1
  return Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)))
}

/** Zone a level belongs to. Out-of-range input is clamped. */
export function zoneForLevel(level: number): LevelZone {
  const L = clampMapLevel(level)
  const index = Math.min(ZONES.length, Math.ceil(L / LEVELS_PER_ZONE))
  return ZONES[index - 1]!
}

export function zoneById(id: ZoneId): LevelZone | undefined {
  return ZONES.find((z) => z.id === id)
}

/** Position inside the zone: 1 … LEVELS_PER_ZONE. */
export function levelInZone(level: number): number {
  const L = clampMapLevel(level)
  return ((L - 1) % LEVELS_PER_ZONE) + 1
}

/**
 * Normalized progress inside the zone: 0 at the first level, 1 at the last.
 * Difficulty curves use this so every zone ramps on its own.
 */
export function zoneProgress(level: number): number {
  return (levelInZone(level) - 1) / (LEVELS_PER_ZONE - 1)
}

/** True for the level that closes a zone (100, 200, 300, 400, 500). */
export function isZoneGate(level: number): boolean {
  const L = clampMapLevel(level)
  return L % LEVELS_PER_ZONE === 0
}

/** True for the very last level of the map (Eispalast). */
export function isFinalLevel(level: number): boolean {
  return clampMapLevel(level) === MAX_LEVEL
}

/* ------------------------------------------------------------------ *
 * Map segments – the map is walked in pieces of 20 levels.
 * Each piece ends at a gate; opening the gate loads the next piece.
 * ------------------------------------------------------------------ */

/** Levels shown on one map piece. */
export const SEGMENT_SIZE = 20
/** Map pieces per zone (100 / 20). */
export const SEGMENTS_PER_ZONE = LEVELS_PER_ZONE / SEGMENT_SIZE
/** Map pieces in total (500 / 20). */
export const SEGMENT_COUNT = MAX_LEVEL / SEGMENT_SIZE

export interface MapSegment {
  /** 1-based piece number (1 = levels 1–20 … 25 = levels 481–500) */
  index: number
  from: number
  to: number
  zone: LevelZone
  /** Name of the gate that closes this piece. */
  gateName: string
  /** True when the gate is also a zone border (levels 100, 200 … 500). */
  isZoneGate: boolean
}

/** True for a level that ends a map piece (20, 40, 60 … 500). */
export function isSegmentGate(level: number): boolean {
  return clampMapLevel(level) % SEGMENT_SIZE === 0
}

export function segmentIndexForLevel(level: number): number {
  return Math.ceil(clampMapLevel(level) / SEGMENT_SIZE)
}

export function segmentByIndex(index: number): MapSegment {
  const i = Math.max(1, Math.min(SEGMENT_COUNT, Math.floor(index)))
  const to = i * SEGMENT_SIZE
  const zone = zoneForLevel(to)
  const zoneBorder = to % LEVELS_PER_ZONE === 0
  return {
    index: i,
    from: to - SEGMENT_SIZE + 1,
    to,
    zone,
    gateName: zoneBorder ? zone.gateName : `Tor zu Abschnitt ${i + 1}`,
    isZoneGate: zoneBorder,
  }
}

export function segmentForLevel(level: number): MapSegment {
  return segmentByIndex(segmentIndexForLevel(level))
}
