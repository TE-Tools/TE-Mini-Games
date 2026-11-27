/**
 * Die Flotte auf dem Meer: wo ein Schiff liegt, ob eine Aufstellung gilt,
 * und eine zufällige Aufstellung.
 *
 * Ein Feld ist eine Zahl von 0 bis 99: `y * 10 + x`, x die Spalte (A–J),
 * y die Reihe (1–10). Dieselbe Zählung steht in der SQL-Fassung
 * (Migration 035) -- ein Feld heißt dort genauso.
 *
 * Alles hier ist rein: Werte hinein, Werte heraus, kein Zufall außer dem,
 * der hereingereicht wird.
 */

import { FLOTTE, GROESSE, type SchiffeRegeln, type SchiffId } from './config'

export type Richtung = 'h' | 'v'

export interface Schiff {
  id: SchiffId
  laenge: number
  /** Spalte des Bugs (links bzw. oben), 0 bis 9. */
  x: number
  /** Reihe des Bugs, 0 bis 9. */
  y: number
  /** h: nach rechts, v: nach unten. */
  richtung: Richtung
}

/**
 * Warum eine Aufstellung nicht gilt -- in dieser Reihenfolge geprüft, in
 * der SQL-Fassung genauso:
 * - `flotte`: nicht genau die Schiffe aus FLOTTE
 * - `ausserhalb`: ein Schiff ragt übers Meer hinaus
 * - `ueberlappt`: zwei Schiffe teilen ein Feld
 * - `beruehrt`: zwei Schiffe liegen nebeneinander, obwohl sie nicht dürfen
 */
export type FlottenFehler = 'flotte' | 'ausserhalb' | 'ueberlappt' | 'beruehrt'

export const feldVon = (x: number, y: number): number => y * GROESSE + x
export const spalteVon = (feld: number): number => feld % GROESSE
export const reiheVon = (feld: number): number => Math.floor(feld / GROESSE)

/** „B7" -- Spalte als Buchstabe, Reihe ab 1. Sprachfrei. */
export function feldName(feld: number): string {
  return `${String.fromCharCode(65 + spalteVon(feld))}${reiheVon(feld) + 1}`
}

/** Die Felder eines Schiffs, vom Bug zum Heck. Auch die außerhalb des Meeres. */
export function felderVon(s: Pick<Schiff, 'x' | 'y' | 'laenge' | 'richtung'>): number[] {
  const felder: number[] = []
  for (let i = 0; i < s.laenge; i++) {
    const x = s.richtung === 'h' ? s.x + i : s.x
    const y = s.richtung === 'v' ? s.y + i : s.y
    felder.push(feldVon(x, y))
  }
  return felder
}

function imMeer(s: Schiff): boolean {
  return (
    Number.isInteger(s.x) &&
    Number.isInteger(s.y) &&
    Number.isInteger(s.laenge) &&
    (s.richtung === 'h' || s.richtung === 'v') &&
    s.x >= 0 &&
    s.y >= 0 &&
    s.laenge >= 1 &&
    (s.richtung === 'h' ? s.x + s.laenge : s.x + 1) <= GROESSE &&
    (s.richtung === 'v' ? s.y + s.laenge : s.y + 1) <= GROESSE
  )
}

/** Liegen zwei Schiffe Rumpf an Rumpf oder über Eck? (Überlappen zählt auch.) */
function beruehren(a: Schiff, b: Schiff): boolean {
  const ax1 = a.x + (a.richtung === 'h' ? a.laenge - 1 : 0)
  const ay1 = a.y + (a.richtung === 'v' ? a.laenge - 1 : 0)
  const bx1 = b.x + (b.richtung === 'h' ? b.laenge - 1 : 0)
  const by1 = b.y + (b.richtung === 'v' ? b.laenge - 1 : 0)
  return a.x <= bx1 + 1 && b.x <= ax1 + 1 && a.y <= by1 + 1 && b.y <= ay1 + 1
}

function ueberlappen(a: Schiff, b: Schiff): boolean {
  const fa = new Set(felderVon(a))
  return felderVon(b).some((f) => fa.has(f))
}

/**
 * Passt dieses Schiff zu den übrigen? Beim Aufstellen: Das Schiff mit
 * derselben Kennung zählt nicht mit -- es ist ja das, das gerade bewegt wird.
 */
export function platzFehler(
  flotte: readonly Schiff[],
  schiff: Schiff,
  regeln: SchiffeRegeln,
): Exclude<FlottenFehler, 'flotte'> | null {
  if (!imMeer(schiff)) return 'ausserhalb'
  const andere = flotte.filter((s) => s.id !== schiff.id)
  if (andere.some((s) => ueberlappen(s, schiff))) return 'ueberlappt'
  if (regeln.nichtBeruehren && andere.some((s) => beruehren(s, schiff))) return 'beruehrt'
  return null
}

