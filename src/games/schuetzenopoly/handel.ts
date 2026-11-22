/**
 * Handel zwischen zwei Spielern.
 *
 * Ein Angebot besteht aus Grundstücken und Talern auf beiden Seiten. Es
 * wird geprüft, bevor es ausgeführt wird -- niemand soll etwas verschenken,
 * was ihm gar nicht gehört, und niemand mehr Taler zusagen, als er hat.
 *
 * Gebaute Grundstücke sind vom Handel ausgenommen. Sonst müsste man beim
 * Besitzerwechsel entscheiden, was mit den Gebäuden passiert, und das ist
 * eine Regel, die sich niemand merkt.
 */

import { baukosten, gruppeKomplett, istGrundstueck, kaufpreis } from './gebuehren'
import { grundstueck, grundstueckeDerGruppe } from './grundstuecke'
import { gutschrift } from './bank'
import {
  besitzVon,
  feldName,
  mitBesitz,
  mitLog,
  mitSpieler,
  spielerMit,
  type SpielZustand,
} from './zustand'

export interface Handelsangebot {
  vonId: string
  anId: string
  /** Felder, die der Anbieter abgibt. */
  gebeFelder: string[]
  gebeTaler: number
  /** Felder, die er dafür haben will. */
  willFelder: string[]
  willTaler: number
}

/** Warum ein Angebot nicht geht -- als Kennung, die Oberfläche sagt es in ihrer Sprache. */
export type HandelGrund =
  | 'unbekannt'
  | 'selbst'
  | 'ausgeschieden'
  | 'negativ'
  | 'zuWenigAnbieter'
  | 'zuWenigPartner'
  | 'leer'
  | 'nichtSeins'
  | 'gebaeude'

export interface HandelPruefung {
  gueltig: boolean
  /** Deutsch, wie bisher. */
  grund?: string
  code?: HandelGrund
  /** Bei `nichtSeins` und `gebaeude`: welches Feld. */
  feldId?: string
}

export function pruefeHandel(state: SpielZustand, angebot: Handelsangebot): HandelPruefung {
  const nein = (code: HandelGrund, grund: string, feldId?: string): HandelPruefung =>
    feldId ? { gueltig: false, grund, code, feldId } : { gueltig: false, grund, code }
  const von = spielerMit(state, angebot.vonId)
  const an = spielerMit(state, angebot.anId)
  if (!von || !an) return nein('unbekannt', 'Spieler unbekannt')
  if (von.id === an.id) return nein('selbst', 'Nicht mit sich selbst')
  if (von.insolvent || an.insolvent) return nein('ausgeschieden', 'Spieler ist ausgeschieden')
  if (angebot.gebeTaler < 0 || angebot.willTaler < 0)
    return nein('negativ', 'Negative Beträge gibt es nicht')
  if (angebot.gebeTaler > von.taler) return nein('zuWenigAnbieter', 'So viel hat er nicht')
  if (angebot.willTaler > an.taler) return nein('zuWenigPartner', 'So viel hat der andere nicht')
  if (
    angebot.gebeFelder.length === 0 &&
    angebot.willFelder.length === 0 &&
    angebot.gebeTaler === 0 &&
    angebot.willTaler === 0
  )
    return nein('leer', 'Leeres Angebot')

  for (const feldId of angebot.gebeFelder) {
    const b = state.besitz[feldId]
    if (!b || b.besitzerId !== von.id)
      return nein('nichtSeins', `${feldName(feldId)} gehört ihm nicht`, feldId)
    if (b.stufe > 0) return nein('gebaeude', `Auf ${feldName(feldId)} steht ein Gebäude`, feldId)
  }
  for (const feldId of angebot.willFelder) {
    const b = state.besitz[feldId]
    if (!b || b.besitzerId !== an.id)
      return nein('nichtSeins', `${feldName(feldId)} gehört ihm nicht`, feldId)
    if (b.stufe > 0) return nein('gebaeude', `Auf ${feldName(feldId)} steht ein Gebäude`, feldId)
  }
  return { gueltig: true }
}

