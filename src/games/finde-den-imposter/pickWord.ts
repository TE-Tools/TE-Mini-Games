import { helperCandidates } from './data/helperClusters'
import { wordsForCategory } from './data/words'

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
  }
}

/** Geheimes Wort + thematisch nahes Hilfswort. */
export function pickSecretAndHelper(
  pool: string[],
  rng: () => number,
  categoryId: string = '',
): { word: string; helperWord: string } {
  if (pool.length === 0) return { word: 'Geheimnis', helperWord: 'Begriff' }
  const indices = pool.map((_, i) => i)
  shuffleInPlace(indices, rng)
  const word = pool[indices[0]!]!
  const candidates = helperCandidates(word, categoryId, pool)
  if (candidates.length === 0) return { word, helperWord: word }
  const helper = candidates[Math.floor(rng() * candidates.length)]!
  return { word, helperWord: helper }
}

export function poolFor(categoryId: string, customWords: string[] | null): string[] {
  if (customWords && customWords.length > 0) return customWords
  return wordsForCategory(categoryId).map((w) => w.word)
}
