/**
 * Visual objects for "Was fehlt?".
 * V1 uses emoji glyphs – architecture allows swapping to SVG/image assets later.
 */

export interface GameObject {
  id: string
  label: string
  emoji: string
  /**
   * Objects that look alike share a family (a brown and a green chair, a red
   * and a green apple). Later levels deliberately show several members of one
   * family, so remembering "there was a heart" is no longer enough.
   */
  family?: string
}

/** Catalog of objects available in Version 1 */
export const OBJECT_CATALOG: readonly GameObject[] = [
  { id: 'apple', label: 'Apfel', emoji: '🍎', family: 'apple' },
  { id: 'banana', label: 'Banane', emoji: '🍌' },
  { id: 'car', label: 'Auto', emoji: '🚗', family: 'car' },
  { id: 'tree', label: 'Baum', emoji: '🌳', family: 'tree' },
  { id: 'ball', label: 'Ball', emoji: '⚽', family: 'ball' },
  { id: 'book', label: 'Buch', emoji: '📚', family: 'book' },
  { id: 'house', label: 'Haus', emoji: '🏠', family: 'house' },
  { id: 'star', label: 'Stern', emoji: '⭐', family: 'star' },
  { id: 'sun', label: 'Sonne', emoji: '☀️' },
  { id: 'moon', label: 'Mond', emoji: '🌙', family: 'moon' },
  { id: 'heart', label: 'Herz', emoji: '❤️', family: 'heart' },
  { id: 'flower', label: 'Blume', emoji: '🌸', family: 'flower' },
  { id: 'fish', label: 'Fisch', emoji: '🐟', family: 'fish' },
  { id: 'bird', label: 'Vogel', emoji: '🐦', family: 'bird' },
  { id: 'cat', label: 'Katze', emoji: '🐱', family: 'cat' },
  { id: 'dog', label: 'Hund', emoji: '🐶' },
  { id: 'cake', label: 'Kuchen', emoji: '🎂' },
  { id: 'gift', label: 'Geschenk', emoji: '🎁' },
  { id: 'key', label: 'Schlüssel', emoji: '🔑' },
  { id: 'clock', label: 'Uhr', emoji: '🕐', family: 'clock' },
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
  { id: 'chair', label: 'Stuhl', emoji: '🪑', family: 'chair' },
  { id: 'shoe', label: 'Schuh', emoji: '👟', family: 'shoe' },
  { id: 'hat', label: 'Hut', emoji: '🎩', family: 'hat' },
  { id: 'glasses', label: 'Brille', emoji: '👓' },
  { id: 'pizza', label: 'Pizza', emoji: '🍕' },
  { id: 'ice', label: 'Eis', emoji: '🍦' },
  { id: 'cup', label: 'Tasse', emoji: '☕', family: 'cup' },
  { id: 'leaf', label: 'Blatt', emoji: '🍃' },
  // --- look-alike variants: same shape, different colour/kind -------------
  { id: 'apple-green', label: 'Apfel grün', emoji: '🍏', family: 'apple' },
  { id: 'heart-green', label: 'Herz grün', emoji: '💚', family: 'heart' },
  { id: 'heart-blue', label: 'Herz blau', emoji: '💙', family: 'heart' },
  { id: 'heart-yellow', label: 'Herz gelb', emoji: '💛', family: 'heart' },
  { id: 'car-blue', label: 'Auto blau', emoji: '🚙', family: 'car' },
  { id: 'car-taxi', label: 'Taxi', emoji: '🚕', family: 'car' },
  { id: 'circle-red', label: 'Kreis rot', emoji: '🔴', family: 'circle' },
  { id: 'circle-green', label: 'Kreis grün', emoji: '🟢', family: 'circle' },
  { id: 'circle-blue', label: 'Kreis blau', emoji: '🔵', family: 'circle' },
  { id: 'circle-yellow', label: 'Kreis gelb', emoji: '🟡', family: 'circle' },
  { id: 'square-red', label: 'Quadrat rot', emoji: '🟥', family: 'square' },
  { id: 'square-green', label: 'Quadrat grün', emoji: '🟩', family: 'square' },
  { id: 'square-blue', label: 'Quadrat blau', emoji: '🟦', family: 'square' },
  { id: 'book-red', label: 'Buch rot', emoji: '📕', family: 'book' },
  { id: 'book-green', label: 'Buch grün', emoji: '📗', family: 'book' },
  { id: 'book-blue', label: 'Buch blau', emoji: '📘', family: 'book' },
  { id: 'flower-red', label: 'Blume rot', emoji: '🌺', family: 'flower' },
  { id: 'flower-yellow', label: 'Sonnenblume', emoji: '🌻', family: 'flower' },
  { id: 'flower-tulip', label: 'Tulpe', emoji: '🌷', family: 'flower' },
  { id: 'ball-basket', label: 'Basketball', emoji: '🏀', family: 'ball' },
  { id: 'ball-tennis', label: 'Tennisball', emoji: '🎾', family: 'ball' },
  { id: 'ball-volley', label: 'Volleyball', emoji: '🏐', family: 'ball' },
  { id: 'cat-black', label: 'Katze schwarz', emoji: '🐈\u200d⬛', family: 'cat' },
  { id: 'house-garden', label: 'Haus mit Garten', emoji: '🏡', family: 'house' },
  { id: 'tree-fir', label: 'Tanne', emoji: '🌲', family: 'tree' },
  { id: 'tree-palm', label: 'Palme', emoji: '🌴', family: 'tree' },
  { id: 'clock-alarm', label: 'Wecker', emoji: '⏰', family: 'clock' },
  { id: 'clock-watch', label: 'Armbanduhr', emoji: '⌚', family: 'clock' },
  { id: 'moon-full', label: 'Vollmond', emoji: '🌕', family: 'moon' },
  { id: 'star-glow', label: 'Funkelstern', emoji: '🌟', family: 'star' },
  { id: 'bird-parrot', label: 'Papagei', emoji: '🦜', family: 'bird' },
  { id: 'bird-owl', label: 'Eule', emoji: '🦉', family: 'bird' },
  { id: 'fish-tropical', label: 'Tropenfisch', emoji: '🐠', family: 'fish' },
  { id: 'fish-puffer', label: 'Kugelfisch', emoji: '🐡', family: 'fish' },
  { id: 'cup-tea', label: 'Tee', emoji: '🍵', family: 'cup' },
  { id: 'hat-cap', label: 'Mütze', emoji: '🧢', family: 'hat' },
  { id: 'shoe-boot', label: 'Stiefel', emoji: '🥾', family: 'shoe' },
  { id: 'couch', label: 'Sofa', emoji: '🛋️', family: 'chair' },
] as const

export function getObjectById(id: string): GameObject | undefined {
  return OBJECT_CATALOG.find((o) => o.id === id)
}

/** All look-alike families that have at least two members. */
export function objectFamilies(): Map<string, GameObject[]> {
  const map = new Map<string, GameObject[]>()
  for (const o of OBJECT_CATALOG) {
    if (!o.family) continue
    const list = map.get(o.family) ?? []
    list.push(o)
    map.set(o.family, list)
  }
  for (const [family, list] of map) {
    if (list.length < 2) map.delete(family)
  }
  return map
}
