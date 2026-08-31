/**
 * Wacht darüber, dass jedes Abzeichen der App auch im Datenbank-Katalog steht.
 *
 * Hintergrund (30./31.08.2026): public.user_achievements.achievement_id hat
 * einen Fremdschlüssel auf public.achievements(id). Als die App von 5 auf 50
 * Abzeichen erweitert wurde, ohne diese Tabelle mitzuziehen, scheiterte das
 * Hochladen jedes neuen Abzeichens dauerhaft mit Fehler 23503 – und blockierte
 * die Sync-Warteschlange, die die ältesten Einträge zuerst abarbeitet.
 *
 * Die SQL-Dateien kommen über Vites `?raw`-Import herein, damit der Test ohne
 * Node-Typen im App-tsconfig auskommt.
 */
import { describe, it, expect } from 'vitest'
import catalogSql from '../supabase/migrations/009_achievements_catalog.sql?raw'
import allInOneSql from '../supabase/migrations/ALL_IN_ONE.sql?raw'
import { ACHIEVEMENTS } from '@/progression/achievements'

function idsInSql(sql: string): Set<string> {
  const ids = new Set<string>()
  for (const m of sql.matchAll(/^\s*\('([^']+)',/gm)) {
    ids.add(m[1]!)
  }
  return ids
}

describe('Abzeichen-Katalog (App ↔ Datenbank)', () => {
  it('jedes Abzeichen der App steht in der Migration', () => {
    const inSql = idsInSql(catalogSql)
    const missing = ACHIEVEMENTS.filter((a) => !inSql.has(a.id)).map((a) => a.id)
    expect(missing, 'node scripts/build-achievements-sql.mjs ausführen').toEqual([])
  })

  it('die Migration enthält keine Abzeichen, die es in der App nicht gibt', () => {
    const appIds = new Set<string>(ACHIEVEMENTS.map((a) => a.id))
    const extra = [...idsInSql(catalogSql)].filter((id) => !appIds.has(id))
    expect(extra).toEqual([])
  })

  it('ALL_IN_ONE.sql enthält den Katalog mit', () => {
    expect(allInOneSql).toContain('009_achievements_catalog.sql')
    for (const a of ACHIEVEMENTS) {
      expect(allInOneSql, `${a.id} fehlt in ALL_IN_ONE.sql`).toContain(`('${a.id}',`)
    }
  })
})
