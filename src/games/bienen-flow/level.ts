/**
 * Bienen-Flow – die Level.
 *
 * Vorerst zehn Stück zum Anspielen; der Erzeuger rechnet aber schon mit
 * einer Steigerung, damit daraus später hundert werden können, ohne dass
 * sich die Regeln ändern.
 *
 * Ein Level besteht aus dem Motiv (daraus ergibt sich, wie viele Pixel jede
 * Farbe hat) und dem Nachschub. Zwei Dinge muss der Erzeuger garantieren:
 *
 *  1. Die Blöcke einer Farbe fassen zusammen genau so viele Pixel, wie die
 *     Farbe im Bild hat. Sonst bliebe am Ende ein Block übrig, der nie voll
 *     wird -- oder schlimmer: Pixel, die niemand mehr holen kann.
 *  2. Es muss eine Reihenfolge geben, die aufgeht. Das prüft der Löser in
 *     tests/bienen-flow.test.ts für jedes einzelne Level.
 *
 * Die Schwierigkeit kommt aus drei Richtungen: wie viele Farben im Spiel
 * sind, wie tief eine Farbe im Bild vergraben liegt (ein Block dafür belegt
 * lange einen Platz), und wie viele Blöcke zu viel im Nachschub liegen.
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
  const rng = mulberry(L * 9973 + 42)
  const segment = segmentIndexForLevel(L)
  const pos = (L - 1) % SEGMENT_SIZE
  const gate = isSegmentGate(L)
  /** 0 (erstes Level) bis 1 (letztes) -- die grobe Steigung über alle 300. */
  const stufe = (L - 1) / (BIENEN_MAX_LEVEL - 1)
  /**
   * Die Welle innerhalb eines Abschnitts: erst locker, dann anziehend, vor
   * dem Tor ein Durchatmen. Ohne sie fühlten sich zwanzig Level am Stück
   * gleich an.
   */
  const welle = gate ? 1.35 : pos <= 6 ? 0.4 + (pos / 6) * 0.2 : pos <= 13 ? 0.6 + ((pos - 7) / 6) * 0.4 : 0.6 + ((pos - 14) / 5) * 0.2

  // Motive: erst die schlichten, ab Abschnitt 3 die farbigen, am Tor immer
  // ein farbiges. Damit sich über 300 Level nicht alles wiederholt, wandert
  // die Auswahl mit jedem Abschnitt weiter.
  const auswahl = segment >= 3 || gate ? REICHE_MOTIVE : MOTIVE
  // Streuen statt reihum: (L * 7 + segment) ergab bei sechs Motiven immer
  // dieselben zwei an den Toren. Der Zufallsgenerator des Levels mischt
  // gleichmäßig und bleibt trotzdem für jedes Level derselbe.
  const motiv = auswahl[Math.floor(rng() * auswahl.length)]!
  // Größe: kleine Bilder am Anfang, später die doppelte, ganz spät die
  // dreifache Kantenlänge -- damit ein Level auch länger dauert.
  const skala = segment >= 10 ? 3 : segment >= 4 || (gate && segment >= 2) ? 2 : 1
  const { rows, cols, bild } = motivRaster(motiv, skala)
  const pixel = bedarfJeFarbe(bild)
  const farben = pixel.map((n, i) => (n > 0 ? i : 0)).filter((i) => i > 0)
  const colorCount = Math.max(...farben)

  // Blöcke, die genau aufgehen. Wie fein zerlegt wird, hängt an der Größe
  // der Farbe: Eine Farbe mit sechs Pixeln in drei Blöcke zu schneiden ergibt
  // nur Dreien, und damit hat man nichts zu entscheiden.
  const proBlock = skala === 3 ? 26 : skala === 2 ? 14 : 7
  const minStueck = 3
  const bloecke: BienenBlock[] = []
  let lfd = 0
  for (const farbe of farben) {
    const teile = clamp(Math.round(pixel[farbe]! / proBlock), 1, 5)
    for (const menge of zerlege(pixel[farbe]!, teile, minStueck, rng)) {
      bloecke.push({ id: `b${lfd++}`, color: farbe, amount: menge })
    }
  }

  // Blöcke zu viel: Sie können nie voll werden und kosten einen Platz. Sie
  // liegen unten im Stapel, sind also vermeidbar -- wer mitzählt, lässt sie
  // liegen; wer drauflostippt, verliert Plätze.
  // Bei den großen Bildern (dreifache Kante) reicht weniger Überschuss: Dort
  // dauert alles ohnehin länger, und ein verlorener Platz wiegt schwerer.
  const zuvielAnzahl = clamp(Math.round(stufe * 4 + welle * 1.5) - 1, 0, skala === 3 ? 4 : 6)
  const zuviel: BienenBlock[] = []
  for (let u = 0; u < zuvielAnzahl; u++) {
    const farbe = farben[Math.floor(rng() * farben.length)]!
    const menge = clamp(Math.round(pixel[farbe]! / 3) + 2, minStueck, 60)
    zuviel.push({ id: `u${u}`, color: farbe, amount: menge })
  }

  mische(bloecke, rng)
  mische(zuviel, rng)
  const spalten: BienenBlock[][] = Array.from({ length: SPALTEN }, () => [])
  bloecke.forEach((b, i) => spalten[i % SPALTEN]!.push(b))
  zuviel.forEach((b, i) => spalten[i % SPALTEN]!.push(b))

  // Ein paar Störer wandern nach oben: Durch die muss man hindurch, um an
  // das zu kommen, was darunter gebraucht wird. Höchstens drei, sonst bliebe
  // auch bei fehlerfreiem Spiel kein Weg.
  const stoerer = clamp(Math.round(stufe * 2 + welle) - 1, 0, skala === 3 ? 1 : 2)
  for (let k = 0; k < stoerer && k < zuviel.length; k++) {
    const spalte = spalten[k % SPALTEN]!
    const idx = spalte.findIndex((b) => b.id.startsWith('u'))
    if (idx <= 0) continue
    const [b] = spalte.splice(idx, 1)
    spalte.splice(Math.max(0, Math.floor(rng() * Math.min(idx, 2))), 0, b!)
  }

  const label = gate ? 'Tor' : welle >= 0.9 ? 'Knifflig' : welle >= 0.6 ? 'Mittel' : 'Locker'

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

/** Für Anzeige und Tests. */
export function blockZahlen(level: BienenLevel): { gesamt: number; kapazitaet: number } {
  const alle = level.spalten.flat()
  return { gesamt: alle.length, kapazitaet: alle.reduce((n, b) => n + b.amount, 0) }
}
