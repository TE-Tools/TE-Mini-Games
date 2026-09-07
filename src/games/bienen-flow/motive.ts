/**
 * Die Pixelbilder, die gefüllt werden.
 *
 * Im Original ist das Ziel ein Pixelbild -- daraus ergibt sich, wie viele
 * Pollen jede Farbe braucht. Ohne Bild gäbe es keinen Grund zu liefern, und
 * die Zahlen auf den Blöcken wären willkürlich.
 *
 * Geschrieben als Zeichenraster, weil man ein Motiv so beim Lesen erkennt.
 * Ein Punkt ist Luft. Die Buchstaben stehen für die Farben aus COLOR_HEX:
 *
 *   R rot · B blau · N grün · G gelb · L lila · O orange
 *   T türkis · P rosa · D dunkel · H hell
 *
 * Größere Level nehmen dasselbe Motiv in doppelter Kantenlänge (skalieren):
 * Das vervierfacht die Pollenzahl, ohne dass das Bild unkenntlich wird.
 */

import type { CellColor } from './types'

const FARBEN: Record<string, CellColor> = {
  R: 1,
  B: 2,
  N: 3,
  G: 4,
  L: 5,
  O: 6,
  T: 7,
  P: 8,
  D: 9,
  H: 10,
}

export interface Motiv {
  name: string
  zeilen: string[]
}

export const MOTIVE: Motiv[] = [
  {
    name: 'Biene',
    zeilen: [
      '..DDDD..',
      '.DGGGGD.',
      'DGDDGGGD',
      'DGGGGGGD',
      '.DGDDGD.',
      '..DDDD..',
    ],
  },
  {
    name: 'Blume',
    zeilen: [
      '.PP.PP.',
      'PPPPPPP',
      'PPGGGPP',
      'PPGGGPP',
      'PPPPPPP',
      '.PPNPP.',
      '...N...',
      '..NNN..',
    ],
  },
  {
    name: 'Wabe',
    zeilen: [
      '..GGGG..',
      '.GGGGGG.',
      'GGGDDGGG',
      'GGDDDDGG',
      'GGGDDGGG',
      '.GGGGGG.',
      '..GGGG..',
    ],
  },
  {
    name: 'Marienkäfer',
    zeilen: [
      '..DDDD..',
      '.RRDDRR.',
      'RDRRRRDR',
      'RRRDDRRR',
      'RDRRRRDR',
      '.RRDDRR.',
      '..RRRR..',
    ],
  },
  {
    name: 'Sonne',
    zeilen: [
      '..O.O.O..',
      '.OGGGGGO.',
      '.GGGGGGG.',
      'OGGDGDGGO',
      '.GGGGGGG.',
      '.GGGDGGG.',
      '.OGGGGGO.',
      '..O.O.O..',
    ],
  },
  {
    name: 'Schmetterling',
    zeilen: [
      'LL.DD.LL',
      'LLLDDLLL',
      '.LLDDLL.',
      '..LDDL..',
      '.TTDDTT.',
      'TTTDDTTT',
      'TT.DD.TT',
    ],
  },
  {
    name: 'Pilz',
    zeilen: [
      '..RRRR..',
      '.RRHRRR.',
      'RRRRRHRR',
      'RHRRRRRR',
      '..HHHH..',
      '..HDDH..',
      '..HHHH..',
    ],
  },
  {
    name: 'Herz',
    zeilen: [
      '.RR.RR.',
      'RRRRRRR',
      'RRRRRRR',
      '.RRRRR.',
      '..RRR..',
      '...R...',
    ],
  },
  {
    name: 'Baum',
    zeilen: [
      '..NNN..',
      '.NNNNN.',
      'NNNNNNN',
      '.NNNNN.',
      '..NNN..',
      '...O...',
      '...O...',
      '..OOO..',
    ],
  },
  {
    name: 'Krone',
    zeilen: [
      'G.G.G.G',
      'GGGGGGG',
      'GGBGBGG',
      'GGGGGGG',
      'OOOOOOO',
    ],
  },
  {
    name: 'Honigglas',
    zeilen: [
      '.DDDDD.',
      '.HHHHH.',
      'DGGGGGD',
      'DGGDGGD',
      'DGGGGGD',
      'DGGGGGD',
      '.DDDDD.',
    ],
  },
  {
    name: 'Regenschirm',
    zeilen: [
      '..BBBBB..',
      '.BBRRRBB.',
      'BBRRRRRBB',
      '....D....',
      '....D....',
      '...DD....',
    ],
  },
]


