/**
 * Bienen-Flow – 100 Level, Abschnitte à 20 mit Tor.
 *
 * Ein Level besteht aus zwei Teilen: dem Motiv (daraus ergibt sich, wie viele
 * Pollen jede Farbe braucht) und dem Nachschub (Blöcke mit Farbe und Anzahl,
 * in vier Spalten gestapelt).
 *
 * Die eigentliche Aufgabe des Erzeugers ist, dass es aufgeht UND wehtut:
 *
 *  - Zu jeder Farbe gibt es Blöcke, die zusammen genau ihren Bedarf ergeben.
 *    Ohne die wäre das Level unlösbar.
 *  - Dazu kommt Überschuss: einzelne Blöcke zu viel. Wer sie hochschickt,
 *    liefert nur noch, was das Bild braucht -- der Rest bleibt im Block
 *    liegen und der Platz ist für den Rest des Levels verloren. Fünf solcher
 *    Plätze beenden das Level.
 *  - Weil immer nur der oberste Block einer Spalte antippbar ist, muss man
 *    manchmal durch einen Überschussblock hindurch, um an den darunter zu
 *    kommen. Genau da liegt die Entscheidung.
 *
 * Die Zahlen unten sind am Löser eingestellt, nicht geraten (siehe
 * tests/bienen-flow.test.ts: dort wird jedes der 100 Level durchgerechnet).
 */

import { SEGMENT_SIZE, isSegmentGate, segmentIndexForLevel } from '@/progression/zones'
import { MOTIVE, REICHE_MOTIVE, motivRaster, bedarfJeFarbe } from './motive'
import {
  BIENEN_MAX_LEVEL,
  SLOT_COUNT,
  SPALTEN,
  type BienenBlock,
  type BienenLevel,
} from './types'

function mulberry(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n))
}

function mische<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
  }
}

/** 0.35 = ganz leicht … 1.35 = Tor. */
function waveFactor(posInSeg: number): number {
  if (posInSeg >= 19) return 1.35
  if (posInSeg <= 6) return 0.35 + (posInSeg / 6) * 0.25
  if (posInSeg <= 13) return 0.6 + ((posInSeg - 7) / 6) * 0.45
  return 0.55 + ((posInSeg - 14) / 4) * 0.2
}

/** Eine Zahl in `teile` Summanden zerlegen, keiner kleiner als `min`. */
function zerlege(summe: number, teile: number, min: number, rng: () => number): number[] {
  const n = clamp(teile, 1, Math.max(1, Math.floor(summe / min)))
  const stuecke = new Array<number>(n).fill(min)
  let rest = summe - n * min
  while (rest > 0) {
    const i = Math.floor(rng() * n)
    const dazu = Math.min(rest, 1 + Math.floor(rng() * Math.max(1, Math.ceil(rest / n))))
    stuecke[i]! += dazu
    rest -= dazu
  }
  return stuecke
}

export function createBienenLevel(level: number): BienenLevel {
  const L = clamp(Math.floor(level), 1, BIENEN_MAX_LEVEL)
  const segment = segmentIndexForLevel(L)
  const pos = (L - 1) % SEGMENT_SIZE
  const wave = waveFactor(pos)
  const gate = isSegmentGate(L)
  const rng = mulberry(L * 9973 + 42)

  // Früh die einfachen Motive, später die farbigen -- und am Tor immer ein
  // farbiges, ein einfarbiges Herz wäre als Abschluss eine Enttäuschung.
  const auswahl = segment >= 3 || gate ? REICHE_MOTIVE : MOTIVE
  const motiv = auswahl[(L - 1) % auswahl.length]!
  const skala = segment >= 4 ? 2 : 1
  const { rows, cols, bild } = motivRaster(motiv, skala)
  const bedarf = bedarfJeFarbe(bild)
  const farben = bedarf.map((n, i) => (n > 0 ? i : 0)).filter((i) => i > 0)
  const colorCount = Math.max(...farben)

  // Blöcke, die genau aufgehen: jede Farbe wird in Stücke zerlegt.
  const teile = 2 + Math.round(wave * 0.8)
  const minStueck = skala === 2 ? 8 : 4
  const bloecke: BienenBlock[] = []
  let lfd = 0
  for (const farbe of farben) {
    for (const menge of zerlege(bedarf[farbe]!, teile, minStueck, rng)) {
      bloecke.push({ id: `b${lfd++}`, color: farbe, amount: menge })
    }
  }
  // Überschuss: Blöcke, die nicht mehr hineinpassen. Sie sind die Gefahr --
  // wer sie hochschickt, verliert den Platz für immer.
  const ueberschuss = clamp(
    Math.round(wave * 4) + (segment - 1) * 2 + (gate ? 3 : 0) - 1,
    0,
    9,
  )
  const zuviel: BienenBlock[] = []
  for (let u = 0; u < ueberschuss; u++) {
    const farbe = farben[Math.floor(rng() * farben.length)]!
    const grund = Math.max(minStueck, Math.round(bedarf[farbe]! / teile))
    const menge = clamp(grund + Math.floor(rng() * grund), minStueck, 60)
    zuviel.push({ id: `u${u}`, color: farbe, amount: menge })
  }

  // Verteilen. Die gebrauchten Blöcke liegen oben, der Überschuss darunter --
  // so ist er vermeidbar, wenn man mitzählt, und tödlich, wenn nicht.
  mische(bloecke, rng)
  mische(zuviel, rng)
  const spalten: BienenBlock[][] = Array.from({ length: SPALTEN }, () => [])
  bloecke.forEach((b, i) => spalten[i % SPALTEN]!.push(b))
  zuviel.forEach((b, i) => spalten[i % SPALTEN]!.push(b))

  // Ein paar Störer wandern nach oben: Durch die muss man hindurch, um an
  // das zu kommen, was darunter gebraucht wird. Höchstens vier -- beim
  // fünften wäre auch bei fehlerfreiem Spiel Schluss.
  const stoerer = clamp(Math.round(wave * 3) - 1 + (gate ? 1 : 0), 0, 4)
  for (let k = 0; k < stoerer && k < zuviel.length; k++) {
    const spalte = spalten[k % SPALTEN]!
    const idx = spalte.findIndex((b) => b.id.startsWith('u'))
    if (idx <= 0) continue
    const [b] = spalte.splice(idx, 1)
    spalte.splice(Math.max(0, Math.floor(rng() * Math.min(idx, 2))), 0, b!)
  }

  const label = gate ? 'Tor' : wave >= 0.9 ? 'Knifflig' : wave >= 0.6 ? 'Mittel' : 'Locker'

  return {
    level: L,
    motiv: motiv.name,
    rows,
    cols,
    bild,
    spalten,
    slotCount: SLOT_COUNT,
    colorCount,
    isGate: gate,
    label,
  }
}

/** Nur für Anzeige und Tests: wie viele echte und wie viele Überschussblöcke. */
export function blockZahlen(level: BienenLevel): { gesamt: number; pollen: number } {
  const alle = level.spalten.flat()
  return {
    gesamt: alle.length,
    pollen: alle.reduce((n, b) => n + b.amount, 0),
  }
}
