/**
 * Erzeugt supabase/migrations/027_imposter_hilfswoerter.sql aus den
 * Spieldaten: zu jedem Wort jeder Kategorie die Hilfswörter, die das Spiel
 * am einen Gerät auch nehmen würde.
 *
 * WARUM. Online zog der Server das Hilfswort bisher zufällig aus der ganzen
 * Kategorie -- zu "Trompete" kam dann "Ohrwurm", und der Imposter verriet
 * sich mit dem ersten Satz. Am einen Gerät wählt `helperCandidates` aus der
 * thematischen Gruppe, ohne Wörter, die das Geheimwort verraten
 * (Schwein/Wildschwein). Statt diese Regeln ein zweites Mal in SQL zu
 * schreiben, steht hier ihr Ergebnis als Tabelle. Eine Fassung, zwei Orte.
 *
 * Aufruf: node scripts/build-imposter-helfer-sql.mjs
 * tests/imposter-helfer-sql.test.ts schlägt fehl, sobald beides auseinanderläuft.
 */
import { writeFileSync } from 'node:fs'
import { createServer } from 'vite'
import { schreibeEnglischeWoerter } from './imposter-englisch-sql.mjs'

const server = await createServer({ server: { middlewareMode: true }, logLevel: 'error' })
const { helperCandidates } = await server.ssrLoadModule(
  '/src/games/finde-den-imposter/data/helperClusters.ts',
)
const { wordsForCategory } = await server.ssrLoadModule(
  '/src/games/finde-den-imposter/data/words.ts',
)
const { CATEGORIES } = await server.ssrLoadModule(
  '/src/games/finde-den-imposter/data/categories.ts',
)
await server.close()

const q = (s) => `'${s.replace(/'/g, "''")}'`
const zeilen = []
// Nur Deutsch -- die englischen Hilfswörter stehen in 029 (siehe unten).
for (const cat of CATEGORIES.filter((c) => c.sprache === 'de')) {
  const pool = wordsForCategory(cat.id).map((w) => w.word)
  for (const wort of pool) {
    for (const helfer of helperCandidates(wort, cat.id, pool)) {
      zeilen.push(`  (${q(cat.id)}, ${q(wort)}, ${q(helfer)})`)
    }
  }
}

const sql = `-- Hilfswörter für das Online-Spiel "Finde den Imposter".
--
-- NICHT von Hand pflegen: erzeugt aus src/games/finde-den-imposter/data/ mit
--   node scripts/build-imposter-helfer-sql.mjs
-- tests/imposter-helfer-sql.test.ts schlägt fehl, sobald beides auseinanderläuft.
--
-- Zu jedem Geheimwort die Hilfswörter, die auch das Spiel am einen Gerät
-- nehmen würde: aus derselben Themengruppe, nie eins, das das Geheimwort
-- verrät. fdi_deal (Migration 028) zieht daraus. Mehrfach ausführbar.

create table if not exists public.fdi_helper (
  category_id text not null,
  word text not null,
  helper text not null,
  primary key (category_id, word, helper)
);

-- Nur die Funktionen des Servers lesen hier; wer die Tabelle sieht, sieht
-- zu jedem Hilfswort die möglichen Geheimwörter.
alter table public.fdi_helper enable row level security;
revoke all on public.fdi_helper from public, anon, authenticated;

delete from public.fdi_helper;
insert into public.fdi_helper (category_id, word, helper) values
${zeilen.join(',\n')};
`
writeFileSync('supabase/migrations/027_imposter_hilfswoerter.sql', sql)
console.log(`${zeilen.length} Zeilen geschrieben`)

// Die englischen Hilfswörter gehen zusammen mit ihren Wörtern in 029.
await schreibeEnglischeWoerter()
