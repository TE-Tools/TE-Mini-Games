/**
 * Was ein Feld kostet, wenn man darauf landet.
 *
 * Die Formel steht bewusst an einer Stelle, damit "Wie kommt diese Zahl
 * zustande?" eine Antwort hat, die man vorlesen kann:
 *
 *   Grundstück:  Grundgebühr × Ausbaufaktor × Gruppenfaktor
 *   Sonderfeld:  Staffel nach Anzahl im Besitz desselben Spielers
 *   Verband:     Würfelsumme × Faktor (einer oder beide)
 */

import {
  AUSBAU_FAKTOR,
  GRUPPEN_FAKTOR,
  GRUPPEN_FAKTOR_PREMIUM,
  SONDERFELD_GEBUEHR,
  SONDERFELD_PREIS,
  VERBAND_FAKTOR_BEIDE,
  VERBAND_FAKTOR_EINER,
  VERBAND_PREIS,
  VERKAUF_ANTEIL,
  type AusbauStufe,
} from './config'
import { SONDERFELDER, VERBANDSFELDER, feldAn } from './brett'
import { GRUNDSTUECKE, grundstueck, gruppe, grundstueckeDerGruppe } from './grundstuecke'
import type { SpielZustand } from './zustand'

const SONDERFELD_IDS = new Set<string>(SONDERFELDER.map((s) => s.id))
const VERBAND_IDS = new Set<string>(VERBANDSFELDER.map((v) => v.id))

export function istGrundstueck(feldId: string): boolean {
  return GRUNDSTUECKE.some((g) => g.id === feldId)
}
export function istSonderfeld(feldId: string): boolean {
  return SONDERFELD_IDS.has(feldId)
}
export function istVerband(feldId: string): boolean {
  return VERBAND_IDS.has(feldId)
}

/** Kaufpreis eines beliebigen kaufbaren Feldes. */
export function kaufpreis(feldId: string): number {
  const g = grundstueck(feldId)
  if (g) return g.preis
  if (istSonderfeld(feldId)) return SONDERFELD_PREIS
  if (istVerband(feldId)) return VERBAND_PREIS
  throw new Error(`Feld ${feldId} ist nicht käuflich`)
}

/** Kosten einer weiteren Ausbaustufe. */
export function baukosten(feldId: string): number {
  const g = grundstueck(feldId)
  if (!g) throw new Error(`Auf ${feldId} lässt sich nicht bauen`)
  const gr = gruppe(g.gruppe)
  if (!gr) throw new Error(`Unbekannte Gruppe: ${g.gruppe}`)
  return gr.baukosten
}

/** Was die Bank beim Rückkauf zahlt. */
export function rueckkaufwert(betrag: number): number {
  return Math.round(betrag * VERKAUF_ANTEIL)
}

/** Besitzt derselbe Spieler alle Grundstücke der Gruppe? */
export function gruppeKomplett(state: SpielZustand, feldId: string): boolean {
  const g = grundstueck(feldId)
  if (!g) return false
  const besitzer = state.besitz[feldId]?.besitzerId
  if (!besitzer) return false
  return grundstueckeDerGruppe(g.gruppe).every(
    (andere) => state.besitz[andere.id]?.besitzerId === besitzer,
  )
}

/** Wie viele Felder eines Typs demselben Spieler gehören. */
function anzahlImBesitz(state: SpielZustand, ids: Iterable<string>, besitzerId: string): number {
  let n = 0
  for (const id of ids) {
    if (state.besitz[id]?.besitzerId === besitzerId) n++
  }
  return n
}

export function grundstueckGebuehr(state: SpielZustand, feldId: string): number {
  const g = grundstueck(feldId)
  const b = state.besitz[feldId]
  if (!g || !b || !b.besitzerId) return 0
  const gr = gruppe(g.gruppe)
  const komplett = gruppeKomplett(state, feldId)
  const gruppenFaktor = komplett
    ? gr?.premium
      ? GRUPPEN_FAKTOR_PREMIUM
      : GRUPPEN_FAKTOR
    : 1
  return Math.round(g.grundgebuehr * AUSBAU_FAKTOR[b.stufe] * gruppenFaktor)
}

export function sonderfeldGebuehr(state: SpielZustand, feldId: string): number {
  const b = state.besitz[feldId]
  if (!b?.besitzerId) return 0
  const anzahl = anzahlImBesitz(state, SONDERFELD_IDS, b.besitzerId)
  return SONDERFELD_GEBUEHR[Math.min(anzahl, SONDERFELD_GEBUEHR.length - 1)] ?? 0
}

