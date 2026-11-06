/**
 * Die Startfehler der Partyspiele in der Sprache der Oberfläche.
 *
 * Die Engines (Wer würde eher, Wortbombe, Scharade) werfen deutsche
 * Sätze -- Tests lesen sie, und an den Regeln ändert die Übersetzung
 * nichts. Die Seite merkt sich den deutschen Satz und baut ihn erst beim
 * Rendern neu, so wechselt er mit der Sprache. Ein Satz, den kein Muster
 * kennt, bleibt deutsch statt leer.
 */
import type { Texte } from '@/i18n/sprache'

/** Ein gefangener Fehler als Satz, so wie ihn die Engine geschrieben hat. */
export function fehlerSatz(fehler: unknown): string {
  return fehler instanceof Error ? fehler.message : 'Start fehlgeschlagen'
}

/**
 * Übersetzt einen Startfehler. `eigene` ordnet weitere feste Sätze des
 * jeweiligen Spiels zu (deutscher Satz → angezeigter Text).
 */
export function partyFehler(t: Texte, satz: string, eigene: Record<string, string> = {}): string {
  const g = t.partyGemeinsam
  if (satz === 'Start fehlgeschlagen') return g.startFehlgeschlagen
  const eigener = eigene[satz]
  if (eigener !== undefined) return eigener
  const mindestens = /^Mindestens (\d+) Spieler nötig$/.exec(satz)
  if (mindestens) return g.mindestensSpieler(Number(mindestens[1]))
  const maximal = /^Maximal (\d+) Spieler$/.exec(satz)
  if (maximal) return g.maximalSpieler(Number(maximal[1]))
  const doppelt = /^Name doppelt: (.+)$/.exec(satz)
  if (doppelt) return g.nameDoppelt(doppelt[1]!)
  return satz
}
