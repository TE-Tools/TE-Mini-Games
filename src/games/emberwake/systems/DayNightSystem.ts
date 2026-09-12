import type { DayPhase } from '@/games/emberwake/data/schema/types'
import type { World } from '@/games/emberwake/world/World'

/**
 * Tag/Nacht-Zyklus (GAME_DESIGN.md §12).
 * Die Nacht muss sich deutlich anders anfühlen: Sichtweite fällt auf
 * den Lichtradius, Wellen greifen an, Nacht-Gegner erscheinen.
 */

const ORDER: DayPhase[] = ['day', 'dusk', 'night', 'dawn']

function durationOf(w: World, phase: DayPhase): number {
  const c = w.level.cycle
  switch (phase) {
    case 'day':
      return c.dayDuration
    case 'dusk':
      return c.duskDuration
    case 'night':
      return c.nightDuration
    case 'dawn':
      return c.dawnDuration
  }
}

export function updateClock(w: World, dt: number): void {
  const c = w.clock
  c.elapsed += dt
  c.phaseTime += dt

  // Level ohne Nächte bleiben im Tag.
  const noNights = w.level.cycle.nights === 0

  if (!noNights && c.phaseTime >= c.phaseDuration) {
    const next = ORDER[(ORDER.indexOf(c.phase) + 1) % ORDER.length]!
    enterPhase(w, next)
  }

  c.sun = computeSun(w)
}

export function enterPhase(w: World, phase: DayPhase): void {
  const c = w.clock
  c.phase = phase
  c.phaseTime = 0
  c.phaseDuration = durationOf(w, phase)

  if (phase === 'night') c.night += 1
  if (phase === 'dawn') c.nightsSurvived += 1

  w.events.emit('phase_changed', { phase, night: c.night })
}

/** 1 = voller Tag, 0 = tiefe Nacht, weich interpoliert. */
function computeSun(w: World): number {
  const c = w.clock
  const t = c.phaseDuration > 0 ? Math.min(1, c.phaseTime / c.phaseDuration) : 1
  switch (c.phase) {
    case 'day':
      return 1
    case 'dusk':
      return 1 - smooth(t)
    case 'night':
      return 0
    case 'dawn':
      return smooth(t)
  }
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Aktuelle Sichtweite, gemischt aus Tag- und Nachtwert. */
export function visibilityRange(w: World): number {
  const v = w.level.visibility
  return v.nightRange + (v.dayRange - v.nightRange) * w.clock.sun
}

export function isNightPhase(w: World): boolean {
  return w.clock.phase === 'night'
}
