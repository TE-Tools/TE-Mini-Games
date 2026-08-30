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
  SEGMENT_SIZE,
  SEGMENT_COUNT,
  SEGMENTS_PER_ZONE,
  isSegmentGate,
  segmentByIndex,
  segmentForLevel,
  segmentIndexForLevel,
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

describe('Map segments (20 levels per piece)', () => {
  it('splits the map into 25 pieces of 20 levels', () => {
    expect(SEGMENT_SIZE).toBe(20)
    expect(SEGMENT_COUNT).toBe(25)
    expect(SEGMENTS_PER_ZONE).toBe(5)
    expect(segmentByIndex(1)).toMatchObject({ from: 1, to: 20 })
    expect(segmentByIndex(25)).toMatchObject({ from: 481, to: 500 })
  })

  it('pieces are gap-free and never straddle a zone border', () => {
    for (let i = 1; i <= SEGMENT_COUNT; i++) {
      const seg = segmentByIndex(i)
      expect(seg.to - seg.from + 1).toBe(SEGMENT_SIZE)
      if (i > 1) expect(seg.from).toBe(segmentByIndex(i - 1).to + 1)
      expect(zoneForLevel(seg.from).id).toBe(zoneForLevel(seg.to).id)
    }
  })

  it('maps levels to their piece, including the borders', () => {
    expect(segmentIndexForLevel(1)).toBe(1)
    expect(segmentIndexForLevel(20)).toBe(1)
    expect(segmentIndexForLevel(21)).toBe(2)
    expect(segmentIndexForLevel(100)).toBe(5)
    expect(segmentIndexForLevel(101)).toBe(6)
    expect(segmentIndexForLevel(500)).toBe(25)
    expect(segmentForLevel(37)).toMatchObject({ index: 2, from: 21, to: 40 })
  })

  it('a gate closes every twentieth level', () => {
    const gates = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).filter(isSegmentGate)
    expect(gates).toHaveLength(25)
    expect(gates.slice(0, 3)).toEqual([20, 40, 60])
    expect(gates.at(-1)).toBe(500)
    expect(isSegmentGate(19)).toBe(false)
  })

  it('gates on a zone border carry the zone name, the others a piece name', () => {
    expect(segmentByIndex(5)).toMatchObject({ isZoneGate: true, gateName: 'Tor zum Vulkanland' })
    expect(segmentByIndex(25)).toMatchObject({ isZoneGate: true, gateName: 'Eispalast' })
    expect(segmentByIndex(1)).toMatchObject({ isZoneGate: false, gateName: 'Tor zu Abschnitt 2' })
  })

  it('clamps out-of-range piece numbers', () => {
    expect(segmentByIndex(0).index).toBe(1)
    expect(segmentByIndex(99).index).toBe(SEGMENT_COUNT)
  })
})
