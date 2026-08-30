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
 * - Target times never run longer than 20 s: piece 1 (level 1–20) 1,5 s → 5 s,
 *   piece 2 (21–40) 3 s → 10 s, piece 3 (41–60) 4,5 s → 15 s, from piece 4 on
 *   6 s → 20 s.
 * - How exact the target itself is grows with the map: the first pieces only ask
 *   for round half seconds, later ones for tenths, hundredths and finally full
 *   milliseconds – so beginners never have to hit "7,234 s".
 * - Tolerance shrinks inside a piece and from piece to piece, so the demanded
 *   precision relative to the target time rises the whole way. The first two
 *   pieces get an extra-wide tolerance on top, to make the start easy.
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
/** From this level on, every level needs one extra hit. */
const DOUBLE_HIT_FROM_LEVEL = 241

/**
 * Rounding step of the target time per map piece: half seconds at the start,
 * full milliseconds deep in the map.
 */
export function targetStepForSegment(segment: number): number {
  if (segment <= 2) return 0.5
  if (segment <= 5) return 0.1
  if (segment <= 10) return 0.01
  return 0.001
}

/**
 * Extra tolerance for the first pieces so the start is forgiving:
 * piece 1 ×1.6, piece 2 ×1.3, from piece 3 on none.
 */
function easyStartFactor(segment: number): number {
  return 1 + 0.6 * Math.max(0, (3 - segment) / 2)
}

/** Ceiling of the target time for a map piece: 5 s, 10 s, 15 s, then 20 s. */
export function targetCeilingForSegment(segment: number): number {
  return Math.min(MAX_TARGET_TIME, 5 * Math.max(1, segment))
}

/** Where a map piece starts – 30 % of its ceiling, but never under 1.5 s. */
function targetFloorForSegment(segment: number): number {
  return Math.max(1.5, targetCeilingForSegment(segment) * 0.3)
}

function toleranceRangeForSegment(segment: number): { from: number; to: number } {
  const base = Math.max(0.05, 0.5 * Math.pow(0.88, Math.max(0, segment - 1)))
  const from = round3(base * easyStartFactor(segment))
  return { from, to: round3(from * 0.5) }
}

export function createPerfectSecondLevel(level: number): PerfectSecondLevel {
  const L = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)))
  const segment = segmentIndexForLevel(L)
  // 0 at the first level of the piece, 1 at the last one.
  const p = ((L - 1) % SEGMENT_SIZE) / (SEGMENT_SIZE - 1)

  const floor = targetFloorForSegment(segment)
  const ceiling = targetCeilingForSegment(segment)
  const targetTime = roundStep(floor + (ceiling - floor) * p, targetStepForSegment(segment))

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

function roundStep(n: number, step: number): number {
  return round3(Math.round(n / step) * step)
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

/**
 * Family mode: one fresh random target per session, somewhere between 1 s and
 * 20 s in tenths, with a friendly tolerance. Every player of a session gets the
 * same number so the comparison stays fair – the next session gets a new one.
 */
export function createFamilyLevel(random: () => number = Math.random): PerfectSecondLevel {
  const targetTime = roundStep(1 + random() * 19, 0.1)
  return {
    level: 1,
    targetTime,
    tolerance: 0.5,
    hitsRequired: 1,
    maxDeviationRatio: 0.3,
    zoneId: zoneForLevel(1).id,
  }
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
