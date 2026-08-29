/**
 * What Is Missing – Level difficulty formulas.
 *
 * Object count:
 *   count(L) = round(5 + 35 * (L - 1) / 99)
 *   Level 1  → 5
 *   Level 10 → ~8
 *   Level 30 → ~15
 *   Level 50 → ~23
 *   Level 100 → 40
 *
 * Display time (seconds):
 *   time(L) = 5 - 3.5 * (L - 1) / 99
 *   Level 1  → 5.0 s
 *   Level 10 → ~4.7 s
 *   Level 30 → ~4.0 s
 *   Level 50 → ~3.2 s
 *   Level 100 → 1.5 s
 *
 * Continuous formulas – no hard-coded jumps.
 */

import { OBJECT_CATALOG, type GameObject } from './objects'
import { createRng, pickN, shuffle } from './seed'

export interface WhatIsMissingLevel {
  level: number
  objectCount: number
  displayTimeSeconds: number
  /** Objects shown in the memorization phase */
  shownObjects: GameObject[]
  /** Object that will be removed */
  missingObject: GameObject
  /** Objects shown in the choice phase */
  choiceObjects: GameObject[]
  seed: string
}

export function objectCountForLevel(level: number): number {
  const L = clampLevel(level)
  return Math.round(5 + 35 * ((L - 1) / 99))
}

export function displayTimeForLevel(level: number): number {
  const L = clampLevel(level)
  const t = 5 - 3.5 * ((L - 1) / 99)
  return Math.round(t * 10) / 10
}

function clampLevel(level: number): number {
  return Math.max(1, Math.min(100, Math.floor(level)))
}

/**
 * Create a deterministic level from level number + optional seed.
 * Same seed + level → same objects and missing item.
 */
export function createWhatIsMissingLevel(level: number, seed?: string): WhatIsMissingLevel {
  const L = clampLevel(level)
  const resolvedSeed = seed ?? `wim-level-${L}`
  const rng = createRng(resolvedSeed)
  const count = objectCountForLevel(L)
  const displayTimeSeconds = displayTimeForLevel(L)

  const selected = pickN(OBJECT_CATALOG, count, rng)
  const missingIndex = Math.floor(rng() * selected.length)
  const missingObject = selected[missingIndex]!
  const shownObjects = selected
  const others = selected.filter((o) => o.id !== missingObject.id)
  const maxChoices = Math.min(selected.length, 12)
  const choicePool = shuffle([missingObject, ...others], rng).slice(0, maxChoices)
  if (!choicePool.some((o) => o.id === missingObject.id)) {
    choicePool[0] = missingObject
  }
  const choiceObjects = shuffle(choicePool, rng)

  return {
    level: L,
    objectCount: count,
    displayTimeSeconds,
    shownObjects,
    missingObject,
    choiceObjects,
    seed: resolvedSeed,
  }
}