/**
 * Reiche Motive für die späteren Abschnitte.
 *
 * Warum eigene: Die einfachen oben haben zwei bis drei Farben, und jede
 * Farbe bringt nur zwei, drei Blöcke mit. Das sind zu wenige Entscheidungen
 * für ein spätes Level. Diese hier haben fünf bis sieben Farben -- damit
 * wird der Nachschub voll und das Mitzählen zur eigentlichen Aufgabe.
 */
export const REICHE_MOTIVE: Motiv[] = [
  {
    name: 'Blumenstrauß',
    zeilen: [
      '.PP..RR..BB.',
      'PPPP.RRRR.BB',
      'PPGP.RGGR.BG',
      'PPPP.RRRR.BB',
      '.PP.N.RR.NBB',
      '...N.N.N.N..',
      '..NN.N.NN...',
      '...DDDDDD...',
      '...DHHHHD...',
      '...DDDDDD...',
    ],
  },
  {
    name: 'Bienenstock',
    zeilen: [
      '...DDDD...',
      '..GGGGGG..',
      '.GGOOOOGG.',
      'GGOOGGOOGG',
      'GGOODDOOGG',
      '.GGOOOOGG.',
      '..GGGGGG..',
      '...HDDH...',
      '..N.DD.N..',
      '..NN..NN..',
    ],
  },
  {
    name: 'Regenbogen',
    zeilen: [
      '..RRRRRR..',
      '.RROOOORR.',
      'ROOGGGGOOR',
      'OOGGNNGGOO',
      'GGNNTTNNGG',
      'NNTTBBTTNN',
      '.TT.BB.TT.',
      'HH......HH',
      'HHH....HHH',
    ],
  },
  {
    name: 'Torte',
    zeilen: [
      '....R.....',
      '...RRR....',
      '..GGGGGG..',
      '.PPPPPPPP.',
      'HHHHHHHHHH',
      'DDDDDDDDDD',
      'HHHHHHHHHH',
      'OOOOOOOOOO',
      '.DDDDDDDD.',
    ],
  },
  {
    name: 'Rakete',
    zeilen: [
      '....RR....',
      '...RRRR...',
      '..HHTTHH..',
      '..HHTTHH..',
      '..HHHHHH..',
      '.RHHHHHHR.',
      'RRHDDDDHRR',
      '..O.GG.O..',
      '...OGGO...',
      '....GG....',
    ],
  },
  {
    name: 'Käfer im Klee',
    zeilen: [
      '.PP..DD..GG.',
      'PPPP.DD.GGGG',
      '.PP.RRRR.GG.',
      '..NRDRRDRN..',
      '..RRRDDRRR..',
      '..RDRRRRDR..',
      '.N.RRRRRR.N.',
      'NNN..RR..NNN',
      '.N..HHHH..N.',
      '..HHHHHHHH..',
    ],
  },
]


/**
 * Geschichtete Motive – die Bauart, die das Original für die frühen Level
 * benutzt.
 *
 * Thomas' Video zeigt in Level 1 einen Stern in drei sauberen Ringen: außen
 * orange, darunter gelb, im Kern weiß. Dadurch sieht man das Abtragen von
 * außen nach innen sofort -- bei einem gemalten Motiv (Biene, Torte) liegen
 * die Schichten nur zufällig übereinander.
 *
 * Erzeugt werden sie aus einer Form: Für jedes Feld wird gezählt, wie viele
 * Schritte es bis nach draußen sind. Aus dieser Tiefe wird die Farbe -- Tiefe
 * 1 ist der äußere Ring, Tiefe 2 der nächste, alles Tiefere der Kern.
 */
function schichten(name: string, form: string[], farben: string[]): Motiv {
  const hoehe = form.length
  const breite = Math.max(...form.map((z) => z.length))
  const drin = (r: number, c: number) =>
    r >= 0 && r < hoehe && c >= 0 && c < breite && (form[r]?.[c] ?? '.') !== '.'

  // Tiefe je Feld: Vielquellen-Suche von außen nach innen.
  const tiefe = new Array(hoehe * breite).fill(0)
  let rand: number[] = []
  for (let r = 0; r < hoehe; r++) {
    for (let c = 0; c < breite; c++) {
      if (!drin(r, c)) continue
      const amRand =
        !drin(r - 1, c) || !drin(r + 1, c) || !drin(r, c - 1) || !drin(r, c + 1)
      if (amRand) {
        tiefe[r * breite + c] = 1
        rand.push(r * breite + c)
      }
    }
  }
  let stufe = 1
  while (rand.length > 0) {
    const naechste: number[] = []
    for (const i of rand) {
      const r = Math.floor(i / breite)
      const c = i % breite
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const nr = r + dr
        const nc = c + dc
        if (!drin(nr, nc)) continue
        const ni = nr * breite + nc
        if (tiefe[ni] !== 0) continue
        tiefe[ni] = stufe + 1
        naechste.push(ni)
      }
    }
    rand = naechste
    stufe++
  }

  const zeilen: string[] = []
  for (let r = 0; r < hoehe; r++) {
    let zeile = ''
    for (let c = 0; c < breite; c++) {
      const t = tiefe[r * breite + c]!
      zeile += t === 0 ? '.' : farben[Math.min(t - 1, farben.length - 1)]!
    }
    zeilen.push(zeile)
  }
  return { name, zeilen }
}

