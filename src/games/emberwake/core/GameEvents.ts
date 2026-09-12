import type {
  BuildingId,
  DayPhase,
  EnemyId,
  ItemId,
  ResourceId,
  Stock,
  ToolId,
} from '@/games/emberwake/data/schema/types'

/**
 * Alle Ereignisse, die die Simulation nach außen meldet.
 * UI, Audio, Haptik und Rendering hören hier zu — die Simulation
 * kennt keinen davon.
 */
export interface GameEvents {
  // Zeit
  phase_changed: { phase: DayPhase; night: number }
  wave_incoming: { inSeconds: number; direction: number; count: number }
  wave_started: { night: number; count: number }

  // Sammeln und Lager
  resource_gathered: { resource: ResourceId; amount: number; x: number; z: number }
  inventory_full: { resource: ResourceId }
  deposited: { items: Stock }
  camp_opened: { atWorkbench: boolean }
  core_refueled: { wood: number; charge: number }
  built: { building: BuildingId; level: number }
  crafted: { item: ToolId }

  // Kern
  core_threshold: { state: 'low' | 'critical' | 'recovered' }
  core_damaged: { amount: number; charge: number }

  // Kampf
  player_damaged: { amount: number; hp: number; source: string }
  player_attacked: { hit: boolean }
  enemy_damaged: { id: number; amount: number; x: number; z: number; byLight: boolean }
  enemy_died: { enemy: EnemyId; x: number; z: number }
  enemy_spawned: { enemy: EnemyId; x: number; z: number }
  enemy_seen: { enemy: EnemyId }

  // Verlauf
  player_died: { cause: string }
  level_completed: { stars: number; timeSeconds: number; secondary: boolean; secret: boolean }
  objective_progress: { primary: number; secondary: number; secondaryFailed: boolean }
  secret_found: { text: string }
  lore: { text: string }
  hint: { text: string }
  interactable_changed: { label: string | null }
  item_dropped: { item: ItemId; amount: number }
}
