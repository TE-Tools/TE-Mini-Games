import { ITEMS } from '@/games/emberwake/data/items'
import { BUILDINGS } from '@/games/emberwake/data/buildings'
import type { ItemId } from '@/games/emberwake/data/schema/types'
import { dist2 } from '@/games/emberwake/core/math'
import { CAMP_POS, type Interactable, type World } from '@/games/emberwake/world/World'
import type { InputFrame } from './PlayerSystem'
import {
  addToInventory,
  canCarry,
  depositAll,
  dropHeaviest,
  hasAnyResources,
} from './InventorySystem'
import { canBuild } from './BaseSystem'

/**
 * Was der Spieler gerade tun kann — und was passiert, wenn er es tut.
 * Die eine kontextabhängige Haupttaste (MOBILE.md §3) liest `label`.
 */

const NODE_REACH = 1.9
const CORE_REACH = 3.0
const SLOT_REACH = 2.4
const SECRET_REACH = 2.4

/** Sekunden je Einheit. */
const GATHER_TIME = 0.85
const AXE_FACTOR = 0.5

export function updateInteraction(w: World, input: InputFrame, dt: number): void {
  const p = w.player
  if (!p.alive) {
    setInteractable(w, null)
    return
  }

  const next = findInteractable(w)
  setInteractable(w, next)

  if (input.dropPressed) dropHeaviest(w)

  if (!next) {
    p.gatherProgress = 0
    return
  }

  switch (next.kind) {
    case 'node':
      if (input.actionHeld) gather(w, next.id, dt)
      else p.gatherProgress = Math.max(0, p.gatherProgress - dt * 2)
      break
    case 'core':
      if (input.actionPressed) {
        const items = depositAll(w)
        w.events.emit('deposited', { items })
        w.events.emit('camp_opened', { atWorkbench: false })
      }
      break
    case 'slot':
      if (input.actionPressed) {
        const items = depositAll(w)
        w.events.emit('deposited', { items })
        w.events.emit('camp_opened', { atWorkbench: true })
      }
      break
    case 'secret':
      if (input.actionPressed) discoverSecret(w)
      break
  }
}

function findInteractable(w: World): Interactable | null {
  const p = w.player
  let best: Interactable | null = null
  let bestD2 = Number.POSITIVE_INFINITY

  for (let i = 0; i < w.nodes.length; i++) {
    const n = w.nodes[i]!
    if (n.amount <= 0) continue
    const reach = NODE_REACH + n.radius
    const d2 = dist2(n.pos, p.pos)
    if (d2 <= reach * reach && d2 < bestD2) {
      bestD2 = d2
      best = { kind: 'node', id: n.id, label: `${ITEMS[n.resource].name} sammeln` }
    }
  }

  const dCore2 = dist2(p.pos, CAMP_POS)
  if (dCore2 <= CORE_REACH * CORE_REACH && dCore2 < bestD2) {
    bestD2 = dCore2
    best = { kind: 'core', id: 0, label: hasAnyResources(w) ? 'Einlagern' : 'Lager' }
  }

  for (let i = 0; i < w.camp.slots.length; i++) {
    const s = w.camp.slots[i]!
    const built = (w.camp.buildings[s.building] ?? 0) > 0
    const unlocked = w.level.camp.unlockedBuildings.includes(s.building)
    if (!built && !unlocked) continue
    const d2 = dist2(s.pos, p.pos)
    if (d2 <= SLOT_REACH * SLOT_REACH && d2 < bestD2) {
      bestD2 = d2
      const name = BUILDINGS[s.building].name
      best = { kind: 'slot', id: i, label: built ? name : `${name} bauen` }
    }
  }

  if (!w.secret.found) {
    const d2 = dist2(w.secret.pos, p.pos)
    if (d2 <= SECRET_REACH * SECRET_REACH && d2 < bestD2) {
      best = { kind: 'secret', id: 0, label: 'Untersuchen' }
    }
  }

  return best
}

function setInteractable(w: World, next: Interactable | null): void {
  const prev = w.interactable
  const changed =
    (prev === null) !== (next === null) ||
    (prev && next && (prev.kind !== next.kind || prev.id !== next.id || prev.label !== next.label))
  if (changed) {
    w.interactable = next
    w.events.emit('interactable_changed', { label: next?.label ?? null })
  }
}

function gather(w: World, nodeId: number, dt: number): void {
  const node = w.nodes.find((n) => n.id === nodeId)
  if (!node || node.amount <= 0) return
  const p = w.player

  if (!canCarry(w, node.resource)) {
    p.gatherProgress = 0
    w.events.emit('inventory_full', { resource: node.resource })
    return
  }

  const factor = node.resource === 'wood' && p.tools.has('axe') ? AXE_FACTOR : 1
  p.gatherProgress += dt / (GATHER_TIME * factor)

  if (p.gatherProgress >= 1) {
    p.gatherProgress = 0
    node.amount -= 1
    node.shake = 1
    addToInventory(w, node.resource, 1)
    w.stats.gathered++
    w.events.emit('resource_gathered', {
      resource: node.resource,
      amount: 1,
      x: node.pos.x,
      z: node.pos.z,
    })
  }
}

function discoverSecret(w: World): void {
  w.secret.found = true
  const reward = w.level.secret.reward
  for (const key in reward) {
    const id = key as ItemId
    addToInventory(w, id, reward[id] ?? 0)
  }
  w.events.emit('secret_found', { text: w.level.secret.text })
}

/** Sichtbarer Fortschritt der Haupttaste, 0..1. */
export function interactionProgress(w: World): number {
  return w.interactable?.kind === 'node' ? w.player.gatherProgress : 0
}

/** Kann am aktuellen Bauplatz überhaupt gebaut werden? Für die UI. */
export function slotAvailability(w: World, slotIndex: number): string | null {
  const slot = w.camp.slots[slotIndex]
  if (!slot) return null
  return canBuild(w, slot.building).reason
}
