/**
 * Das Aussehen der Figur -- reine Optik, kein Vorteil.
 *
 * Eine Farbe gibt es nur über ein Belohnungsvideo („Glut“: warmes Gold mit
 * einer Leuchtspur). Einmal freigeschaltet, bleibt sie für immer: Sie liegt
 * unter einem eigenen Schlüssel auf dem Gerät, geht offline, und auch
 * „Fortschritt löschen“ nimmt sie nicht wieder weg -- dafür hat jemand ein
 * Video angesehen. Am Spiel ändert sie nichts: gleiche Figur, gleiche
 * Größe, gleiche Physik, nur ein anderer Anstrich.
 */

const SCHLUESSEL = 'trapbound:aussehen'

export type FigurId = 'hell' | 'glut'

export interface Figur {
  id: FigurId
  /** Körperfarbe. */
  farbe: string
  /** Farbe der Leuchtspur hinter der Figur, null = keine Spur. */
  spur: string | null
  /** Nur per Belohnungsvideo zu haben. */
  nurPerVideo: boolean
}

export const FIGUREN: readonly Figur[] = [
  { id: 'hell', farbe: '#f4f1ff', spur: null, nurPerVideo: false },
  { id: 'glut', farbe: '#ffc04d', spur: '#ff7a3d', nurPerVideo: true },
]

export interface Aussehen {
  /** Per Video freigeschaltete Figuren. */
  frei: FigurId[]
  gewaehlt: FigurId
}

const STANDARD: Aussehen = { frei: [], gewaehlt: 'hell' }

function istFigurId(x: unknown): x is FigurId {
  return FIGUREN.some((f) => f.id === x)
}

export function figur(id: FigurId): Figur {
  return FIGUREN.find((f) => f.id === id) ?? FIGUREN[0]!
}

/** Darf diese Figur gewählt werden? */
export function istFrei(a: Aussehen, id: FigurId): boolean {
  return !figur(id).nurPerVideo || a.frei.includes(id)
}

/** Rein: nach einem zu Ende geschauten Video freischalten und gleich anziehen. */
export function schalteFrei(a: Aussehen, id: FigurId): Aussehen {
  return {
    frei: a.frei.includes(id) ? a.frei : [...a.frei, id],
    gewaehlt: id,
  }
}

/** Rein: wählen -- eine gesperrte Figur bleibt gesperrt. */
export function waehle(a: Aussehen, id: FigurId): Aussehen {
  return istFrei(a, id) ? { ...a, gewaehlt: id } : a
}

/** Die Figur, die gezeichnet wird. */
export function aktuelleFigur(a: Aussehen): Figur {
  return figur(istFrei(a, a.gewaehlt) ? a.gewaehlt : 'hell')
}

function speicher(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function leseAussehen(): Aussehen {
  try {
    const roh = speicher()?.getItem(SCHLUESSEL)
    if (!roh) return { ...STANDARD, frei: [] }
    const daten = JSON.parse(roh) as Partial<Aussehen>
    const frei = Array.isArray(daten.frei) ? daten.frei.filter(istFigurId) : []
    const gewaehlt = istFigurId(daten.gewaehlt) ? daten.gewaehlt : 'hell'
    return { frei, gewaehlt }
  } catch {
    return { ...STANDARD, frei: [] }
  }
}

export function schreibeAussehen(a: Aussehen): Aussehen {
  try {
    speicher()?.setItem(SCHLUESSEL, JSON.stringify(a))
  } catch {
    // Voller Speicher: Die Wahl gilt bis zum Neuladen.
  }
  return a
}
