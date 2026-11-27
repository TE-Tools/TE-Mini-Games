/**
 * Was ein Antippen auf dem Mühlebrett bedeutet -- ohne React, damit es sich
 * prüfen lässt. Für die Partie gegen den Computer, zu zweit und online
 * derselbe Weg. Entschieden wird hier nichts: Welche Züge es gibt, sagt
 * die Engine (`zuegeJetzt`); hier wird nur ausgesucht.
 *
 * Ein Zug entsteht in bis zu drei Schritten:
 * 1. Setzen: einen freien Punkt antippen. Ziehen: einen eigenen Stein
 *    antippen, dann sein Ziel (oder ihn hinschieben).
 * 2. Schließt das eine Mühle, steht der Stein schon da, die Mühle leuchtet,
 *    und die schlagbaren Steine sind markiert -- einen davon antippen.
 *    Den eben gesetzten Stein noch einmal antippen nimmt das zurück.
 * 3. Bei einer doppelten Mühle (Hausregel) noch einen.
 * Erst dann geht der ganze Zug (`a1-a4xd7`) an die Seite.
 */
import {
  basisVon,
  brettNachBasis,
  farbeVonStein,
  kurz,
  setzFelder,
  zieleVon,
  zuegeJetzt,
  zuegeMitBasis,
  type Farbe,
  type Partie,
  type Zug,
} from '@/games/muehle'

export interface Auswahl {
  /** Der angetippte eigene Stein (Zugphase). */
  von: number | null
  /** Gesetzt oder gezogen, aber noch nicht geschlagen: `d2` oder `a1-a4`. */
  basis: string | null
  /** Die schon angetippten Schläge einer doppelten Mühle. */
  geschlagen: number[]
}

export type Antippen = { art: 'zug'; zug: string } | { art: 'auswahl'; auswahl: Auswahl | null }

const beginntMit = (liste: readonly number[], anfang: readonly number[]) =>
  anfang.every((f, i) => liste[i] === f)

function offeneSchlaege(p: Partie, a: Auswahl): Zug[] {
  return a.basis ? zuegeMitBasis(p, a.basis).filter((z) => beginntMit(z.schlag, a.geschlagen)) : []
}

export function tippe(p: Partie, auswahl: Auswahl | null, feld: number, eigene: Farbe): Antippen {
  const a: Auswahl = auswahl ?? { von: null, basis: null, geschlagen: [] }

  if (a.basis) {
    const passend = offeneSchlaege(p, a)
    const moeglich = new Set(passend.map((z) => z.schlag[a.geschlagen.length]))
    if (moeglich.has(feld)) {
      const weiter = [...a.geschlagen, feld]
      const fertig = passend.find(
        (z) => z.schlag.length === weiter.length && beginntMit(z.schlag, weiter),
      )
      if (fertig) return { art: 'zug', zug: kurz(fertig) }
      return { art: 'auswahl', auswahl: { ...a, geschlagen: weiter } }
    }
    // Den eben gesetzten oder gezogenen Stein noch einmal: zurück vor den Zug.
    const z0 = passend[0]
    if (z0 && feld === z0.nach && a.geschlagen.length === 0) {
      return {
        art: 'auswahl',
        auswahl: z0.von === null ? null : { von: z0.von, basis: null, geschlagen: [] },
      }
    }
    return { art: 'auswahl', auswahl: a }
  }

  const liste = zuegeJetzt(p)
  const hierher = liste.filter((z) => z.nach === feld && z.von === a.von)
  if (hierher.length > 0) {
    if (hierher.length === 1 && hierher[0]!.schlag.length === 0) {
      return { art: 'zug', zug: kurz(hierher[0]!) }
    }
    return { art: 'auswahl', auswahl: { von: a.von, basis: basisVon(hierher[0]!), geschlagen: [] } }
  }

  const meiner = farbeVonStein(p.stellung.brett[feld] ?? 0) === eigene
  if (meiner && feld !== a.von && liste.some((z) => z.von === feld)) {
    return { art: 'auswahl', auswahl: { von: feld, basis: null, geschlagen: [] } }
  }
  return { art: 'auswahl', auswahl: null }
}

/** Was das Brett gerade zeigen soll -- alles aus der Engine abgeleitet. */
export interface Anzeige {
  /** Das Brett, wie es aussieht: nach einer Mühle schon mit dem neuen Stein. */
  brett: readonly number[]
  /** Punkte, die als nächstes angetippt werden können. */
  ziele: number[]
  /** Steine des Gegners, die jetzt geschlagen werden dürfen. */
  schlagbar: number[]
  /** Die Mühlen, die gerade geschlossen wurden und auf den Schlag warten. */
  muehlen: number[]
  /** Der hervorgehobene eigene Stein. */
  gewaehlt: number | null
  /** Wartet die Auswahl auf einen Schlag? */
  schlagen: boolean
}

export function anzeige(p: Partie, auswahl: Auswahl | null, amBrett: boolean): Anzeige {
  const leer: Anzeige = {
    brett: p.stellung.brett,
    ziele: [],
    schlagbar: [],
    muehlen: [],
    gewaehlt: null,
    schlagen: false,
  }
  if (!amBrett) return leer
  if (auswahl?.basis) {
    const passend = offeneSchlaege(p, auswahl)
    const z0 = passend[0]
    const brett = brettNachBasis(p, auswahl.basis)
    if (!z0 || !brett) return leer
    for (const g of auswahl.geschlagen) brett[g] = 0
    return {
      brett,
      ziele: [],
      schlagbar: [
        ...new Set(
          passend.map((z) => z.schlag[auswahl.geschlagen.length]!).filter((x) => x !== undefined),
        ),
      ],
      muehlen: z0.muehlen,
      gewaehlt: z0.nach,
      schlagen: true,
    }
  }
  if (auswahl?.von !== null && auswahl?.von !== undefined) {
    return { ...leer, ziele: zieleVon(p, auswahl.von), gewaehlt: auswahl.von }
  }
  return { ...leer, ziele: setzFelder(p) }
}
