/**
 * Die Hilfswörter des Online-Spiels (Migration 027) müssen genau die sein,
 * die das Spiel am einen Gerät nehmen würde. 027 ist aus den Spieldaten
 * erzeugt (`node scripts/build-imposter-helfer-sql.mjs`) -- dieser Test
 * schlägt fehl, sobald jemand die Gruppen ändert und das Erzeugen vergisst.
 */
import { describe, expect, it } from 'vitest'
import sql from '../supabase/migrations/027_imposter_hilfswoerter.sql?raw'
import { helperCandidates } from '@/games/finde-den-imposter/data/helperClusters'
import { wordsForCategory } from '@/games/finde-den-imposter/data/words'
import { CATEGORIES } from '@/games/finde-den-imposter/data/categories'

const q = (s: string) => `'${s.replace(/'/g, "''")}'`

describe('Imposter-Hilfswörter in SQL', () => {
  it('enthält jedes Paar, das das Spiel ziehen würde, und kein anderes', () => {
    let erwartet = 0
    for (const cat of CATEGORIES) {
      const pool = wordsForCategory(cat.id).map((w) => w.word)
      for (const wort of pool) {
        for (const h of helperCandidates(wort, cat.id, pool)) {
          erwartet++
          expect(sql, `${cat.id}: ${wort} -> ${h}`).toContain(`(${q(cat.id)}, ${q(wort)}, ${q(h)})`)
        }
      }
    }
    const zeilen = sql.match(/^ {2}\('[a-z_]+', '.*', '.*'\)[,;]?$/gm) ?? []
    expect(zeilen.length).toBe(erwartet)
  })
})
