/**
 * Öffentliche Räume und Aufräumen nach zwanzig Minuten (Migration 018).
 *
 * Fünf Spiele, vier Funktionen je Spiel -- das ist genau die Art Liste, bei
 * der eine Zeile vergessen wird und es erst auffällt, wenn in einem Spiel
 * die Lobby leer bleibt. Deshalb prüft der Test die Migration Spiel für
 * Spiel, und dazu, dass die Dienste im Browser dieselben Namen rufen.
 */
import { describe, it, expect } from 'vitest'
import migration from '../supabase/migrations/018_oeffentliche_raeume.sql?raw'
import {
  RAUM_FRIST_MINUTEN,
  RAUM_GESCHLOSSEN_TEXT,
  istRaumWeg,
  raumFunktionen,
} from '@/services/raeume'

const PRAEFIXE = ['sr', 'fdi', 'wbi', 'slf', 'kniffel'] as const

describe('Migration 018', () => {
  it('räumt in jedem Spiel nach zwanzig Minuten auf', () => {
    for (const p of PRAEFIXE) {
      expect(migration, p).toContain(`create or replace function public.${p}_cleanup()`)
      expect(migration, p).toContain(
        `delete from public.${p}_matches where updated_at < now() - interval '${RAUM_FRIST_MINUTEN} minutes'`,
      )
    }
  })

  it('hat für jedes Spiel Lebenszeichen, Schalter und Liste -- mit Rechten', () => {
    for (const p of PRAEFIXE) {
      expect(migration, p).toContain(`public.${p}_heartbeat(p_match uuid)`)
      expect(migration, p).toContain(`public.${p}_set_public(p_match uuid, p_public boolean)`)
      expect(migration, p).toContain(`public.${p}_public_matches()`)
      expect(migration, p).toContain(`alter table public.${p}_matches`)
      expect(migration, p).toContain(`grant execute on function public.${p}_heartbeat(uuid)`)
      expect(migration, p).toContain(
        `grant execute on function public.${p}_set_public(uuid, boolean)`,
      )
      expect(migration, p).toContain(`grant execute on function public.${p}_public_matches()`)
      // Die Lobby-Listen räumen vorher auf -- deshalb sind sie hier neu definiert.
      expect(migration, p).toContain(`public.${p}_my_matches()`)
      expect(migration, p).toContain(`perform public.${p}_cleanup();`)
    }
  })

  it('nennt in der Liste den Gastgeber und alle Spieler', () => {
    for (const p of PRAEFIXE) {
      expect(migration, p).toContain(
        `where x.match_id = m.id and x.user_id = m.host_id limit 1), 'Jemand')`,
      )
      expect(migration, p).toContain(`from public.${p}_players x where x.match_id = m.id),`)
    }
    expect((migration.match(/array_agg\(x\.name order by x\.seat\)/g) ?? []).length).toBe(
      PRAEFIXE.length,
    )
    expect((migration.match(/spieler text\[\]/g) ?? []).length).toBe(PRAEFIXE.length)
  })

  it('gibt der Aufräumfunktion kein Recht nach außen', () => {
    for (const p of PRAEFIXE) {
      expect(migration).not.toContain(`grant execute on function public.${p}_cleanup`)
    }
  })
})

describe('Dienst', () => {
  it('ruft die Funktionen mit dem Präfix des Spiels', async () => {
    const aufrufe: string[] = []
    const client = () =>
      ({
        rpc: async (name: string) => {
          aufrufe.push(name)
          return { data: [], error: null }
        },
      }) as unknown as Parameters<typeof raumFunktionen>[1] extends () => infer C ? C : never
    const r = raumFunktionen('kniffel', client)
    await r.herzschlag('m1')
    await r.oeffentlichSchalten('m1', true)
    await r.oeffentlicheRaeume()
    expect(aufrufe).toEqual(['kniffel_heartbeat', 'kniffel_set_public', 'kniffel_public_matches'])
  })

  it('erkennt einen verschwundenen Raum an den Meldungen des Servers', () => {
    expect(istRaumWeg(new Error('Runde nicht gefunden'))).toBe(true)
    expect(istRaumWeg(new Error('Du bist in dieser Runde nicht dabei.'))).toBe(true)
    expect(istRaumWeg(new Error('Diesen Spielcode gibt es nicht.'))).toBe(true)
    expect(istRaumWeg(new Error('Du bist nicht am Zug.'))).toBe(false)
    expect(RAUM_GESCHLOSSEN_TEXT).toContain('20 Minuten')
  })
})
