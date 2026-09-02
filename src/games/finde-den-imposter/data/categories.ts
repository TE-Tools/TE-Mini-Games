import type { CategoryDef } from '../types'

/** Built-in categories for classic mode. Expand toward 40+. */
export const CATEGORIES: CategoryDef[] = [
  { id: 'tiere', label: 'Tiere' },
  { id: 'essen', label: 'Essen & Trinken' },
  { id: 'berufe', label: 'Berufe' },
  { id: 'sport', label: 'Sport' },
  { id: 'reisen', label: 'Reisen & Orte' },
  { id: 'technik', label: 'Technik' },
  { id: 'filme', label: 'Filme & Serien' },
  { id: 'musik', label: 'Musik' },
  { id: 'schule', label: 'Schule & Lernen' },
  { id: 'haus', label: 'Haus & Wohnen' },
  { id: 'natur', label: 'Natur & Wetter' },
  { id: 'koerper', label: 'Körper & Gesundheit' },
  { id: 'kleidung', label: 'Kleidung' },
  { id: 'fahrzeuge', label: 'Fahrzeuge' },
  { id: 'spiele', label: 'Spiele & Hobbys' },
  { id: 'feiertage', label: 'Feiertage & Feste' },
  { id: 'gefuehle', label: 'Gefühle' },
  { id: 'stadt', label: 'Stadt & Alltag' },
  { id: 'maerchen', label: 'Märchen & Fantasie' },
  { id: 'beruehmt', label: 'Berühmte Personen' },
]

export function categoryById(id: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.id === id)
}

export function categoryLabel(id: string): string {
  return categoryById(id)?.label ?? id
}
