/**
 * Wie die freischaltbaren Designs aussehen.
 *
 * Reine Daten, damit sie die flache Darstellung (CSS-Variablen), die
 * 3D-Würfel (gemalte Texturen) und die Vorschau in der Auswahl
 * gleichermaßen nutzen. Das Standarddesign steht hier nicht: Es ist das,
 * was die Spiele ohne jede Variable ohnehin zeichnen.
 *
 * Alles eigene Entwürfe -- keine Farben, Muster oder Schriftzüge eines
 * Handelsprodukts.
 */

import type { CSSProperties } from 'react'
import type { RueckenDesignId, WuerfelDesignId } from '@/services/sammlung'

/* ------------------------------------------------------------ Würfel */

export interface WuerfelFarben {
  /** Fläche: Verlauf von hell (oben links) nach dunkel. */
  flaeche: [string, string]
  /** Augen: Mitte und Rand des eingesenkten Punkts. */
  auge: [string, string]
  /** Holzmaserung über der Fläche. */
  maserung?: boolean
}

export const WUERFEL_FARBEN: Record<Exclude<WuerfelDesignId, 'standard'>, WuerfelFarben> = {
  // Warmes Messinggold, dunkelbraune Augen.
  gold: { flaeche: ['#f7dc8c', '#d4a237'], auge: ['#5a3a0a', '#2a1a04'] },
  // Helles Ahornholz mit Maserung, fast schwarze Augen.
  holz: { flaeche: ['#e2b67f', '#b07a43'], auge: ['#3a2512', '#160c04'], maserung: true },
  // Tiefes Nachtblau, helle Augen wie Sterne.
  nacht: { flaeche: ['#2b3461', '#0e1330'], auge: ['#ffffff', '#c9d3ff'] },
  // Kirschrot, cremeweiße Augen.
  kirsche: { flaeche: ['#d8344f', '#8e1027'], auge: ['#fffaf2', '#f0dccd'] },
}

const MASERUNG =
  'repeating-linear-gradient(100deg, rgb(110 60 20 / 0.14) 0 2px, transparent 2px 7px, rgb(110 60 20 / 0.08) 7px 8px, transparent 8px 13px)'

/**
 * CSS-Variablen für die flache Würfelreihe. Der Standard liefert keine --
 * dann gilt das CSS wie bisher.
 */
export function wuerfelStil(id: WuerfelDesignId): CSSProperties | undefined {
  if (id === 'standard') return undefined
  const f = WUERFEL_FARBEN[id]
  const flaeche = `linear-gradient(160deg, ${f.flaeche[0]}, ${f.flaeche[1]})`
  const mitMaserung = f.maserung ? `${MASERUNG}, ${flaeche}` : flaeche
  return {
    '--wuerfel-flaeche': mitMaserung,
    // Gehalten: dieselbe Fläche. Gehalten zeigen Goldrand und Anheben.
    '--wuerfel-flaeche-gehalten': mitMaserung,
    '--wuerfel-auge': `radial-gradient(circle at 35% 30%, ${f.auge[0]}, ${f.auge[1]} 70%)`,
  } as CSSProperties
}

/* ---------------------------------------------------- Kartenrücken */

interface RueckenMuster {
  /** Die Fläche der Rückseite. */
  flaeche: string
  /** Das Muster im Innenfeld. */
  muster: string
}

const linien = (farbe: string, winkel: number, abstand: number) =>
  `repeating-linear-gradient(${winkel}deg, ${farbe} 0, ${farbe} 2px, transparent 2px, transparent ${abstand}px)`

export const RUECKEN_MUSTER: Record<Exclude<RueckenDesignId, 'standard'>, RueckenMuster> = {
  // Tannengrün mit feinem Karomuster.
  wald: {
    flaeche: 'linear-gradient(145deg, #2f7350, #163a27)',
    muster: `${linien('rgb(255 255 255 / 0.13)', 0, 7)}, ${linien('rgb(255 255 255 / 0.13)', 90, 7)}`,
  },
  // Weinrot mit Punkten.
  bordeaux: {
    flaeche: 'linear-gradient(145deg, #8f2a3d, #4a0f1c)',
    muster:
      'radial-gradient(circle, rgb(255 230 210 / 0.26) 1.4px, transparent 1.8px) 0 0 / 7px 7px',
  },
  // Kupfer mit schrägen Streifen.
  kupfer: {
    flaeche: 'linear-gradient(145deg, #c27a45, #6b3518)',
    muster: linien('rgb(255 240 220 / 0.16)', 60, 8),
  },
  // Dunkles Blau mit goldenen Sternpunkten.
  sternennacht: {
    flaeche: 'linear-gradient(145deg, #1d2547, #070a18)',
    muster:
      'radial-gradient(circle, rgb(240 200 90 / 0.55) 1px, transparent 1.4px) 0 0 / 9px 9px, radial-gradient(circle, rgb(240 200 90 / 0.3) 1px, transparent 1.4px) 4px 5px / 13px 11px',
  },
}

/**
 * CSS-Variablen für eine Kartenrückseite. Jede verdeckte Karte bekommt
 * dieselben -- die Rückseite verrät nichts über die Karte darunter.
 */
export function rueckenStil(id: RueckenDesignId): CSSProperties | undefined {
  if (id === 'standard') return undefined
  const m = RUECKEN_MUSTER[id]
  return { '--ruecken-flaeche': m.flaeche, '--ruecken-muster': m.muster } as CSSProperties
}
