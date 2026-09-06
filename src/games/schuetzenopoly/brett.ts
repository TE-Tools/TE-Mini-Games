/**
 * Das Spielbrett: 40 Felder im Kreis.
 *
 * Die Reihenfolge ist bewusst gemischt: teure Gruppen liegen nicht
 * nebeneinander, zwischen den Grundstücken sitzen Karten-, Sonder- und
 * Minispielfelder. Die beiden teuersten Felder (Neuss, Hannover) liegen im
 * letzten Viertel -- wer sie hält, hat den letzten Abschnitt vor START in
 * der Hand.
 *
 * Zusammensetzung: 22 Grundstücke, 4 Sonderfelder, 2 Verbandsfelder,
 * 4 Ecken, 6 Kartenfelder, 2 Minispielfelder.
 */

import { GRUNDSTUECKE, type GrundstueckDaten } from './grundstuecke'
import {
  ECKE_FREIES_FEST,
  ECKE_START,
  ECKE_STRAFBANK,
  ECKE_ZUR_STRAFBANK,
  FELDER,
} from './config'

export type FeldTyp =
  | 'start'
  | 'strafbank'
  | 'freies_fest'
  | 'zur_strafbank'
  | 'grundstueck'
  | 'sonderfeld'
  | 'verband'
  | 'ereignis'
  | 'vereinskarte'
  | 'minispiel'

export interface BrettFeld {
  position: number
  typ: FeldTyp
  name: string
  icon: string
  /** Nur bei typ === 'grundstueck'. */
  grundstueckId?: string
  /** Nur bei kaufbaren Feldern (Grundstück, Sonderfeld, Verband). */
  kaufbar?: boolean
}

/**
 * Die vier Sonderfelder ersetzen die Transportfelder klassischer Bretter.
 * Ihre Namen dürfen sich nicht mit den Ausbaustufen überschneiden -- sonst
 * hieße dasselbe Wort im Spiel zwei verschiedene Dinge.
 */
export const SONDERFELDER = [
  { id: 'festzug', name: 'Festzug', icon: '🎪' },
  { id: 'schuetzenumzug', name: 'Schützenumzug', icon: '🥁' },
  { id: 'musikzug', name: 'Musikzug', icon: '🎺' },
  { id: 'koenigsfahrt', name: 'Königsfahrt', icon: '👑' },
] as const

export const VERBANDSFELDER = [
  { id: 'schiesssportverband', name: 'Schießsportverband', icon: '🎯' },
  { id: 'schuetzenbund', name: 'Deutscher Schützenbund', icon: '🏆' },
] as const

export type SonderfeldId = (typeof SONDERFELDER)[number]['id']
export type VerbandId = (typeof VERBANDSFELDER)[number]['id']

/** Reihenfolge der Grundstücke auf dem Brett -- Index = Position. */
const GRUNDSTUECK_POSITIONEN: Record<number, string> = {
  1: 'kevelaer',
  3: 'grevenbroich',
  4: 'krefeld',
  6: 'attendorn',
  8: 'iserlohn',
  9: 'olpe',
  11: 'sassenberg',
  13: 'recklinghausen',
  14: 'werl',
  16: 'soest',
  18: 'paderborn',
  21: 'cloppenburg',
  23: 'vechta',
  24: 'lohne',
  26: 'celle',
  27: 'wolfsburg',
  29: 'peine',
  31: 'moenchengladbach',
  32: 'muenchen',
  34: 'duesseldorf',
  37: 'neuss',
  39: 'hannover',
}

const SONDERFELD_POSITIONEN: Record<number, SonderfeldId> = {
  5: 'festzug',
  15: 'schuetzenumzug',
  25: 'musikzug',
  35: 'koenigsfahrt',
}

const VERBAND_POSITIONEN: Record<number, VerbandId> = {
  12: 'schiesssportverband',
  28: 'schuetzenbund',
}

