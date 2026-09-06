/**
 * Wächter gegen Reste des alten Nachtdesigns.
 *
 * Vorgefallen am 06.09.2026: Bei "Finde den Imposter" war die Übersicht ein
 * schwarzes Feld -- die Karten dort waren über die Systemfarben `Canvas` und
 * `CanvasText` gebaut, und `color-scheme` stand in global.css noch auf
 * "dark". Der Browser zeichnete also Nachtfarben unter die dunkle Schrift
 * der hellen App. Beides ist repariert; diese Tests halten es fest, denn im
 * Quelltext sieht man einem `Canvas` nicht an, was es anrichtet.
 */
import { describe, it, expect } from 'vitest'
import globalCss from '../src/styles/global.css?raw'
import tokensCss from '../src/styles/tokens.css?raw'
import indexHtml from '../index.html?raw'
import viteConfig from '../vite.config.ts?raw'

// Wie in tests/all-in-one.test.ts: Vite löst das beim Bauen auf, so kommt der
// Test an alle Dateien, ohne Node-Typen im tsconfig zu brauchen.
const stylesheets = import.meta.glob('../src/**/*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Kommentare zählen nicht mit -- dort steht erklärt, warum es das nicht mehr gibt. */
const ohneKommentare = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

describe('Helles Design', () => {
  it('färbt Flächen und Schrift nirgends über Systemfarben', () => {
    // Canvas/CanvasText folgen dem color-scheme des Browsers, nicht der
    // Palette der App. Wer sie mischt, bekommt irgendwann Schwarz auf
    // Schwarz. Farben gehören in src/styles/tokens.css.
    const treffer = Object.entries(stylesheets)
      .filter(([, css]) => /\b(Canvas|CanvasText)\b/.test(ohneKommentare(css)))
      .map(([pfad]) => pfad)
    expect(treffer).toEqual([])
  })

  it('stellt das Farbschema auf hell', () => {
    expect(globalCss).toMatch(/color-scheme:\s*light/)
    expect(ohneKommentare(globalCss)).not.toMatch(/color-scheme:\s*dark/)
  })

  it('nennt überall dieselbe Grundfarbe wie die Palette', () => {
    // theme-color färbt die Statusleiste, background_color den
    // Android-Startbildschirm. Standen sie auf dem alten Nachtblau, klebte
    // über der cremefarbenen App ein schwarzer Balken.
    const grund = /--color-bg:\s*(#[0-9a-f]{6})/i.exec(tokensCss)?.[1]
    expect(grund).toBeTruthy()

    expect(/<meta name="theme-color" content="(#[0-9a-f]{6})"/i.exec(indexHtml)?.[1]).toBe(grund)
    expect(/theme_color:\s*'(#[0-9a-f]{6})'/i.exec(viteConfig)?.[1]).toBe(grund)
    expect(/background_color:\s*'(#[0-9a-f]{6})'/i.exec(viteConfig)?.[1]).toBe(grund)
  })
})
