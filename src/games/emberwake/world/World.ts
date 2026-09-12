import type { Vec2 } from '@/games/emberwake/core/math'
import { vec2 } from '@/games/emberwake/core/math'
import { Rng } from '@/games/emberwake/core/Rng'
import { EventBus } from '@/games/emberwake/core/EventBus'
import type { GameEvents } from '@/games/emberwake/core/GameEvents'
import type {
  BuildingId,
  DayPhase,
  EnemyDef,
  EnemyId,
  HintTrigger,
  LevelDef,
  ResourceId,
  Stock,
  ToolId,
  WorldDef,
} from '@/games/emberwake/data/schema/types'
import { Terrain } from './Terrain'
import { SpatialHash } from './Collision'

/**
 * Der gesamte Simulationszustand eines laufenden Levels.
 *
 * Reine Daten. Kein Three.js, kein DOM. Systeme in `systems/` verändern
 * diesen Zustand, `render/` und `ui/` lesen ihn nur.
 */

export interface PlayerState {
  pos: Vec2
  prevPos: Vec2
  vel: Vec2
  facing: number
  hp: number
  maxHp: number
  radius: number
  sprinting: boolean
  attackCooldown: number
  /** Anteil der Angriffsanimation, 1 → 0. */
  attackAnim: number
  invulnerable: number
  gatherProgress: number
  inventory: Stock
  carryCapacity: number
  weight: number
  tools: Set<ToolId>
  alive: boolean
  lastDamageSource: string
  /** Laufanimation, wächst mit zurückgelegter Strecke. */
  stride: number
}

export type EnemyMode = 'wander' | 'chase' | 'attack' | 'flee' | 'dissolve'

export interface EnemyState {
  id: number
  def: EnemyDef
  pos: Vec2
  prevPos: Vec2
  vel: Vec2
  facing: number
  hp: number
  alive: boolean
  mode: EnemyMode
  target: 'player' | 'core' | 'none'
  exposure: number
  attackCooldown: number
  /** Rest-Sichtbarkeit beim Auflösen, 1 → 0. */
  dissolve: number
  hitFlash: number
  lightTick: number
  brainTimer: number
  wanderAngle: number
  wanderTimer: number
  stuckTimer: number
  detourSign: number
  seen: boolean
  attackAnim: number
}

export interface ResourceNodeState {
  id: number
  resource: ResourceId
  pos: Vec2
  amount: number
  maxAmount: number
  radius: number
  /** Kurzes Wackeln nach dem Abbau, 1 → 0. */
  shake: number
}

export interface Obstacle {
  x: number
  z: number
  r: number
  kind: 'tree' | 'rock'
  scale: number
  rotation: number
  variant: number
}

export interface BuildSlot {
  building: BuildingId
  pos: Vec2
}

export interface CampState {
  /** Stufe je Gebäude. 0 = nicht gebaut. Kern beginnt bei 1. */
  buildings: Partial<Record<BuildingId, number>>
  stock: Stock
  slots: BuildSlot[]
}

export interface EmberState {
  charge: number
  capacity: number
  lightRadius: number
  drainRate: number
  regen: number
  minCharge: number
  damaged: boolean
  threshold: 'ok' | 'low' | 'critical'
}

export interface ClockState {
  phase: DayPhase
  phaseTime: number
  phaseDuration: number
  /** Laufende Nacht, 0 vor der ersten. */
  night: number
  nightsSurvived: number
  elapsed: number
  /** 1 = voller Tag, 0 = tiefe Nacht. */
  sun: number
}

export interface PendingWave {
  night: number
  delay: number
  /** Absoluter Zeitpunkt (elapsed), gesetzt beim Nachtbeginn. */
  at: number
  enemies: Partial<Record<EnemyId, number>>
  announced: boolean
  spawned: boolean
  angle: number
}

export type InteractKind = 'node' | 'core' | 'slot' | 'secret'

export interface Interactable {
  kind: InteractKind
  id: number
  label: string
}

export interface ObjectiveState {
  primary: number
  secondary: number
  secondaryFailed: boolean
}

export interface WorldStats {
  gathered: number
  deposited: number
  damageTaken: number
  enemiesKilled: number
  distanceWalked: number
  maxDistanceFromCamp: number
}

export type WorldStatus = 'running' | 'dead' | 'complete'

