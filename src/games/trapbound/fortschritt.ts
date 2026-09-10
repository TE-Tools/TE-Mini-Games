/**
 * Der Fortschritt – auf dem Gerät gespeichert.
 *
 * Bewusst getrennt vom app-weiten Spielstand (der liegt in IndexedDB und
 * wandert bei einem Konto in die Cloud): Hier stehen die Dinge, die nur
 * dieses Spiel angehen -- wie oft man an einem Level gestorben ist, wie
 * schnell man war, welche Kristalle man gefunden hat und wie laut es sein
 * soll. Ein Schlüssel, ein JSON-Objekt, alles gekapselt; wer später in die
 * Cloud will, hängt hier eine zweite Quelle ein.
 */

import { LEVEL_ANZAHL } from './levels'

const SCHLUESSEL = 'trapbound:stand'

export interface LevelStand {
  /** Geschafft. */
  fertig: boolean
  /** Wenigste Tode für einen Durchgang. */
  besteTode: number
  /** Schnellste Zeit in Sekunden. */
  besteZeit: number
  /** Kristall in diesem Level gefunden. */
  kristall: boolean
  /** Tode insgesamt, über alle Versuche. */
  tode: number
}

export interface Einstellungen {
  ton: boolean
  /** 0 bis 1. */
  lautstaerke: number
  /** Bildschirmwackeln -- wer davon Kopfweh bekommt, schaltet es ab. */
  beben: boolean
  /** Große Knöpfe links/rechts tauschen (für Linkshänder). */
  linkshand: boolean
}

export interface Stand {
  /** Bis zu diesem Level ist alles offen. */
  freigeschaltet: number
  level: Record<string, LevelStand>
  einstellungen: Einstellungen
}

const STANDARD: Stand = {
  freigeschaltet: 1,
  level: {},
  einstellungen: { ton: true, lautstaerke: 0.7, beben: true, linkshand: false },
}

function speicher(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    // Safari im privaten Modus wirft schon beim Zugriff.
    return null
  }
}

export function leseStand(): Stand {
  const sp = speicher()
  if (!sp) return { ...STANDARD, level: {} }
  try {
    const roh = sp.getItem(SCHLUESSEL)
    if (!roh) return { ...STANDARD, level: {} }
    const daten = JSON.parse(roh) as Partial<Stand>
    return {
      freigeschaltet: Math.max(1, Math.min(LEVEL_ANZAHL, Number(daten.freigeschaltet) || 1)),
      level: typeof daten.level === 'object' && daten.level ? daten.level : {},
      einstellungen: { ...STANDARD.einstellungen, ...(daten.einstellungen ?? {}) },
    }
  } catch {
    return { ...STANDARD, level: {} }
  }
}

function schreibe(stand: Stand): void {
  const sp = speicher()
  if (!sp) return
  try {
    sp.setItem(SCHLUESSEL, JSON.stringify(stand))
  } catch {
    // Voller Speicher darf das Spiel nicht anhalten.
  }
}

export function levelStand(nr: number, stand = leseStand()): LevelStand {
  return (
    stand.level[String(nr)] ?? {
      fertig: false,
      besteTode: Infinity,
      besteZeit: Infinity,
      kristall: false,
      tode: 0,
    }
  )
}

export function istOffen(nr: number, stand = leseStand()): boolean {
  return nr <= stand.freigeschaltet
}

/** Nach einem Tod: mitzählen. */
export function merkeTod(nr: number): number {
  const stand = leseStand()
  const l = levelStand(nr, stand)
  const neu = { ...l, tode: l.tode + 1 }
  stand.level[String(nr)] = neu
  schreibe(stand)
  return neu.tode
}

export interface Abschluss {
  nr: number
  /** Tode in diesem Durchgang. */
  tode: number
  /** Gebrauchte Zeit in Sekunden. */
  zeit: number
  kristall: boolean
}

/** Nach dem Levelabschluss: eintragen und das nächste Level öffnen. */
export function merkeAbschluss(a: Abschluss): Stand {
  const stand = leseStand()
  const l = levelStand(a.nr, stand)
  stand.level[String(a.nr)] = {
    fertig: true,
    besteTode: Math.min(l.besteTode, a.tode),
    besteZeit: Math.min(l.besteZeit, a.zeit),
    kristall: l.kristall || a.kristall,
    tode: l.tode,
  }
  stand.freigeschaltet = Math.max(stand.freigeschaltet, Math.min(LEVEL_ANZAHL, a.nr + 1))
  schreibe(stand)
  return stand
}

export function setzeEinstellungen(teil: Partial<Einstellungen>): Einstellungen {
  const stand = leseStand()
  stand.einstellungen = { ...stand.einstellungen, ...teil }
  schreibe(stand)
  return stand.einstellungen
}

/** Wie viele Kristalle insgesamt gefunden sind. */
export function kristalle(stand = leseStand()): number {
  return Object.values(stand.level).filter((l) => l.kristall).length
}

/** Wie viele Level geschafft sind. */
export function geschaffte(stand = leseStand()): number {
  return Object.values(stand.level).filter((l) => l.fertig).length
}

/** Alle Tode zusammen -- steht als Ehrenzeichen im Menü. */
export function todeGesamt(stand = leseStand()): number {
  return Object.values(stand.level).reduce((n, l) => n + l.tode, 0)
}

/** Nur für Tests und den Knopf "Fortschritt löschen". */
export function loescheStand(): void {
  const sp = speicher()
  try {
    sp?.removeItem(SCHLUESSEL)
  } catch {
    // egal
  }
}
