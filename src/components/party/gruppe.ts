/**
 * Die gemerkte Runde der Partyspiele.
 *
 * Wer am Abend mehrere Partyspiele hintereinander spielt, tippt die Namen
 * einmal ein -- danach steht die Runde in jedem Partyspiel schon da. Gemerkt
 * wird beim Start einer Partie (die zuletzt *gespielte* Runde, nicht jeder
 * Tastendruck), und nur auf diesem Gerät: localStorage, keine Tabelle, kein
 * Netz. Die Vorbelegung eines Spiels gilt nur, solange noch nie eine Runde
 * gemerkt wurde.
 *
 * Doppelte Namen werden beim Laden absichtlich *nicht* aussortiert: Das
 * Eingabefeld lässt keine neuen Doppelten zu, und was trotzdem ankommt
 * (eine Liste aus einer älteren Fassung), meldet die Engine beim Start wie
 * bisher -- so bleibt es an einer Stelle geprüft.
 */
import { useCallback, useState } from 'react'

export const GRUPPE_SCHLUESSEL = 'te-party-gruppe'

/** Mehr als das nimmt kein Partyspiel; was darüber liegt, ist kaputt. */
const HOECHSTENS = 16
/** So lang darf ein Name im Eingabefeld werden. */
export const NAME_LAENGE = 20

/** Die gemerkte Runde, oder `null`, wenn es noch keine gibt (oder sie unlesbar ist). */
export function ladeGruppe(): string[] | null {
  try {
    const roh = localStorage.getItem(GRUPPE_SCHLUESSEL)
    if (!roh) return null
    const daten: unknown = JSON.parse(roh)
    if (!Array.isArray(daten)) return null
    const namen = daten
      .filter((n): n is string => typeof n === 'string')
      .map((n) => n.trim().slice(0, NAME_LAENGE))
      .filter(Boolean)
      .slice(0, HOECHSTENS)
    return namen.length > 0 ? namen : null
  } catch {
    return null
  }
}

/** Merkt die Runde für alle Partyspiele. Geht das nicht (privates Fenster), bleibt es still. */
export function merkeGruppe(namen: readonly string[]): void {
  try {
    localStorage.setItem(GRUPPE_SCHLUESSEL, JSON.stringify(namen.slice(0, HOECHSTENS)))
  } catch {
    // Ohne Speicher gibt es eben nichts zu merken -- gespielt wird trotzdem.
  }
}

/** Gleiche Runde, gleiche Reihenfolge -- Groß/klein zählt mit, das ist ein anderer Name. */
export function gleicheRunde(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((n, i) => n === b[i])
}

/**
 * Die Mitspieler einer Spielseite: startet mit der gemerkten Runde, sonst mit
 * der Vorbelegung des Spiels. `merken` ruft die Seite, wenn eine Partie
 * wirklich losging.
 */
export function useSpielerGruppe(vorbelegung: readonly string[]) {
  const [anfang] = useState(ladeGruppe)
  const [gemerkt, setGemerkt] = useState<readonly string[] | null>(anfang)
  const [namen, setNamen] = useState<string[]>(() => [...(anfang ?? vorbelegung)])
  const merken = useCallback((liste: readonly string[]) => {
    merkeGruppe(liste)
    setGemerkt([...liste])
  }, [])
  return { namen, setNamen, gemerkt, merken }
}
