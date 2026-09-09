/**
 * Die Knödel zum Sammeln – und der Avatar, den man daraus trägt.
 *
 * Thomas am 09.09.2026: "man kann als Belohnung für schwere Level immer
 * wieder neue Dumplings sammeln und die dann als seinen eigenen Avatar im
 * Spiel haben."
 *
 * Gespeichert wird dafür nichts Eigenes: Freigeschaltet ist, was der
 * erreichte Level hergibt. Das kann nicht auseinanderlaufen, wandert mit dem
 * Spielstand in die Cloud und lässt sich nicht durch Löschen des Browsers
 * aus Versehen verlieren.
 */

export interface SammelKnoedel {
  id: string
  name: string
  /** Füllfarbe des Knödels. */
  hex: string
  /** Zweite Farbe für Muster und Schattierung. */
  akzent: string
  /** Das Gesicht: bestimmt, wie die Augen gezeichnet werden. */
  gesicht: 'froh' | 'zwinker' | 'selig' | 'frech' | 'schlaf' | 'stern'
  /** Ab diesem geschafften Level gehört er dir. */
  abLevel: number
}

export const SAMMEL_KNOEDEL: readonly SammelKnoedel[] = [
  {
    id: 'bao-klassik',
    name: 'Klassischer Bao',
    hex: '#f6ecd9',
    akzent: '#e0cfa8',
    gesicht: 'froh',
    abLevel: 1,
  },
  {
    id: 'bao-rot',
    name: 'Chili-Bao',
    hex: '#e0433f',
    akzent: '#a92c2a',
    gesicht: 'frech',
    abLevel: 5,
  },
  {
    id: 'bao-matcha',
    name: 'Matcha-Bao',
    hex: '#7cb342',
    akzent: '#4f7c22',
    gesicht: 'selig',
    abLevel: 10,
  },
  {
    id: 'bao-taro',
    name: 'Taro-Bao',
    hex: '#8e44ad',
    akzent: '#5f2c76',
    gesicht: 'zwinker',
    abLevel: 20,
  },
  {
    id: 'bao-butterfly',
    name: 'Schmetterlingsblüte',
    hex: '#29b6f6',
    akzent: '#0d7fb3',
    gesicht: 'selig',
    abLevel: 40,
  },
  {
    id: 'bao-custard',
    name: 'Custard-Bao',
    hex: '#f9c22e',
    akzent: '#c28f0c',
    gesicht: 'froh',
    abLevel: 60,
  },
  {
    id: 'bao-sakura',
    name: 'Sakura-Bao',
    hex: '#ec7fa9',
    akzent: '#c2557f',
    gesicht: 'zwinker',
    abLevel: 80,
  },
  {
    id: 'bao-sesam',
    name: 'Schwarzer Sesam',
    hex: '#4a4458',
    akzent: '#241f2e',
    gesicht: 'schlaf',
    abLevel: 100,
  },
  {
    id: 'bao-kuerbis',
    name: 'Kürbis-Bao',
    hex: '#e67e22',
    akzent: '#a9550c',
    gesicht: 'frech',
    abLevel: 130,
  },
  {
    id: 'bao-minze',
    name: 'Minz-Bao',
    hex: '#1abc9c',
    akzent: '#0e7d67',
    gesicht: 'selig',
    abLevel: 160,
  },
  {
    id: 'bao-beere',
    name: 'Beeren-Bao',
    hex: '#c0392b',
    akzent: '#7d2318',
    gesicht: 'zwinker',
    abLevel: 190,
  },
  {
    id: 'bao-milch',
    name: 'Milchbrötchen',
    hex: '#fdf6e8',
    akzent: '#d9c9a5',
    gesicht: 'schlaf',
    abLevel: 220,
  },
  {
    id: 'bao-honig',
    name: 'Honig-Bao',
    hex: '#d99b1c',
    akzent: '#9c6c07',
    gesicht: 'froh',
    abLevel: 250,
  },
  {
    id: 'bao-mond',
    name: 'Mondkuchen',
    hex: '#b8860b',
    akzent: '#7a5807',
    gesicht: 'stern',
    abLevel: 280,
  },
  {
    id: 'bao-gold',
    name: 'Goldener Bao',
    hex: '#f5d76e',
    akzent: '#b8912a',
    gesicht: 'stern',
    abLevel: 300,
  },
]

export const STANDARD_KNOEDEL = SAMMEL_KNOEDEL[0]!

/** Welche Knödel bei diesem Fortschritt schon dir gehören. */
export function freigeschaltet(hoechstesGeschafftesLevel: number): SammelKnoedel[] {
  return SAMMEL_KNOEDEL.filter((k) => k.abLevel <= Math.max(1, hoechstesGeschafftesLevel))
}

/** Ob ein bestimmtes Level einen neuen Knödel bringt. */
export function belohnungFuer(level: number): SammelKnoedel | null {
  return SAMMEL_KNOEDEL.find((k) => k.abLevel === level) ?? null
}

/** Der nächste, den es zu holen gibt -- steht als Ansporn auf der Karte. */
export function naechsteBelohnung(hoechstesGeschafftesLevel: number): SammelKnoedel | null {
  return SAMMEL_KNOEDEL.find((k) => k.abLevel > Math.max(1, hoechstesGeschafftesLevel)) ?? null
}

export function knoedelFuer(id: string | null | undefined): SammelKnoedel {
  return SAMMEL_KNOEDEL.find((k) => k.id === id) ?? STANDARD_KNOEDEL
}
