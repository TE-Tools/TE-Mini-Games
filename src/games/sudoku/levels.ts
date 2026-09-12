/**
 * Die Level -- drei Stufen zu je fünfzig Rätseln.
 *
 * Level 1–50 Leicht, 51–100 Mittel, 101–150 Schwer. Nach außen zählt das
 * Spiel durchgehend von 1 bis 150 (so will es die gemeinsame Levelkarte
 * und der Spielstand); im Spiel selbst spricht man von "Mittel 12". Beide
 * Sichten rechnet dieses Modul ineinander um.
 *
 * Jede Stufe ist eine eigene Strecke: Wer Schwer spielen will, muss nicht
 * erst fünfzig leichte lösen. Deshalb bekommt jede Stufe ihre eigene Karte
 * (`karteFuer`) mit fünfzig Stufen in fünf Abschnitten zu zehn.
 */

import type { Kartenaufbau, LevelZone } from '@/progression/zones'
import { RAETSEL_DATEN, type RaetselDaten } from './daten'
import { parse, type Gitter } from './gitter'
import { TECHNIK_GEWICHT, TECHNIK_NAME, type Technik } from './techniken'

export type Schwierigkeit = 'leicht' | 'mittel' | 'schwer'

export const SCHWIERIGKEITEN: readonly Schwierigkeit[] = ['leicht', 'mittel', 'schwer']
export const LEVEL_PRO_STUFE = 50
export const SUDOKU_MAX_LEVEL = SCHWIERIGKEITEN.length * LEVEL_PRO_STUFE
/** Zehn Level je Kartenabschnitt -- fünf Tore je Stufe. */
export const ABSCHNITT = 10

export const STUFEN_NAME: Record<Schwierigkeit, string> = {
  leicht: 'Leicht',
  mittel: 'Mittel',
  schwer: 'Schwer',
}

export const STUFEN_TEXT: Record<Schwierigkeit, string> = {
  leicht: 'Nur Singles: Jedes Feld ergibt sich aus dem, was schon dasteht.',
  mittel: 'Paare, Tripel, zeigende Paare -- hier braucht es Notizen.',
  schwer: 'Fische, Wings, Ketten. Am Ende Rätsel, an denen man Stunden sitzt.',
}

export interface Raetsel {
  /** Durchgehende Nummer 1–150. */
  nr: number
  schwierigkeit: Schwierigkeit
  /** Stufe innerhalb der Schwierigkeit, 1–50. */
  stufe: number
  vorgabe: Gitter
  loesung: Gitter
  /** Schwerster nötiger Schritt. */
  technik: Technik
  /** Gesamtaufwand laut Menschenlöser. */
  aufwand: number
  anzahlVorgaben: number
}

export function begrenze(nr: number): number {
  if (!Number.isFinite(nr)) return 1
  return Math.max(1, Math.min(SUDOKU_MAX_LEVEL, Math.floor(nr)))
}

export function schwierigkeitVon(nr: number): Schwierigkeit {
  const index = Math.min(
    SCHWIERIGKEITEN.length - 1,
    Math.floor((begrenze(nr) - 1) / LEVEL_PRO_STUFE),
  )
  return SCHWIERIGKEITEN[index]!
}

export function stufeVon(nr: number): number {
  return ((begrenze(nr) - 1) % LEVEL_PRO_STUFE) + 1
}

/** Aus "Mittel, Stufe 12" die durchgehende Nummer 62. */
export function levelNummer(schwierigkeit: Schwierigkeit, stufe: number): number {
  const s = Math.max(1, Math.min(LEVEL_PRO_STUFE, Math.floor(stufe)))
  return SCHWIERIGKEITEN.indexOf(schwierigkeit) * LEVEL_PRO_STUFE + s
}

const CACHE = new Map<number, Raetsel>()

function baue(nr: number, d: RaetselDaten): Raetsel {
  const vorgabe = parse(d.v)
  let anzahl = 0
  for (const w of vorgabe) if (w !== 0) anzahl++
  return {
    nr,
    schwierigkeit: schwierigkeitVon(nr),
    stufe: stufeVon(nr),
    vorgabe,
    loesung: parse(d.l),
    technik: d.t,
    aufwand: d.p,
    anzahlVorgaben: anzahl,
  }
}

