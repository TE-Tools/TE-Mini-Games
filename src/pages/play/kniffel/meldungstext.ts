import { ZUSATZ_KNIFFEL_PUNKTE, type KniffelZustand } from '@/games/kniffel'
import type { Texte } from '@/i18n/sprache'

/**
 * Die letzte Meldung der Partie in der Sprache der Oberfläche.
 *
 * Das Protokoll der Engine bleibt deutsch; daneben führt sie die letzte
 * Meldung als Daten. Partien, die vor dem 06.11.2026 begonnen wurden,
 * haben die noch nicht -- dann gilt die letzte Protokollzeile.
 */
export function meldungstext(t: Texte, zustand: KniffelZustand): string | undefined {
  const m = zustand.meldung
  if (!m) return zustand.protokoll[zustand.protokoll.length - 1]
  const w = t.kniffel.meldung
  switch (m.art) {
    case 'start':
      return w.start
    case 'eingetragen':
    case 'gestrichen': {
      const zug = m.art === 'eingetragen' ? w.eingetragen(m.name, m.punkte) : w.gestrichen(m.name)
      return m.zusatz ? `${w.zusatz(m.name, ZUSATZ_KNIFFEL_PUNKTE)} ${zug}` : zug
    }
    case 'sieg':
      return w.sieg(m.name, m.punkte)
    case 'endstand':
      return w.endstand(m.punkte)
  }
}
