import {
  angleDelta,
  dist,
  dist2,
  normalize,
  set,
  vec2,
  type Vec2,
} from '@/games/emberwake/core/math'
import { CAMP_POS, type EnemyState, type World } from '@/games/emberwake/world/World'
import {
  coreExposureAt,
  damageCore,
  exposureAt,
  lanternExposureAt,
} from '@/games/emberwake/systems/EmberSystem'
import { damagePlayer } from '@/games/emberwake/systems/HealthSystem'

/**
 * Gegner-KI (docs/AI.md).
 *
 * Drei Ebenen: Absicht (aus den Daten), Entscheidung (Brain, 5 Hz),
 * Bewegung (Steering, 30 Hz). Der wichtigste Wert ist `exposure` —
 * wie hell der Gegner gerade steht. Daran hängt Flucht und Lichtschaden,
 * und damit hängt die Bedrohung direkt am Kern des Spielers.
 *
 * Vertical Slice: direktes Steering mit Hindernis-Ausweichen.
 * Flow-Field-Wegfindung folgt in Phase 2 (TODO A-03).
 */

const BRAIN_INTERVAL = 0.2
const SEPARATION_RADIUS = 1.4
const LIGHT_DAMAGE_PER_SECOND = 9
const FLEE_SPEED_FACTOR = 1.25
const DISSOLVE_SPEED = 1.6

const scratchDir = vec2()
const scratchSep = vec2()
const scratchAway = vec2()

export function updateEnemies(w: World, dt: number): void {
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i]!
    e.prevPos.x = e.pos.x
    e.prevPos.z = e.pos.z

    if (!e.alive) {
      e.dissolve = Math.max(0, e.dissolve - DISSOLVE_SPEED * dt)
      continue
    }

    e.brainTimer -= dt
    if (e.brainTimer <= 0) {
      e.brainTimer = BRAIN_INTERVAL
      think(w, e)
    }

    act(w, e, dt)
    applyLight(w, e, dt)

    if (e.hitFlash > 0) e.hitFlash -= dt
    if (e.attackAnim > 0) e.attackAnim -= dt * 3
    if (e.attackCooldown > 0) e.attackCooldown -= dt
  }
}

/** Entscheidung: Was will der Gegner gerade? */
function think(w: World, e: EnemyState): void {
  const def = e.def
  e.exposure = exposureAt(w, e.pos)

  // Flucht hat Vorrang — Licht ist die Regel, die alle kennen.
  if (e.exposure > def.lightTolerance) {
    e.mode = 'flee'
    return
  }

  const dPlayer = w.player.alive ? dist(e.pos, w.player.pos) : Number.POSITIVE_INFINITY
  const dCore = dist(e.pos, CAMP_POS)

  switch (def.intent) {
    case 'core':
      e.target = 'core'
      break
    case 'player':
      e.target = dPlayer < def.perceptionRange ? 'player' : 'none'
      break
    case 'nearest': {
      const seesPlayer = dPlayer < def.perceptionRange
      const seesCore = dCore < def.perceptionRange
      if (seesPlayer && (!seesCore || dPlayer <= dCore)) e.target = 'player'
      else if (seesCore) e.target = 'core'
      else e.target = 'none'
      break
    }
  }

  if (e.target === 'none') {
    // Nichts wahrgenommen: Die Stillen ziehen zum Kern — sie wollen das Licht,
    // das sie verloren haben. Ohne diesen Zug bliebe eine Welle am Kartenrand stehen.
    e.target = 'core'
  }

  const targetDist = e.target === 'player' ? dPlayer : dCore - 0.9
  const reach = def.attackRange + (e.target === 'player' ? w.player.radius : 0)
  e.mode = targetDist <= reach ? 'attack' : 'chase'

  if (!e.seen && dPlayer < 20) {
    e.seen = true
    w.events.emit('enemy_seen', { enemy: def.id })
  }
}

