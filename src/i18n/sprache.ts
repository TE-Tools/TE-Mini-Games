/**
 * Die Sprache der Oberfläche -- Typen, Kontext, Zugriff.
 *
 * Die App ist auf Deutsch geschrieben und bleibt es: Deutsch ist die
 * Ausgangssprache, Englisch die Übersetzung. Wer eine Zeichenkette
 * ändert, ändert sie in `de` -- und TypeScript verlangt dann dieselbe
 * Stelle in `en`. Ein vergessener Text ist dadurch kein stiller Rückfall
 * auf Deutsch, sondern ein roter Build.
 *
 * Die Wahl liegt im localStorage und damit auf dem Gerät. Bewusst nicht
 * im Konto: Wer ohne Konto spielt, soll trotzdem seine Sprache behalten,
 * und wer am Tablet Englisch will und am Telefon Deutsch, darf das.
 *
 * Der Provider steht in SprachProvider.tsx -- getrennt, weil Fast
 * Refresh sonst bei jeder Textänderung den Zustand der Seite verwirft.
 */
import { createContext, useContext } from 'react'
import { de } from './texte/de'
import { en } from './texte/en'

export type Sprache = 'de' | 'en'

/** Die Form aller Texte -- Deutsch gibt sie vor. */
export type Texte = typeof de

export const SPEICHER_SCHLUESSEL = 'te-sprache'

export const WOERTERBUECHER: Record<Sprache, Texte> = { de, en }

/**
 * Welche Sprache beim ersten Start gilt.
 *
 * Nicht einfach Deutsch: Wer das Gerät auf Englisch stehen hat, bekommt
 * sonst eine App, die er nicht lesen kann, und sucht den Knopf dafür in
 * einer fremden Sprache.
 */
export function sprachenWahlAusUmgebung(sprachen: readonly string[]): Sprache {
  for (const eintrag of sprachen) {
    if (eintrag.toLowerCase().startsWith('de')) return 'de'
  }
  return sprachen.length > 0 ? 'en' : 'de'
}

export function gespeicherteSprache(): Sprache | null {
  try {
    const wert = localStorage.getItem(SPEICHER_SCHLUESSEL)
    return wert === 'de' || wert === 'en' ? wert : null
  } catch {
    // Privates Fenster oder gesperrter Speicher -- dann eben die Umgebung.
    return null
  }
}

export interface SprachLage {
  sprache: Sprache
  setzeSprache: (neu: Sprache) => void
  t: Texte
}

export const SprachContext = createContext<SprachLage | null>(null)

export function useSprache(): SprachLage {
  const lage = useContext(SprachContext)
  if (!lage) throw new Error('useSprache braucht einen SprachProvider darüber.')
  return lage
}

/** Kurzform für den häufigsten Fall: nur die Texte. */
export function useText(): Texte {
  return useSprache().t
}

/**
 * Der Name eines Spiels, auch wenn die Kennung aus gespeicherten Daten
 * kommt und damit `string` ist.
 *
 * Ein Ergebnis aus der Datenbank kann ein Spiel nennen, das es nicht
 * mehr gibt -- etwa nach einer Umbenennung. Dann greift der Ersatz,
 * statt dass die Zeile leer bleibt.
 */
export function spielName(t: Texte, id: string, ersatz: string): string {
  return (t.spiele as Record<string, string | undefined>)[id] ?? ersatz
}
