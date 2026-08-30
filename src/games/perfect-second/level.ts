/**
 * Perfect Second – difficulty curve along the 1–500 map.
 *
 * Design spec: docs/design/level-map-500/README.md
 *
 * The curve follows the map: one ramp per **map piece of 20 levels**
 * (`SEGMENT_SIZE`). Every piece starts a little easier than the previous one
 * ended and climbs to a higher ceiling, so the levels keep getting harder
 * without the target times running away.
 *
 * - Target times are round numbers (half-second steps), never longer than 20 s:
 *   piece 1 (level 1–20) 1,5 s → 5 s, piece 2 (21–40) 3 s → 10 s,
 *   piece 3 (41–60) 4,5 s → 15 s, from piece 4 on 6 s → 20 s.
 * - Tolerance shrinks inside a piece and from piece to piece, so the demanded
 *   precision relative to the target time rises the whole way.
 * - The last level of a piece – the one in front of the gate – has to be hit
 *   **twice in a row on the same time**. Deep in the map (level 241+) every
 *   level needs two hits and the gate levels three.
 */

import { MAX_LEVEL, SEGMENT_SIZE, isSegmentGate, segmentIndexForLevel } from '@/progression/zones'
import { zoneForLevel, type ZoneId } from '@/progression/zones'

export interface PerfectSecondLevel {
  level: number
  targetTime: number
  tolerance: number
  hitsRequired: number
  maxDeviationRatio: number
  /** Zone the level belongs to (map theming / UI copy) */
  zoneId: ZoneId
}

/** Longest target time on the whole map, in seconds. */
export const MAX_TARGET_TIME = 20
/** Target times are rounded to this step so the numbers stay readable. */
const TARGET_STEP = 0.5
/** From this level on, every level needs one extra hit. */
const DOUBLE_HIT_FROM_LEVEL = 241

/** Ceiling of the target time for a map piece: 5 s, 10 s, 15 s, then 20 s. */
export function targetCeilingForSegment(segment: number): number {
  return Math.min(MAX_TARGET_TIME, 5 * Math.max(1, segment))
}

/** Where a map piece starts – 30 % of its ceiling, but never under 1.5 s. */
function targetFloorForSegment(segment: number): number {
  return Math.max(1.5, roundStep(targetCeilingForSegment(segment) * 0.3))
}

function toleranceRangeForSegment(segment: number): { from: number; to: number } {
  const from = Math.max(0.05, round3(0.5 * Math.pow(0.88, Math.max(0, segment - 1))))
  return { from, to: round3(from * 0.5) }
}

export function createPerfectSecondLevel(level: number): PerfectSecondLevel {
  const L = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)))
  const segment = segmentIndexForLevel(L)
  // 0 at the first level of the piece, 1 at the last one.
  const p = ((L - 1) % SEGMENT_SIZE) / (SEGMENT_SIZE - 1)

  const floor = targetFloorForSegment(segment)
  const ceiling = targetCeilingForSegment(segment)
  const targetTime = roundStep(floor + (ceiling - floor) * p)

  const tol = toleranceRangeForSegment(segment)
  const tolerance = round3(tol.from * Math.pow(tol.to / tol.from, p))

  const baseHits = L >= DOUBLE_HIT_FROM_LEVEL ? 2 : 1
  const hitsRequired = baseHits + (isSegmentGate(L) ? 1 : 0)
  const maxDeviationRatio = round3(Math.max(0.08, 0.3 * Math.pow(0.94, segment - 1)))

  return {
    level: L,
    targetTime,
    tolerance,
    hitsRequired,
    maxDeviationRatio,
    zoneId: zoneForLevel(L).id,
  }
}

function roundStep(n: number): number {
  return Math.round(n / TARGET_STEP) * TARGET_STEP
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
