/**
 * Schiffe versenken online: Was den Server verlässt, verrät die fremde
 * Flotte nicht -- weder in der TypeScript-Sicht (die der Server in SQL
 * genauso baut, gegengerechnet von scripts/pruefe-schiffe-sql.mjs) noch im
 * Aufbau von `sv_get_state`. Und was vom Server kommt, wird vorsichtig
 * gelesen.
 */
import { describe, it, expect } from 'vitest'
import migration from '../supabase/migrations/035_schiffe_versenken_online.sql?raw'
import {
  FLOTTE,
  STANDARD_REGELN,
  flotteVomServer,
  neuePartie,
  schiesse,
  sichtAus,
  sichtFuer,
  spielerVonSitz,
  zufallsFlotte,
  type Partie,
} from '@/games/schiffe-versenken'
import { mulberry32 } from '@/games/rng'

function zufallsPartie(seed: number, schuesse: number): Partie {
  const z = mulberry32(seed)
  let p = neuePartie(
    STANDARD_REGELN,
    zufallsFlotte(STANDARD_REGELN, z),
    zufallsFlotte(STANDARD_REGELN, z),
  )
  for (let i = 0; i < schuesse && !p.ende; i++) {
    const n = schiesse(p, Math.floor(z() * 100))
    if (n) p = n
  }
  return p
}

/** Eine Funktion aus der Migration herausschneiden. */
function funktion(name: string): string {
  const ab = migration.indexOf(`function public.${name}(`)
  expect(ab).toBeGreaterThan(0)
  return migration.slice(ab, migration.indexOf('$$;', migration.indexOf('$$', ab) + 2))
}

describe('Die Sicht eines Mitspielers', () => {
  it('enthält vor dem Ende kein fremdes Schiff, das noch schwimmt', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const p = zufallsPartie(seed, 60)
      if (p.ende) continue
      for (const ich of [0, 1] as const) {
        const sicht = sichtFuer(p, ich)
        // Die Sicht hat genau drei Stellen mit Schiffen bzw. Feldern des anderen:
        // seine versenkten Schiffe, meine Schüsse, seine Schüsse.
        expect(Object.keys(sicht).sort()).toEqual([
          'amZug',
          'eigeneFlotte',
          'eigeneSchuesse',
          'ende',
          'gegnerFlotte',
          'gegnerSchuesse',
          'ich',
          'regeln',
        ])
        expect(sicht.eigeneFlotte).toBe(p.flotten[ich])
        const versenktIds = new Set(
          sicht.eigeneSchuesse.filter((x) => x.ergebnis === 'versenkt').map((x) => x.schiff),
        )
        expect(sicht.gegnerFlotte.map((g) => g.id).sort()).toEqual([...versenktIds].sort())
        // Ein bloßer Treffer sagt nicht, welches Schiff es war.
        for (const x of sicht.eigeneSchuesse) {
          if (x.ergebnis !== 'versenkt') expect(x.schiff).toBeUndefined()
        }
      }
    }
  })

  it('übersteht den Weg über den Server unverändert', () => {
    const p = zufallsPartie(7, 40)
    const sicht = sichtFuer(p, 1)
    expect(sichtAus(JSON.parse(JSON.stringify(sicht)))).toEqual(sicht)
  })

  it('liest Unsinn vom Server als nichts', () => {
    expect(sichtAus(null)).toBeNull()
    const s = sichtAus({
      ich: 1,
      eigeneSchuesse: [{ feld: 400, ergebnis: 'wasser' }, 'x'],
      ende: 'ja',
    })!
    expect(s.ich).toBe(1)
    expect(s.eigeneSchuesse).toEqual([])
    expect(s.ende).toBeNull()
    expect(s.regeln).toEqual(STANDARD_REGELN)
    expect(flotteVomServer(null)).toBeNull()
    expect(flotteVomServer(FLOTTE.map((a) => ({ ...a, x: 0, y: 0, richtung: 'h' })))).toHaveLength(
      5,
    )
    expect(spielerVonSitz(1)).toBe(0)
    expect(spielerVonSitz(2)).toBe(1)
  })
})

describe('Migration 035', () => {
  it('sv_get_state gibt nur die eigene Aufstellung und die Sicht heraus, nie den Zustand', () => {
    const f = funktion('sv_get_state')
    expect(f).toContain('public.sv_sicht(v_match.zustand, v_platz - 1)')
    expect(f).not.toMatch(/'zustand'\s*,/)
    expect(f).toMatch(
      /'flotte', case when v_platz = 1 then v_match.flotte1 else v_match.flotte2 end/,
    )
  })

  it('die Regelfunktionen fassen keine Tabelle an', () => {
    for (const name of [
      'sv_flotte_fehler',
      'sv_schuss',
      'sv_aufgabe',
      'sv_sicht',
      'sv_neue_partie',
      'sv_ist_versenkt',
      'sv_felder',
    ]) {
      const f = funktion(name)
      expect(f, name).toMatch(/\bimmutable\b/)
      expect(f, name).not.toMatch(
        /\b(from|update|insert into|delete from)\s+public\.sv_(matches|players|state)\b/,
      )
    }
  })

  it('die Tabellen sind gesperrt', () => {
    for (const tabelle of ['sv_matches', 'sv_players', 'sv_state']) {
      expect(migration).toContain(`revoke all on public.${tabelle} from anon, authenticated;`)
    }
  })
})
