/**
 * Schützenrunde online: feste Sätze statt freiem Chat.
 *
 * Geprüft wird, was beim Ändern leicht auseinanderläuft: die Sätze im
 * Wörterbuch, die der Client sendet, und die Liste, die der Server in
 * Migration 030 annimmt. Und dass jeder gesendete Satz in jeder Sprache
 * wieder als Satz ankommt, nicht als deutscher Rest.
 */
import sql from '../supabase/migrations/030_schuetzenrunde_feste_saetze.sql?raw'
import { describe, it, expect } from 'vitest'
import { de } from '@/i18n/texte/de'
import { en } from '@/i18n/texte/en'
import {
  alleSaetze,
  brauchtNamen,
  deutscherSatz,
  satzIn,
} from '@/pages/play/schuetzenrunde/festeSaetze'
import { aussageText } from '@/pages/play/schuetzenrunde/srText'

function sqlListe(name: string): string[] {
  const block = sql.match(new RegExp(`${name} text\\[\\] := array\\[([\\s\\S]*?)\\];`))
  if (!block) throw new Error(`${name} fehlt in 030`)
  return [...block[1]!.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1]!.replace(/''/g, "'"))
}

describe('Feste Sätze', () => {
  it('der Server nimmt genau die Sätze an, die der Client anbietet', () => {
    const a = de.schuetzenrunde.aussagen
    expect(sqlListe('ohne_namen')).toEqual([...a.verteidigungen, ...a.allgemein])
    expect(sqlListe('mit_namen')).toEqual(
      [...a.vorwuerfe, ...a.fuersprache].map((satz) => satz('%s')),
    )
  })

  it('jeder Satz kommt auf Englisch als englischer Satz an', () => {
    for (const wahl of alleSaetze()) {
      const gesendet = deutscherSatz(wahl, 'Hilde')
      const gezeigt = aussageText(en, gesendet)
      expect(gezeigt).toBe(satzIn(en.schuetzenrunde.aussagen, wahl, 'Hilde'))
      expect(gezeigt).not.toMatch(/[äöüß]|ich |nicht/i)
    }
  })

  it('auf Deutsch bleibt jeder Satz, wie er gesendet wurde', () => {
    for (const wahl of alleSaetze()) {
      const gesendet = deutscherSatz(wahl, 'Karl')
      expect(aussageText(de, gesendet)).toBe(gesendet)
    }
  })

  it('Sätze mit Namen verlangen einen, die anderen nicht', () => {
    const mit = alleSaetze().filter(brauchtNamen)
    expect(mit).toHaveLength(8)
    for (const wahl of mit) expect(deutscherSatz(wahl, 'Käthe')).toContain('Käthe')
  })

  it('freier Text aus älteren Runden bleibt stehen, wie er ist', () => {
    expect(aussageText(en, 'Hallo zusammen!')).toBe('Hallo zusammen!')
  })
})
