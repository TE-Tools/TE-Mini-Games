/** Das Spiel des Tages auf der Startseite. */
import { describe, expect, it } from 'vitest'
import { SPIELE_KACHELN, spielDesTages } from '@/pages/spiele-katalog'

describe('Spiel des Tages', () => {
  it('bleibt den ganzen Tag dasselbe und wechselt am nächsten', () => {
    const morgens = spielDesTages(new Date(2026, 10, 22, 0, 5))
    const abends = spielDesTages(new Date(2026, 10, 22, 23, 55))
    const morgen = spielDesTages(new Date(2026, 10, 23, 8, 0))
    expect(abends.id).toBe(morgens.id)
    expect(morgen.id).not.toBe(morgens.id)
  })

  it('kommt der Reihe nach an jedem Spiel vorbei', () => {
    const gesehen = new Set<string>()
    for (let tag = 0; tag < SPIELE_KACHELN.length; tag++) {
      gesehen.add(spielDesTages(new Date(2026, 0, 1 + tag, 12)).id)
    }
    expect(gesehen.size).toBe(SPIELE_KACHELN.length)
  })
})

describe('Startseite: Zuletzt gespielt', () => {
  it('Serie auf Deutsch und Englisch mit richtiger Einzahl', async () => {
    const { de } = await import('@/i18n/texte/de')
    const { en } = await import('@/i18n/texte/en')
    expect([de.start.serieTage(1), de.start.serieTage(3)]).toEqual(['1 Tag', '3 Tage'])
    expect([en.start.serieTage(1), en.start.serieTage(3)]).toEqual(['1 day', '3 days'])
  })
})
