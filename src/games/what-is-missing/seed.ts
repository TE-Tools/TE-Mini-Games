/**
 * Simple deterministic PRNG from a string seed (Mulberry32).
 * Enables reproducible levels for Daily Challenge, family rounds, tests.
 */

export function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function createRng(seed: string): () => number {
  return mulberry32(hashSeed(seed))
}

/** Fisher–Yates shuffle with deterministic RNG */
export function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
  }
  return arr
}

export function pickN<T>(items: readonly T[], n: number, rng: () => number): T[] {
  if (n >= items.length) return shuffle([...items], rng)
  const shuffled = shuffle([...items], rng)
  return shuffled.slice(0, n)
}
