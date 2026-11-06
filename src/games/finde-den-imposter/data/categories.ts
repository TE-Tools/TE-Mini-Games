import type { CategoryDef, WortSprache } from '../types'

/**
 * Die eingebauten Kategorien -- je Sprache ein eigener Satz. Die englischen
 * sind keine Übersetzung der deutschen, sondern eigene Listen mit eigenen
 * Wörtern (words.en.ts); ihre Kennung trägt das Präfix `en-`, damit sie
 * online neben den deutschen in fdi_categories stehen können.
 */
export const CATEGORIES: CategoryDef[] = [
  { id: 'tiere', label: 'Tiere', sprache: 'de' },
  { id: 'essen', label: 'Essen & Trinken', sprache: 'de' },
  { id: 'berufe', label: 'Berufe', sprache: 'de' },
  { id: 'sport', label: 'Sport', sprache: 'de' },
  { id: 'reisen', label: 'Reisen & Orte', sprache: 'de' },
  { id: 'technik', label: 'Technik', sprache: 'de' },
  { id: 'filme', label: 'Filme & Serien', sprache: 'de' },
  { id: 'musik', label: 'Musik', sprache: 'de' },
  { id: 'schule', label: 'Schule & Lernen', sprache: 'de' },
  { id: 'haus', label: 'Haus & Wohnen', sprache: 'de' },
  { id: 'natur', label: 'Natur & Wetter', sprache: 'de' },
  { id: 'koerper', label: 'Körper & Gesundheit', sprache: 'de' },
  { id: 'kleidung', label: 'Kleidung', sprache: 'de' },
  { id: 'fahrzeuge', label: 'Fahrzeuge', sprache: 'de' },
  { id: 'spiele', label: 'Spiele & Hobbys', sprache: 'de' },
  { id: 'feiertage', label: 'Feiertage & Feste', sprache: 'de' },
  { id: 'gefuehle', label: 'Gefühle', sprache: 'de' },
  { id: 'stadt', label: 'Stadt & Alltag', sprache: 'de' },
  { id: 'maerchen', label: 'Märchen & Fantasie', sprache: 'de' },
  { id: 'beruehmt', label: 'Berühmte Personen', sprache: 'de' },

  { id: 'en-tiere', label: 'Animals', sprache: 'en' },
  { id: 'en-essen', label: 'Food & Drink', sprache: 'en' },
  { id: 'en-berufe', label: 'Jobs', sprache: 'en' },
  { id: 'en-sport', label: 'Sports', sprache: 'en' },
  { id: 'en-reisen', label: 'Travel & Places', sprache: 'en' },
  { id: 'en-technik', label: 'Technology', sprache: 'en' },
  { id: 'en-filme', label: 'Films & TV', sprache: 'en' },
  { id: 'en-musik', label: 'Music', sprache: 'en' },
  { id: 'en-schule', label: 'School', sprache: 'en' },
  { id: 'en-haus', label: 'Home', sprache: 'en' },
  { id: 'en-natur', label: 'Nature & Weather', sprache: 'en' },
  { id: 'en-koerper', label: 'Body & Health', sprache: 'en' },
  { id: 'en-kleidung', label: 'Clothes', sprache: 'en' },
  { id: 'en-fahrzeuge', label: 'Vehicles', sprache: 'en' },
  { id: 'en-spiele', label: 'Games & Hobbies', sprache: 'en' },
  { id: 'en-feiertage', label: 'Holidays & Celebrations', sprache: 'en' },
  { id: 'en-gefuehle', label: 'Feelings', sprache: 'en' },
  { id: 'en-stadt', label: 'Town & City', sprache: 'en' },
  { id: 'en-maerchen', label: 'Fairy Tales & Fantasy', sprache: 'en' },
  { id: 'en-beruehmt', label: 'Famous People', sprache: 'en' },
]

/** Die Kategorien einer Sprache, in der Reihenfolge oben. */
export function categoriesFor(sprache: WortSprache): CategoryDef[] {
  return CATEGORIES.filter((c) => c.sprache === sprache)
}

export function categoryById(id: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.id === id)
}

export function categoryLabel(id: string): string {
  return categoryById(id)?.label ?? id
}
