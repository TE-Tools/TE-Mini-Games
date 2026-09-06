/**
 * Kniffel -- der Block und seine Wertung.
 *
 * Dreizehn Felder, jedes genau einmal. Oben die sechs Zahlen, unten die
 * Kombinationen. Wer oben zusammen 63 Punkte schafft, bekommt 35 dazu --
 * das entspricht dreimal jeder Zahl und ist der Grund, warum man oben
 * nicht einfach die schlechten Würfe abladen sollte.
 *
 * Hier steht nur, was ein Wurf wert ist. Wer wann würfelt, steht in der
 * Engine; wie es aussieht, in der Oberfläche.
 */

export type KategorieId =
  | 'einser'
  | 'zweier'
  | 'dreier'
  | 'vierer'
  | 'fuenfer'
  | 'sechser'
  | 'dreierpasch'
  | 'viererpasch'
  | 'fullHouse'
  | 'kleineStrasse'
  | 'grosseStrasse'
  | 'kniffel'
  | 'chance'

export type Blockteil = 'oben' | 'unten'

export interface KategorieDaten {
  id: KategorieId
  name: string
  teil: Blockteil
  /** Kurzerklärung, die im Block unter dem Namen steht. */
  kurz: string
}

export const KATEGORIEN: readonly KategorieDaten[] = [
  { id: 'einser', name: 'Einser', teil: 'oben', kurz: 'Alle Einser zählen' },
  { id: 'zweier', name: 'Zweier', teil: 'oben', kurz: 'Alle Zweier zählen' },
  { id: 'dreier', name: 'Dreier', teil: 'oben', kurz: 'Alle Dreier zählen' },
  { id: 'vierer', name: 'Vierer', teil: 'oben', kurz: 'Alle Vierer zählen' },
  { id: 'fuenfer', name: 'Fünfer', teil: 'oben', kurz: 'Alle Fünfer zählen' },
  { id: 'sechser', name: 'Sechser', teil: 'oben', kurz: 'Alle Sechser zählen' },
  { id: 'dreierpasch', name: 'Dreierpasch', teil: 'unten', kurz: 'Drei gleiche – alle Augen' },
  { id: 'viererpasch', name: 'Viererpasch', teil: 'unten', kurz: 'Vier gleiche – alle Augen' },
  { id: 'fullHouse', name: 'Full House', teil: 'unten', kurz: 'Drei und zwei gleiche – 25' },
  { id: 'kleineStrasse', name: 'Kleine Straße', teil: 'unten', kurz: 'Vier in Folge – 30' },
  { id: 'grosseStrasse', name: 'Große Straße', teil: 'unten', kurz: 'Fünf in Folge – 40' },
  { id: 'kniffel', name: 'Kniffel', teil: 'unten', kurz: 'Fünf gleiche – 50' },
  { id: 'chance', name: 'Chance', teil: 'unten', kurz: 'Alle Augen zählen' },
] as const

export const KATEGORIE_IDS: readonly KategorieId[] = KATEGORIEN.map((k) => k.id)

/** Ein Block: Feld → Punkte, oder null, solange es noch frei ist. */
export type Block = Record<KategorieId, number | null>

export function leererBlock(): Block {
  const block = {} as Block
  for (const id of KATEGORIE_IDS) block[id] = null
  return block
}

/* ----------------------------------------------------------- Balancing */

export const WUERFEL_ANZAHL = 5
export const WUERFE_JE_ZUG = 3
export const BONUS_GRENZE = 63
export const BONUS_PUNKTE = 35
export const FULL_HOUSE_PUNKTE = 25
export const KLEINE_STRASSE_PUNKTE = 30
export const GROSSE_STRASSE_PUNKTE = 40
export const KNIFFEL_PUNKTE = 50

/**
 * Zählt ein Kniffel als Full House?
 *
 * In den offiziellen Yahtzee-Regeln nicht, in den meisten deutschen
 * Kniffel-Runden schon -- fünf gleiche sind schließlich auch drei gleiche
 * und zwei gleiche. Wir folgen der verbreiteten Hausregel und sagen es im
 * Spiel dazu, damit sich niemand wundert.
 */
export const KNIFFEL_ZAEHLT_ALS_FULL_HOUSE = true

/* ------------------------------------------------------------- Wertung */

/** Wie oft jede Augenzahl vorkommt. Index 1 bis 6. */
export function haeufigkeiten(wuerfel: readonly number[]): number[] {
  const zaehler = [0, 0, 0, 0, 0, 0, 0]
  for (const w of wuerfel) {
    if (w >= 1 && w <= 6) zaehler[w] = (zaehler[w] ?? 0) + 1
  }
  return zaehler
}

