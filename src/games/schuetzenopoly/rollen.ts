/**
 * Spielerrollen -- die Dienstgrade im Verein.
 *
 * Jede Rolle gibt genau einen kleinen Vorteil. Die Werte sind absichtlich
 * klein gehalten: eine Rolle soll den Stil einer Partie färben, nicht sie
 * entscheiden. Deshalb gibt es auch keine Rolle, die Geld aus dem Nichts
 * erzeugt oder Gebühren komplett abschaltet.
 */

export type RollenId =
  | 'jungschuetze'
  | 'schuetze'
  | 'unteroffizier'
  | 'leutnant'
  | 'oberleutnant'
  | 'hauptmann'
  | 'major'
  | 'oberst'
  | 'koenig'

export interface RollenBonus {
  /** Aufschlag auf Minispielpunkte, z.B. 0.1 = +10 %. */
  minispielPunkte?: number
  /** Aufschlag auf die Belohnung eines Minispiels. */
  minispielBelohnung?: number
  /** Rabatt auf eine zu zahlende Gebühr, einmal je Runde. */
  gebuehrRabattJeRunde?: number
  /** Aufschlag auf kassierte Gebühren. */
  einnahmenBonus?: number
  /** Aufschlag auf positive Kartenbeträge. */
  kartenBonus?: number
  /** Rabatt auf Baukosten. */
  baukostenRabatt?: number
  /** Darf ein Minispiel einmal je Partie selbst auslösen. */
  duellJePartie?: number
  /** Darf ein Grundstück einmal je Partie schützen. */
  schutzJePartie?: number
  /** Darf einmal je Partie eine gezogene Karte ablehnen und neu ziehen. */
  karteNeuJePartie?: number
  /** Einmal je Partie: Königsaktion -- sofortige Zahlung aus der Vereinskasse. */
  koenigsaktion?: number
}

export interface RollenDaten {
  id: RollenId
  name: string
  icon: string
  beschreibung: string
  bonus: RollenBonus
}

export const ROLLEN: readonly RollenDaten[] = [
  {
    id: 'jungschuetze',
    name: 'Jungschütze',
    icon: '🎽',
    beschreibung: 'Trifft am Stand besser: +15 % Punkte in jedem Minispiel.',
    bonus: { minispielPunkte: 0.15 },
  },
  {
    id: 'schuetze',
    name: 'Schütze',
    icon: '🎯',
    beschreibung: 'Bekommt für Medaillen mehr: +25 % Minispiel-Belohnung.',
    bonus: { minispielBelohnung: 0.25 },
  },
  {
    id: 'unteroffizier',
    name: 'Unteroffizier',
    icon: '🎖️',
    beschreibung: 'Handelt einmal je Runde 25 % einer Gebühr herunter.',
    bonus: { gebuehrRabattJeRunde: 0.25 },
  },
  {
    id: 'leutnant',
    name: 'Leutnant',
    icon: '⚔️',
    beschreibung: 'Fordert einmal je Partie zum Duell am Schießstand.',
    bonus: { duellJePartie: 1 },
  },
  {
    id: 'oberleutnant',
    name: 'Oberleutnant',
    icon: '📯',
    beschreibung: 'Kennt die richtigen Leute: +20 % auf gute Kartenbeträge.',
    bonus: { kartenBonus: 0.2 },
  },
  {
    id: 'hauptmann',
    name: 'Hauptmann',
    icon: '🛡️',
    beschreibung: 'Schützt einmal je Partie ein Grundstück vor Gebühren.',
    bonus: { schutzJePartie: 1 },
  },
  {
    id: 'major',
    name: 'Major',
    icon: '💼',
    beschreibung: 'Kassiert mehr: +12 % auf alle eingenommenen Gebühren.',
    bonus: { einnahmenBonus: 0.12 },
  },
  {
    id: 'oberst',
    name: 'Oberst',
    icon: '🃏',
    beschreibung: 'Lehnt einmal je Partie eine Karte ab und zieht neu.',
    bonus: { karteNeuJePartie: 1 },
  },
  {
    id: 'koenig',
    name: 'Schützenkönig',
    icon: '👑',
    beschreibung: 'Einmal je Partie: Die Vereinskasse zahlt 1.500 Taler aus.',
    bonus: { koenigsaktion: 1500 },
  },
] as const

const NACH_ID = new Map(ROLLEN.map((r) => [r.id, r]))

export function rolle(id: RollenId): RollenDaten {
  const r = NACH_ID.get(id)
  if (!r) throw new Error(`Unbekannte Rolle: ${id}`)
  return r
}

export function rollenBonus(id: RollenId): RollenBonus {
  return rolle(id).bonus
}
