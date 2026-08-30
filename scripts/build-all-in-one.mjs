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

const files = readdirSync(dir)
  .filter((f) => /^\d+_.*\.sql$/.test(f))
  .sort()

const header = `-- TE-Mini Games – complete Supabase setup
-- (schema + RLS + username + level 500 + leaderboard + self-deletion
--  + Schützenrunde multiplayer)
-- Generated from the migrations in this folder; safe to run more than once.
-- Paste into Supabase → SQL Editor → New query → Run.
`

const body = files
  .map((f) => `\n-- ==================== ${f} ====================\n${readFileSync(join(dir, f), 'utf8').trimEnd()}\n`)
  .join('')

writeFileSync(target, header + body)
console.log(`${target}: ${files.length} Migrationen, ${(header + body).split('\n').length} Zeilen`)
