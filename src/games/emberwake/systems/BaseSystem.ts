import { BUILDINGS } from '@/games/emberwake/data/buildings'
import { RECIPES } from '@/games/emberwake/data/recipes'
import type { BuildingId, RecipeDef } from '@/games/emberwake/data/schema/types'
import { buildingLevel, type World } from '@/games/emberwake/world/World'
import { stockHas, stockTake } from './InventorySystem'

/**
 * Lager: Gebäude, Ausbaustufen, Crafting (GAME_DESIGN.md §7).
 * Bauen kostet Ressourcen UND Kernenergie — auch das ist Lichtschuld.
 */

/** Unter diesen Ladestand darf Bauen den Kern nie drücken. */
const CORE_RESERVE = 6

export interface Availability {
  ok: boolean
  reason: string | null
}

export function nextBuildingLevel(w: World, id: BuildingId): number {
  return buildingLevel(w, id) + 1
}

export function canBuild(w: World, id: BuildingId): Availability {
  const def = BUILDINGS[id]
  const current = buildingLevel(w, id)
  const next = current + 1
  if (next > def.levels.length) return { ok: false, reason: 'Höchste Stufe erreicht' }
  if (!w.level.camp.unlockedBuildings.includes(id) && current === 0) {
    return { ok: false, reason: 'Noch nicht freigeschaltet' }
  }
  const lvl = def.levels[next - 1]!
  if (!stockHas(w.camp.stock, lvl.cost)) return { ok: false, reason: 'Zu wenig Material' }
  if (w.ember.charge - lvl.emberCost < CORE_RESERVE) return { ok: false, reason: 'Kern zu schwach' }
  return { ok: true, reason: null }
}

export function build(w: World, id: BuildingId): boolean {
  const check = canBuild(w, id)
  if (!check.ok) return false
  const def = BUILDINGS[id]
  const next = buildingLevel(w, id) + 1
  const lvl = def.levels[next - 1]!

  stockTake(w.camp.stock, lvl.cost)
  w.ember.charge -= lvl.emberCost
  w.camp.buildings[id] = next

  // Neuer Bauplatz wird Hindernis
  if (next === 1 && id !== 'core') {
    const slot = w.camp.slots.find((s) => s.building === id)
    if (slot) w.collision.insert({ x: slot.pos.x, z: slot.pos.z, r: 0.8 })
  }

  recomputeCampEffects(w)
  w.events.emit('built', { building: id, level: next })
  return true
}

export function availableRecipes(w: World): RecipeDef[] {
  return RECIPES.filter((r) => buildingLevel(w, r.requires.building) >= r.requires.level)
}

export function canCraft(w: World, recipe: RecipeDef): Availability {
  if (w.player.tools.has(recipe.result)) return { ok: false, reason: 'Bereits vorhanden' }
  if (buildingLevel(w, recipe.requires.building) < recipe.requires.level) {
    return { ok: false, reason: `${BUILDINGS[recipe.requires.building].name} nötig` }
  }
  if (!stockHas(w.camp.stock, recipe.cost)) return { ok: false, reason: 'Zu wenig Material' }
  if (w.ember.charge - recipe.emberCost < CORE_RESERVE)
    return { ok: false, reason: 'Kern zu schwach' }
  return { ok: true, reason: null }
}

export function craft(w: World, recipe: RecipeDef): boolean {
  if (!canCraft(w, recipe).ok) return false
  stockTake(w.camp.stock, recipe.cost)
  w.ember.charge -= recipe.emberCost
  w.player.tools.add(recipe.result)
  w.events.emit('crafted', { item: recipe.result })
  return true
}

/** Leitet Kapazität, Regeneration und Traglast aus den Gebäudestufen ab. */
export function recomputeCampEffects(w: World): void {
  let capacity = 100
  let regen = 0
  let carry = w.level.player.carryCapacity

  for (const key in w.camp.buildings) {
    const id = key as BuildingId
    const level = w.camp.buildings[id] ?? 0
    const def = BUILDINGS[id]
    for (let i = 0; i < level && i < def.levels.length; i++) {
      const fx = def.levels[i]!.effects
      capacity += fx.coreCapacity ?? 0
      regen += fx.coreRegen ?? 0
      carry += fx.carryCapacity ?? 0
    }
  }

  w.ember.capacity = capacity
  w.ember.regen = regen
  w.player.carryCapacity = carry
}