/** Ist das wirklich eine Flotte aus FLOTTE -- jedes Schiff einmal, mit seiner Länge? */
function richtigeSchiffe(roh: unknown): roh is Schiff[] {
  if (!Array.isArray(roh) || roh.length !== FLOTTE.length) return false
  const gesehen = new Set<string>()
  for (const s of roh as unknown[]) {
    if (!s || typeof s !== 'object') return false
    const { id, laenge } = s as Record<string, unknown>
    const art = FLOTTE.find((a) => a.id === id)
    if (!art || laenge !== art.laenge || gesehen.has(art.id)) return false
    gesehen.add(art.id)
  }
  return true
}

/** Gilt diese Aufstellung? null heißt ja. Die Reihenfolge steht bei `FlottenFehler`. */
export function flottenFehler(roh: unknown, regeln: SchiffeRegeln): FlottenFehler | null {
  if (!richtigeSchiffe(roh)) return 'flotte'
  const flotte = roh
  if (!flotte.every(imMeer)) return 'ausserhalb'
  for (let i = 0; i < flotte.length; i++) {
    for (let j = i + 1; j < flotte.length; j++) {
      if (ueberlappen(flotte[i]!, flotte[j]!)) return 'ueberlappt'
    }
  }
  if (regeln.nichtBeruehren) {
    for (let i = 0; i < flotte.length; i++) {
      for (let j = i + 1; j < flotte.length; j++) {
        if (beruehren(flotte[i]!, flotte[j]!)) return 'beruehrt'
      }
    }
  }
  return null
}

/** Eine Flotte nur aus den Feldern, die sie hat -- für die Anzeige und die Engine. */
export function schiffAuf(flotte: readonly Schiff[], feld: number): Schiff | undefined {
  return flotte.find((s) => felderVon(s).includes(feld))
}

/**
 * Eine zufällige, gültige Aufstellung. Die großen Schiffe zuerst; findet
 * eines keinen Platz mehr (kommt bei 100 Feldern praktisch nie vor), fängt
 * die Aufstellung von vorn an.
 */
export function zufallsFlotte(regeln: SchiffeRegeln, zufall: () => number): Schiff[] {
  const arten = [...FLOTTE].sort((a, b) => b.laenge - a.laenge)
  for (;;) {
    const flotte: Schiff[] = []
    let geklappt = true
    for (const art of arten) {
      let gesetzt = false
      for (let versuch = 0; versuch < 400 && !gesetzt; versuch++) {
        const richtung: Richtung = zufall() < 0.5 ? 'h' : 'v'
        const lang = GROESSE - art.laenge + 1
        const x = Math.floor(zufall() * (richtung === 'h' ? lang : GROESSE))
        const y = Math.floor(zufall() * (richtung === 'v' ? lang : GROESSE))
        const schiff: Schiff = { id: art.id, laenge: art.laenge, x, y, richtung }
        if (platzFehler(flotte, schiff, regeln) === null) {
          flotte.push(schiff)
          gesetzt = true
        }
      }
      if (!gesetzt) {
        geklappt = false
        break
      }
    }
    if (geklappt) {
      // In der Reihenfolge von FLOTTE, damit zwei gleiche Aufstellungen gleich aussehen.
      return FLOTTE.map((a) => flotte.find((s) => s.id === a.id)!)
    }
  }
}

/**
 * Ein Schiff drehen, und zwar um sein zweites Feld -- so bleibt es beim
 * Antippen ungefähr, wo es war. Ragt es dann hinaus, rückt es ins Meer.
 */
export function gedreht(s: Schiff): Schiff {
  const richtung: Richtung = s.richtung === 'h' ? 'v' : 'h'
  const dreh = Math.min(1, s.laenge - 1)
  let x = s.richtung === 'h' ? s.x + dreh : s.x - dreh
  let y = s.richtung === 'h' ? s.y - dreh : s.y + dreh
  const maxX = GROESSE - (richtung === 'h' ? s.laenge : 1)
  const maxY = GROESSE - (richtung === 'v' ? s.laenge : 1)
  x = Math.max(0, Math.min(maxX, x))
  y = Math.max(0, Math.min(maxY, y))
  return { ...s, richtung, x, y }
}

/** Ein Schiff an eine Stelle schieben, so weit ins Meer gerückt, dass es hineinpasst. */
export function verschoben(s: Schiff, x: number, y: number): Schiff {
  const maxX = GROESSE - (s.richtung === 'h' ? s.laenge : 1)
  const maxY = GROESSE - (s.richtung === 'v' ? s.laenge : 1)
  return { ...s, x: Math.max(0, Math.min(maxX, x)), y: Math.max(0, Math.min(maxY, y)) }
}

/** Eine Flotte aus dem Gerätespeicher oder vom Server -- oder null, wenn sie nicht gilt. */
export function flotteAus(roh: unknown, regeln: SchiffeRegeln): Schiff[] | null {
  if (flottenFehler(roh, regeln) !== null) return null
  return (roh as Schiff[]).map((s) => ({
    id: s.id,
    laenge: s.laenge,
    x: s.x,
    y: s.y,
    richtung: s.richtung,
  }))
}
