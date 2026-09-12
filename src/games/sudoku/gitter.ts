/**
 * Sudoku -- das Gitter und seine Nachbarschaften.
 *
 * Alles, was mit "wo liegt was" zu tun hat, steht hier einmal: Zeilen,
 * Spalten, Kästen, und für jede Zelle die zwanzig Zellen, mit denen sie
 * sich eine Einheit teilt. Löser, Bewertung, Generator und Anzeige rechnen
 * alle mit denselben Tabellen.
 *
 * Ziffern stecken als Bitmasken in Zahlen: Bit `d` steht für die Ziffer d
 * (1 … 9). Das macht Kandidatenmengen zu einer einzigen Zahl, und die
 * Techniken werden zu Und/Oder auf Zahlen statt zu Schleifen über Arrays.
 */

export const N = 9
export const ZELLEN = 81
export const ALLE_ZIFFERN = 0b1111111110 // Bits 1..9

/** Ein Gitter: 81 Werte, 0 = leer. */
export type Gitter = Uint8Array

export function zeileVon(zelle: number): number {
  return Math.floor(zelle / N)
}

export function spalteVon(zelle: number): number {
  return zelle % N
}

export function kastenVon(zelle: number): number {
  return Math.floor(zeileVon(zelle) / 3) * 3 + Math.floor(spalteVon(zelle) / 3)
}

export function zelleVon(zeile: number, spalte: number): number {
  return zeile * N + spalte
}

/** Die neun Zeilen, dann die neun Spalten, dann die neun Kästen. */
export const ZEILEN: readonly (readonly number[])[] = Array.from({ length: N }, (_, r) =>
  Array.from({ length: N }, (_, c) => zelleVon(r, c)),
)
export const SPALTEN: readonly (readonly number[])[] = Array.from({ length: N }, (_, c) =>
  Array.from({ length: N }, (_, r) => zelleVon(r, c)),
)
export const KAESTEN: readonly (readonly number[])[] = Array.from({ length: N }, (_, k) => {
  const r0 = Math.floor(k / 3) * 3
  const c0 = (k % 3) * 3
  const zellen: number[] = []
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) zellen.push(zelleVon(r0 + r, c0 + c))
  return zellen
})
export const EINHEITEN: readonly (readonly number[])[] = [...ZEILEN, ...SPALTEN, ...KAESTEN]

/** Die zwanzig Zellen, die eine Zelle "sieht". */
export const NACHBARN: readonly (readonly number[])[] = Array.from({ length: ZELLEN }, (_, i) => {
  const menge = new Set<number>()
  for (const z of ZEILEN[zeileVon(i)]!) menge.add(z)
  for (const z of SPALTEN[spalteVon(i)]!) menge.add(z)
  for (const z of KAESTEN[kastenVon(i)]!) menge.add(z)
  menge.delete(i)
  return [...menge].sort((a, b) => a - b)
})

export function sehenSich(a: number, b: number): boolean {
  return (
    a !== b &&
    (zeileVon(a) === zeileVon(b) || spalteVon(a) === spalteVon(b) || kastenVon(a) === kastenVon(b))
  )
}

/** Wie viele Bits gesetzt sind. */
export function anzahlBits(maske: number): number {
  let n = 0
  let m = maske
  while (m) {
    m &= m - 1
    n++
  }
  return n
}

/** Die Ziffern einer Maske, aufsteigend. */
export function ziffernVon(maske: number): number[] {
  const aus: number[] = []
  for (let d = 1; d <= N; d++) if (maske & (1 << d)) aus.push(d)
  return aus
}

/** Die einzige Ziffer einer Ein-Bit-Maske (sonst 0). */
export function einzigeZiffer(maske: number): number {
  if (maske === 0 || (maske & (maske - 1)) !== 0) return 0
  return 31 - Math.clz32(maske)
}

/** Aus "53..7...." (81 Zeichen, . oder 0 für leer) ein Gitter. */
export function parse(text: string): Gitter {
  const sauber = text.replace(/[^0-9.]/g, '')
  if (sauber.length !== ZELLEN) {
    throw new Error(`Sudoku braucht ${ZELLEN} Zeichen, bekam ${sauber.length}`)
  }
  const g = new Uint8Array(ZELLEN)
  for (let i = 0; i < ZELLEN; i++) {
    const ch = sauber[i]!
    g[i] = ch === '.' ? 0 : Number(ch)
  }
  return g
}

export function alsText(g: Gitter): string {
  let s = ''
  for (let i = 0; i < ZELLEN; i++) s += g[i] === 0 ? '.' : String(g[i])
  return s
}

/** Anzahl der vorgegebenen (gefüllten) Zellen. */
export function anzahlVorgaben(g: Gitter): number {
  let n = 0
  for (let i = 0; i < ZELLEN; i++) if (g[i] !== 0) n++
  return n
}

/** Verstößt eine gefüllte Zelle gegen eine Nachbarzelle? */
export function hatKonflikt(g: Gitter, zelle: number): boolean {
  const w = g[zelle]
  if (!w) return false
  for (const n of NACHBARN[zelle]!) if (g[n] === w) return true
  return false
}

/** Keine Ziffer doppelt in einer Einheit -- egal, ob voll oder nicht. */
export function istGueltig(g: Gitter): boolean {
  for (const einheit of EINHEITEN) {
    let gesehen = 0
    for (const z of einheit) {
      const w = g[z]!
      if (w === 0) continue
      if (gesehen & (1 << w)) return false
      gesehen |= 1 << w
    }
  }
  return true
}

/** Voll und gültig. */
export function istGeloest(g: Gitter): boolean {
  for (let i = 0; i < ZELLEN; i++) if (g[i] === 0) return false
  return istGueltig(g)
}

/** Welche Ziffern in einer leeren Zelle noch möglich sind. */
export function kandidatenFuer(g: Gitter, zelle: number): number {
  if (g[zelle] !== 0) return 0
  let belegt = 0
  for (const n of NACHBARN[zelle]!) belegt |= 1 << g[n]!
  return ALLE_ZIFFERN & ~belegt
}
