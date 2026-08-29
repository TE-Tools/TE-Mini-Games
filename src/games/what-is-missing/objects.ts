/**
 * Visual objects for "Was fehlt?".
 * V1 uses emoji glyphs – architecture allows swapping to SVG/image assets later.
 */

export interface GameObject {
  id: string
  label: string
  emoji: string
}

/** Catalog of objects available in Version 1 */
export const OBJECT_CATALOG: readonly GameObject[] = [
  { id: 'apple', label: 'Apfel', emoji: '🍎' },
  { id: 'banana', label: 'Banane', emoji: '🍌' },
  { id: 'car', label: 'Auto', emoji: '🚗' },
  { id: 'tree', label: 'Baum', emoji: '🌳' },
  { id: 'ball', label: 'Ball', emoji: '⚽' },
  { id: 'book', label: 'Buch', emoji: '📚' },
  { id: 'house', label: 'Haus', emoji: '🏠' },
  { id: 'star', label: 'Stern', emoji: '⭐' },
  { id: 'sun', label: 'Sonne', emoji: '☀️' },
  { id: 'moon', label: 'Mond', emoji: '🌙' },
  { id: 'heart', label: 'Herz', emoji: '❤️' },
  { id: 'flower', label: 'Blume', emoji: '🌸' },
  { id: 'fish', label: 'Fisch', emoji: '🐟' },
  { id: 'bird', label: 'Vogel', emoji: '🐦' },
  { id: 'cat', label: 'Katze', emoji: '🐱' },
  { id: 'dog', label: 'Hund', emoji: '🐶' },
  { id: 'cake', label: 'Kuchen', emoji: '🎂' },
  { id: 'gift', label: 'Geschenk', emoji: '🎁' },
  { id: 'key', label: 'Schlüssel', emoji: '🔑' },
  { id: 'clock', label: 'Uhr', emoji: '🕐' },
  { id: 'umbrella', label: 'Schirm', emoji: '☂️' },
  { id: 'rocket', label: 'Rakete', emoji: '🚀' },
  { id: 'bike', label: 'Fahrrad', emoji: '🚲' },
  { id: 'plane', label: 'Flugzeug', emoji: '✈️' },
  { id: 'boat', label: 'Boot', emoji: '⛵' },
  { id: 'cloud', label: 'Wolke', emoji: '☁️' },
  { id: 'fire', label: 'Feuer', emoji: '🔥' },
  { id: 'snow', label: 'Schnee', emoji: '❄️' },
  { id: 'music', label: 'Musik', emoji: '🎵' },
  { id: 'phone', label: 'Telefon', emoji: '📱' },
  { id: 'camera', label: 'Kamera', emoji: '📷' },
  { id: 'lamp', label: 'Lampe', emoji: '💡' },
  { id: 'chair', label: 'Stuhl', emoji: '🪑' },
  { id: 'shoe', label: 'Schuh', emoji: '👟' },
  { id: 'hat', label: 'Hut', emoji: '🎩' },
  { id: 'glasses', label: 'Brille', emoji: '👓' },
  { id: 'pizza', label: 'Pizza', emoji: '🍕' },
  { id: 'ice', label: 'Eis', emoji: '🍦' },
  { id: 'cup', label: 'Tasse', emoji: '☕' },
  { id: 'leaf', label: 'Blatt', emoji: '🍃' },
] as const

export function getObjectById(id: string): GameObject | undefined {
  return OBJECT_CATALOG.find((o) => o.id === id)
}
