/**
 * What Is Missing – Level difficulty formulas.
 */

import { OBJECT_CATALOG, type GameObject } from './objects'
import { createRng, pickN, shuffle } from './seed'

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

  const selected = pickN(OBJECT_CATALOG, count, rng)
  if (selected.length < 2) {
    throw new Error('Need at least 2 objects for What Is Missing')
  }

  const missingIndex = Math.floor(rng() * selected.length)
  const missingObject = selected[missingIndex]!
  const shownObjects = selected
  const remainingObjects = selected.filter((o) => o.id !== missingObject.id)

  const distractors = remainingObjects
  const maxChoices = Math.min(Math.max(4, Math.min(selected.length, 8)), selected.length)
  let choicePool = shuffle([missingObject, ...distractors], rng).slice(0, maxChoices)
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
