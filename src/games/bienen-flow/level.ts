/**
 * Bienen-Flow – die Level.
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
 * Woher die Schwierigkeit kommt (Umbau vom 08.09.2026, nach Thomas: "das
 * Spiel ist teilweise nur eine Farbe und zu einfach, man soll auch mal
 * überlegen müssen, welche Wabe man als erstes nach oben tut"):
 *
 *  - FARBEN. Jedes Motiv hat mindestens drei; mit steigender Schwierigkeit
 *    werden nur noch farbenreiche ausgesucht. Vorher rutschten Bilder mit
 *    einer einzigen Farbe durch -- dort gab es nichts zu entscheiden.
 *  - TIEFE. Wie weit innen eine Farbe liegt. Ein Block für eine tief
 *    liegende Farbe wartet und belegt dabei seinen Platz.
 *  - REIHENFOLGE IM STAPEL. Je schwerer, desto öfter liegt so ein tiefer
 *    Block ganz oben -- man muss durch ihn hindurch, um an den darunter zu
 *    kommen. Genau daraus entsteht die Frage "welchen zuerst?".
 *  - BLÖCKE ZU VIEL. Sie werden nie voll und belegen ihren Platz bis zum
 *    Schluss. Wer mitzählt, lässt sie liegen.
 */

import { isSegmentGate, segmentIndexForLevel } from '@/progression/zones'
import {
  MOTIVE,
  REICHE_MOTIVE,
  SCHICHT_MOTIVE,
  farbanzahl,
  warteFarben,
  motivRaster,
  bedarfJeFarbe,
  type Motiv,
} from './motive'
import { schichtJeFarbe } from './engine'
import { BIENEN_MAX_LEVEL, SLOT_COUNT, SPALTEN, type BienenBlock, type BienenLevel } from './types'

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

/**
 * Wie schwer ein Level sein soll: 0 (Lernstoff) bis 1 (das Schwerste).
 *
 * Thomas am 08.09.2026: "Ab Level 21 soll es immer schwerer werden, aber
 * immer mal auch wieder leichte Level für den Anreiz." Also:
 *
 *   1-20    Lernphase. Flach ansteigend; hier lernt man die Regel, ohne
 *           bestraft zu werden.
 *   ab 21   gleichmäßig steigend bis Level 300.
 *   dazwischen Atempausen -- jedes achte und jedes dreizehnte Level fällt
 *           deutlich zurück. Das ist ungefähr jedes fünfte, also oft genug,
 *           um weiterzuspielen, und selten genug, um nicht zu tragen.
 *   Tore    liegen immer über dem Schnitt und nie in einer Atempause.
 */
export function schwierigkeit(level: number): number {
  const L = clamp(Math.floor(level), 1, BIENEN_MAX_LEVEL)
  const grund = L <= 20 ? ((L - 1) / 19) * 0.18 : 0.24 + ((L - 21) / (BIENEN_MAX_LEVEL - 21)) * 0.76
  if (isSegmentGate(L)) return clamp(Math.max(grund, 0.5) + 0.12, 0, 1)
  return clamp(istAtempause(L) ? grund * 0.42 : grund, 0, 1)
}

/** Der Rhythmus der Atempausen: jedes achte und jedes dreizehnte Level. */
function pausenTakt(L: number): boolean {
  return L > 20 && (L % 8 === 5 || L % 13 === 2)
}

/**
 * Ob das Level eine der eingestreuten leichten Runden ist.
 *
 * Nie zwei hintereinander: Der Achter- und der Dreizehner-Takt treffen sich
 * gelegentlich auf benachbarten Leveln, und zwei leichte Runden am Stück
 * wären keine Atempause mehr, sondern ein Loch in der Kurve.
 */
export function istAtempause(level: number): boolean {
  const L = clamp(Math.floor(level), 1, BIENEN_MAX_LEVEL)
  return !isSegmentGate(L) && pausenTakt(L) && !pausenTakt(L - 1)
}