/** Was das Lager zwischen Leveln behält (Profil). */
export interface CampSnapshot {
  buildings: Partial<Record<BuildingId, number>>
  stock: Stock
  tools: ToolId[]
}

export interface World {
  readonly level: LevelDef
  readonly worldDef: WorldDef
  readonly rng: Rng
  readonly events: EventBus<GameEvents>
  readonly size: number
  readonly half: number
  readonly terrain: Terrain
  readonly collision: SpatialHash

  player: PlayerState
  enemies: EnemyState[]
  nodes: ResourceNodeState[]
  obstacles: Obstacle[]
  camp: CampState
  ember: EmberState
  clock: ClockState
  waves: PendingWave[]
  secret: { pos: Vec2; found: boolean }
  interactable: Interactable | null
  objectives: ObjectiveState
  hintsShown: Set<HintTrigger>
  stats: WorldStats
  status: WorldStatus
  deathCause: string | null
  nextId: number
}

export const CAMP_POS: Readonly<Vec2> = Object.freeze(vec2(0, 0))
export const PLAYER_START: Readonly<Vec2> = Object.freeze(vec2(0, 4))
/** Blickrichtung zu Beginn: weg vom Lager, in die Karte hinein (−z). */
export const START_FACING = -Math.PI / 2

export function createEmptyWorld(level: LevelDef, worldDef: WorldDef, camp: CampSnapshot): World {
  const rng = new Rng(level.seed)
  const startPhase = level.cycle.startPhase
  const phaseDuration =
    startPhase === 'day'
      ? level.cycle.dayDuration
      : startPhase === 'dusk'
        ? level.cycle.duskDuration
        : startPhase === 'night'
          ? level.cycle.nightDuration
          : level.cycle.dawnDuration

  return {
    level,
    worldDef,
    rng,
    events: new EventBus<GameEvents>(),
    size: level.terrain.size,
    half: level.terrain.size / 2,
    terrain: new Terrain(level.terrain.size, level.terrain.elevation, level.seed ^ 0x7e11),
    collision: new SpatialHash(level.terrain.size),

    player: {
      pos: vec2(PLAYER_START.x, PLAYER_START.z),
      prevPos: vec2(PLAYER_START.x, PLAYER_START.z),
      vel: vec2(),
      facing: START_FACING,
      hp: level.player.hp,
      maxHp: level.player.hp,
      radius: 0.42,
      sprinting: false,
      attackCooldown: 0,
      attackAnim: 0,
      invulnerable: 0,
      gatherProgress: 0,
      inventory: {},
      carryCapacity: level.player.carryCapacity,
      weight: 0,
      tools: new Set(camp.tools),
      alive: true,
      lastDamageSource: '',
      stride: 0,
    },
    enemies: [],
    nodes: [],
    obstacles: [],
    camp: {
      buildings: { core: 1, ...camp.buildings },
      stock: { ...camp.stock },
      slots: [
        { building: 'workbench', pos: vec2(3.6, 2.4) },
        { building: 'storage', pos: vec2(-3.6, 2.4) },
        { building: 'tower', pos: vec2(0, -4.2) },
      ],
    },
    ember: {
      charge: level.ember.startCharge,
      capacity: 100,
      lightRadius: level.ember.lightRadiusMin,
      drainRate: 0,
      regen: 0,
      minCharge: level.ember.startCharge,
      damaged: false,
      threshold: 'ok',
    },
    clock: {
      phase: startPhase,
      phaseTime: 0,
      phaseDuration,
      night: startPhase === 'night' ? 1 : 0,
      nightsSurvived: 0,
      elapsed: 0,
      sun: startPhase === 'day' ? 1 : startPhase === 'night' ? 0 : 0.5,
    },
    waves: [],
    secret: { pos: vec2(), found: false },
    interactable: null,
    objectives: { primary: 0, secondary: 0, secondaryFailed: false },
    hintsShown: new Set(),
    stats: {
      gathered: 0,
      deposited: 0,
      damageTaken: 0,
      enemiesKilled: 0,
      distanceWalked: 0,
      maxDistanceFromCamp: 0,
    },
    status: 'running',
    deathCause: null,
    nextId: 1,
  }
}

/** Stufe eines Gebäudes, 0 wenn nicht gebaut. */
export function buildingLevel(w: World, id: BuildingId): number {
  return w.camp.buildings[id] ?? 0
}

export function stockOf(stock: Stock, id: keyof Stock): number {
  return stock[id] ?? 0
}
