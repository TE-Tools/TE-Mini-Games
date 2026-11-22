/**
 * Feste Sätze für den Tag in Schützenrunde online.
 *
 * Anlass (07.11.2026): Ein freier Chat zwischen Fremden verlangt im Play
 * Store Melden, Blockieren und Moderation. Feste Sätze brauchen nichts davon
 * -- und jeder liest sie in seiner Sprache.
 *
 * Gesendet wird immer der deutsche Satz: Er ist die Kennung, die der Server
 * prüft (Migration 030) und die `aussageText` beim Anzeigen übersetzt. Es
 * sind dieselben Sätze, die auch die Rechner-Spieler sagen, dazu zwei zum
 * In-Schutz-Nehmen und einige ohne Namen.
 */
import { de } from '@/i18n/texte/de'

const A = de.schuetzenrunde.aussagen

export type SatzArt = 'vorwurf' | 'fuersprache' | 'verteidigung' | 'allgemein'

export interface SatzWahl {
  art: SatzArt
  nr: number
}

/** Alle Sätze in der Reihenfolge der Auswahl. */
export function alleSaetze(): SatzWahl[] {
  return [
    ...A.vorwuerfe.map((_, nr) => ({ art: 'vorwurf' as const, nr })),
    ...A.fuersprache.map((_, nr) => ({ art: 'fuersprache' as const, nr })),
    ...A.verteidigungen.map((_, nr) => ({ art: 'verteidigung' as const, nr })),
    ...A.allgemein.map((_, nr) => ({ art: 'allgemein' as const, nr })),
  ]
}

export function brauchtNamen(wahl: SatzWahl): boolean {
  return wahl.art === 'vorwurf' || wahl.art === 'fuersprache'
}

export function schluessel(wahl: SatzWahl): string {
  return `${wahl.art}:${wahl.nr}`
}

export function ausSchluessel(wert: string): SatzWahl | null {
  return alleSaetze().find((w) => schluessel(w) === wert) ?? null
}

/** Der Satz in einer Sprache; mit Namen, wo der Satz einen braucht. */
export function satzIn(aussagen: typeof A, wahl: SatzWahl, name: string): string {
  switch (wahl.art) {
    case 'vorwurf':
      return aussagen.vorwuerfe[wahl.nr]?.(name) ?? ''
    case 'fuersprache':
      return aussagen.fuersprache[wahl.nr]?.(name) ?? ''
    case 'verteidigung':
      return aussagen.verteidigungen[wahl.nr] ?? ''
    case 'allgemein':
      return aussagen.allgemein[wahl.nr] ?? ''
  }
}

/** Was an den Server geht: immer der deutsche Satz. */
export function deutscherSatz(wahl: SatzWahl, name: string): string {
  return satzIn(A, wahl, name)
}
