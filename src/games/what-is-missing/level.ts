/**
 * What Is Missing – Level difficulty formulas across the 1–500 zone map.
 *
 * Design spec: docs/design/level-map-500/README.md
 *
 * Every zone ramps on its own: it starts with more objects than the previous
 * zone began with, shows them for less time and offers more answer choices.
 * Zone 1 (level 1–100) is unchanged from the original 100-level curve.
 * Object counts are capped by the catalog size.
 */

import {
  MAX_LEVEL,
  segmentIndexForLevel,
  zoneForLevel,
  zoneProgress,
} from '@/progression/zones'
import type { ZoneId } from '@/progression/zones'
import { OBJECT_CATALOG, objectFamilies, type GameObject } from './objects'
import { createRng, pickN, shuffle } from './seed'

interface ZoneCurve {
  objectsFrom: number
  objectsTo: number
  displayFrom: number
  displayTo: number
  /** Answer choices offered (capped by the number of shown objects) */
  choices: number
}

const ZONE_CURVES: Record<ZoneId, ZoneCurve> = {
  jungle: { objectsFrom: 5, objectsTo: 40, displayFrom: 5, displayTo: 1.5, choices: 8 },
  volcanic: { objectsFrom: 10, objectsTo: 42, displayFrom: 4, displayTo: 1.2, choices: 9 },
  canyon: { objectsFrom: 14, objectsTo: 42, displayFrom: 3.5, displayTo: 1, choices: 10 },
  iceage: { objectsFrom: 18, objectsTo: 42, displayFrom: 3, displayTo: 0.9, choices: 11 },
  glacier: { objectsFrom: 22, objectsTo: 42, displayFrom: 2.5, displayTo: 0.8, choices: 12 },
}

function curveForLevel(level: number): ZoneCurve {
  return ZONE_CURVES[zoneForLevel(level).id]
}

export interface WhatIsMissingLevel {
  level: number
  objectCount: number
  displayTimeSeconds: number
  /** Objects shown in the memorization phase (includes the one that will go missing) */
  shownObjects: GameObject[]
  /** Objects still visible after one is removed */
  remainingObjects: GameObject[]
  /** Object that was removed */
  missingObject: GameObject
  /** Options for the player to choose from (always includes missingObject) */
  choiceObjects: GameObject[]
  seed: string
}

export function objectCountForLevel(level: number): number {
  const L = clampLevel(level)
  const curve = curveForLevel(L)
  const count = Math.round(curve.objectsFrom + (curve.objectsTo - curve.objectsFrom) * zoneProgress(L))
  return Math.min(count, OBJECT_CATALOG.length)
}

export function displayTimeForLevel(level: number): number {
  const L = clampLevel(level)
  const curve = curveForLevel(L)
  const t = curve.displayFrom - (curve.displayFrom - curve.displayTo) * zoneProgress(L)
  return Math.round(t * 10) / 10
}

/**
 * How many options the player picks from – grows with every map piece from 5 up
 * to 16 (never more than the shown objects).
 */
export function choiceCountForLevel(level: number): number {
  return Math.min(16, 4 + segmentIndexForLevel(clampLevel(level)))
}

/**
 * How many look-alike pairs (red/green apple, chair/couch …) are forced into the
 * shown objects. The first two pieces stay clean, then it grows every second
 * piece up to six pairs.
 */
export function similarPairsForLevel(level: number): number {
  const segment = segmentIndexForLevel(clampLevel(level))
  if (segment <= 2) return 0
  return Math.min(6, Math.floor((segment - 1) / 2))
}

/**
 * Pick the objects that are shown: first `pairs` look-alike pairs, then fill up
 * with anything else. Deterministic for a given RNG.
 */
function pickShownObjects(count: number, pairs: number, rng: () => number): GameObject[] {
  const chosen: GameObject[] = []
  const used = new Set<string>()

  if (pairs > 0) {
    const families = shuffle([...objectFamilies().values()], rng)
    for (const members of families) {
      if (chosen.length + 2 > count || used.size / 2 >= pairs) break
      const [a, b] = shuffle([...members], rng)
      if (!a || !b) continue
      chosen.push(a, b)
      used.add(a.id)
      used.add(b.id)
    }
  }

  const rest = OBJECT_CATALOG.filter((o) => !used.has(o.id))
  const fill = pickN(rest, Math.max(0, count - chosen.length), rng)
  return shuffle([...chosen, ...fill], rng)
}

function clampLevel(level: number): number {
  return Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)))
}

/**
 * Create a level from level number + optional seed.
 * Without seed → new random layout each call (play again stays fresh).
 * With seed (Daily / Family) → deterministic.
 */
export function createWhatIsMissingLevel(level: number, seed?: string): WhatIsMissingLevel {
  const L = clampLevel(level)
  const resolvedSeed =
    seed ??
    `wim-level-${L}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`
  const rng = createRng(resolvedSeed)
  const count = objectCountForLevel(L)
  const displayTimeSeconds = displayTimeForLevel(L)

  const selected = pickShownObjects(count, similarPairsForLevel(L), rng)
  if (selected.length < 2) {
    throw new Error('Need at least 2 objects for What Is Missing')
  }

  const missingIndex = Math.floor(rng() * selected.length)
  const missingObject = selected[missingIndex]!
  const shownObjects = selected
  const remainingObjects = selected.filter((o) => o.id !== missingObject.id)

  // Look-alikes of the removed object come first, so the choice really is
  // "which chair was it" and not "was there a chair at all".
  const lookAlikes = remainingObjects.filter(
    (o) => missingObject.family != null && o.family === missingObject.family,
  )
  const others = remainingObjects.filter((o) => !lookAlikes.includes(o))
  const maxChoices = Math.min(Math.max(4, choiceCountForLevel(L)), selected.length)
  let choicePool = [missingObject, ...lookAlikes, ...shuffle(others, rng)].slice(0, maxChoices)
  if (!choicePool.some((o) => o.id === missingObject.id)) {
    choicePool = [missingObject, ...choicePool.slice(0, maxChoices - 1)]
  }
  const seen = new Set<string>()
  choicePool = choicePool.filter((o) => {
    if (seen.has(o.id)) return false
    seen.add(o.id)
    return true
  })
  const choiceObjects = shuffle(choicePool, rng)

  return {
    level: L,
    objectCount: count,
    displayTimeSeconds,
    shownObjects,
    remainingObjects,
    missingObject,
    choiceObjects,
    seed: resolvedSeed,
  }
}