const EREIGNIS_POSITIONEN = [2, 17, 33]
const VEREINSKARTE_POSITIONEN = [7, 22, 36]
const MINISPIEL_POSITIONEN = [19, 38]

function baueBrett(): BrettFeld[] {
  const felder: BrettFeld[] = []
  const grundstueckNachId = new Map<string, GrundstueckDaten>(
    GRUNDSTUECKE.map((g) => [g.id, g]),
  )

  for (let position = 0; position < FELDER; position++) {
    if (position === ECKE_START) {
      felder.push({ position, typ: 'start', name: 'Start', icon: '🏠' })
      continue
    }
    if (position === ECKE_STRAFBANK) {
      felder.push({ position, typ: 'strafbank', name: 'Strafbank', icon: '🚧' })
      continue
    }
    if (position === ECKE_FREIES_FEST) {
      felder.push({ position, typ: 'freies_fest', name: 'Freies Fest', icon: '🎉' })
      continue
    }
    if (position === ECKE_ZUR_STRAFBANK) {
      felder.push({ position, typ: 'zur_strafbank', name: 'Zur Strafbank', icon: '⛔' })
      continue
    }

    const grundstueckId = GRUNDSTUECK_POSITIONEN[position]
    if (grundstueckId) {
      const daten = grundstueckNachId.get(grundstueckId)
      if (!daten) throw new Error(`Unbekanntes Grundstück auf Feld ${position}: ${grundstueckId}`)
      felder.push({
        position,
        typ: 'grundstueck',
        name: daten.stadt,
        icon: '🎪',
        grundstueckId,
        kaufbar: true,
      })
      continue
    }

    const sonder = SONDERFELD_POSITIONEN[position]
    if (sonder) {
      const daten = SONDERFELDER.find((s) => s.id === sonder)!
      felder.push({
        position,
        typ: 'sonderfeld',
        name: daten.name,
        icon: daten.icon,
        grundstueckId: sonder,
        kaufbar: true,
      })
      continue
    }

    const verband = VERBAND_POSITIONEN[position]
    if (verband) {
      const daten = VERBANDSFELDER.find((v) => v.id === verband)!
      felder.push({
        position,
        typ: 'verband',
        name: daten.name,
        icon: daten.icon,
        grundstueckId: verband,
        kaufbar: true,
      })
      continue
    }

    if (EREIGNIS_POSITIONEN.includes(position)) {
      felder.push({ position, typ: 'ereignis', name: 'Ereignis', icon: '📜' })
      continue
    }
    if (VEREINSKARTE_POSITIONEN.includes(position)) {
      felder.push({ position, typ: 'vereinskarte', name: 'Vereinskarte', icon: '🤝' })
      continue
    }
    if (MINISPIEL_POSITIONEN.includes(position)) {
      felder.push({ position, typ: 'minispiel', name: 'Schießstand', icon: '🎯' })
      continue
    }

    throw new Error(`Feld ${position} hat keine Zuordnung`)
  }

  return felder
}

export const BRETT: readonly BrettFeld[] = baueBrett()

export function feldAn(position: number): BrettFeld {
  const feld = BRETT[((position % FELDER) + FELDER) % FELDER]
  if (!feld) throw new Error(`Feld ${position} liegt außerhalb des Bretts`)
  return feld
}

/** Positionen aller Felder, die einem Spieler gehören können. */
export function kaufbareFelder(): BrettFeld[] {
  return BRETT.filter((f) => f.kaufbar === true)
}

/**
 * Welche Seite des Bretts. Die Oberfläche legt die Felder daraus in ein
 * Quadrat -- die Engine interessiert das nicht.
 */
export function seiteVon(position: number): 'unten' | 'links' | 'oben' | 'rechts' {
  if (position <= 10) return 'unten'
  if (position <= 20) return 'links'
  if (position <= 30) return 'oben'
  return 'rechts'
}
