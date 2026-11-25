/**
 * Ein Bild je eingebauter Kategorie -- nur für die Auswahl. Die Kennungen
 * der englischen Listen tragen das Präfix `en-` und bekommen dasselbe Bild.
 */
const ICONS: Record<string, string> = {
  tiere: '🐾',
  essen: '🍕',
  berufe: '👷',
  sport: '⚽',
  reisen: '✈️',
  technik: '💻',
  filme: '🎬',
  musik: '🎵',
  schule: '📚',
  haus: '🏠',
  natur: '🌦️',
  koerper: '💪',
  kleidung: '👕',
  fahrzeuge: '🚗',
  spiele: '🎲',
  feiertage: '🎉',
  gefuehle: '😊',
  stadt: '🏙️',
  maerchen: '🧚',
  beruehmt: '⭐',
}

/** Eigene Listen (und unbekannte Kennungen) bekommen den Stift. */
export const EIGENE_ICON = '✍️'

export function kategorieIcon(id: string): string {
  return ICONS[id.replace(/^en-/, '')] ?? EIGENE_ICON
}
