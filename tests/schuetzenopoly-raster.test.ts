/**
 * Wo die 40 Felder im 11x11-Raster liegen.
 *
 * Das ist reine Rechnerei, aber genau dort war schon ein Fehler drin: die
 * linke Spalte lag eine Zeile zu tief, sodass zwei Felder übereinander
 * standen und der Rest verrutschte. Auf dem Bildschirm sieht man das
 * sofort -- in der Rechnung eben nicht.
 */
import { describe, it, expect } from 'vitest'
import { rasterplatz, kante } from '@/pages/play/schuetzenopoly/brettPositionen'

describe('Rasterplätze', () => {
  it('legt kein Feld auf denselben Platz wie ein anderes', () => {
    const belegt = new Set<string>()
    for (let p = 0; p < 40; p++) {
      const { zeile, spalte } = rasterplatz(p)
      const schluessel = `${zeile}:${spalte}`
      expect(belegt.has(schluessel)).toBe(false)
      belegt.add(schluessel)
    }
    expect(belegt.size).toBe(40)
  })

  it('bleibt innerhalb des Rasters', () => {
    for (let p = 0; p < 40; p++) {
      const { zeile, spalte } = rasterplatz(p)
      expect(zeile).toBeGreaterThanOrEqual(1)
      expect(zeile).toBeLessThanOrEqual(11)
      expect(spalte).toBeGreaterThanOrEqual(1)
      expect(spalte).toBeLessThanOrEqual(11)
    }
  })

  it('lässt nur den Rand belegt und die Mitte frei', () => {
    for (let p = 0; p < 40; p++) {
      const { zeile, spalte } = rasterplatz(p)
      const amRand = zeile === 1 || zeile === 11 || spalte === 1 || spalte === 11
      expect(amRand).toBe(true)
    }
  })

  it('setzt die vier Ecken in die vier Ecken', () => {
    expect(rasterplatz(0)).toEqual({ zeile: 11, spalte: 11 })
    expect(rasterplatz(10)).toEqual({ zeile: 11, spalte: 1 })
    expect(rasterplatz(20)).toEqual({ zeile: 1, spalte: 1 })
    expect(rasterplatz(30)).toEqual({ zeile: 1, spalte: 11 })
  })

  it('läuft gegen den Uhrzeigersinn ohne Sprung', () => {
    for (let p = 0; p < 40; p++) {
      const a = rasterplatz(p)
      const b = rasterplatz((p + 1) % 40)
      const abstand = Math.abs(a.zeile - b.zeile) + Math.abs(a.spalte - b.spalte)
      expect(abstand).toBe(1)
    }
  })

  it('rechnet Positionen außerhalb des Bretts im Kreis', () => {
    expect(rasterplatz(40)).toEqual(rasterplatz(0))
    expect(rasterplatz(-1)).toEqual(rasterplatz(39))
  })

  it('ordnet jeder Position eine Kante zu', () => {
    expect(kante(5)).toBe('unten')
    expect(kante(15)).toBe('links')
    expect(kante(25)).toBe('oben')
    expect(kante(35)).toBe('rechts')
  })
})
