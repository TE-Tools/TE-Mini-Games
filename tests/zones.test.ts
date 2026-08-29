import { describe, it, expect } from 'vitest'
import {
  ZONES,
  MAX_LEVEL,
  LEVELS_PER_ZONE,
  zoneForLevel,
  zoneById,
  levelInZone,
  zoneProgress,
  isZoneGate,
  isFinalLevel,
  clampMapLevel,
  type ZoneId,
} from '@/progression/zones'

describe('Level zones', () => {
  it('covers levels 1–500 in five gap-free zones', () => {
    expect(ZONES).toHaveLength(5)
    expect(MAX_LEVEL).toBe(500)
    expect(ZONES[0]!.levelFrom).toBe(1)
    expect(ZONES.at(-1)!.levelTo).toBe(MAX_LEVEL)
    for (let i = 1; i < ZONES.length; i++) {
      expect(ZONES[i]!.levelFrom).toBe(ZONES[i - 1]!.levelTo + 1)
      expect(ZONES[i]!.index).toBe(i + 1)
    }
    for (const zone of ZONES) {
      expect(zone.levelTo - zone.levelFrom + 1).toBe(LEVELS_PER_ZONE)
      expect(zone.gateLevel).toBe(zone.levelTo)
    }
  })

  it('maps levels to the right zone, including the boundaries', () => {
    expect(zoneForLevel(1).id).toBe('jungle')
    expect(zoneForLevel(100).id).toBe('jungle')
    expect(zoneForLevel(101).id).toBe('volcanic')
    expect(zoneForLevel(200).id).toBe('volcanic')
    expect(zoneForLevel(201).id).toBe('canyon')
    expect(zoneForLevel(300).id).toBe('canyon')
    expect(zoneForLevel(301).id).toBe('iceage')
    expect(zoneForLevel(400).id).toBe('iceage')
    expect(zoneForLevel(401).id).toBe('glacier')
    expect(zoneForLevel(500).id).toBe('glacier')
  })

  it('every level 1–500 resolves to exactly the zone containing it', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const zone = zoneForLevel(level)
      expect(level).toBeGreaterThanOrEqual(zone.levelFrom)
      expect(level).toBeLessThanOrEqual(zone.levelTo)
    }
  })

  it('clamps out-of-range input', () => {
    expect(clampMapLevel(0)).toBe(1)
    expect(clampMapLevel(-5)).toBe(1)
    expect(clampMapLevel(999)).toBe(MAX_LEVEL)
    expect(clampMapLevel(Number.NaN)).toBe(1)
    expect(zoneForLevel(0).id).toBe('jungle')
    expect(zoneForLevel(9999).id).toBe('glacier')
  })

  it('levelInZone counts 1–100 inside every zone', () => {
    expect(levelInZone(1)).toBe(1)
    expect(levelInZone(100)).toBe(100)
    expect(levelInZone(101)).toBe(1)
    expect(levelInZone(250)).toBe(50)
    expect(levelInZone(500)).toBe(100)
  })

  it('zoneProgress runs 0 → 1 inside every zone', () => {
    expect(zoneProgress(1)).toBe(0)
    expect(zoneProgress(100)).toBe(1)
    expect(zoneProgress(101)).toBe(0)
    expect(zoneProgress(500)).toBe(1)
    expect(zoneProgress(150)).toBeCloseTo(49 / 99, 10)
  })

  it('zone gates are the levels 100, 200, 300, 400, 500', () => {
    const gates = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).filter(isZoneGate)
    expect(gates).toEqual([100, 200, 300, 400, 500])
    expect(isFinalLevel(500)).toBe(true)
    expect(isFinalLevel(499)).toBe(false)
  })

  it('zoneById finds zones and returns undefined for unknown ids', () => {
    expect(zoneById('glacier')?.levelFrom).toBe(401)
    expect(zoneById('atlantis' as ZoneId)).toBeUndefined()
  })
})
