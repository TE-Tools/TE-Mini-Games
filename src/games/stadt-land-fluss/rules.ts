/**
 * Stadt-Land-Fluss – Buchstaben, Spalten und die klassische Wertung.
 *
 * Die Punkte sind die, die am Küchentisch gelten:
 *   20 – nur du hattest in dieser Spalte überhaupt etwas
 *   10 – deine Antwort hatte sonst niemand
 *    5 – jemand anders hatte dasselbe
 *    0 – nichts eingetragen oder falscher Anfangsbuchstabe
 */

export interface SlfSpalte {
  id: string
  label: string
}

/** Die üblichen Spalten. Die ersten vier sind voreingestellt. */
export const SPALTEN: SlfSpalte[] = [
  { id: 'stadt', label: 'Stadt' },
  { id: 'land', label: 'Land' },
  { id: 'fluss', label: 'Fluss' },
  { id: 'name', label: 'Name' },
  { id: 'tier', label: 'Tier' },
  { id: 'beruf', label: 'Beruf' },
  { id: 'pflanze', label: 'Pflanze' },
  { id: 'essen', label: 'Essen' },
  { id: 'marke', label: 'Marke' },
  { id: 'film', label: 'Film' },
]

export const STANDARD_SPALTEN = ['stadt', 'land', 'fluss', 'name', 'tier']

/**
 * Q, X und Y sind draußen: Zu dritt am Tisch fällt einem dazu in fünf
 * Spalten nichts ein, und dann ist die Runde nur ärgerlich.
 */
export const BUCHSTABEN = 'ABCDEFGHIJKLMNOPRSTUVWZ'.split('')

export function spalteLabel(id: string): string {
  return SPALTEN.find((s) => s.id === id)?.label ?? id
}

/** Vergleich ohne Rücksicht auf Groß-/Kleinschreibung, Umlaute und Leerzeichen. */
export function normalisieren(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '')
}

/** Fängt die Antwort mit dem gezogenen Buchstaben an? */
export function passtZumBuchstaben(antwort: string, buchstabe: string): boolean {
  const a = antwort.trim()
  if (!a) return false
  return a[0]!.toLocaleUpperCase('de') === buchstabe.toLocaleUpperCase('de')
}

export const PUNKTE_ALLEIN = 20
export const PUNKTE_EINZIGARTIG = 10
export const PUNKTE_GETEILT = 5

export interface SlfEintrag {
  /** Kennung der Person (Platz oder Spieler-ID). */
  playerId: string
  antwort: string
}

/**
 * Eine Spalte werten. Bekommt alle Antworten dieser Spalte und gibt je
 * Person die Punkte zurück.
 */
export function werteSpalte(
  eintraege: SlfEintrag[],
  buchstabe: string,
): Record<string, number> {
  const gueltig = eintraege.filter((e) => passtZumBuchstaben(e.antwort, buchstabe))
  const punkte: Record<string, number> = {}
  for (const e of eintraege) punkte[e.playerId] = 0
  if (gueltig.length === 0) return punkte

  const zaehler = new Map<string, number>()
  for (const e of gueltig) {
    const key = normalisieren(e.antwort)
    zaehler.set(key, (zaehler.get(key) ?? 0) + 1)
  }

  for (const e of gueltig) {
    const key = normalisieren(e.antwort)
    if (gueltig.length === 1) punkte[e.playerId] = PUNKTE_ALLEIN
    else if ((zaehler.get(key) ?? 0) > 1) punkte[e.playerId] = PUNKTE_GETEILT
    else punkte[e.playerId] = PUNKTE_EINZIGARTIG
  }
  return punkte
}

export interface SlfWertung {
  /** Punkte je Person und Spalte. */
  proSpalte: Record<string, Record<string, number>>
  /** Summe je Person. */
  summe: Record<string, number>
}

/**
 * Eine ganze Runde werten.
 *
 * `antworten` ist je Person eine Zuordnung Spalte → Antwort.
 */
export function werteRunde(
  antworten: Record<string, Record<string, string>>,
  spalten: string[],
  buchstabe: string,
): SlfWertung {
  const proSpalte: Record<string, Record<string, number>> = {}
  const summe: Record<string, number> = {}
  for (const playerId of Object.keys(antworten)) summe[playerId] = 0

  for (const spalte of spalten) {
    const eintraege: SlfEintrag[] = Object.entries(antworten).map(([playerId, felder]) => ({
      playerId,
      antwort: felder[spalte] ?? '',
    }))
    const punkte = werteSpalte(eintraege, buchstabe)
    proSpalte[spalte] = punkte
    for (const [playerId, p] of Object.entries(punkte)) {
      summe[playerId] = (summe[playerId] ?? 0) + p
    }
  }
  return { proSpalte, summe }
}
