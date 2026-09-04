/**
 * Baut supabase/migrations/ALL_IN_ONE.sql aus den einzelnen Migrationen.
 *
 * Das Ergebnis ist das Skript, das im Supabase-SQL-Editor eingefügt wird. Es
 * ist mehrfach ausführbar, weil jede Migration selbst idempotent geschrieben
 * ist (create table if not exists / create or replace / drop policy if exists).
 *
 * Aufruf: node scripts/build-all-in-one.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'supabase/migrations'
const target = join(dir, 'ALL_IN_ONE.sql')

// Nachtrag 04.09.2026: Das Muster war vorher /^\d+_.*\.sql$/ und liess damit
// 011b_imposter_words.sql aussen vor -- nach den Ziffern kam ein Buchstabe
// statt des Unterstrichs. Aufgefallen ist es erst, als das Online-Spiel live
// keine Woerter hatte. Der Buchstabe gehoert jetzt ausdruecklich dazu, und
// tests/all-in-one.test.ts prueft, dass wirklich jede Migration drin ist.
const files = readdirSync(dir)
  .filter((f) => /^\d+[a-z]?_.*\.sql$/.test(f))
  .sort()

const header = `-- TE-Mini Games – complete Supabase setup
-- (Schema + RLS + Benutzername + Level 500 + Rangliste + Selbstlöschung
--  + Schützenrunde online + Finde den Imposter online + Wer bin ich?
--  + Stadt-Land-Fluss)
-- Generated from the migrations in this folder; safe to run more than once.
-- Paste into Supabase → SQL Editor → New query → Run.
`

const body = files
  .map((f) => `\n-- ==================== ${f} ====================\n${readFileSync(join(dir, f), 'utf8').trimEnd()}\n`)
  .join('')

writeFileSync(target, header + body)
console.log(`${target}: ${files.length} Migrationen, ${(header + body).split('\n').length} Zeilen`)
