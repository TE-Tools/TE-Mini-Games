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
 * - Target times are **drawn at random** inside the range of the map piece, not
 *   ramped up level by level: level 1 may ask for 2 s and level 3 for 0,5 s.
 *   The draw is seeded with the level number, so a level always shows the same
 *   number – records stay comparable. The upper end of the range grows with the
 *   map: 5 s in piece 1, 10 s in piece 2, 15 s in piece 3, 20 s from piece 4 on;
 *   the lower end is always 0,5 s.
 * - How exact the target itself is grows with the map: the first pieces only ask
 *   for round half seconds, later ones for tenths, hundredths and finally full
 *   milliseconds – so beginners never have to hit "7,234 s".
 * - Tolerance shrinks inside a piece and from piece to piece. The first two
 *   pieces get an extra-wide tolerance on top, to make the start easy, and the
 *   tolerance is additionally capped at a share of the target time so a short
 *   target like 0,5 s cannot be hit by accident.
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
/** Shortest target time on the whole map, in seconds. */
export const MIN_TARGET_TIME = 0.5
/** The tolerance never exceeds this share of the target time. */
const MAX_TOLERANCE_RATIO = 0.35
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

/**
 * Deterministic 0…1 draw for a level – same level, same number, but the
 * sequence across levels looks random (2 s, then 0,5 s, then 3,5 s …).
 */
function levelRandom(level: number): number {
  let h = Math.imul(level ^ 0x9e3779b9, 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function toleranceRangeForSegment(segment: number): { from: number; to: number } {
  const base = Math.max(0.05, 0.5 * Math.pow(0.88, Math.max(0, segment - 1)))
  const from = round3(base * easyStartFactor(segment))
  return { from, to: round3(from * 0.5) }
}

/** Draw the target, nudged if it would repeat the previous level's number. */
function drawTarget(level: number, ceiling: number, step: number): number {
  const draw = (l: number) => {
    const raw = MIN_TARGET_TIME + levelRandom(l) * (ceiling - MIN_TARGET_TIME)
    return Math.min(ceiling, Math.max(MIN_TARGET_TIME, roundStep(raw, step)))
  }
  const value = draw(level)
  if (level <= 1) return value
  const previous = draw(level - 1)
  if (value !== previous) return value
  const shifted = round3(value + step)
  return shifted <= ceiling ? shifted : round3(Math.max(MIN_TARGET_TIME, value - step))
}

export function createPerfectSecondLevel(level: number): PerfectSecondLevel {
  const L = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)))
  const segment = segmentIndexForLevel(L)
  // 0 at the first level of the piece, 1 at the last one.
  const p = ((L - 1) % SEGMENT_SIZE) / (SEGMENT_SIZE - 1)

  // Random target inside the range of this map piece, seeded with the level.
  const ceiling = targetCeilingForSegment(segment)
  const step = targetStepForSegment(segment)
  const targetTime = drawTarget(L, ceiling, step)

  const tol = toleranceRangeForSegment(segment)
  // Shrinks along the piece, but never more than a share of the target time –
  // otherwise a 0,5 s target would be impossible to miss.
  const tolerance = round3(
    Math.max(
      0.02,
      Math.min(
        tol.from * Math.pow(tol.to / tol.from, p),
        targetTime * MAX_TOLERANCE_RATIO,
      ),
    ),
  )

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
