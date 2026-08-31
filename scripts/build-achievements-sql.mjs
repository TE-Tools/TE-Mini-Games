/**
 * Baut supabase/migrations/009_achievements_catalog.sql aus den
 * Abzeichen-Definitionen in src/progression/achievements.ts.
 *
 * Hintergrund: public.user_achievements.achievement_id hat einen Fremdschlüssel
 * auf public.achievements(id). Steht ein Abzeichen nur in der App, aber nicht
 * in dieser Tabelle, scheitert das Hochladen jedes Freischaltens dauerhaft --
 * und blockiert damit die ganze Sync-Warteschlange. Diese Datei hält beides
 * zusammen; tests/achievements-catalog.test.ts wacht darüber.
 *
 * Aufruf: node scripts/build-achievements-sql.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const source = readFileSync('src/progression/achievements.ts', 'utf8')

// Nur den ACHIEVEMENTS-Array-Block betrachten, nicht den AchievementId-Union.
const start = source.indexOf('export const ACHIEVEMENTS')
const end = source.indexOf('export function getAchievementDef')
if (start === -1 || end === -1) {
  throw new Error('ACHIEVEMENTS-Block in src/progression/achievements.ts nicht gefunden')
}
const block = source.slice(start, end)

const entryPattern =
  /\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*description:\s*'([^']+)',\s*icon:\s*'([^']*)',?\s*\}/g

const rows = []
for (const m of block.matchAll(entryPattern)) {
  rows.push({ id: m[1], name: m[2], description: m[3] })
}

if (rows.length === 0) {
  throw new Error('Keine Abzeichen gefunden – Format von achievements.ts geändert?')
}

const sqlString = (s) => `'${s.replace(/'/g, "''")}'`

const values = rows
  .map((r) => `  (${sqlString(r.id)}, ${sqlString(r.name)}, ${sqlString(r.description)})`)
  .join(',\n')

const sql = `-- Abzeichen-Katalog: jedes Abzeichen der App muss hier stehen.
--
-- public.user_achievements.achievement_id hat einen Fremdschlüssel auf
-- public.achievements(id). Fehlt ein Abzeichen hier, scheitert das Hochladen
-- des Freischaltens dauerhaft (Fehler 23503) -- und weil die Sync-Warteschlange
-- die ältesten Einträge zuerst abarbeitet, blockiert so ein Dauerfehler
-- irgendwann auch alle neuen Spielergebnisse. Genau das ist am 30.08.2026
-- passiert, als die App von 5 auf 50 Abzeichen erweitert wurde, ohne diese
-- Tabelle mitzuziehen.
--
-- NICHT von Hand pflegen: erzeugt aus src/progression/achievements.ts mit
--   node scripts/build-achievements-sql.mjs
-- tests/achievements-catalog.test.ts schlägt fehl, sobald beides auseinanderläuft.
insert into public.achievements (id, name, description) values
${values}
on conflict (id) do update
  set name = excluded.name,
      description = excluded.description;
`

writeFileSync('supabase/migrations/009_achievements_catalog.sql', sql)
console.log(`009_achievements_catalog.sql: ${rows.length} Abzeichen`)
