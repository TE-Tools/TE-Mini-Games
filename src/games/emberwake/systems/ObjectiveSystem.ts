import type { ObjectiveDef } from '@/games/emberwake/data/schema/types'
import { buildingLevel, type World } from '@/games/emberwake/world/World'

/**
 * Missionsziele und Sterne (GAME_DESIGN.md §13).
 * ★ Hauptziel · ★★ Zusatzziel · ★★★ Geheimnis. Nicht gestaffelt.
 */

export function updateObjectives(w: World): void {
  if (w.status !== 'running') return

  const primary = progressOf(w, w.level.objectives.primary)
  const secondaryResult = evaluateSecondary(w, w.level.objectives.secondary)

  const o = w.objectives
  const changed =
    Math.abs(primary - o.primary) > 1e-3 ||
    Math.abs(secondaryResult.progress - o.secondary) > 1e-3 ||
    secondaryResult.failed !== o.secondaryFailed

  o.primary = primary
  o.secondary = secondaryResult.progress
  o.secondaryFailed = secondaryResult.failed

  if (changed) {
    w.events.emit('objective_progress', {
      primary: o.primary,
      secondary: o.secondary,
      secondaryFailed: o.secondaryFailed,
    })
  }

  if (primary >= 1) completeLevel(w)
}

/** Fortschritt 0..1. Für Bedingungen, die erst am Ende feststehen, 0 oder 1. */
function progressOf(w: World, def: ObjectiveDef): number {
  switch (def.kind) {
    case 'store_resource':
      return Math.min(1, (w.camp.stock[def.resource] ?? 0) / def.amount)
    case 'core_charge':
      return Math.min(1, w.ember.charge / def.threshold)
    case 'survive_nights':
      return Math.min(1, w.clock.nightsSurvived / def.nights)
    case 'core_never_below':
      return w.ember.minCharge >= def.threshold ? 1 : 0
    case 'time_under':
      return Math.min(1, w.clock.elapsed / def.seconds)
    case 'craft':
      return w.player.tools.has(def.item) ? 1 : 0
    case 'build':
      return buildingLevel(w, def.building) >= def.level ? 1 : 0
    case 'core_undamaged':
      return w.ember.damaged ? 0 : 1
  }
}

/** Zusatzziele können endgültig scheitern — das zeigen wir ehrlich an. */
function evaluateSecondary(w: World, def: ObjectiveDef): { progress: number; failed: boolean } {
  switch (def.kind) {
    case 'core_never_below':
      return {
        progress: w.ember.minCharge >= def.threshold ? 1 : 0,
        failed: w.ember.minCharge < def.threshold,
      }
    case 'time_under':
      return {
        progress: Math.min(1, w.clock.elapsed / def.seconds),
        failed: w.clock.elapsed > def.seconds,
      }
    case 'core_undamaged':
      return { progress: w.ember.damaged ? 0 : 1, failed: w.ember.damaged }
    default:
      return { progress: progressOf(w, def), failed: false }
  }
}

/**
 * Ist das Zusatzziel beim Levelabschluss erfüllt?
 * „Unter vier Minuten" gilt, wenn der Abschluss vor der Frist liegt —
 * nicht erst, wenn die Frist abläuft.
 */
export function secondaryAchieved(w: World, def: ObjectiveDef): boolean {
  switch (def.kind) {
    case 'time_under':
      return w.clock.elapsed <= def.seconds
    case 'core_never_below':
      return w.ember.minCharge >= def.threshold
    case 'core_undamaged':
      return !w.ember.damaged
    default:
      return progressOf(w, def) >= 1
  }
}

function completeLevel(w: World): void {
  w.status = 'complete'
  const secondaryOk = secondaryAchieved(w, w.level.objectives.secondary)
  const stars = 1 + (secondaryOk ? 1 : 0) + (w.secret.found ? 1 : 0)
  w.events.emit('level_completed', {
    stars,
    timeSeconds: w.clock.elapsed,
    secondary: secondaryOk,
    secret: w.secret.found,
  })
}

export function objectiveText(def: ObjectiveDef): string {
  return def.text
}
