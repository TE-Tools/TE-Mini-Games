/**
 * Die Rangliste muss stehen bleiben, auch wenn die Datenbank die Levelzahlen
 * noch nicht kennt.
 *
 * Am 04.09.2026 war sie leer. Der Grund war kein Datenverlust, sondern eine
 * Abfrage: Die App verlangte die Spalte `player_level`, die auf der laufenden
 * Datenbank noch nicht existierte. PostgREST weist in so einem Fall die GANZE
 * Abfrage ab -- nicht nur die eine Spalte --, und der Fehlerzweig gab eine
 * leere Liste zurueck. Aus "eine Zahl fehlt" wurde "nichts da".
 *
 * Die Lehre steckt in der Aufteilung: Die Levelzahlen kommen aus einer eigenen
 * Abfrage, die scheitern darf. Was nicht scheitern darf, ist die Rangliste
 * selbst. Genau das haelt dieser Test fest.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

const anfragen: string[] = []

/**
 * Eine Supabase-Attrappe, bei der ausgewaehlte Tabellen "fehlen".
 *
 * Jede Methode gibt die Kette zurueck, und die Kette selbst ist awaitbar --
 * genau wie beim echten Client. Gibt man schon bei .order() ein Promise
 * zurueck, laeuft das nachfolgende .limit() ins Leere; beim ersten Versuch
 * hier ist mir genau das passiert.
 */
function supabaseMit(fehlend: string[], zeilen: Record<string, unknown[]>) {
  const bauer = (tabelle: string) => {
    const antwort = () =>
      fehlend.includes(tabelle)
        ? { data: null, error: { code: '42703', message: `column ${tabelle}.x does not exist` } }
        : { data: zeilen[tabelle] ?? [], error: null }

    const kette: Record<string, unknown> = {
      then: (aufloesen: (w: unknown) => void) => aufloesen(antwort()),
    }
    for (const m of ['select', 'eq', 'order', 'limit']) {
      kette[m] = vi.fn(() => kette)
    }
    return kette
  }
  return {
    from: vi.fn((tabelle: string) => {
      anfragen.push(tabelle)
      return bauer(tabelle)
    }),
  }
}

const RANGLISTE = [
  { username: 'phillip', total_xp: 5988, total_score: 40305, play_count: 258, game_count: 4, last_played_at: '2026-09-04T20:02:46Z' },
  { username: 'luna', total_xp: 2500, total_score: 24778, play_count: 73, game_count: 3, last_played_at: '2026-09-02T10:23:03Z' },
]
const JE_SPIEL = [
  { username: 'luna', total_xp: 999, total_score: 14225, play_count: 15, last_played_at: '2026-09-02T10:23:03Z' },
]

async function mitDatenbank(fehlend: string[]) {
  vi.resetModules()
  anfragen.length = 0
  vi.doMock('@/database/supabase', () => ({
    isSupabaseConfigured: true,
    supabase: supabaseMit(fehlend, {
      leaderboard_overall: RANGLISTE,
      leaderboard_xp_total: JE_SPIEL,
      spieler_stand: [{ username: 'phillip', player_level: 9 }, { username: 'luna', player_level: 4 }],
      level_stand: [{ username: 'luna', level: 15 }],
    }),
  }))
  return import('@/services/leaderboard')
}

afterEach(() => {
  vi.doUnmock('@/database/supabase')
  vi.resetModules()
})

describe('Rangliste, wenn die Datenbank die Levelzahlen noch nicht kennt', () => {
  beforeEach(() => {
    anfragen.length = 0
  })

  it('bleibt vollständig, wenn spieler_stand fehlt', async () => {
    const { getRemoteOverall } = await mitDatenbank(['spieler_stand'])
    const liste = await getRemoteOverall()
    expect(liste).toHaveLength(2)
    expect(liste[0]!.username).toBe('phillip')
    expect(liste[0]!.totalXp).toBe(5988)
    // 0 heisst "unbekannt" -- die Seite schreibt dann gar kein Level hin.
    expect(liste[0]!.playerLevel).toBe(0)
  })

  it('zeigt das Level, sobald spieler_stand da ist', async () => {
    const { getRemoteOverall } = await mitDatenbank([])
    const liste = await getRemoteOverall()
    expect(liste[0]!.playerLevel).toBe(9)
    expect(liste[1]!.playerLevel).toBe(4)
  })

  it('bleibt je Spiel vollständig, wenn level_stand fehlt', async () => {
    const { getRemoteXpTotals } = await mitDatenbank(['level_stand'])
    const liste = await getRemoteXpTotals('reihenfolge')
    expect(liste).toHaveLength(1)
    expect(liste[0]!.xp).toBe(999)
    expect(liste[0]!.level).toBe(0)
  })

  it('zeigt das Level je Spiel, sobald level_stand da ist', async () => {
    const { getRemoteXpTotals } = await mitDatenbank([])
    const liste = await getRemoteXpTotals('reihenfolge')
    expect(liste[0]!.level).toBe(15)
  })

  it('fragt die Levelzahlen getrennt ab, nicht in derselben Abfrage', async () => {
    // Der eigentliche Fehler von damals: beides in einer Abfrage. Faellt eine
    // Spalte weg, faellt alles weg.
    const { getRemoteOverall } = await mitDatenbank([])
    await getRemoteOverall()
    expect(anfragen).toContain('leaderboard_overall')
    expect(anfragen).toContain('spieler_stand')
  })

  it('gibt eine leere Liste, wenn die Rangliste selbst fehlt', async () => {
    const { getRemoteOverall } = await mitDatenbank(['leaderboard_overall'])
    expect(await getRemoteOverall()).toEqual([])
  })
})
