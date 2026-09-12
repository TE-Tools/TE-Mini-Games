import { ITEMS } from '@/games/emberwake/data/items'
import type { ItemId, Stock } from '@/games/emberwake/data/schema/types'
import type { World } from '@/games/emberwake/world/World'

/**
 * Ballast (GAME_DESIGN.md §2.2).
 *
 * Kein Fächer-Inventar. Gewicht bestimmt das Lauftempo. Das Artefakt
 * wiegt viel. Zwanzig Holz wiegen viel. Beides geht nicht.
 */

/** Wie stark volle Beladung das Tempo drückt. */
export const LOAD_SPEED_PENALTY = 0.55
/** Über der Traglast geht noch etwas — dann aber sehr langsam. */
export const OVERLOAD_LIMIT = 1.3

export function weightOf(stock: Stock): number {
  let total = 0
  for (const key in stock) {
    const id = key as ItemId
    total += (stock[id] ?? 0) * ITEMS[id].weight
  }
  return total
}

export function recomputeWeight(w: World): void {
  w.player.weight = weightOf(w.player.inventory)
}

/** 0 = leer, 1 = Traglast erreicht, bis OVERLOAD_LIMIT darüber. */
export function loadRatio(w: World): number {
  return w.player.carryCapacity > 0 ? w.player.weight / w.player.carryCapacity : 0
}

export function speedFactor(w: World): number {
  const ratio = Math.min(loadRatio(w), OVERLOAD_LIMIT)
  return Math.max(0.2, 1 - ratio * LOAD_SPEED_PENALTY)
}

/** Passt eine Einheit noch in den Rucksack? */
export function canCarry(w: World, item: ItemId, amount = 1): boolean {
  return w.player.weight + ITEMS[item].weight * amount <= w.player.carryCapacity + 1e-6
}

export function addToInventory(w: World, item: ItemId, amount: number): void {
  w.player.inventory[item] = (w.player.inventory[item] ?? 0) + amount
  recomputeWeight(w)
}

export function removeFromInventory(w: World, item: ItemId, amount: number): number {
  const have = w.player.inventory[item] ?? 0
  const n = Math.min(have, amount)
  if (n <= 0) return 0
  if (have - n <= 0) delete w.player.inventory[item]
  else w.player.inventory[item] = have - n
  recomputeWeight(w)
  return n
}

export function hasAnyResources(w: World): boolean {
  for (const key in w.player.inventory) {
    if ((w.player.inventory[key as ItemId] ?? 0) > 0) return true
  }
  return false
}

/** Alles aus dem Rucksack in den Lagerbestand. */
export function depositAll(w: World): Stock {
  const moved: Stock = {}
  for (const key in w.player.inventory) {
    const id = key as ItemId
    const n = w.player.inventory[id] ?? 0
    if (n <= 0) continue
    moved[id] = n
    w.camp.stock[id] = (w.camp.stock[id] ?? 0) + n
    w.stats.deposited += n
  }
  w.player.inventory = {}
  recomputeWeight(w)
  return moved
}

/** Notbremse: Halber Wert geht verloren, Tempo kommt zurück. */
export function dropHeaviest(w: World): { item: ItemId; amount: number } | null {
  let best: ItemId | null = null
  let bestWeight = 0
  for (const key in w.player.inventory) {
    const id = key as ItemId
    const total = (w.player.inventory[id] ?? 0) * ITEMS[id].weight
    if (total > bestWeight) {
      bestWeight = total
      best = id
    }
  }
  if (!best) return null
  const have = w.player.inventory[best] ?? 0
  const drop = Math.max(1, Math.ceil(have / 2))
  removeFromInventory(w, best, drop)
  w.events.emit('item_dropped', { item: best, amount: drop })
  return { item: best, amount: drop }
}

export function stockHas(stock: Stock, cost: Stock): boolean {
  for (const key in cost) {
    const id = key as ItemId
    if ((stock[id] ?? 0) < (cost[id] ?? 0)) return false
  }
  return true
}

export function stockTake(stock: Stock, cost: Stock): void {
  for (const key in cost) {
    const id = key as ItemId
    const left = (stock[id] ?? 0) - (cost[id] ?? 0)
    if (left <= 0) delete stock[id]
    else stock[id] = left
  }
}