export function verbandGebuehr(
  state: SpielZustand,
  feldId: string,
  wuerfelSumme: number,
): number {
  const b = state.besitz[feldId]
  if (!b?.besitzerId) return 0
  const anzahl = anzahlImBesitz(state, VERBAND_IDS, b.besitzerId)
  const faktor = anzahl >= 2 ? VERBAND_FAKTOR_BEIDE : VERBAND_FAKTOR_EINER
  return wuerfelSumme * faktor
}

export interface GebuehrErgebnis {
  betrag: number
  besitzerId: string
  feldId: string
  /** Warum nichts fällig wird, falls betrag 0 ist. */
  grund?: 'geschuetzt' | 'eigenes' | 'frei'
}

/**
 * Die fällige Gebühr auf einem Feld -- oder null, wenn keine anfällt.
 * Rollenboni bleiben außen vor: die rechnet die Engine dazu, weil sie
 * Zähler mitführen muss.
 */
export function gebuehrFuer(
  state: SpielZustand,
  position: number,
  wuerfelSumme: number,
  zahlerId: string,
): GebuehrErgebnis | null {
  const feld = feldAn(position)
  if (!feld.kaufbar || !feld.grundstueckId) return null
  const b = state.besitz[feld.grundstueckId]
  if (!b?.besitzerId) return null
  if (b.besitzerId === zahlerId) return null
  const besitzer = state.spieler.find((s) => s.id === b.besitzerId)
  if (!besitzer || besitzer.insolvent) return null
  if (b.geschuetztBis !== null && b.geschuetztBis >= state.runde) {
    return { betrag: 0, besitzerId: b.besitzerId, feldId: b.feldId, grund: 'geschuetzt' }
  }

  let betrag = 0
  if (istGrundstueck(b.feldId)) betrag = grundstueckGebuehr(state, b.feldId)
  else if (istSonderfeld(b.feldId)) betrag = sonderfeldGebuehr(state, b.feldId)
  else if (istVerband(b.feldId)) betrag = verbandGebuehr(state, b.feldId, wuerfelSumme)

  return { betrag, besitzerId: b.besitzerId, feldId: b.feldId }
}

/** Vermögen: Bargeld plus halber Gegenwert von Grundstücken und Gebäuden. */
export function vermoegen(state: SpielZustand, spielerId: string): number {
  const spieler = state.spieler.find((s) => s.id === spielerId)
  if (!spieler) return 0
  let summe = spieler.taler
  for (const b of Object.values(state.besitz)) {
    if (b.besitzerId !== spielerId) continue
    summe += kaufpreis(b.feldId)
    if (istGrundstueck(b.feldId)) summe += baukosten(b.feldId) * b.stufe
  }
  return summe
}

/** Was ein Spieler durch Verkauf an die Bank noch flüssig machen könnte. */
export function verwertbaresVermoegen(state: SpielZustand, spielerId: string): number {
  let summe = 0
  for (const b of Object.values(state.besitz)) {
    if (b.besitzerId !== spielerId) continue
    summe += rueckkaufwert(kaufpreis(b.feldId))
    if (istGrundstueck(b.feldId)) summe += rueckkaufwert(baukosten(b.feldId)) * b.stufe
  }
  return summe
}

/** Höchste Stufe, die auf einem Grundstück der Gruppe schon steht. */
export function hoechsteStufeDerGruppe(state: SpielZustand, feldId: string): AusbauStufe {
  const g = grundstueck(feldId)
  if (!g) return 0
  let max: AusbauStufe = 0
  for (const andere of grundstueckeDerGruppe(g.gruppe)) {
    const stufe = state.besitz[andere.id]?.stufe ?? 0
    if (stufe > max) max = stufe
  }
  return max
}

/** Niedrigste Stufe in der Gruppe -- für das gleichmäßige Bauen. */
export function niedrigsteStufeDerGruppe(state: SpielZustand, feldId: string): AusbauStufe {
  const g = grundstueck(feldId)
  if (!g) return 0
  let min: AusbauStufe = 4
  for (const andere of grundstueckeDerGruppe(g.gruppe)) {
    const stufe = state.besitz[andere.id]?.stufe ?? 0
    if (stufe < min) min = stufe
  }
  return min
}
