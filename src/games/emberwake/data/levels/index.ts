import type { LevelDef, WorldDef } from '../schema/types'
import { LEVEL_001 } from './level001'
import { LEVEL_002 } from './level002'
import { WORLD_01 } from '../worlds/world01'

/**
 * Zentrales Register. Ein neues Level hinzuzufügen heißt:
 * Datei anlegen, hier eintragen, `npm run validate:levels`.
 */
export const LEVELS: readonly LevelDef[] = [LEVEL_001, LEVEL_002]

export const WORLDS: readonly WorldDef[] = [WORLD_01]

const levelById = new Map<number, LevelDef>(LEVELS.map((l) => [l.id, l]))
const worldById = new Map<number, WorldDef>(WORLDS.map((w) => [w.id, w]))

export function getLevel(id: number): LevelDef | undefined {
  return levelById.get(id)
}

export function getWorld(id: number): WorldDef | undefined {
  return worldById.get(id)
}

export function getWorldForLevel(level: LevelDef): WorldDef {
  const world = worldById.get(level.worldId)
  if (!world) throw new Error(`Level ${level.id} verweist auf unbekannte Welt ${level.worldId}`)
  return world
}

/** Nächstes Level nach `id`, oder undefined am Ende der vorhandenen Inhalte. */
export function getNextLevelId(id: number): number | undefined {
  const idx = LEVELS.findIndex((l) => l.id === id)
  return idx >= 0 && idx + 1 < LEVELS.length ? LEVELS[idx + 1]!.id : undefined
}
