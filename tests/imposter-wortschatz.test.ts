/**
 * Der Wortschatz und seine Kopie in der Datenbank.
 *
 * Warum es die Kopie gibt: Online zieht der Server das geheime Wort. Würde
 * der Browser des Gastgebers es auswählen, kennte er es auch dann, wenn er
 * selbst Imposter ist. Damit beides nicht auseinanderläuft, wird
 * 011b_imposter_words.sql aus den Spieldaten erzeugt
 * (`node scripts/build-imposter-words-sql.mjs`) -- dieser Test schlägt fehl,
 * sobald jemand nur eine Seite anfasst.
 */
import { describe, it, expect } from 'vitest'
import { WORDS, wordsForCategory } from '@/games/finde-den-imposter/data/words'
import { CATEGORIES } from '@/games/finde-den-imposter/data/categories'
import sql from '../supabase/migrations/011b_imposter_words.sql?raw'

const MINDESTENS_JE_KATEGORIE = 40

describe('Wortschatz', () => {
  it('hat rund 1000 Wörter', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(1000)
  })

  it('füllt jede Kategorie ordentlich', () => {
    for (const c of CATEGORIES) {
      expect(
        wordsForCategory(c.id).length,
        `Kategorie ${c.id} hat zu wenige Wörter`,
      ).toBeGreaterThanOrEqual(MINDESTENS_JE_KATEGORIE)
    }
  })

  it('kennt keine Wörter außerhalb der Kategorien', () => {
    const ids = new Set(CATEGORIES.map((c) => c.id))
    for (const w of WORDS) expect(ids.has(w.categoryId), `${w.word} → ${w.categoryId}`).toBe(true)
  })

  it('hat innerhalb einer Kategorie keine Dopplungen', () => {
    for (const c of CATEGORIES) {
      const woerter = wordsForCategory(c.id).map((w) => w.word.toLowerCase())
      expect(new Set(woerter).size, `Kategorie ${c.id} enthält ein Wort doppelt`).toBe(
        woerter.length,
      )
    }
  })

  it('lässt in jeder Kategorie ein Hilfswort übrig, das nicht das Geheimnis ist', () => {
    for (const c of CATEGORIES) expect(wordsForCategory(c.id).length).toBeGreaterThan(1)
  })
})

describe('Kopie für das Online-Spiel', () => {
  it('enthält jede Kategorie', () => {
    for (const c of CATEGORIES) {
      expect(sql, `Kategorie ${c.id} fehlt in 011b`).toContain(`('${c.id}', '${c.label}')`)
    }
  })

  it('enthält genauso viele Wörter wie das Spiel', () => {
    const zeilen = sql.match(/^ {2}\('[a-z]+', '.*'\)[,;]?$/gm) ?? []
    expect(zeilen.length).toBe(WORDS.length + CATEGORIES.length)
  })

  it('enthält jedes einzelne Wort', () => {
    const fehlen = WORDS.filter(
      (w) => !sql.includes(`('${w.categoryId}', '${w.word.replace(/'/g, "''")}')`),
    )
    expect(fehlen.map((w) => `${w.categoryId}/${w.word}`)).toEqual([])
  })
})