/**
 * Startwerte, mit denen die Tore eng werden.
 *
 * Ein Tor soll sich nur über ein, zwei Reihenfolgen öffnen lassen (Thomas:
 * "dann auch die Tor-Level zum Öffnen so, dass nur ein Weg möglich ist").
 * Ob das zutrifft, weiß erst der Löser, und der ist für den Seitenaufbau zu
 * langsam. Deshalb steht hier die Nummer der Variante, die beim Durchsuchen
 * gewonnen hat -- der Test in tests/bienen-flow.test.ts rechnet für jedes
 * Tor nach, dass sie noch stimmt.
 *
 * Gesucht wurde die kleinste Nummer, bei der mindestens drei Stellen im
 * Spielverlauf nur einen einzigen rettenden Zug haben. Nicht eingetragene
 * Tore sind schon mit der Null eng genug; ein paar stehen hier auch nur,
 * weil ihre Variante 0 dem Löser zu lange dauert.
 */
const TOR_VARIANTE: Readonly<Record<number, number>> = {
  60: 1,
  200: 1,
  240: 1,
  280: 1,
  300: 1,
}

/**
 * Wie anspruchsvoll ein Bild sein muss.
 *
 * Gezählt werden Farben UND wartende Farben, letztere anderthalbfach: Ein
 * Regenbogen hat sieben Farben, aber alle liegen am Rand -- da wartet nie
 * jemand, und man kann drauflostippen. Erst eine Farbe im Inneren macht aus
 * dem Tippen eine Entscheidung.
 */
function motivPunkte(m: Motiv): number {
  return farbanzahl(m) + 1.5 * warteFarben(m)
}

/** Aus welchem Vorrat ein Level sein Bild sucht. */
function motivPool(L: number): Motiv[] {
  const gate = isSegmentGate(L)
  const s = schwierigkeit(L)
  const segment = segmentIndexForLevel(L)
  // In den ersten beiden Abschnitten nur geschichtete Bilder: An ihnen sieht
  // man, dass von außen nach innen abgetragen wird. Danach alles.
  const grund =
    segment <= 2 && !gate ? SCHICHT_MOTIVE : [...SCHICHT_MOTIVE, ...MOTIVE, ...REICHE_MOTIVE]
  const latte = 4 + s * 5 + (gate ? 1.5 : 0)
  // Ein Tor ist ein Schloss, und ein Schloss braucht Tiefe: Bilder, bei
  // denen fast alle Farben am Rand liegen (ein Regenbogen etwa), lassen sich
  // in jeder Reihenfolge abräumen. Dort ist nichts zu verriegeln.
  const passend = grund.filter((m) => motivPunkte(m) >= latte && (!gate || warteFarben(m) >= 3))
  if (passend.length >= 3) return passend
  // Reicht der Vorrat nicht, nimm die anspruchsvollsten -- lieber ein Bild
  // etwas unter der Latte als immer dasselbe.
  return [...grund].sort((a, b) => motivPunkte(b) - motivPunkte(a)).slice(0, 4)
}

/** Eine Motivnummer aus einem eigenen Startwert (sonst häufen sich Wiederholungen). */
function ziehIndex(L: number, anzahl: number): number {
  const r = mulberry(L * 2654435761 + 17)
  r()
  return Math.floor(r() * anzahl) % Math.max(1, anzahl)
}

