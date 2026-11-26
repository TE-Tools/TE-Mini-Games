/**
 * Was ein Antippen auf dem Damebrett bedeutet -- ohne React, damit es sich
 * prüfen lässt. Für die Partie gegen den Computer, zu zweit und online
 * derselbe Weg.
 *
 * Eine Schlagfolge lässt sich auf zwei Arten eingeben:
 * - Sprung für Sprung: Stein, dann jedes Landefeld der Reihe nach.
 * - Gleich das Ziel: Führt nur eine Folge dorthin, wird sie gezogen.
 * Bleibt nach einem Sprung nur noch eine Folge übrig, zieht das Brett sie
 * zu Ende -- niemand muss Felder antippen, die feststehen.
 */
import {
  farbeVonFigur,
  kurz,
  naechsteFelder,
  zuegeVon,
  type Farbe,
  type Partie,
  type Zug,
} from '@/games/dame'

export interface Auswahl {
  von: number
  /** Die schon angetippten Landefelder einer Schlagfolge. */
  teilpfad: number[]
}

export type Antippen = { art: 'zug'; zug: string } | { art: 'auswahl'; auswahl: Auswahl | null }

const beginntMit = (pfad: readonly number[], anfang: readonly number[]) =>
  anfang.every((f, i) => pfad[i] === f)

export function tippe(p: Partie, auswahl: Auswahl | null, feld: number, eigene: Farbe): Antippen {
  if (auswahl) {
    const passend = zuegeVon(p, auswahl.von, auswahl.teilpfad)
    const weiter = [...auswahl.teilpfad, feld]
    const schritt = passend.filter((z) => beginntMit(z.pfad, weiter))
    if (schritt.length === 1) return { art: 'zug', zug: kurz(schritt[0]!) }
    if (schritt.length > 1) {
      // Mehrere Folgen gehen hier weiter: auf das nächste Landefeld warten.
      return { art: 'auswahl', auswahl: { von: auswahl.von, teilpfad: weiter } }
    }
    const amZiel = passend.filter((z) => z.pfad[z.pfad.length - 1] === feld)
    if (amZiel.length === 1) return { art: 'zug', zug: kurz(amZiel[0]!) }
  }
  const figur = p.stellung.brett[feld] ?? 0
  const meine = farbeVonFigur(figur) === eigene
  if (!meine || auswahl?.von === feld) return { art: 'auswahl', auswahl: null }
  return { art: 'auswahl', auswahl: { von: feld, teilpfad: [] } }
}

/** Die Felder, die als nächstes angetippt werden können. */
export function zieleFuer(p: Partie, auswahl: Auswahl | null): number[] {
  return auswahl ? naechsteFelder(p, auswahl.von, auswahl.teilpfad) : []
}

/**
 * Was schon feststeht, solange eine Schlagfolge halb angetippt ist: die
 * Landefelder und die Steine, die bis dahin übersprungen sind.
 */
export function vorschau(p: Partie, auswahl: Auswahl | null): { pfad: number[]; opfer: number[] } {
  if (!auswahl || auswahl.teilpfad.length === 0) return { pfad: [], opfer: [] }
  const z: Zug | undefined = zuegeVon(p, auswahl.von, auswahl.teilpfad)[0]
  if (!z) return { pfad: [], opfer: [] }
  return { pfad: auswahl.teilpfad, opfer: z.geschlagen.slice(0, auswahl.teilpfad.length) }
}
