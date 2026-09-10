/**
 * Aufgezeichnete Lösungen abspielen.
 *
 * Jedes Level bringt eine Eingabefolge mit, die es löst. Der Test spielt sie
 * ab und beweist damit, dass das Level zu schaffen ist -- ohne Browser, ohne
 * Bildschirm, in Millisekunden. Wer ein Level ändert, muss die Lösung
 * mitändern, sonst fällt der Test. Genau das ist der Sinn.
 *
 * Dieselbe Maschinerie kann später eine Vorführung („so geht's") oder
 * Geisterläufe antreiben; deshalb steht sie im Spielmodul und nicht im Test.
 */

import { laufe, starte, type Spielstand } from './engine'
import type { LevelDaten, LoesungsSchritt } from './types'

/** Mit welcher Bildrate abgespielt wird -- 60 Hz wie im Browser. */
const TAKT = 1 / 60

export interface Abspielergebnis {
  stand: Spielstand
  /** Gebrauchte Spielzeit in Sekunden. */
  zeit: number
  geschafft: boolean
  /** Woran es scheiterte, falls es scheiterte. */
  grund: string
}

function bedingungErfuellt(s: Spielstand, schritt: LoesungsSchritt): boolean {
  if (schritt.bisX !== undefined && s.koerper.x < schritt.bisX) return false
  if (schritt.bisXunter !== undefined && s.koerper.x > schritt.bisXunter) return false
  if (schritt.bisYunter !== undefined && s.koerper.y > schritt.bisYunter) return false
  if (schritt.bisBoden && !s.koerper.amBoden) return false
  return true
}

function hatBedingung(schritt: LoesungsSchritt): boolean {
  return (
    schritt.bisX !== undefined ||
    schritt.bisXunter !== undefined ||
    schritt.bisYunter !== undefined ||
    Boolean(schritt.bisBoden)
  )
}

export function spieleLoesung(level: LevelDaten): Abspielergebnis {
  if (!level.loesung || level.loesung.length === 0) {
    return { stand: starte(level), zeit: 0, geschafft: false, grund: 'keine Lösung hinterlegt' }
  }
  let s = starte(level)
  let zeit = 0
  for (const schritt of level.loesung) {
    const eingabe = {
      links: Boolean(schritt.links),
      rechts: Boolean(schritt.rechts),
      sprung: Boolean(schritt.sprung),
    }
    const grenze = schritt.dauer ?? (hatBedingung(schritt) ? 6 : 0.2)
    let offen = grenze
    // Eine Bedingung darf erst nach dem ersten Bild greifen: Sonst wäre ein
    // "springen, bis du am Boden bist" schon im selben Augenblick erfüllt.
    let ersterTakt = true
    while (offen > 0) {
      const dt = Math.min(TAKT, offen)
      s = laufe(s, eingabe, dt)
      zeit += dt
      offen -= dt
      if (s.phase === 'geschafft') return { stand: s, zeit, geschafft: true, grund: '' }
      if (s.phase === 'tot') {
        return {
          stand: s,
          zeit,
          geschafft: false,
          grund: `gestorben bei x=${Math.round(s.koerper.x)}, y=${Math.round(s.koerper.y)} nach ${zeit.toFixed(2)}s`,
        }
      }
      if (!ersterTakt && hatBedingung(schritt) && bedingungErfuellt(s, schritt)) break
      ersterTakt = false
    }
  }
  // Nach der Folge noch kurz auslaufen lassen -- der letzte Sprung darf
  // landen, bevor geurteilt wird.
  for (let n = 0; n < 120 && s.phase === 'laeuft'; n++) {
    s = laufe(s, { links: false, rechts: false, sprung: false }, TAKT)
    zeit += TAKT
  }
  if (s.phase === 'geschafft') return { stand: s, zeit, geschafft: true, grund: '' }
  return {
    stand: s,
    zeit,
    geschafft: false,
    grund:
      s.phase === 'tot'
        ? `gestorben bei x=${Math.round(s.koerper.x)}, y=${Math.round(s.koerper.y)}`
        : `Lösung zu Ende, Figur steht bei x=${Math.round(s.koerper.x)}, y=${Math.round(s.koerper.y)}`,
  }
}
