/**
 * Wacht darüber, dass ALL_IN_ONE.sql wirklich jede Migration enthält.
 *
 * Hintergrund (04.09.2026): Die Datei ist das Skript, das im Supabase-SQL-
 * Editor eingefügt wird -- die Einrichtungsanleitung nennt nur sie. Sie war
 * beim Stand von 010 stehengeblieben, weil der Generator nach dem Hinzufügen
 * von 011 bis 014 nie wieder lief. Ergebnis: Imposter online, Wer bin ich?
 * und Stadt-Land-Fluss hatten in der laufenden Datenbank gar keine Tabellen.
 * Aufgefallen ist es erst beim Nachsehen an der echten Instanz.
 *
 * Zweiter Fehler derselben Sorte: Das Namensmuster des Generators war
 * /^\d+_.*\.sql$/ und liess 011b_imposter_words.sql aussen vor -- ohne die
 * hätte das Online-Spiel keine Wörter gehabt.
 *
 * Beides sieht man einer erfolgreichen Auslieferung nicht an. Deshalb dieser
 * Test: Er vergleicht die Dateien im Ordner mit dem, was im Sammelskript
 * steht, und schlägt fehl, sobald etwas fehlt.
 */
import { describe, it, expect } from 'vitest'
import allInOne from '../supabase/migrations/ALL_IN_ONE.sql?raw'

// Vite löst diesen Ausdruck beim Bauen auf -- so kommt der Test an die
// Dateinamen, ohne Node-Typen im App-tsconfig zu brauchen.
const dateien = import.meta.glob('../supabase/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const migrationen = Object.keys(dateien)
  .map((p) => p.split('/').pop() as string)
  .filter((n) => n !== 'ALL_IN_ONE.sql')
  .sort()

describe('ALL_IN_ONE.sql', () => {
  it('kennt überhaupt Migrationen', () => {
    expect(migrationen.length).toBeGreaterThan(10)
  })

  it('enthält jede einzelne Migration', () => {
    const fehlend = migrationen.filter((n) => !allInOne.includes(`==== ${n} ====`))
    expect(fehlend).toEqual([])
  })

  it('enthält die Migrationen in der richtigen Reihenfolge', () => {
    const stellen = migrationen.map((n) => allInOne.indexOf(`==== ${n} ====`))
    const sortiert = [...stellen].sort((a, b) => a - b)
    expect(stellen).toEqual(sortiert)
  })

  it('bringt die Tabellen mit, ohne die die Online-Spiele nicht laufen', () => {
    for (const tabelle of ['sr_state', 'fdi_state', 'wbi_state', 'slf_state']) {
      expect(allInOne).toContain(`public.${tabelle}`)
    }
  })

  it('bringt die Wörter für das Online-Spiel mit', () => {
    // 011b fiel früher durch das Namensmuster des Generators.
    expect(allInOne).toContain('fdi_categories')
    expect(allInOne).toContain('fdi_words')
  })

  it('ist auf dem Stand der einzelnen Dateien', () => {
    // Jede Migration muss inhaltlich drinstehen, nicht nur ihre Überschrift --
    // sonst genügte es, den Generator halb laufen zu lassen.
    for (const [pfad, inhalt] of Object.entries(dateien)) {
      const name = pfad.split('/').pop() as string
      if (name === 'ALL_IN_ONE.sql') continue
      const letzteZeile = inhalt.trimEnd().split('\n').filter((z) => z.trim()).pop() as string
      expect(allInOne, `${name} ist veraltet im Sammelskript`).toContain(letzteZeile.trim())
    }
  })
})
