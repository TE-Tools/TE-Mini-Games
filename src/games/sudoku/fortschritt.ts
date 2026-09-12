/**
 * Der Fortschritt -- auf dem Gerät gespeichert.
 *
 * Wie bei Trapbound getrennt vom app-weiten Spielstand: Der weiß nur
 * "höchstes Level" und rechnet linear -- bei drei eigenständigen Strecken
 * (Leicht, Mittel, Schwer) taugt das nicht als Freischaltung. Hier steht je
 * Stufe, bis wohin es offen ist, je Level die Bestleistung, und -- wichtig
 * bei Rätseln, die eine Stunde dauern -- das angefangene Gitter samt
 * Notizen und Uhr, damit man jederzeit weg und wieder zurück kann.
 */

import {
  LEVEL_PRO_STUFE,
  SCHWIERIGKEITEN,
  schwierigkeitVon,
  stufeVon,
  type Schwierigkeit,
} from './levels'

const SCHLUESSEL = 'sudoku:stand'

export interface LevelStand {
  fertig: boolean
  /** Schnellste Lösung in Sekunden. */
  besteZeit: number
  /** Beste Punktzahl. */
  bestePunkte: number
  sterne: number
}

/** Ein angefangenes Rätsel. */
export interface Partie {
  nr: number
  /** 81 Zeichen wie die Vorgabe, . für leer. */
  werte: string
  /** Je Zelle die Notizen als Bitmaske. */
  notizen: number[]
  sekunden: number
  fehler: number
  tipps: number
}

export interface Einstellungen {
  /** Falsche Ziffern sofort rot zeigen (bei Schwer wird das ignoriert). */
  fehlerZeigen: boolean
  /** Beim Setzen einer Ziffer die Notizen in Zeile, Spalte, Kasten aufräumen. */
  notizenAufraeumen: boolean
  /** Gleiche Ziffern hervorheben, wenn eine gewählt ist. */
  gleicheZeigen: boolean
  ton: boolean
}

export interface Stand {
  /** Je Stufe: bis zu dieser Stufe (1–50) ist offen. */
  frei: Record<Schwierigkeit, number>
  level: Record<string, LevelStand>
  partien: Record<string, Partie>
  einstellungen: Einstellungen
}

const STANDARD_EINSTELLUNGEN: Einstellungen = {
  fehlerZeigen: true,
  notizenAufraeumen: true,
  gleicheZeigen: true,
  ton: true,
}

function frisch(): Stand {
  return {
    frei: { leicht: 1, mittel: 1, schwer: 1 },
    level: {},
    partien: {},
    einstellungen: { ...STANDARD_EINSTELLUNGEN },
  }
}

function speicher(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function leseStand(): Stand {
  const sp = speicher()
  if (!sp) return frisch()
  try {
    const roh = sp.getItem(SCHLUESSEL)
    if (!roh) return frisch()
    const d = JSON.parse(roh) as Partial<Stand>
    const s = frisch()
    for (const k of SCHWIERIGKEITEN) {
      const v = Number(d.frei?.[k])
      s.frei[k] = Number.isFinite(v) ? Math.max(1, Math.min(LEVEL_PRO_STUFE, Math.floor(v))) : 1
    }
    if (d.level && typeof d.level === 'object') s.level = d.level
    if (d.partien && typeof d.partien === 'object') s.partien = d.partien
    s.einstellungen = { ...STANDARD_EINSTELLUNGEN, ...(d.einstellungen ?? {}) }
    return s
  } catch {
    return frisch()
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
    stand.level[String(nr)] ?? { fertig: false, besteZeit: Infinity, bestePunkte: 0, sterne: 0 }
  )
}

export function istOffen(nr: number, stand = leseStand()): boolean {
  return stufeVon(nr) <= stand.frei[schwierigkeitVon(nr)]
}

export interface Abschluss {
  nr: number
  sekunden: number
  punkte: number
  sterne: number
}

/** Nach dem Lösen: eintragen, nächste Stufe öffnen, Partie vergessen. */
export function merkeAbschluss(a: Abschluss): Stand {
  const stand = leseStand()
  const alt = levelStand(a.nr, stand)
  stand.level[String(a.nr)] = {
    fertig: true,
    besteZeit: Math.min(alt.besteZeit, a.sekunden),
    bestePunkte: Math.max(alt.bestePunkte, a.punkte),
    sterne: Math.max(alt.sterne, a.sterne),
  }
  const s = schwierigkeitVon(a.nr)
  stand.frei[s] = Math.max(stand.frei[s], Math.min(LEVEL_PRO_STUFE, stufeVon(a.nr) + 1))
  delete stand.partien[String(a.nr)]
  schreibe(stand)
  return stand
}

export function merkePartie(p: Partie): void {
  const stand = leseStand()
  stand.partien[String(p.nr)] = p
  schreibe(stand)
}

export function lesePartie(nr: number, stand = leseStand()): Partie | null {
  const p = stand.partien[String(nr)]
  if (!p || typeof p.werte !== 'string' || p.werte.length !== 81) return null
  return p
}

export function vergissPartie(nr: number): void {
  const stand = leseStand()
  delete stand.partien[String(nr)]
  schreibe(stand)
}

export function setzeEinstellungen(teil: Partial<Einstellungen>): Einstellungen {
  const stand = leseStand()
  stand.einstellungen = { ...stand.einstellungen, ...teil }
  schreibe(stand)
  return stand.einstellungen
}

/** Wie viele Level einer Stufe gelöst sind. */
export function geloeste(schwierigkeit: Schwierigkeit, stand = leseStand()): number {
  let n = 0
  for (const [k, l] of Object.entries(stand.level)) {
    if (l.fertig && schwierigkeitVon(Number(k)) === schwierigkeit) n++
  }
  return n
}

export function geloesteGesamt(stand = leseStand()): number {
  return Object.values(stand.level).filter((l) => l.fertig).length
}

/** Nur für Tests und den Knopf "Fortschritt löschen". */
export function loescheStand(): void {
  try {
    speicher()?.removeItem(SCHLUESSEL)
  } catch {
    // egal
  }
}