export const SCHICHT_MOTIVE: Motiv[] = [
  schichten(
    'Stern',
    [
      '.....#.....',
      '.....#.....',
      '....###....',
      '###########',
      '.#########.',
      '..#######..',
      '..#######..',
      '.###...###.',
      '.##.....##.',
      '.#.......#.',
    ],
    ['O', 'G', 'H'],
  ),
  schichten(
    'Herz',
    [
      '..###.###..',
      '.#########.',
      '###########',
      '###########',
      '.#########.',
      '..#######..',
      '...#####...',
      '....###....',
      '.....#.....',
    ],
    ['R', 'P', 'H'],
  ),
  schichten(
    'Wabe',
    [
      '...#####...',
      '..#######..',
      '.#########.',
      '###########',
      '###########',
      '###########',
      '.#########.',
      '..#######..',
      '...#####...',
    ],
    ['D', 'G', 'O', 'H'],
  ),
  schichten(
    'Raute',
    [
      '.....#.....',
      '....###....',
      '...#####...',
      '..#######..',
      '.#########.',
      '..#######..',
      '...#####...',
      '....###....',
      '.....#.....',
    ],
    ['B', 'T', 'H'],
  ),
  schichten(
    'Kreis',
    [
      '...#####...',
      '.#########.',
      '.#########.',
      '###########',
      '###########',
      '###########',
      '.#########.',
      '.#########.',
      '...#####...',
    ],
    ['N', 'G', 'R'],
  ),
  schichten(
    'Kreuz',
    [
      '...#####...',
      '...#####...',
      '...#####...',
      '###########',
      '###########',
      '###########',
      '...#####...',
      '...#####...',
      '...#####...',
    ],
    ['L', 'B', 'H'],
  ),
  schichten(
    'Blüte',
    [
      '..##...##..',
      '.####.####.',
      '.#########.',
      '..#######..',
      '###########',
      '..#######..',
      '.#########.',
      '.####.####.',
      '..##...##..',
    ],
    ['P', 'G', 'O'],
  ),
  schichten(
    'Turm',
    [
      '#.#.#.#.#.#',
      '###########',
      '###########',
      '.#########.',
      '.#########.',
      '.#########.',
      '.#########.',
      '###########',
      '###########',
    ],
    ['D', 'H', 'B', 'G'],
  ),
]

/** Motiv in ein Raster übersetzen, bei Bedarf vergrößert. */
export function motivRaster(
  motiv: Motiv,
  skala = 1,
): { rows: number; cols: number; bild: CellColor[] } {
  const hoehe = motiv.zeilen.length
  const breite = Math.max(...motiv.zeilen.map((z) => z.length))
  const rows = hoehe * skala
  const cols = breite * skala
  const bild: CellColor[] = new Array(rows * cols).fill(0)
  for (let r = 0; r < hoehe; r++) {
    const zeile = motiv.zeilen[r]!
    for (let c = 0; c < breite; c++) {
      const farbe = FARBEN[zeile[c] ?? '.'] ?? 0
      if (farbe === 0) continue
      for (let dr = 0; dr < skala; dr++) {
        for (let dc = 0; dc < skala; dc++) {
          bild[(r * skala + dr) * cols + (c * skala + dc)] = farbe
        }
      }
    }
  }
  return { rows, cols, bild }
}

/** Wie viele Pixel jede Farbe hat -- das ist der Bedarf des Levels. */
export function bedarfJeFarbe(bild: CellColor[]): number[] {
  const offen: number[] = []
  for (const c of bild) {
    if (c === 0) continue
    offen[c] = (offen[c] ?? 0) + 1
  }
  for (let i = 0; i < offen.length; i++) if (offen[i] === undefined) offen[i] = 0
  return offen
}
