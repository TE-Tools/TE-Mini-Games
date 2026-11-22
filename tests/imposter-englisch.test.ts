/**
 * Die englischen Wortlisten für Imposter, Wer bin ich? und Scharade -- und
 * ihre Kopie für das Online-Spiel in Migration 029.
 *
 * Englisch ist kein übersetztes Deutsch, sondern eigene Kategorien mit dem
 * Präfix `en-`. 029 ist aus den Spieldaten erzeugt
 * (`node scripts/build-imposter-words-sql.mjs`); dieser Test schlägt fehl,
 * sobald beides auseinanderläuft.
 */
import { describe, it, expect } from 'vitest'
import sql from '../supabase/migrations/029_englische_woerter.sql?raw'
import { CATEGORIES, categoriesFor } from '@/games/finde-den-imposter/data/categories'
import { wordsForCategory } from '@/games/finde-den-imposter/data/words'
import {
  HELPER_CLUSTERS,
  MIN_HELFER,
  helperCandidates,
  zuNah,
} from '@/games/finde-den-imposter/data/helperClusters'
import { createMatch } from '@/games/finde-den-imposter/engine'
import { createScharadeMatch, currentWord } from '@/games/scharade'
import { createWbiMatch } from '@/games/wer-bin-ich'

const ENGLISCH = categoriesFor('en')
const DEUTSCH = categoriesFor('de')
const q = (s: string) => `'${s.replace(/'/g, "''")}'`
const klein = (w: string) => w.toLowerCase()

describe('Englischer Wortschatz', () => {
  it('hat zu jeder deutschen Kategorie eine englische mit en-Präfix', () => {
    expect(ENGLISCH).toHaveLength(20)
    expect(DEUTSCH).toHaveLength(20)
    expect(ENGLISCH.map((c) => c.id)).toEqual(DEUTSCH.map((c) => `en-${c.id}`))
    expect(CATEGORIES).toHaveLength(40)
    for (const c of ENGLISCH)
      expect(c.label).not.toBe(DEUTSCH.find((d) => `en-${d.id}` === c.id)?.label)
  })

  it('lässt die deutschen Kennungen und Namen, wie sie waren', () => {
    expect(DEUTSCH.map((c) => c.id)).toEqual([
      'tiere',
      'essen',
      'berufe',
      'sport',
      'reisen',
      'technik',
      'filme',
      'musik',
      'schule',
      'haus',
      'natur',
      'koerper',
      'kleidung',
      'fahrzeuge',
      'spiele',
      'feiertage',
      'gefuehle',
      'stadt',
      'maerchen',
      'beruehmt',
    ])
    expect(DEUTSCH[0]).toMatchObject({ id: 'tiere', label: 'Tiere', sprache: 'de' })
    expect(wordsForCategory('tiere')[0]?.word).toBe('Hund')
  })

  it('hat 50 verschiedene Wörter je Kategorie', () => {
    for (const c of ENGLISCH) {
      const woerter = wordsForCategory(c.id).map((w) => klein(w.word))
      expect(woerter, c.id).toHaveLength(50)
      expect(new Set(woerter).size, `${c.id} enthält ein Wort doppelt`).toBe(50)
    }
  })

  it('steckt jedes Wort in mindestens eine Gruppe', () => {
    for (const c of ENGLISCH) {
      const gruppen = HELPER_CLUSTERS[c.id]
      expect(gruppen, c.id).toBeDefined()
      const gruppiert = new Set(gruppen!.flat().map(klein))
      const pool = wordsForCategory(c.id).map((w) => w.word)
      const fehlen = pool.filter((w) => !gruppiert.has(klein(w)))
      expect(fehlen, `${c.id}: ohne Gruppe`).toEqual([])
      const fremd = [...gruppiert].filter((w) => !pool.some((p) => klein(p) === w))
      expect(fremd, `${c.id}: Gruppe nennt fremde Wörter`).toEqual([])
    }
  })

  it('gibt nie das Geheimwort oder einen Verräter als Hilfswort, und immer mehrere', () => {
    expect(zuNah('Cake', 'Pancake')).toBe(true)
    expect(zuNah('Envy', 'Jealousy')).toBe(true)
    expect(zuNah('Dog', 'Cat')).toBe(false)
    for (const c of ENGLISCH) {
      const pool = wordsForCategory(c.id).map((w) => w.word)
      for (const geheim of pool) {
        const kandidaten = helperCandidates(geheim, c.id, pool)
        expect(kandidaten.length, `${c.id}: ${geheim}`).toBeGreaterThanOrEqual(MIN_HELFER)
        for (const h of kandidaten) {
          expect(klein(h), `${c.id}: ${geheim}`).not.toBe(klein(geheim))
          expect(zuNah(geheim, h), `${c.id}: ${geheim} -> ${h}`).toBe(false)
        }
      }
    }
  })

  it('teilt in allen drei Spielen englische Wörter aus', () => {
    const pool = new Set(wordsForCategory('en-tiere').map((w) => w.word))
    for (let seed = 1; seed <= 20; seed++) {
      const m = createMatch({ names: ['A', 'B', 'C', 'D'], categoryId: 'en-tiere', seed })
      expect(pool.has(m.config.secretWord)).toBe(true)
      expect(pool.has(m.config.helperWord)).toBe(true)
      expect(m.config.helperWord).not.toBe(m.config.secretWord)
      expect(m.config.categoryLabel).toBe('Animals')
    }
    const sch = createScharadeMatch({ names: ['A', 'B'], categoryId: 'en-essen', seconds: 60 })
    expect(wordsForCategory('en-essen').map((w) => w.word)).toContain(currentWord(sch))
    expect(sch.categoryLabel).toBe('Food & Drink')
    const wbi = createWbiMatch({ names: ['A', 'B', 'C'], categoryId: 'en-maerchen' })
    const maerchen = wordsForCategory('en-maerchen').map((w) => w.word)
    for (const p of wbi.players) expect(maerchen).toContain(p.word)
  })
})

