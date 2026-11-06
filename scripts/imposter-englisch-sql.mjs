/**
 * Erzeugt supabase/migrations/029_englische_woerter.sql: die englischen
 * Kategorien (`en-…`), ihre Wörter und ihre Hilfswörter für das Online-Spiel.
 *
 * Beide Erzeuger rufen das hier auf -- build-imposter-words-sql.mjs (Wörter)
 * und build-imposter-helfer-sql.mjs (Hilfswörter) --, denn 029 enthält
 * beides. 011b und 027 bleiben, wie sie sind, und enthalten nur Deutsch.
 *
 * Nur Daten, kein Schema und keine Funktion: Der Server zieht das Wort schon
 * heute nach `category_id` aus fdi_words und das Hilfswort aus fdi_helper.
 * Mehrfach ausführbar.
 */
import { writeFileSync } from 'node:fs'
import { createServer } from 'vite'

export const ZIEL_ENGLISCH = 'supabase/migrations/029_englische_woerter.sql'

const q = (s) => `'${s.replace(/'/g, "''")}'`

export async function schreibeEnglischeWoerter() {
  const server = await createServer({ server: { middlewareMode: true }, logLevel: 'error' })
  const { helperCandidates } = await server.ssrLoadModule(
    '/src/games/finde-den-imposter/data/helperClusters.ts',
  )
  const { wordsForCategory } = await server.ssrLoadModule(
    '/src/games/finde-den-imposter/data/words.ts',
  )
  const { categoriesFor } = await server.ssrLoadModule(
    '/src/games/finde-den-imposter/data/categories.ts',
  )
  await server.close()

  const kategorien = categoriesFor('en')
  const woerter = []
  const helfer = []
  for (const cat of kategorien) {
    const pool = wordsForCategory(cat.id).map((w) => w.word)
    for (const wort of pool) {
      woerter.push(`  (${q(cat.id)}, ${q(wort)})`)
      for (const h of helperCandidates(wort, cat.id, pool)) {
        helfer.push(`  (${q(cat.id)}, ${q(wort)}, ${q(h)})`)
      }
    }
  }

  const sql = `-- Englische Wörter für "Finde den Imposter" und "Wer bin ich?" online.
--
-- NICHT von Hand pflegen: erzeugt aus src/games/finde-den-imposter/data/
-- (words.en.ts, helperClusters.en.ts, categories.ts) mit
--   node scripts/build-imposter-words-sql.mjs
-- (oder build-imposter-helfer-sql.mjs -- beide schreiben diese Datei mit).
-- tests/imposter-englisch.test.ts schlägt fehl, sobald beides auseinanderläuft.
--
-- Nur Daten: eigene Kategorien mit dem Präfix "en-", ihre Wörter und ihre
-- Hilfswörter. Kein Schema, keine Funktion -- fdi_deal und wbi ziehen schon
-- heute nach category_id. Die App bietet die englischen Kategorien online
-- erst an, wenn sie hier in fdi_categories stehen.
--
-- Mehrfach ausführbar. Setzt 011 (Tabellen) und 027 (fdi_helper) voraus.
-- Achtung: 027 allein noch einmal ausgeführt leert fdi_helper ganz -- danach
-- diese Datei erneut einspielen.

insert into public.fdi_categories (id, label) values
${kategorien.map((c) => `  (${q(c.id)}, ${q(c.label)})`).join(',\n')}
on conflict (id) do update set label = excluded.label;

insert into public.fdi_words (category_id, word) values
${woerter.join(',\n')}
on conflict (category_id, word) do nothing;

delete from public.fdi_helper where category_id like 'en-%';
insert into public.fdi_helper (category_id, word, helper) values
${helfer.join(',\n')}
on conflict (category_id, word, helper) do nothing;
`
  writeFileSync(ZIEL_ENGLISCH, sql)
  console.log(
    `029_englische_woerter.sql: ${kategorien.length} Kategorien, ${woerter.length} Wörter, ${helfer.length} Hilfswort-Zeilen`,
  )
}