/** Das Bild eines Levels -- nie dasselbe wie im Level davor. */
function motivFuer(L: number): Motiv {
  const pool = motivPool(L)
  const i = ziehIndex(L, pool.length)
  const motiv = pool[i]!
  if (L <= 1) return motiv
  const vorher = motivPool(L - 1)
  const vorheriges = vorher[ziehIndex(L - 1, vorher.length)]!
  return vorheriges.name === motiv.name ? pool[(i + 1) % pool.length]! : motiv
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

interface Kandidat extends BienenBlock {
  /** Schälrunde der Farbe: 0 = liegt sofort frei. */
  tiefe: number
}

/**
 * Den Nachschub stapeln.
 *
 * Hier entsteht die Frage "welchen zuerst?". Über dem ersten arbeitsfähigen
 * Block einer Spalte liegt ein Deckel aus wartenden Blöcken: Um an ihn
 * heranzukommen, muss man die Wartenden auf Plätze legen, wo sie bleiben,
 * bis das Bild weit genug abgetragen ist. Eine Spalte hat den dünnsten
 * Deckel -- das ist der Weg, und den muss man finden, bevor die Plätze voll
 * sind.
 *
 * `huerde` ist die Dicke dieses dünnsten Deckels, `zwang` bestimmt, wie oft
 * auch weiter unten im Stapel noch ein Wartender dazwischenliegt.
 */
function staple(
  bloecke: Kandidat[],
  breite: number,
  huerde: number,
  zwang: number,
  rng: () => number,
): BienenBlock[][] {
  const nackt = (b: Kandidat): BienenBlock => ({ id: b.id, color: b.color, amount: b.amount })
  // Die am tiefsten liegenden zuerst: Sie warten am längsten und wiegen
  // deshalb am schwersten, wenn man sie zu früh hochschiebt.
  const tief = bloecke
    .filter((b) => b.tiefe > 0)
    .sort((a, b) => b.tiefe - a.tiefe || b.amount - a.amount || a.id.localeCompare(b.id))
  const flach = bloecke
    .filter((b) => b.tiefe === 0)
    .sort((a, b) => a.amount - b.amount || a.id.localeCompare(b.id))

  const spalten: BienenBlock[][] = Array.from({ length: breite }, () => [])
  const kurz = Math.floor(rng() * breite)
  for (let j = 0; j < breite && flach.length > 0; j++) {
    const dick = j === kurz ? huerde : huerde + (rng() < 0.6 ? 1 : 0)
    for (let k = 0; k < dick && tief.length > 0; k++) spalten[j]!.push(nackt(tief.shift()!))
    spalten[j]!.push(nackt(flach.shift()!))
  }

  let n = 0
  while (flach.length > 0 || tief.length > 0) {
    const nimmTief = tief.length > 0 && (flach.length === 0 || rng() < zwang)
    spalten[n % breite]!.push(nackt(nimmTief ? tief.shift()! : flach.shift()!))
    n++
  }
  return spalten
}

export function createBienenLevel(level: number): BienenLevel {
  const L = clamp(Math.floor(level), 1, BIENEN_MAX_LEVEL)
  return createBienenLevelVariante(L, TOR_VARIANTE[L] ?? 0)
}

/**
 * Dasselbe Level mit einer anderen Variantennummer.
 *
 * Nur für die Suche nach den Tor-Startwerten oben und für den Test, der
 * nachrechnet, dass die eingetragenen noch eng sind. Im Spiel wird immer
 * `createBienenLevel` benutzt.
 */
export function createBienenLevelVariante(level: number, variante: number): BienenLevel {
  const L = clamp(Math.floor(level), 1, BIENEN_MAX_LEVEL)
  const gate = isSegmentGate(L)
  const s = schwierigkeit(L)
  const segment = segmentIndexForLevel(L)
  const rng = mulberry(L * 9973 + 42 + variante * 7919)

  const motiv = motivFuer(L)
  // Größe: kleine Bilder am Anfang, später die doppelte, ganz spät die
  // dreifache Kantenlänge. Über 480 Pixel wird eine Runde zäh (bei rund vier
  // Bienen sind das schon halbe Minuten) -- dann eine Stufe kleiner.
  const grob = motiv.zeilen.join('').replace(/\./g, '').length
  let skala = s >= 0.74 ? 3 : s >= 0.34 ? 2 : 1
  while (skala > 1 && grob * skala * skala > 480) skala--
  const { rows, cols, bild } = motivRaster(motiv, skala)
  const pixel = bedarfJeFarbe(bild)
  const farben = pixel.map((n, i) => (n > 0 ? i : 0)).filter((i) => i > 0)
  const colorCount = Math.max(...farben)
  const tiefe = schichtJeFarbe(bild, rows, cols)

  // Blöcke, die genau aufgehen. Wie fein zerlegt wird, hängt an der Größe
  // der Farbe: Eine Farbe mit sechs Pixeln in drei Blöcke zu schneiden ergibt
  // nur Dreien, und damit hat man nichts zu entscheiden.
  const proBlock = skala === 3 ? 26 : skala === 2 ? 14 : 7
  const minStueck = 3
  const bloecke: Kandidat[] = []
  let lfd = 0
  for (const farbe of farben) {
    const teile = clamp(Math.round(pixel[farbe]! / proBlock), 1, 5)
    for (const menge of zerlege(pixel[farbe]!, teile, minStueck, rng)) {
      bloecke.push({
        id: `b${lfd++}`,
        color: farbe,
        amount: menge,
        tiefe: tiefe.get(farbe) ?? 0,
      })
    }
  }

  // Blöcke zu viel: Sie können nie voll werden und kosten einen Platz. Wer
  // mitzählt, lässt sie liegen; wer drauflostippt, verliert Plätze. Bei den
  // großen Bildern reicht weniger davon -- dort dauert alles ohnehin länger,
  // und ein verlorener Platz wiegt schwerer.
  const zuvielAnzahl = clamp(Math.round(s * (gate ? 4.5 : 5)), 0, skala === 3 ? 3 : 5)
  const zuviel: Kandidat[] = []
  for (let u = 0; u < zuvielAnzahl; u++) {
    const farbe = farben[Math.floor(rng() * farben.length)]!
    const menge = clamp(Math.round(pixel[farbe]! / 3) + 2, minStueck, 60)
    zuviel.push({ id: `u${u}`, color: farbe, amount: menge, tiefe: tiefe.get(farbe) ?? 0 })
  }

  // Wie breit der Nachschub ist: drei Spalten am Anfang, später vier. Im
  // Original ist Level 1 dreispaltig, spätere Level sind vierspaltig.
  const breite = segment >= 3 ? SPALTEN : SPALTEN - 1

  // Wie dick der dünnste Deckel ist: In der Lernphase liegt oben, was sofort
  // arbeitet; später muss man sich erst durch Wartende hindurchlegen. Mehr
  // als drei ginge nicht auf -- dann wären vier der fünf Plätze belegt,
  // bevor die erste Biene fliegt.
  // Am Tor liegt immer der dickste Deckel: Dort soll sich der Weg nur über
  // eine, zwei Reihenfolgen öffnen.
  const huerde = gate ? 3 : clamp(Math.round(s * 3.2), 0, 3)
  const zwang = clamp(0.1 + s * 0.55, 0.1, 0.65)
  const spalten = staple(bloecke, breite, huerde, zwang, rng)

  // Die Blöcke zu viel liegen tief im Stapel -- bis auf ein paar Störer, die
  // nach oben wandern. Durch die muss man hindurch. Höchstens zwei, sonst
  // bliebe auch bei fehlerfreiem Spiel kein Weg.
  const stoerer = clamp(Math.round(s * 2.5), 0, skala === 3 ? 1 : 2)
  zuviel.forEach((b, i) => {
    const spalte = spalten[i % breite]!
    const block: BienenBlock = { id: b.id, color: b.color, amount: b.amount }
    if (i < stoerer) spalte.splice(Math.min(1 + i, spalte.length), 0, block)
    else spalte.push(block)
  })

  const label = gate
    ? 'Tor'
    : istAtempause(L)
      ? 'Atempause'
      : s >= 0.66
        ? 'Knifflig'
        : s >= 0.36
          ? 'Mittel'
          : 'Locker'

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
