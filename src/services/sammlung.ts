/**
 * Die Sammlung: Aussehen, das man sich per Belohnungsvideo freischaltet.
 *
 * Entscheidung (07.11.2026, Thomas): Werbung kauft Aussehen, nie Punkte
 * oder Vorteile. Ein Würfel- oder Kartendesign ist reiner Schmuck -- es
 * zeigt nichts, was die Standardfassung nicht auch zeigt, und eine
 * Kartenrückseite sieht für jede verdeckte Karte gleich aus.
 *
 *  - **Freigeschaltet bleibt freigeschaltet.** Die Sammlung liegt im
 *    localStorage dieses Geräts und geht offline wie online.
 *  - **Nur auf diesem Gerät.** Online sieht jeder seine eigene Wahl; zum
 *    Server geht davon nichts.
 *  - **Das Standarddesign gibt es immer**, unverändert. Wer nie ein Video
 *    schaut, merkt von der Sammlung nichts.
 *
 * Die Designs selbst (Farben, Muster) stehen in
 * `src/components/designs/designs.ts`; hier stehen nur ihre Kennungen.
 */

export type DesignArt = 'wuerfel' | 'kartenruecken'

export const WUERFEL_DESIGNS = ['standard', 'gold', 'holz', 'nacht', 'kirsche'] as const
export const RUECKEN_DESIGNS = ['standard', 'wald', 'bordeaux', 'kupfer', 'sternennacht'] as const

export type WuerfelDesignId = (typeof WUERFEL_DESIGNS)[number]
export type RueckenDesignId = (typeof RUECKEN_DESIGNS)[number]

export interface DesignIds {
  wuerfel: WuerfelDesignId
  kartenruecken: RueckenDesignId
}

export const DESIGNS: { [A in DesignArt]: readonly DesignIds[A][] } = {
  wuerfel: WUERFEL_DESIGNS,
  kartenruecken: RUECKEN_DESIGNS,
}

export const STANDARD = 'standard'

const SCHLUESSEL = 'te-sammlung'
export const SAMMLUNG_GEAENDERT = 'te-sammlung-geaendert'

interface Eintrag {
  frei: string[]
  wahl: string
}

type Stand = Record<DesignArt, Eintrag>

function frisch(): Stand {
  return {
    wuerfel: { frei: [STANDARD], wahl: STANDARD },
    kartenruecken: { frei: [STANDARD], wahl: STANDARD },
  }
}

function speicher(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Nur bekannte Kennungen; was es nicht (mehr) gibt, fällt still heraus. */
function bereinige(art: DesignArt, roh: unknown): Eintrag {
  const bekannt = DESIGNS[art] as readonly string[]
  const d = (roh && typeof roh === 'object' ? roh : {}) as Partial<Eintrag>
  const frei = new Set<string>([STANDARD])
  if (Array.isArray(d.frei)) {
    for (const id of d.frei) if (typeof id === 'string' && bekannt.includes(id)) frei.add(id)
  }
  const wahl = typeof d.wahl === 'string' && frei.has(d.wahl) ? d.wahl : STANDARD
  return { frei: bekannt.filter((id) => frei.has(id)), wahl }
}

function lies(): Stand {
  const sp = speicher()
  if (!sp) return frisch()
  try {
    const roh = sp.getItem(SCHLUESSEL)
    if (!roh) return frisch()
    const d = JSON.parse(roh) as Partial<Record<DesignArt, unknown>>
    return {
      wuerfel: bereinige('wuerfel', d.wuerfel),
      kartenruecken: bereinige('kartenruecken', d.kartenruecken),
    }
  } catch {
    return frisch()
  }
}

function schreibe(stand: Stand): void {
  const sp = speicher()
  if (sp) {
    try {
      sp.setItem(SCHLUESSEL, JSON.stringify(stand))
    } catch {
      // Privates Fenster, voller Speicher: Dann gilt es bis zum Neuladen.
    }
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SAMMLUNG_GEAENDERT))
}

/** Welche Designs dieser Art auf diesem Gerät frei sind -- immer mit dem Standard. */
export function freieDesigns<A extends DesignArt>(art: A): DesignIds[A][] {
  return lies()[art].frei as DesignIds[A][]
}

export function istFrei(art: DesignArt, id: string): boolean {
  return lies()[art].frei.includes(id)
}

/** Das gewählte Design; ohne Wahl oder bei Unsinn im Speicher der Standard. */
export function gewaehltesDesign<A extends DesignArt>(art: A): DesignIds[A] {
  return lies()[art].wahl as DesignIds[A]
}

/** Schaltet ein Design frei (nach einem zu Ende geschauten Video) und wählt es gleich. */
export function schalteFrei(art: DesignArt, id: string): void {
  if (!(DESIGNS[art] as readonly string[]).includes(id)) return
  const stand = lies()
  const frei = new Set(stand[art].frei)
  frei.add(id)
  stand[art] = { frei: (DESIGNS[art] as readonly string[]).filter((d) => frei.has(d)), wahl: id }
  schreibe(stand)
}

/** Wählt ein freies Design. Ein gesperrtes lässt sich so nicht wählen. */
export function waehleDesign(art: DesignArt, id: string): void {
  const stand = lies()
  if (!stand[art].frei.includes(id)) return
  stand[art] = { ...stand[art], wahl: id }
  schreibe(stand)
}
