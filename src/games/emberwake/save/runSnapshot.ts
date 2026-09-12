import type { World } from '@/games/emberwake/world/World'
import { spawnEnemy } from '@/games/emberwake/systems/WaveSystem'
import { recomputeWeight } from '@/games/emberwake/systems/InventorySystem'
import { recomputeCampEffects } from '@/games/emberwake/systems/BaseSystem'
import { enterPhase } from '@/games/emberwake/systems/DayNightSystem'
import type { RunSnapshot } from './schema'

/**
 * Laufenden Levelversuch sichern und wiederherstellen.
 * Weil die Weltgenerierung deterministisch ist, müssen nur Zustände
 * gespeichert werden, nicht die Welt selbst.
 */

export function snapshotRun(w: World): RunSnapshot {
  return {
    levelId: w.level.id,
    savedAt: Date.now(),
    clock: {
      phase: w.clock.phase,
      phaseTime: w.clock.phaseTime,
      night: w.clock.night,
      nightsSurvived: w.clock.nightsSurvived,
      elapsed: w.clock.elapsed,
    },
    ember: { charge: w.ember.charge, minCharge: w.ember.minCharge, damaged: w.ember.damaged },
    player: {
      x: w.player.pos.x,
      z: w.player.pos.z,
      facing: w.player.facing,
      hp: w.player.hp,
      inventory: { ...w.player.inventory },
      tools: Array.from(w.player.tools),
    },
    camp: { buildings: { ...w.camp.buildings }, stock: { ...w.camp.stock } },
    nodes: w.nodes.map((n) => n.amount),
    enemies: w.enemies
      .filter((e) => e.alive)
      .map((e) => ({ id: e.def.id, x: e.pos.x, z: e.pos.z, hp: e.hp })),
    waves: w.waves.map((wv) => ({
      at: wv.at,
      announced: wv.announced,
      spawned: wv.spawned,
      angle: wv.angle,
    })),
    secretFound: w.secret.found,
    hintsShown: Array.from(w.hintsShown),
    stats: { ...w.stats },
  }
}

/** Überschreibt eine frisch generierte Welt mit dem gesicherten Zustand. */
export function restoreRun(w: World, s: RunSnapshot): void {
  if (s.levelId !== w.level.id) throw new Error('Snapshot gehört zu einem anderen Level')

  w.clock.night = s.clock.night
  w.clock.nightsSurvived = s.clock.nightsSurvived
  w.clock.elapsed = s.clock.elapsed
  enterPhase(w, s.clock.phase)
  w.clock.phaseTime = s.clock.phaseTime
  // enterPhase zählt Nacht/Morgen hoch — auf gesicherte Werte zurücksetzen
  w.clock.night = s.clock.night
  w.clock.nightsSurvived = s.clock.nightsSurvived

  w.ember.charge = s.ember.charge
  w.ember.minCharge = s.ember.minCharge
  w.ember.damaged = s.ember.damaged

  w.player.pos.x = s.player.x
  w.player.pos.z = s.player.z
  w.player.prevPos.x = s.player.x
  w.player.prevPos.z = s.player.z
  w.player.facing = s.player.facing
  w.player.hp = s.player.hp
  w.player.inventory = { ...s.player.inventory }
  w.player.tools = new Set(s.player.tools)

  w.camp.buildings = { ...s.camp.buildings }
  w.camp.stock = { ...s.camp.stock }
  for (const slot of w.camp.slots) {
    if ((w.camp.buildings[slot.building] ?? 0) > 0) {
      w.collision.insert({ x: slot.pos.x, z: slot.pos.z, r: 0.8 })
    }
  }

  for (let i = 0; i < w.nodes.length && i < s.nodes.length; i++) {
    w.nodes[i]!.amount = s.nodes[i]!
  }

  w.enemies.length = 0
  for (const e of s.enemies) {
    const spawned = spawnEnemy(w, e.id, e.x, e.z)
    spawned.hp = e.hp
  }

  for (let i = 0; i < w.waves.length && i < s.waves.length; i++) {
    const src = s.waves[i]!
    const dst = w.waves[i]!
    dst.at = src.at
    dst.announced = src.announced
    dst.spawned = src.spawned
    dst.angle = src.angle
  }

  w.secret.found = s.secretFound
  w.hintsShown = new Set(s.hintsShown)
  Object.assign(w.stats, s.stats)

  recomputeCampEffects(w)
  recomputeWeight(w)
}
