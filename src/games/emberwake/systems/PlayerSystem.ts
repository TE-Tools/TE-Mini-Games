import { angleDelta, dist, len, normalize, set, vec2 } from '@/games/emberwake/core/math'
import { CAMP_POS, type World } from '@/games/emberwake/world/World'
import { damageEnemy } from '@/games/emberwake/ai/EnemyAI'
import { speedFactor } from './InventorySystem'

/**
 * Bewegung und Nahkampf des Spielers.
 * Eingaben kommen als bereits normalisierte Absicht (InputFrame),
 * die Simulation kennt keine Touch-Ereignisse.
 */

export interface InputFrame {
  /** Bewegungsrichtung in der Ebene, Länge ≤ 1. */
  moveX: number
  moveZ: number
  sprint: boolean
  actionHeld: boolean
  actionPressed: boolean
  attackPressed: boolean
  dropPressed: boolean
}

export function emptyInput(): InputFrame {
  return {
    moveX: 0,
    moveZ: 0,
    sprint: false,
    actionHeld: false,
    actionPressed: false,
    attackPressed: false,
    dropPressed: false,
  }
}

export const PLAYER_BASE_SPEED = 3.4
const SPRINT_FACTOR = 1.35
const SPRINT_MAX_LOAD = 0.85
const ATTACK_RANGE = 1.9
const ATTACK_ARC = 1.05 // Radiant, halber Öffnungswinkel
const ATTACK_COOLDOWN = 0.5
const ATTACK_DAMAGE = 12
const AXE_BONUS = 6

const move = vec2()

export function updatePlayer(w: World, input: InputFrame, dt: number): void {
  const p = w.player
  if (!p.alive) return

  p.prevPos.x = p.pos.x
  p.prevPos.z = p.pos.z

  set(move, input.moveX, input.moveZ)
  const strength = Math.min(1, len(move))
  if (strength > 0.02) normalize(move)
  else set(move, 0, 0)

  const loadFactor = speedFactor(w)
  const canSprint = input.sprint && p.weight / p.carryCapacity < SPRINT_MAX_LOAD
  p.sprinting = canSprint && strength > 0.5
  const speed = PLAYER_BASE_SPEED * loadFactor * (p.sprinting ? SPRINT_FACTOR : 1) * strength

  p.vel.x = move.x * speed
  p.vel.z = move.z * speed
  p.pos.x += p.vel.x * dt
  p.pos.z += p.vel.z * dt
  w.collision.resolve(p.pos, p.radius)

  const dx = p.pos.x - p.prevPos.x
  const dz = p.pos.z - p.prevPos.z
  const stepLen = Math.sqrt(dx * dx + dz * dz)
  w.stats.distanceWalked += stepLen
  p.stride += stepLen

  const dCamp = dist(p.pos, CAMP_POS)
  if (dCamp > w.stats.maxDistanceFromCamp) w.stats.maxDistanceFromCamp = dCamp

  if (strength > 0.05) {
    const target = Math.atan2(move.z, move.x)
    p.facing += angleDelta(p.facing, target) * Math.min(1, dt * 12)
  }

  if (p.attackCooldown > 0) p.attackCooldown -= dt
  if (p.attackAnim > 0) p.attackAnim = Math.max(0, p.attackAnim - dt * 4)

  if (input.attackPressed && p.attackCooldown <= 0) {
    attack(w)
  }
}

function attack(w: World): void {
  const p = w.player
  p.attackCooldown = ATTACK_COOLDOWN
  p.attackAnim = 1
  const dmg = ATTACK_DAMAGE + (p.tools.has('axe') ? AXE_BONUS : 0)
  let hit = false

  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i]!
    if (!e.alive) continue
    const dx = e.pos.x - p.pos.x
    const dz = e.pos.z - p.pos.z
    const d = Math.sqrt(dx * dx + dz * dz)
    if (d > ATTACK_RANGE + e.def.radius) continue
    const a = Math.atan2(dz, dx)
    if (Math.abs(angleDelta(p.facing, a)) > ATTACK_ARC) continue
    damageEnemy(w, e, dmg)
    hit = true
  }

  w.events.emit('player_attacked', { hit })
}

/** Hat der Spieler einen lebenden Gegner in Angriffsnähe? Für die UI. */
export function enemyInAttackRange(w: World): boolean {
  const p = w.player
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i]!
    if (!e.alive) continue
    const dx = e.pos.x - p.pos.x
    const dz = e.pos.z - p.pos.z
    if (dx * dx + dz * dz <= (ATTACK_RANGE + e.def.radius + 0.6) ** 2) return true
  }
  return false
}