export function augensumme(wuerfel: readonly number[]): number {
  return wuerfel.reduce((summe, w) => summe + w, 0)
}

function hatMindestens(wuerfel: readonly number[], gleiche: number): boolean {
  return haeufigkeiten(wuerfel).some((n) => n >= gleiche)
}

function istFullHouse(wuerfel: readonly number[]): boolean {
  const z = haeufigkeiten(wuerfel).filter((n) => n > 0)
  if (z.includes(3) && z.includes(2)) return true
  return KNIFFEL_ZAEHLT_ALS_FULL_HOUSE && z.includes(5)
}

/** Längste Folge aufeinanderfolgender Augenzahlen. */
export function laengsteFolge(wuerfel: readonly number[]): number {
  const da = haeufigkeiten(wuerfel).map((n) => n > 0)
  let beste = 0
  let laufend = 0
  for (let auge = 1; auge <= 6; auge++) {
    if (da[auge]) {
      laufend++
      if (laufend > beste) beste = laufend
    } else {
      laufend = 0
    }
  }
  return beste
}

const ZAHLENFELD: Partial<Record<KategorieId, number>> = {
  einser: 1,
  zweier: 2,
  dreier: 3,
  vierer: 4,
  fuenfer: 5,
  sechser: 6,
}

/**
 * Was ein Wurf in einem Feld einbringt.
 *
 * Wichtig: Ein Feld darf auch mit 0 gestrichen werden -- das gehört zum
 * Spiel. Diese Funktion sagt nur, was der Wurf hergibt, nicht ob es klug
 * ist, ihn dort einzutragen.
 */
export function punkteFuer(kategorie: KategorieId, wuerfel: readonly number[]): number {
  const auge = ZAHLENFELD[kategorie]
  if (auge !== undefined) {
    return (haeufigkeiten(wuerfel)[auge] ?? 0) * auge
  }

  switch (kategorie) {
    case 'dreierpasch':
      return hatMindestens(wuerfel, 3) ? augensumme(wuerfel) : 0
    case 'viererpasch':
      return hatMindestens(wuerfel, 4) ? augensumme(wuerfel) : 0
    case 'fullHouse':
      return istFullHouse(wuerfel) ? FULL_HOUSE_PUNKTE : 0
    case 'kleineStrasse':
      return laengsteFolge(wuerfel) >= 4 ? KLEINE_STRASSE_PUNKTE : 0
    case 'grosseStrasse':
      return laengsteFolge(wuerfel) >= 5 ? GROSSE_STRASSE_PUNKTE : 0
    case 'kniffel':
      return hatMindestens(wuerfel, 5) ? KNIFFEL_PUNKTE : 0
    case 'chance':
      return augensumme(wuerfel)
    default:
      return 0
  }
}

/* --------------------------------------------------------- Blocksummen */

const OBEN: KategorieId[] = KATEGORIEN.filter((k) => k.teil === 'oben').map((k) => k.id)
const UNTEN: KategorieId[] = KATEGORIEN.filter((k) => k.teil === 'unten').map((k) => k.id)

export function obenSumme(block: Block): number {
  return OBEN.reduce((summe, id) => summe + (block[id] ?? 0), 0)
}

export function bonusErreicht(block: Block): boolean {
  return obenSumme(block) >= BONUS_GRENZE
}

export function bonus(block: Block): number {
  return bonusErreicht(block) ? BONUS_PUNKTE : 0
}

/** Wie viel oben noch bis zum Bonus fehlt -- 0, wenn er sicher ist. */
export function bisZumBonus(block: Block): number {
  return Math.max(0, BONUS_GRENZE - obenSumme(block))
}

export function untenSumme(block: Block): number {
  return UNTEN.reduce((summe, id) => summe + (block[id] ?? 0), 0)
}

export function gesamtpunkte(block: Block): number {
  return obenSumme(block) + bonus(block) + untenSumme(block)
}

export function freieFelder(block: Block): KategorieId[] {
  return KATEGORIE_IDS.filter((id) => block[id] === null)
}

export function blockVoll(block: Block): boolean {
  return freieFelder(block).length === 0
}

/** Was der aktuelle Wurf in jedem noch freien Feld brächte. */
export function moeglichePunkte(
  block: Block,
  wuerfel: readonly number[],
): Partial<Record<KategorieId, number>> {
  const ergebnis: Partial<Record<KategorieId, number>> = {}
  for (const id of freieFelder(block)) ergebnis[id] = punkteFuer(id, wuerfel)
  return ergebnis
}

export function kategorie(id: KategorieId): KategorieDaten {
  const k = KATEGORIEN.find((x) => x.id === id)
  if (!k) throw new Error(`Unbekanntes Feld: ${id}`)
  return k
}
