import { describe, it, expect } from 'vitest'
import { createMatch } from '@/games/finde-den-imposter/engine'
import {
  HELPER_CLUSTERS,
  helperCandidates,
} from '@/games/finde-den-imposter/data/helperClusters'
import { wordsForCategory } from '@/games/finde-den-imposter/data/words'
import { CATEGORIES } from '@/games/finde-den-imposter/data/categories'

describe('Imposter-Hilfswort-Cluster', () => {
  it('liefert Cluster-Nachbarn für gruppierte Wörter', () => {
    const pool = wordsForCategory('tiere').map((w) => w.word)
    const cands = helperCandidates('Hund', 'tiere', pool)
    expect(cands.length).toBeGreaterThan(0)
    expect(cands.map((c) => c.toLowerCase())).toContain('katze')
    expect(cands.map((c) => c.toLowerCase())).not.toContain('nashorn')
  })

  it('fällt ohne Cluster auf die restliche Kategorie zurück', () => {
    const pool = ['Alpha', 'Beta', 'Gamma']
    expect(helperCandidates('Alpha', 'tiere', pool).sort()).toEqual(['Beta', 'Gamma'])
  })

  it('zieht in den meisten Runden ein Cluster-Hilfswort', () => {
    let clustered = 0
    const total = 100
    for (let seed = 1; seed <= total; seed++) {
      const s = createMatch({
        names: ['A', 'B', 'C', 'D'],
        categoryId: 'tiere',
        totalRounds: 1,
        seed,
      })
      const related = HELPER_CLUSTERS.tiere?.some(
        (g) =>
          g.some((w) => w.toLowerCase() === s.config.secretWord.toLowerCase()) &&
          g.some((w) => w.toLowerCase() === s.config.helperWord.toLowerCase()),
      )
      if (related) clustered++
    }
    expect(clustered).toBeGreaterThan(total * 0.7)
  })

  it('nutzt nur Wörter aus dem Wortschatz', () => {
    for (const cat of CATEGORIES) {
      const pool = new Set(wordsForCategory(cat.id).map((w) => w.word.toLowerCase()))
      for (const group of HELPER_CLUSTERS[cat.id] ?? []) {
        for (const w of group) {
          expect(pool.has(w.toLowerCase()), `${cat.id}: ${w}`).toBe(true)
        }
        expect(group.length).toBeGreaterThanOrEqual(2)
      }
    }
  })
})