export function raetsel(nr: number): Raetsel {
  const n = begrenze(nr)
  const vorhanden = CACHE.get(n)
  if (vorhanden) return vorhanden
  const d = RAETSEL_DATEN[n - 1]
  if (!d) throw new Error(`Sudoku-Level ${n} fehlt in daten.ts`)
  const r = baue(n, d)
  CACHE.set(n, r)
  return r
}

export function alleRaetsel(): Raetsel[] {
  return Array.from({ length: SUDOKU_MAX_LEVEL }, (_, i) => raetsel(i + 1))
}

/** Anzeigename für Level 62: "Mittel 12". */
export function levelName(nr: number): string {
  return `${STUFEN_NAME[schwierigkeitVon(nr)]} ${stufeVon(nr)}`
}

/**
 * Härte in fünf Stufen für die Anzeige -- über alle 150 Level hinweg, damit
 * "Schwer 3" nicht plötzlich weniger Punkte zeigt als "Mittel 50".
 */
export function haerte(nr: number): 1 | 2 | 3 | 4 | 5 {
  const r = raetsel(nr)
  const g = TECHNIK_GEWICHT[r.technik]
  if (r.schwierigkeit === 'leicht') return r.stufe <= 25 ? 1 : 2
  if (r.schwierigkeit === 'mittel') return r.stufe <= 30 ? 2 : 3
  if (g >= TECHNIK_GEWICHT['kette']) return 5
  return g >= TECHNIK_GEWICHT['schwertfisch'] ? 5 : 4
}

export function technikName(t: Technik): string {
  return TECHNIK_NAME[t]
}

/* ------------------------------------------------------------- Karten */

const PALETTEN: Record<Schwierigkeit, LevelZone['palette']> = {
  leicht: {
    ground: '#3f8a5a',
    groundLight: '#7fcf97',
    accent: '#1f6b43',
    path: '#d8d0b0',
    sky: '#8fd6c1',
    blob: '#5fb8a0',
  },
  mittel: {
    ground: '#b07a2a',
    groundLight: '#e6b25c',
    accent: '#7d4f10',
    path: '#e9dcb8',
    sky: '#f0c86b',
    blob: '#d9a24a',
  },
  schwer: {
    ground: '#5a2f5e',
    groundLight: '#a55fa8',
    accent: '#2f1433',
    path: '#c9b3cc',
    sky: '#3a2140',
    blob: '#6e3f73',
  },
}

const SYMBOLE: Record<Schwierigkeit, readonly string[]> = {
  leicht: ['🌱', '☀️', '🍀', '🌼'],
  mittel: ['✏️', '📐', '🔍', '📎'],
  schwer: ['🧠', '🌀', '⛓️', '🔥'],
}

const TOR: Record<Schwierigkeit, string> = {
  leicht: 'Alles Leichte gelöst',
  mittel: 'Alles Mittlere gelöst',
  schwer: 'Meister der Ketten',
}

/**
 * Die Karte einer Stufe: eine Zone mit fünfzig Leveln, in Abschnitten zu
 * zehn. Levelnummern auf dieser Karte sind 1–50; `levelNummer` macht daraus
 * die durchgehende Nummer.
 */
export function karteFuer(schwierigkeit: Schwierigkeit): Kartenaufbau {
  const index = SCHWIERIGKEITEN.indexOf(schwierigkeit) + 1
  const zone: LevelZone = {
    id: schwierigkeit,
    index,
    name: STUFEN_NAME[schwierigkeit],
    levelFrom: 1,
    levelTo: LEVEL_PRO_STUFE,
    description: STUFEN_TEXT[schwierigkeit],
    creatures: SYMBOLE[schwierigkeit],
    palette: PALETTEN[schwierigkeit],
    gateLevel: LEVEL_PRO_STUFE,
    gateName: TOR[schwierigkeit],
  }
  return {
    zonen: [zone],
    levelProZone: LEVEL_PRO_STUFE,
    segmentGroesse: ABSCHNITT,
    maxLevel: LEVEL_PRO_STUFE,
  }
}
