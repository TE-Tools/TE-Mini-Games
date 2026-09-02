/**
 * Baut supabase/migrations/011_imposter_online.sql NICHT komplett, sondern nur
 * den Wort-Teil: docs/... nein -- erzeugt die Datei
 * supabase/migrations/011b_imposter_words.sql aus den Spieldaten.
 *
 * Warum die Wörter überhaupt in die Datenbank müssen: Im Online-Spiel darf der
 * Server das geheime Wort ziehen, nicht der Browser. Würde der Gastgeber es
 * auswählen und hochschicken, kennte er es auch dann, wenn er selbst Imposter
 * ist -- das Spiel wäre kaputt.
 *
 * Aufruf: node scripts/build-imposter-words-sql.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const src = readFileSync('src/games/finde-den-imposter/data/words.ts', 'utf8')
const rows = []
for (const m of src.matchAll(/\{\s*word:\s*'([^']+)',\s*categoryId:\s*'([^']+)'\s*\}/g)) {
  rows.push({ word: m[1], categoryId: m[2] })
}
if (rows.length === 0) throw new Error('Keine Wörter gefunden – Format von words.ts geändert?')

const cats = readFileSync('src/games/finde-den-imposter/data/categories.ts', 'utf8')
const catRows = []
for (const m of cats.matchAll(/\{\s*id:\s*'([^']+)',\s*label:\s*'([^']+)'/g)) {
  catRows.push({ id: m[1], label: m[2] })
}

const q = (s) => `'${s.replace(/'/g, "''")}'`

const sql = `-- Wörter und Kategorien für das Online-Spiel "Finde den Imposter".
--
-- NICHT von Hand pflegen: erzeugt aus src/games/finde-den-imposter/data/ mit
--   node scripts/build-imposter-words-sql.mjs
-- tests/imposter-words-sql.test.ts schlägt fehl, sobald beides auseinanderläuft.
--
-- Der Server zieht das geheime Wort selbst -- würde der Gastgeber es im
-- Browser auswählen, kennte er es auch als Imposter.

insert into public.fdi_categories (id, label) values
${catRows.map((c) => `  (${q(c.id)}, ${q(c.label)})`).join(',\n')}
on conflict (id) do update set label = excluded.label;

insert into public.fdi_words (category_id, word) values
${rows.map((r) => `  (${q(r.categoryId)}, ${q(r.word)})`).join(',\n')}
on conflict (category_id, word) do nothing;
`
writeFileSync('supabase/migrations/011b_imposter_words.sql', sql)
console.log(`011b_imposter_words.sql: ${catRows.length} Kategorien, ${rows.length} Wörter`)
