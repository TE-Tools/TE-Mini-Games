/**
 * Wo die 40 Felder im 11x11-Raster liegen.
 *
 * Das ist reine Rechnerei, aber genau dort war schon ein Fehler drin: die
 * linke Spalte lag eine Zeile zu tief, sodass zwei Felder übereinander
 * standen und der Rest verrutschte. Auf dem Bildschirm sieht man das
 * sofort -- in der Rechnung eben nicht.
 */
import { describe, it, expect } from 'vitest'
import {
  BRETT_ZUSATZ,
  FELD_MINDEST,
  KANTEN_EINHEITEN,
  ZOOM_MAX,
  ZOOM_MIN,
  feldGroesse,
  kante,
  rasterplatz,
  standardZoom,
  zoomStufe,
} from '@/pages/play/schuetzenopoly/brettPositionen'

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

/**
 * Wie groß das Brett sein muss, damit man es auf dem Handy lesen kann.
 *
 * Thomas am 21.09.2026: "bei Schützenopoly sind die Felder auf einem Handy
 * zu klein, bitte alles größer machen und besser sichtbar."
 *
 * Gemessen auf 360 Punkten Bildschirmbreite: 26 Punkte je Feld, Schrift 5
 * Punkte, Namen nach acht Zeichen abgeschnitten. Die Rechnung dahinter steht
 * jetzt hier, damit sie sich nachprüfen lässt, ohne dass jemand ein Telefon
 * in die Hand nimmt.
 */
describe('Brettgröße', () => {
  /** So breit ist der Platz fürs Brett auf einem gewöhnlichen Telefon. */
  const HANDY = 330

  it('macht ein Feld auf dem Handy mindestens so groß wie ein Fingertipp', () => {
    const zoom = standardZoom(HANDY)
    expect(zoom).toBeGreaterThan(1)
    expect(feldGroesse(HANDY * zoom)).toBeGreaterThanOrEqual(FELD_MINDEST)
  })

  it('rechnet den Rand des Bretts mit', () => {
    // Zehn Fügen, Innenabstand und Rand sind keine Feldfläche. Ohne sie kam
    // bei einer Vorgabe von 44 gemessen 41 heraus.
    expect(BRETT_ZUSATZ).toBeGreaterThan(0)
    expect(feldGroesse(100)).toBeLessThan(100 / KANTEN_EINHEITEN)
  })

  it('lässt ein breites Fenster in Ruhe', () => {
    // Auf einem Tablet oder am Rechner passt das Brett ohnehin: kein Zoom,
    // kein Schieben.
    expect(standardZoom(FELD_MINDEST * KANTEN_EINHEITEN + BRETT_ZUSATZ)).toBe(1)
    expect(standardZoom(1200)).toBe(1)
  })

  it('bleibt bei unsinnigen Maßen bei eins', () => {
    expect(standardZoom(0)).toBe(1)
    expect(standardZoom(-10)).toBe(1)
    expect(standardZoom(Number.NaN)).toBe(1)
  })

  it('hält die Stufen in ihren Grenzen', () => {
    expect(zoomStufe(ZOOM_MIN, -1)).toBe(ZOOM_MIN)
    expect(zoomStufe(ZOOM_MAX, 1)).toBe(ZOOM_MAX)
    expect(zoomStufe(1.4, 1)).toBeGreaterThan(1.4)
    expect(zoomStufe(1.4, -1)).toBeLessThan(1.4)
    // Und keine krummen Zahlen, die beim Anzeigen wackeln.
    expect(zoomStufe(1.4, 1)).toBe(Math.round(zoomStufe(1.4, 1) * 20) / 20)
  })

  it('deckelt die Vergrößerung', () => {
    // Auch auf einem sehr schmalen Gerät wird das Brett nicht beliebig groß
    // -- sonst sieht man nur noch drei Felder.
    expect(standardZoom(120)).toBeLessThanOrEqual(ZOOM_MAX)
  })
})
