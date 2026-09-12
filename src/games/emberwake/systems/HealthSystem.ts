import type { World } from '@/games/emberwake/world/World'
import { coreExposureAt } from './EmberSystem'
import { dist2 } from '@/games/emberwake/core/math'

/**
 * Gesundheit und Tod des Spielers.
 * Der Todesbildschirm nennt immer die konkrete Ursache (§84) —
 * deshalb trägt jeder Schaden eine Quelle.
 */

const CAMP_REGEN_PER_SECOND = 4
const REGEN_ENEMY_RADIUS = 8
const INVULN_AFTER_HIT = 0.35

export function damagePlayer(w: World, amount: number, source: string): void {
  const p = w.player
  if (!p.alive || p.invulnerable > 0 || w.status !== 'running') return
  p.hp = Math.max(0, p.hp - amount)
  p.invulnerable = INVULN_AFTER_HIT
  p.lastDamageSource = source
  w.stats.damageTaken += amount
  w.events.emit('player_damaged', { amount, hp: p.hp, source })
  if (p.hp <= 0) killPlayer(w, source)
}

export function killPlayer(w: World, cause: string): void {
  if (w.status !== 'running') return
  w.player.alive = false
  w.status = 'dead'
  w.deathCause = cause
  w.events.emit('player_died', { cause })
}

export function updateHealth(w: World, dt: number): void {
  const p = w.player
  if (!p.alive) return
  if (p.invulnerable > 0) p.invulnerable -= dt

  // Regeneration nur im Kernlicht und ohne Gegner in der Nähe.
  if (p.hp < p.maxHp && coreExposureAt(w, p.pos) > 0.55) {
    let enemyNear = false
    for (let i = 0; i < w.enemies.length; i++) {
      const e = w.enemies[i]!
      if (e.alive && dist2(e.pos, p.pos) < REGEN_ENEMY_RADIUS * REGEN_ENEMY_RADIUS) {
        enemyNear = true
        break
      }
    }
    if (!enemyNear) p.hp = Math.min(p.maxHp, p.hp + CAMP_REGEN_PER_SECOND * dt)
  }
}

/** Nahrung essen: heilt sofort. */
export function eatFood(w: World): boolean {
  const have = w.camp.stock.food ?? 0
  if (have <= 0 || w.player.hp >= w.player.maxHp) return false
  w.camp.stock.food = have - 1
  w.player.hp = Math.min(w.player.maxHp, w.player.hp + 30)
  return true
}