/** Bewegung und Angriff für diesen Tick. */
function act(w: World, e: EnemyState, dt: number): void {
  const def = e.def
  let speed = def.speed
  set(scratchDir, 0, 0)

  switch (e.mode) {
    case 'flee': {
      fleeDirection(w, e, scratchAway)
      scratchDir.x = scratchAway.x
      scratchDir.z = scratchAway.z
      speed *= FLEE_SPEED_FACTOR
      break
    }
    case 'chase': {
      const t = targetPos(w, e)
      set(scratchDir, t.x - e.pos.x, t.z - e.pos.z)
      normalize(scratchDir)
      break
    }
    case 'attack': {
      const t = targetPos(w, e)
      e.facing = Math.atan2(t.z - e.pos.z, t.x - e.pos.x)
      if (e.attackCooldown <= 0) {
        e.attackCooldown = def.attackCooldown
        e.attackAnim = 1
        if (e.target === 'player') damagePlayer(w, def.damage, def.killVerb)
        else damageCore(w, def.damage)
      }
      speed = 0
      break
    }
    case 'wander': {
      e.wanderTimer -= dt
      if (e.wanderTimer <= 0) {
        e.wanderTimer = w.rng.range(1.5, 3.5)
        e.wanderAngle += w.rng.range(-1.2, 1.2)
      }
      set(scratchDir, Math.cos(e.wanderAngle), Math.sin(e.wanderAngle))
      speed *= 0.45
      break
    }
    case 'dissolve':
      return
  }

  // Trennung von anderen Gegnern — sie sollen nicht ineinander stehen.
  set(scratchSep, 0, 0)
  for (let i = 0; i < w.enemies.length; i++) {
    const o = w.enemies[i]!
    if (o === e || !o.alive) continue
    const d2 = dist2(o.pos, e.pos)
    const minD = SEPARATION_RADIUS * (e.def.radius + o.def.radius)
    if (d2 < minD * minD && d2 > 1e-6) {
      const d = Math.sqrt(d2)
      const push = (minD - d) / minD
      scratchSep.x += ((e.pos.x - o.pos.x) / d) * push
      scratchSep.z += ((e.pos.z - o.pos.z) / d) * push
    }
  }

  // Umweg, wenn wir feststecken.
  if (e.stuckTimer > 0) {
    e.stuckTimer -= dt
    const a = Math.atan2(scratchDir.z, scratchDir.x) + e.detourSign * 1.2
    set(scratchDir, Math.cos(a), Math.sin(a))
  }

  const vx = (scratchDir.x + scratchSep.x * 0.8) * speed
  const vz = (scratchDir.z + scratchSep.z * 0.8) * speed
  e.vel.x = vx
  e.vel.z = vz

  const beforeX = e.pos.x
  const beforeZ = e.pos.z
  e.pos.x += vx * dt
  e.pos.z += vz * dt
  w.collision.resolve(e.pos, def.radius)

  // Steckt er fest? (deutlich weniger Bewegung als erwartet)
  if (speed > 0 && e.mode !== 'attack') {
    const moved2 = (e.pos.x - beforeX) ** 2 + (e.pos.z - beforeZ) ** 2
    const expected2 = (speed * dt) ** 2
    if (moved2 < expected2 * 0.15 && e.stuckTimer <= 0) {
      e.stuckTimer = 0.9
      e.detourSign = w.rng.chance(0.5) ? 1 : -1
    }
  }

  if (vx * vx + vz * vz > 1e-4) {
    const targetFacing = Math.atan2(vz, vx)
    e.facing += angleDelta(e.facing, targetFacing) * Math.min(1, dt * 8)
  }
}

/** Lichtschaden: Wer über seiner Schwelle steht, verglüht langsam. */
function applyLight(w: World, e: EnemyState, dt: number): void {
  if (e.exposure <= e.def.lightTolerance) return
  const over = (e.exposure - e.def.lightTolerance) / Math.max(0.05, 1 - e.def.lightTolerance)
  const dmg = LIGHT_DAMAGE_PER_SECOND * over * dt
  e.hp -= dmg
  e.lightTick -= dt
  if (e.lightTick <= 0) {
    e.lightTick = 0.45
    w.events.emit('enemy_damaged', { id: e.id, amount: dmg, x: e.pos.x, z: e.pos.z, byLight: true })
  }
  if (e.hp <= 0) killEnemy(w, e)
}

export function damageEnemy(w: World, e: EnemyState, amount: number): void {
  if (!e.alive) return
  e.hp -= amount
  e.hitFlash = 0.18
  w.events.emit('enemy_damaged', { id: e.id, amount, x: e.pos.x, z: e.pos.z, byLight: false })
  if (e.hp <= 0) killEnemy(w, e)
}

export function killEnemy(w: World, e: EnemyState): void {
  if (!e.alive) return
  e.alive = false
  e.mode = 'dissolve'
  e.vel.x = 0
  e.vel.z = 0
  w.stats.enemiesKilled++
  w.events.emit('enemy_died', { enemy: e.def.id, x: e.pos.x, z: e.pos.z })
}

function targetPos(w: World, e: EnemyState): Vec2 {
  return e.target === 'player' ? w.player.pos : CAMP_POS
}

/** Weg von der stärksten Lichtquelle. */
function fleeDirection(w: World, e: EnemyState, out: Vec2): Vec2 {
  const fromCore = coreExposureAt(w, e.pos)
  const fromLantern = lanternExposureAt(w, e.pos)
  const src = fromCore >= fromLantern ? CAMP_POS : w.player.pos
  set(out, e.pos.x - src.x, e.pos.z - src.z)
  if (out.x * out.x + out.z * out.z < 1e-6)
    set(out, Math.cos(e.wanderAngle), Math.sin(e.wanderAngle))
  return normalize(out)
}
