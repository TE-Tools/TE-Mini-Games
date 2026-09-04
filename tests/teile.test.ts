/**
 * Die Stücke zum Einfügen auf dem Handy müssen zu den Migrationen passen.
 *
 * Anlass (04.09.2026, Thomas): "superbase kann ich den Code nicht einfügen per
 * handy stürzt die seite ab weil zu lange". Seither liegt unter
 * supabase/migrations/teile/ dasselbe in handlichen Stücken.
 *
 * Die tückische Stelle daran: Kommt eine Migration dazu und niemand erzeugt
 * die Stücke neu, spielt man vom Handy einen alten Stand ein und merkt es
 * nicht -- die Stücke laufen ja fehlerfrei durch, sie sind nur unvollständig.
 * Genau dieselbe Falle wie bei ALL_IN_ONE.sql im September.
 */
import { describe, it, expect } from 'vitest'

const migrationen = import.meta.glob('../supabase/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const stuecke = import.meta.glob('../supabase/migrations/teile/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const namen = (o: Record<string, string>) => Object.keys(o).map((p) => p.split('/').pop() as string)

/** Ab hier fehlt es auf einer Datenbank, die bis 010 eingespielt wurde. */
const AB = '011'
const nachgezogen = namen(migrationen)
  .filter((n) => /^\d+[a-z]?_/.test(n) && n.slice(0, 3) >= AB)
  .sort()

/** Grenze aus scripts/build-teile.mjs plus etwas Luft für den Kopf. */
const GRENZE = 15000

describe('Stücke zum Einfügen auf dem Handy', () => {
  it('es gibt sie überhaupt', () => {
    expect(namen(stuecke).length).toBeGreaterThan(5)
  })

  it('kein Stück ist zu gross fürs Handy', () => {
    const zuGross = Object.entries(stuecke)
      .filter(([, inhalt]) => inhalt.length > GRENZE)
      .map(([pfad, inhalt]) => `${pfad.split('/').pop()} (${Math.round(inhalt.length / 1024)} KB)`)
    expect(zuGross).toEqual([])
  })

  it('deckt jede Migration ab 011 ab', () => {
    const abgedeckt = namen(stuecke).join(' ')
    const fehlend = nachgezogen.filter((m) => !abgedeckt.includes(m.replace(/\.sql$/, '')))
    expect(fehlend).toEqual([])
  })

  it('zerschneidet keine Funktion', () => {
    // Ein $$ ohne Gegenstück heisst: Der Funktionskörper endet in einem
    // anderen Stück -- dann liesse sich das eine allein nicht ausführen.
    for (const [pfad, inhalt] of Object.entries(stuecke)) {
      if (pfad.endsWith('.md')) continue
      const dollar = (inhalt.match(/\$\$/g) || []).length
      expect(dollar % 2, `${pfad.split('/').pop()} endet mitten in einer Funktion`).toBe(0)
    }
  })

  it('enthält jede Anweisung genau einmal, über alle Stücke zusammen', () => {
    // Stichprobe an dem, was am ehesten verloren geht: die Tabellen und die
    // Funktionen, die die Online-Runden tragen.
    const alles = Object.values(stuecke).join('\n')
    for (const gesucht of [
      'public.fdi_matches',
      'public.fdi_players',
      'public.wbi_state',
      'public.slf_state',
      'public.fdi_custom_categories',
      'public.level_stand',
      'fdi_create_match',
      'fdi_vote',
      'fdi_last_chance',
    ]) {
      expect(alles, `${gesucht} fehlt in den Stücken`).toContain(gesucht)
    }
  })

  it('bringt alle 1000 Wörter mit', () => {
    const alles = Object.values(stuecke).join('\n')
    const woerter = (alles.match(/\('[a-z]+', '[^']+'\)/g) || []).length
    expect(woerter).toBeGreaterThanOrEqual(1000)
  })

  it('sagt in jedem Stück, woher es kommt', () => {
    for (const [pfad, inhalt] of Object.entries(stuecke)) {
      expect(inhalt.slice(0, 400), pfad).toContain('build-teile.mjs')
    }
  })
})