describe('Kopie für das Online-Spiel (029)', () => {
  it('führt jede englische Kategorie mit ihrem Namen und keine deutsche', () => {
    for (const c of ENGLISCH) expect(sql).toContain(`  (${q(c.id)}, ${q(c.label)})`)
    const kategorienBlock = sql.split('insert into public.fdi_words')[0]!
    for (const c of DEUTSCH) expect(kategorienBlock).not.toContain(`(${q(c.id)},`)
  })

  it('enthält genau die englischen Wörter', () => {
    let erwartet = 0
    for (const c of ENGLISCH) {
      for (const w of wordsForCategory(c.id)) {
        erwartet++
        expect(sql, `${c.id}/${w.word}`).toContain(`  (${q(c.id)}, ${q(w.word)})`)
      }
    }
    const zeilen = sql.match(/^ {2}\('en-[a-z]+', '(?:[^']|'')*'\)[,]?$/gm) ?? []
    // Die Wortzeilen plus die Kategoriezeilen haben dieselbe Form.
    expect(zeilen.length).toBe(erwartet + ENGLISCH.length)
  })

  it('enthält jedes Hilfswort-Paar, das das Spiel ziehen würde, und kein anderes', () => {
    let erwartet = 0
    for (const c of ENGLISCH) {
      const pool = wordsForCategory(c.id).map((w) => w.word)
      for (const wort of pool) {
        for (const h of helperCandidates(wort, c.id, pool)) {
          erwartet++
          expect(sql, `${c.id}: ${wort} -> ${h}`).toContain(`(${q(c.id)}, ${q(wort)}, ${q(h)})`)
        }
      }
    }
    const zeilen = sql.match(/^ {2}\('en-[a-z]+', '(?:[^']|'')*', '(?:[^']|'')*'\)[,]?$/gm) ?? []
    expect(zeilen.length).toBe(erwartet)
  })

  it('ist mehrfach ausführbar und ändert weder Schema noch Funktionen', () => {
    expect(sql).toContain('on conflict (id) do update set label = excluded.label;')
    expect(sql).toContain('on conflict (category_id, word) do nothing;')
    expect(sql).toContain('on conflict (category_id, word, helper) do nothing;')
    expect(sql).toContain("delete from public.fdi_helper where category_id like 'en-%';")
    expect(sql).not.toMatch(/create\s+(or\s+replace\s+)?(table|function|policy|view)/i)
    expect(sql).not.toMatch(/alter\s+table|drop\s+/i)
  })
})
