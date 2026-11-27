/**
 * Schiffe versenken online: was vom Server kommt.
 *
 * Anders als bei Schach und Dame führt der Server hier kein Zugbuch, das
 * jeder nachspielt -- dann müsste jeder Client beide Flotten kennen, und
 * verdeckt wäre nur die Anzeige. Wie bei den Kartenspielen hält der Server
 * die Flotten, prüft jede Aufstellung und wertet jeden Schuss aus
 * (Migration 035). `sv_get_state` gibt jedem nur seine `Sicht` -- dieselbe
 * Form wie `sichtFuer` hier, und `scripts/pruefe-schiffe-sql.mjs` hält beide
 * gegeneinander.
 *
 * Diese Datei liest nur: Sie macht aus dem, was ankommt, eine Sicht, und
 * fällt bei allem Unerwarteten auf „nichts" zurück, statt zu raten.
 */

import { FLOTTE, GROESSE, regelnAus, type SchiffId } from './config'
import type { Schiff } from './flotte'
import type { Ende, Ergebnis, Schuss, Sicht, Spieler } from './partie'

/** Sitz 1 und 2 auf dem Server sind Spieler 0 und 1 in der Engine. */
export const spielerVonSitz = (seat: number): Spieler => (seat === 2 ? 1 : 0)

const ERGEBNISSE: readonly Ergebnis[] = ['wasser', 'treffer', 'versenkt']

function schussAus(roh: unknown): Schuss | null {
  if (!roh || typeof roh !== 'object') return null
  const r = roh as Record<string, unknown>
  const feld = r['feld']
  const ergebnis = r['ergebnis']
  if (typeof feld !== 'number' || !Number.isInteger(feld) || feld < 0 || feld >= GROESSE ** 2)
    return null
  if (!ERGEBNISSE.includes(ergebnis as Ergebnis)) return null
  const schiff = r['schiff']
  const s: Schuss = { feld, ergebnis: ergebnis as Ergebnis }
  if (ergebnis === 'versenkt' && FLOTTE.some((a) => a.id === schiff)) s.schiff = schiff as SchiffId
  return s
}

function schiffAus(roh: unknown): Schiff | null {
  if (!roh || typeof roh !== 'object') return null
  const r = roh as Record<string, unknown>
  const art = FLOTTE.find((a) => a.id === r['id'])
  if (!art) return null
  const { x, y, richtung } = r
  if (typeof x !== 'number' || typeof y !== 'number') return null
  if (richtung !== 'h' && richtung !== 'v') return null
  return { id: art.id, laenge: art.laenge, x, y, richtung }
}

function liste<T>(roh: unknown, lies: (x: unknown) => T | null): T[] {
  return Array.isArray(roh) ? roh.map(lies).filter((x): x is T => x !== null) : []
}

function endeAus(roh: unknown): Ende | null {
  if (!roh || typeof roh !== 'object') return null
  const r = roh as Record<string, unknown>
  if (r['art'] !== 'versenkt' && r['art'] !== 'aufgabe') return null
  if (r['sieger'] !== 0 && r['sieger'] !== 1) return null
  return { art: r['art'], sieger: r['sieger'] }
}

/** Eine Sicht vom Server -- oder null, wenn keine kam (Vorraum, Aufstellen). */
export function sichtAus(roh: unknown): Sicht | null {
  if (!roh || typeof roh !== 'object') return null
  const r = roh as Record<string, unknown>
  const ich = r['ich'] === 1 ? 1 : 0
  return {
    ich,
    regeln: regelnAus(r['regeln']),
    amZug: r['amZug'] === 1 ? 1 : 0,
    ende: endeAus(r['ende']),
    eigeneFlotte: liste(r['eigeneFlotte'], schiffAus),
    eigeneSchuesse: liste(r['eigeneSchuesse'], schussAus),
    gegnerSchuesse: liste(r['gegnerSchuesse'], schussAus),
    gegnerFlotte: liste(r['gegnerFlotte'], schiffAus),
  }
}

/** Eine eigene Flotte vom Server (beim Aufstellen schon gesetzt) -- oder null. */
export function flotteVomServer(roh: unknown): Schiff[] | null {
  const f = liste(roh, schiffAus)
  return f.length === FLOTTE.length ? f : null
}