export function handelAusfuehren(state: SpielZustand, angebot: Handelsangebot): SpielZustand {
  const pruefung = pruefeHandel(state, angebot)
  if (!pruefung.gueltig) return state
  const von = spielerMit(state, angebot.vonId)!
  const an = spielerMit(state, angebot.anId)!

  let s = state
  for (const feldId of angebot.gebeFelder) {
    s = mitBesitz(s, feldId, { besitzerId: an.id, geschuetztBis: null })
  }
  for (const feldId of angebot.willFelder) {
    s = mitBesitz(s, feldId, { besitzerId: von.id, geschuetztBis: null })
  }
  if (angebot.gebeTaler > 0) {
    s = mitSpieler(s, von.id, { taler: spielerMit(s, von.id)!.taler - angebot.gebeTaler })
    s = gutschrift(s, an.id, angebot.gebeTaler)
  }
  if (angebot.willTaler > 0) {
    s = mitSpieler(s, an.id, { taler: spielerMit(s, an.id)!.taler - angebot.willTaler })
    s = gutschrift(s, von.id, angebot.willTaler)
  }

  const beschreibe = (felder: string[], taler: number) => {
    const teile = felder.map(feldName)
    if (taler > 0) teile.push(`${taler} 🪙`)
    return teile.length ? teile.join(' + ') : 'nichts'
  }
  s = mitLog(s, {
    spielerId: von.id,
    art: 'kauf',
    text: `Handel: ${von.name} gibt ${beschreibe(angebot.gebeFelder, angebot.gebeTaler)} an ${an.name} für ${beschreibe(angebot.willFelder, angebot.willTaler)}.`,
    meldung: {
      art: 'handel',
      von: von.name,
      an: an.name,
      gebeFelder: [...angebot.gebeFelder],
      gebeTaler: angebot.gebeTaler,
      willFelder: [...angebot.willFelder],
      willTaler: angebot.willTaler,
    },
  })
  return s
}

/**
 * Was ein Grundstück für einen bestimmten Spieler wert ist.
 *
 * Der Kaufpreis ist die Untergrenze. Wer damit eine Gruppe schließt, zahlt
 * mehr; wer damit einem Gegner die Gruppe verbaut, auch. Genau diese
 * Bewertung nutzt die KI -- sie sieht dabei nichts, was nicht auf dem Brett
 * steht.
 */
export function feldWert(state: SpielZustand, feldId: string, fuerSpielerId: string): number {
  const basis = kaufpreis(feldId)
  if (!istGrundstueck(feldId)) {
    // Sonder- und Verbandsfelder werden mit jeder weiteren Karte wertvoller.
    return Math.round(basis * 1.3)
  }
  const g = grundstueck(feldId)
  if (!g) return basis

  const geschwister = grundstueckeDerGruppe(g.gruppe)
  const eigene = geschwister.filter(
    (andere) => andere.id !== feldId && state.besitz[andere.id]?.besitzerId === fuerSpielerId,
  ).length
  const fehlende = geschwister.length - 1 - eigene

  let wert = basis
  if (fehlende === 0)
    wert = Math.round(basis * 2.2) // schließt die Gruppe
  else if (eigene > 0) wert = Math.round(basis * (1 + 0.35 * eigene))

  // Ein Feld, das ein Gegner zum Gruppenschluss braucht, ist mehr wert.
  for (const gegner of state.spieler) {
    if (gegner.id === fuerSpielerId || gegner.insolvent) continue
    const seine = geschwister.filter(
      (andere) => andere.id !== feldId && state.besitz[andere.id]?.besitzerId === gegner.id,
    ).length
    if (seine === geschwister.length - 1) wert = Math.round(wert * 1.4)
  }
  return wert
}

/** Netto-Gewinn eines Angebots aus Sicht des Empfängers. */
export function bewerteAngebot(state: SpielZustand, angebot: Handelsangebot): number {
  const empfaenger = angebot.anId
  const bekommt =
    angebot.gebeFelder.reduce((s, f) => s + feldWert(state, f, empfaenger), 0) + angebot.gebeTaler
  const gibt =
    angebot.willFelder.reduce((s, f) => s + feldWert(state, f, empfaenger), 0) + angebot.willTaler
  return bekommt - gibt
}

/** Handelbare Grundstücke eines Spielers: unbebaut und nicht geschützt. */
export function handelbareFelder(state: SpielZustand, spielerId: string): string[] {
  return besitzVon(state, spielerId)
    .filter((b) => b.stufe === 0)
    .map((b) => b.feldId)
}

/** Grobe Einschätzung, wie stark ein Spieler dasteht -- für die KI. */
export function staerke(state: SpielZustand, spielerId: string): number {
  let punkte = spielerMit(state, spielerId)?.taler ?? 0
  for (const b of besitzVon(state, spielerId)) {
    punkte += kaufpreis(b.feldId)
    if (istGrundstueck(b.feldId)) {
      punkte += baukosten(b.feldId) * b.stufe * 1.5
      if (gruppeKomplett(state, b.feldId)) punkte += kaufpreis(b.feldId) * 0.5
    }
  }
  return Math.round(punkte)
}
