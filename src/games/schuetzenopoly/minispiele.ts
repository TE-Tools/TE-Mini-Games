/**
 * Die drei Minispiele -- nur die Regeln und die Wertung.
 *
 * Zielscheiben, Punkte, Wettbewerb: keine Waffen, keine Simulation. Was
 * sich bewegt und wie es aussieht, entscheidet die Oberfläche; hier steht
 * nur, wie aus einer Leistung eine Medaille wird.
 */

import { MINISPIEL_BELOHNUNG, type Medaille } from './config'
import type { MinispielId, KiStufe } from './zustand'

export interface MinispielDaten {
  id: MinispielId
  name: string
  icon: string
  kurz: string
  anleitung: string
  /** Punktegrenzen für Bronze, Silber, Gold. */
  schwellen: { bronze: number; silber: number; gold: number }
}

export const MINISPIELE: readonly MinispielDaten[] = [
  {
    id: 'koenigsschiessen',
    name: 'Königsschießen',
    icon: '🦅',
    kurz: 'Triff den Vogel im richtigen Moment.',
    anleitung:
      'Der Vogel schwingt hin und her. Tippe, wenn er in der Mitte steht – je genauer, desto mehr Punkte. Drei Versuche.',
    schwellen: { bronze: 120, silber: 220, gold: 280 },
  },
  {
    id: 'ringschiessen',
    name: 'Ringschießen',
    icon: '🎯',
    kurz: 'Zehn Sekunden, so viele Ringe wie möglich.',
    anleitung:
      'Zielscheiben tauchen auf und verschwinden wieder. Kleine Scheiben zählen mehr. Danebentippen kostet 50 Punkte.',
    schwellen: { bronze: 700, silber: 1400, gold: 2200 },
  },
  {
    id: 'praezision',
    name: 'Präzisionsschießen',
    icon: '✨',
    kurz: 'Das Fadenkreuz wandert – halte es an.',
    anleitung:
      'Ein Fadenkreuz läuft über die Scheibe. Tippe, um es anzuhalten. Je näher an der Mitte, desto mehr Punkte. Fünf Schüsse.',
    schwellen: { bronze: 250, silber: 400, gold: 480 },
  },
] as const

const NACH_ID = new Map(MINISPIELE.map((m) => [m.id, m]))

export function minispiel(id: MinispielId): MinispielDaten {
  const m = NACH_ID.get(id)
  if (!m) throw new Error(`Unbekanntes Minispiel: ${id}`)
  return m
}

/** Punkte in eine Medaille übersetzen. */
export function medailleFuer(id: MinispielId, punkte: number): Medaille {
  const { schwellen } = minispiel(id)
  if (punkte >= schwellen.gold) return 'gold'
  if (punkte >= schwellen.silber) return 'silber'
  if (punkte >= schwellen.bronze) return 'bronze'
  return 'keine'
}

export function belohnungFuer(medaille: Medaille): number {
  return MINISPIEL_BELOHNUNG[medaille]
}

/* ------------------------------------------------- Königsschießen: Wertung */

/**
 * Abstand zur Mitte (0 = mittig, 1 = ganz außen) in Punkte umrechnen.
 * Die Kurve ist quadratisch: knapp daneben soll deutlich weniger geben.
 */
export function trefferPunkte(abstand: number): number {
  const a = Math.min(1, Math.max(0, Math.abs(abstand)))
  return Math.round(100 * (1 - a) ** 2)
}

/* --------------------------------------------------- Ringschießen: Wertung */

export type ScheibenGroesse = 'klein' | 'mittel' | 'gross'

export const RING_PUNKTE: Record<ScheibenGroesse, number> = {
  klein: 500,
  mittel: 250,
  gross: 100,
}

export const RING_FEHLSCHUSS = -50
export const RING_SEKUNDEN = 10

/* ----------------------------------------------- Präzisionsschießen: Werte */

export const PRAEZISION_SCHUESSE = 5
export const KOENIGS_SCHUESSE = 3

/**
 * Wie gut eine KI ein Minispiel spielt.
 *
 * Die KI zielt nicht wirklich -- sie bekommt eine Leistung zugewürfelt, die
 * zur Schwierigkeitsstufe passt. Das ist ehrlicher als eine KI, die den
 * Zufallszahlengenerator liest: sie hat dieselben Chancen wie ein Mensch,
 * nur eben ohne Finger.
 */
export function kiMinispielPunkte(
  id: MinispielId,
  stufe: KiStufe,
  zufall: number,
): number {
  const { schwellen } = minispiel(id)
  const spanne = schwellen.gold * 1.1
  const koennen: Record<KiStufe, { min: number; max: number }> = {
    leicht: { min: 0.15, max: 0.6 },
    normal: { min: 0.3, max: 0.85 },
    schwer: { min: 0.45, max: 1 },
  }
  const k = koennen[stufe]
  const anteil = k.min + Math.min(1, Math.max(0, zufall)) * (k.max - k.min)
  return Math.round(spanne * anteil)
}
