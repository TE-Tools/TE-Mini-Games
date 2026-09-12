import type {
  BuildingId,
  DayPhase,
  EnemyId,
  HintTrigger,
  Stock,
  ToolId,
} from '@/games/emberwake/data/schema/types'
import type { QualityTier } from '@/games/emberwake/platform/Capabilities'

/**
 * Spielstand-Schema (SAVE_SYSTEM.md).
 * `profile` überlebt alles. `run` ist der laufende Levelversuch.
 * Jede Änderung hier braucht eine Migration in migrations.ts.
 */

export const SAVE_SCHEMA_VERSION = 1

export const START_LIVES = 3
export const MAX_LIVES = 5

export interface LevelRecord {
  stars: number
  bestTime: number | null
  secret: boolean
  completions: number
  attempts: number
  deaths: number
}

export interface Settings {
  haptics: boolean
  quality: QualityTier | 'auto'
  sfxVolume: number
  musicVolume: number
  showTouchControls: 'auto' | 'always' | 'never'
}

export interface ProfileStats {
  totalPlaytime: number
  totalDeaths: number
  totalGathered: number
  nightsSurvived: number
  enemiesKilled: number
}

export interface ProfileData {
  createdAt: number
  updatedAt: number
  lives: number
  /** Höchstes freigeschaltetes Level. */
  unlockedLevelId: number
  levels: Record<number, LevelRecord>
  camp: {
    buildings: Partial<Record<BuildingId, number>>
    stock: Stock
    tools: ToolId[]
  }
  settings: Settings
  stats: ProfileStats
  achievements: string[]
}

export interface RunSnapshot {
  levelId: number
  savedAt: number
  clock: {
    phase: DayPhase
    phaseTime: number
    night: number
    nightsSurvived: number
    elapsed: number
  }
  ember: { charge: number; minCharge: number; damaged: boolean }
  player: { x: number; z: number; facing: number; hp: number; inventory: Stock; tools: ToolId[] }
  camp: { buildings: Partial<Record<BuildingId, number>>; stock: Stock }
  nodes: number[]
  enemies: Array<{ id: EnemyId; x: number; z: number; hp: number }>
  waves: Array<{ at: number; announced: boolean; spawned: boolean; angle: number }>
  secretFound: boolean
  hintsShown: HintTrigger[]
  stats: {
    gathered: number
    deposited: number
    damageTaken: number
    enemiesKilled: number
    distanceWalked: number
    maxDistanceFromCamp: number
  }
}

export interface SaveEnvelope<T> {
  version: number
  checksum: string
  savedAt: number
  gameVersion: string
  data: T
}

export function defaultSettings(): Settings {
  return {
    haptics: true,
    quality: 'auto',
    sfxVolume: 0.8,
    musicVolume: 0.6,
    showTouchControls: 'auto',
  }
}

export function defaultProfile(now = Date.now()): ProfileData {
  return {
    createdAt: now,
    updatedAt: now,
    lives: START_LIVES,
    unlockedLevelId: 1,
    levels: {},
    camp: { buildings: { core: 1 }, stock: {}, tools: [] },
    settings: defaultSettings(),
    stats: {
      totalPlaytime: 0,
      totalDeaths: 0,
      totalGathered: 0,
      nightsSurvived: 0,
      enemiesKilled: 0,
    },
    achievements: [],
  }
}

export function emptyLevelRecord(): LevelRecord {
  return { stars: 0, bestTime: null, secret: false, completions: 0, attempts: 0, deaths: 0 }
}
