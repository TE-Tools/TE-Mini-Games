import { clamp, clamp01, dist, lerp } from '@/games/emberwake/core/math'
import type { Vec2 } from '@/games/emberwake/core/math'
import { CAMP_POS, type World } from '@/games/emberwake/world/World'
import { killPlayer } from './HealthSystem'

/**
 * ★ Kernmechanik „Lichtschuld" (GAME_DESIGN.md §2.1).
 *
 * Die Laterne des Spielers zieht Energie aus dem Kern — quadratisch
 * steigend mit der Entfernung zum Lager. Der Kern ist gleichzeitig
 * Nachtverteidigung (Lichtradius), Energiequelle (Bauen, Craften)
 * und Laternen-Treibstoff. Eine Zahl, alle Spannung.
 */

const LANTERN_RADIUS = 3.6
const LANTERN_MAX_EXPOSURE = 0.4
const TORCH_RADIUS = 5.2
const TORCH_MAX_EXPOSURE = 0.55

export function updateEmber(w: World, dt: number): void {
  const e = w.ember
  const cfg = w.level.ember

  const d = w.player.alive ? dist(w.player.pos, CAMP_POS) : 0
  const far = d / cfg.drainRange
  e.drainRate = cfg.drainBase + far * far * cfg.drainDistanceFactor

  e.charge += (e.regen - e.drainRate) * dt
  e.charge = clamp(e.charge, 0, e.capacity)
  if (e.charge < e.minCharge) e.minCharge = e.charge

  // Lichtradius folgt dem Ladestand bis 100 %, Ausbau erweitert das Maximum.
  const fill = clamp01(e.charge / 100)
  const bonus = e.capacity > 100 ? (e.capacity - 100) * 0.05 : 0
  e.lightRadius = lerp(cfg.lightRadiusMin, cfg.lightRadiusMax + bonus, Math.sqrt(fill))

  updateThreshold(w)

  if (e.charge <= 0 && w.status === 'running') {
    killPlayer(w, `Der Kern erlosch nach ${formatElapsed(w.clock.elapsed)}`)
  }
}

function updateThreshold(w: World): void {
  const e = w.ember
  const prev = e.threshold
  if (e.charge < 10) e.threshold = 'critical'
  else if (e.charge < 25) e.threshold = 'low'
  else if (e.charge >= 30) e.threshold = 'ok'

  if (prev !== e.threshold) {
    if (e.threshold === 'ok') w.events.emit('core_threshold', { state: 'recovered' })
    else w.events.emit('core_threshold', { state: e.threshold })
  }
}

/** Zunderholz aus dem Lagerbestand in den Kern geben. */
export function refuelCore(w: World, wood: number): number {
  const available = w.camp.stock.wood ?? 0
  const n = Math.max(0, Math.min(wood, available))
  if (n === 0) return 0
  w.camp.stock.wood = available - n
  w.ember.charge = clamp(w.ember.charge + n * w.level.ember.regenPerWood, 0, w.ember.capacity)
  w.events.emit('core_refueled', { wood: n, charge: w.ember.charge })
  return n
}

/** Glutkristall: hochwertige Ladung. */
export function refuelWithCrystal(w: World, count: number): number {
  const available = w.camp.stock.crystal ?? 0
  const n = Math.max(0, Math.min(count, available))
  if (n === 0) return 0
  w.camp.stock.crystal = available - n
  w.ember.charge = clamp(w.ember.charge + n * 25, 0, w.ember.capacity)
  w.events.emit('core_refueled', { wood: 0, charge: w.ember.charge })
  return n
}

export function damageCore(w: World, amount: number): void {
  w.ember.charge = clamp(w.ember.charge - amount, 0, w.ember.capacity)
  w.ember.damaged = true
  w.events.emit('core_damaged', { amount, charge: w.ember.charge })
}

/** Lichtstärke des Kerns an einem Punkt, 0..1. */
export function coreExposureAt(w: World, pos: Vec2): number {
  const d = dist(pos, CAMP_POS)
  const r = w.ember.lightRadius
  if (d >= r) return 0
  return Math.sqrt(1 - d / r)
}

/** Lichtstärke der Spielerlaterne an einem Punkt, 0..cap. */
export function lanternExposureAt(w: World, pos: Vec2): number {
  if (!w.player.alive) return 0
  const torch = w.player.tools.has('torch')
  const radius = torch ? TORCH_RADIUS : LANTERN_RADIUS
  const cap = torch ? TORCH_MAX_EXPOSURE : LANTERN_MAX_EXPOSURE
  const d = dist(pos, w.player.pos)
  if (d >= radius) return 0
  return Math.sqrt(1 - d / radius) * cap
}

/**
 * Gesamtlicht an einem Punkt. Kombiniert wie unabhängige Quellen:
 * 1 − (1−a)(1−b). Nahe am Lager kippt die Laterne einen Gegner über
 * seine Schwelle — weit draußen reicht sie allein nicht.
 */
export function exposureAt(w: World, pos: Vec2): number {
  const a = coreExposureAt(w, pos)
  const b = lanternExposureAt(w, pos)
  return 1 - (1 - a) * (1 - b)
}

export function lanternRadius(w: World): number {
  return w.player.tools.has('torch') ? TORCH_RADIUS : LANTERN_RADIUS
}

export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}
