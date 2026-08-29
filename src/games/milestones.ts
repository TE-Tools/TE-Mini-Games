/**
 * Bonus XP for milestone levels (first clear path) across the 1–500 map.
 *
 * Raster (see docs/design/level-map-500/README.md):
 *   - Zonentor  (every 100): 2000 × zone  → 2000 / 4000 / 6000 / 8000 / 10000
 *   - Halbzone  (every 50):  1000 × zone  → 1000 / 2000 / … / 5000
 *   - Zehner    (every 10):   250 × zone  →  250 /  500 / … /  1250
 *
 * Rewards grow with the zone, and inside a zone always
 * Zehner < Halbzone < Zonentor.
 */

import { MAX_LEVEL, clampMapLevel, zoneForLevel } from '@/progression/zones'

const GATE_BONUS_PER_ZONE = 2000
const HALF_ZONE_BONUS_PER_ZONE = 1000
const TEN_BONUS_PER_ZONE = 250

export type MilestoneKind = 'gate' | 'half-zone' | 'ten' | 'none'

/** All milestone levels of the map, ascending. */
export const MILESTONE_LEVELS: readonly number[] = Array.from(
  { length: Math.floor(MAX_LEVEL / 10) },
  (_, i) => (i + 1) * 10,
)

export function milestoneKind(level: number): MilestoneKind {
  const L = clampMapLevel(level)
  if (L % 10 !== 0) return 'none'
  if (L % 100 === 0) return 'gate'
  if (L % 50 === 0) return 'half-zone'
  return 'ten'
}

export function milestoneBonusXp(level: number): number {
  if (!Number.isFinite(level) || level < 1 || level > MAX_LEVEL) return 0
  const L = Math.floor(level)
  const zone = zoneForLevel(L).index
  switch (milestoneKind(L)) {
    case 'gate':
      return GATE_BONUS_PER_ZONE * zone
    case 'half-zone':
      return HALF_ZONE_BONUS_PER_ZONE * zone
    case 'ten':
      return TEN_BONUS_PER_ZONE * zone
    default:
      return 0
  }
}

export function isMilestoneLevel(level: number): boolean {
  return milestoneBonusXp(level) > 0
}
