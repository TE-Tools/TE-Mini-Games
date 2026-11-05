import { describe, expect, it } from 'vitest'
import { tischplaetze } from '@/pages/play/schuetzenopoly/tischplaetze'

describe('Schützenopoly am Tisch', () => {
  it('gibt jedem Mitspieler eine eigene Seite', () => {
    for (const quer of [true, false]) {
      for (let n = 1; n <= 4; n++) {
        const plaetze = tischplaetze(n, quer)
        expect(plaetze).toHaveLength(n)
        expect(new Set(plaetze).size).toBe(n)
      }
    }
  })

  it('setzt zwei Spieler einander gegenüber an die kurzen Seiten', () => {
    expect(tischplaetze(2, true)).toEqual(['links', 'rechts'])
    expect(tischplaetze(2, false)).toEqual(['unten', 'oben'])
  })
})
