/**
 * Perfect Second – difficulty curve across the 1–500 zone map.
 *
 * Design spec: docs/design/level-map-500/README.md
 *
 * Every zone ramps on its own: it starts easier than the end of the previous
 * zone but climbs to a higher peak (longer target times, tighter tolerance,
 * more consecutive hits). Zone 1 (level 1–100) is unchanged from the original
 * 100-level curve, so existing progress keeps its meaning.
 *
 * Zone 1: target ~2.8s → 12s, tolerance 0.35s → 0.04s, 1–3 hits.
 */

import { MAX_LEVEL, zoneForLevel, levelInZone, zoneProgress } from '@/progression/zones'
import type { ZoneId } from '@/progression/zones'

export interface PerfectSecondLevel {
  level: number
  targetTime: number
  tolerance: number
  hitsRequired: number
  maxDeviationRatio: number
  /** Zone the level belongs to (map theming / UI copy) */
  zoneId: ZoneId
}

interface ZoneCurve {
  targetFrom: number
  targetTo: number
  toleranceFrom: number
  toleranceTo: number
  /** Consecutive hits required at the start of the zone */
  hits: number
  /** From this position inside the zone (1–100) one more hit is required */
  hitsStepAt?: number
  maxDeviationRatio: number
}

const TARGET_EXPONENT = 1.15

const ZONE_CURVES: Record<ZoneId, ZoneCurve> = {
  jungle: {
    targetFrom: 2.8,
    targetTo: 12,
    toleranceFrom: 0.35,
    toleranceTo: 0.04,
    hits: 1,
    maxDeviationRatio: 0.3,
  },
  volcanic: {
    targetFrom: 3.5,
    targetTo: 14,
    toleranceFrom: 0.12,
    toleranceTo: 0.035,
    hits: 3,
    hitsStepAt: 50,
    maxDeviationRatio: 0.15,
  },
  canyon: {
    targetFrom: 4,
    targetTo: 16,
    toleranceFrom: 0.1,
    toleranceTo: 0.03,
    hits: 4,
    hitsStepAt: 50,
    maxDeviationRatio: 0.12,
  },
  iceage: {
    targetFrom: 4.5,
    targetTo: 18,
    toleranceFrom: 0.08,
    toleranceTo: 0.025,
    hits: 5,
    maxDeviationRatio: 0.1,
  },
  glacier: {
    targetFrom: 5,
    targetTo: 20,
    toleranceFrom: 0.06,
    toleranceTo: 0.02,
    hits: 5,
    maxDeviationRatio: 0.08,
  },
}

export function createPerfectSecondLevel(level: number): PerfectSecondLevel {
  const L = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)))
  const zone = zoneForLevel(L)
  const curve = ZONE_CURVES[zone.id]
  const p = zoneProgress(L)

  const targetTime = round3(
    curve.targetFrom + (curve.targetTo - curve.targetFrom) * Math.pow(p, TARGET_EXPONENT),
  )
  const tolerance = round3(
    curve.toleranceFrom * Math.pow(curve.toleranceTo / curve.toleranceFrom, p),
  )

  const { hitsRequired, maxDeviationRatio } =
    zone.id === 'jungle' ? jungleHits(L) : zoneHits(curve, levelInZone(L))

  return { level: L, targetTime, tolerance, hitsRequired, maxDeviationRatio, zoneId: zone.id }
}

/** Zone 1 keeps the original hand-tuned steps of the 100-level version. */
function jungleHits(level: number): { hitsRequired: number; maxDeviationRatio: number } {
  if (level >= 50) return { hitsRequired: 3, maxDeviationRatio: level >= 80 ? 0.1 : 0.15 }
  if (level >= 20) return { hitsRequired: 2, maxDeviationRatio: level >= 35 ? 0.15 : 0.2 }
  if (level >= 10) return { hitsRequired: 1, maxDeviationRatio: 0.25 }
  return { hitsRequired: 1, maxDeviationRatio: 0.3 }
}

function zoneHits(
  curve: ZoneCurve,
  positionInZone: number,
): { hitsRequired: number; maxDeviationRatio: number } {
  const step = curve.hitsStepAt != null && positionInZone >= curve.hitsStepAt ? 1 : 0
  return { hitsRequired: curve.hits + step, maxDeviationRatio: curve.maxDeviationRatio }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

export function createLevelFromSeed(level: number, seed: string): PerfectSecondLevel {
  void seed
  return createPerfectSecondLevel(level)
}

export function isHitWithinTolerance(
  targetTime: number,
  actualTime: number,
  tolerance: number,
): boolean {
  return Math.abs(actualTime - targetTime) <= tolerance
}
