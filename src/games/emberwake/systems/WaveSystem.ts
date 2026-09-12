import type { Rng } from '@/games/emberwake/core/Rng'
import { ENEMIES } from '@/games/emberwake/data/enemies'
import type { EnemyId } from '@/games/emberwake/data/schema/types'
import { dist2, vec2 } from '@/games/emberwake/core/math'
import {
  CAMP_POS,
  type EnemyState,
  type PendingWave,
  type World,
} from '@/games/emberwake/world/World'

/**
 * Nachtwellen (GAME_DESIGN.md §12, AI.md §7).
 *
 * Fairnessregeln, im Code erzwungen:
 * - Jede Welle wird 10 Sekunden vorher angekündigt (Richtung + Anzahl)
 * - Spawns liegen mindestens 25 m vom Spieler entfernt
 * - Kein Spawn im Rücken des Spielers: Der Ankündigungspfeil zeigt hin
 */

const ANNOUNCE_LEAD = 10
const MIN_PLAYER_DISTANCE = 25

/** Legt alle Wellen des Levels an. Zeitpunkte werden beim Nachtbeginn gesetzt. */
export function scheduleWavesForLevel(w: World): void {
  w.waves = w.level.waves.map((def) => ({
    night: def.night,
    delay: def.delay,
    at: Number.POSITIVE_INFINITY,
    enemies: def.enemies,
    announced: false,
    spawned: false,
    angle: 0,
  }))
}

export function onNightStarted(w: World): void {
  const rng = w.rng.fork(`waves-${w.clock.night}`)
  for (const wave of w.waves) {
    if (wave.night !== w.clock.night || wave.spawned) continue
    wave.at = w.clock.elapsed + wave.delay
    wave.angle = pickSpawnAngle(w, rng)
  }
}

export function onDawnStarted(w: World): void {
  // Die Stillen ziehen sich mit dem Licht zurück.
  for (const e of w.enemies) {
    if (e.alive) {
      e.mode = 'dissolve'
      e.alive = false
    }
  }
}

export function updateWaves(w: World): void {
  const now = w.clock.elapsed
  for (const wave of w.waves) {
    if (wave.spawned || !Number.isFinite(wave.at)) continue

    if (!wave.announced && now >= wave.at - ANNOUNCE_LEAD) {
      wave.announced = true
      w.events.emit('wave_incoming', {
        inSeconds: Math.max(0, wave.at - now),
        direction: wave.angle,
        count: countOf(wave.enemies),
      })
    }

    if (now >= wave.at) {
      wave.spawned = true
      spawnWave(w, wave)
    }
  }
}

function countOf(enemies: Partial<Record<EnemyId, number>>): number {
  let n = 0
  for (const key in enemies) n += enemies[key as EnemyId] ?? 0
  return n
}

function pickSpawnAngle(w: World, rng: Rng): number {
  const ring = spawnRadius(w)
  for (let attempt = 0; attempt < 16; attempt++) {
    const a = rng.angle()
    const x = CAMP_POS.x + Math.cos(a) * ring
    const z = CAMP_POS.z + Math.sin(a) * ring
    const dx = x - w.player.pos.x
    const dz = z - w.player.pos.z
    if (dx * dx + dz * dz >= MIN_PLAYER_DISTANCE * MIN_PLAYER_DISTANCE) return a
  }
  // Notfall: gegenüber vom Spieler
  return Math.atan2(CAMP_POS.z - w.player.pos.z, CAMP_POS.x - w.player.pos.x)
}

function spawnRadius(w: World): number {
  return Math.min(w.half * 0.72, 42)
}

function spawnWave(w: World, wave: PendingWave): void {
  const rng = w.rng.fork(`spawn-${wave.at.toFixed(2)}`)
  const ring = spawnRadius(w)
  let total = 0

  for (const key in wave.enemies) {
    const id = key as EnemyId
    const n = wave.enemies[id] ?? 0
    for (let i = 0; i < n; i++) {
      const a = wave.angle + rng.range(-0.35, 0.35)
      const r = ring + rng.range(-3, 3)
      let x = CAMP_POS.x + Math.cos(a) * r
      let z = CAMP_POS.z + Math.sin(a) * r
      const pos = vec2(x, z)
      w.collision.resolve(pos, ENEMIES[id].radius)
      x = pos.x
      z = pos.z
      spawnEnemy(w, id, x, z)
      total++
    }
  }

  w.events.emit('wave_started', { night: w.clock.night, count: total })
}

export function spawnEnemy(w: World, id: EnemyId, x: number, z: number): EnemyState {
  const def = ENEMIES[id]
  const e: EnemyState = {
    id: w.nextId++,
    def,
    pos: vec2(x, z),
    prevPos: vec2(x, z),
    vel: vec2(),
    facing: Math.atan2(CAMP_POS.z - z, CAMP_POS.x - x),
    hp: def.hp,
    alive: true,
    mode: 'wander',
    target: 'none',
    exposure: 0,
    attackCooldown: def.attackCooldown * 0.5,
    dissolve: 1,
    hitFlash: 0,
    lightTick: 0,
    brainTimer: 0,
    wanderAngle: w.rng.angle(),
    wanderTimer: 0,
    stuckTimer: 0,
    detourSign: 1,
    seen: false,
    attackAnim: 0,
  }
  w.enemies.push(e)
  w.events.emit('enemy_spawned', { enemy: id, x, z })
  return e
}

/** Entfernt aufgelöste Gegner ohne Allokation (Kompaktierung in place). */
export function compactEnemies(w: World): void {
  let write = 0
  for (let read = 0; read < w.enemies.length; read++) {
    const e = w.enemies[read]!
    if (e.alive || e.dissolve > 0) {
      w.enemies[write++] = e
    }
  }
  w.enemies.length = write
}

/** Nächster lebender Gegner zum Punkt, oder null. */
export function nearestEnemyDist2(w: World, x: number, z: number): number {
  let best = Number.POSITIVE_INFINITY
  const p = vec2(x, z)
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i]!
    if (!e.alive) continue
    const d = dist2(e.pos, p)
    if (d < best) best = d
  }
  return best
}
