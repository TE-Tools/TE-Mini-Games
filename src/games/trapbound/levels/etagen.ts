/**
 * Stockwerk-Level – hoch und runter statt immer nur nach rechts.
 *
 * Thomas am 05.11.2026: "bei Trapbound mehr verschiedene Level noch
 * einbauen mit mehreren Ebenen und hoch und runter laufen usw. wie beim
 * Original". Bis dahin war jedes Level ein Streifen: links rein, rechts
 * raus, egal wie lang. Diese Level sind einen Bildschirm breit und mehrere
 * hoch, und die Laufrichtung wechselt mit jedem Stockwerk.
 *
 * Drei Bauarten:
 *
 *   aufstieg  unten los, mit Aufzug oder Feder Stock für Stock nach oben.
 *   abstieg   oben los, durch Luken und brüchige Böden nach unten.
 *   turm      hoch bis unters Dach, dort wartet ein falscher Ausgang. Der
 *             Knopf oben öffnet unten die Klappe, und der echte Ausgang
 *             liegt im Keller -- erreichbar durch den Schacht, über den man
 *             auf dem Weg nach oben die ganze Zeit gesprungen ist.
 *
 * Wie bei den anderen erzeugten Leveln entsteht die Lösung mit der
 * Geometrie, und der Test spielt sie ab. Erzeugt heißt auch hier nicht
 * zufällig: Der Zufall hängt an der Levelnummer.
 *
 * Die Bausteine heißen hier anders als in bausteine.ts (zacken statt
 * stacheln, loch statt luecke). Das ist Absicht: Die Abwechslungs-Tests
 * vergleichen Nachbarlevel über die Namen ihrer Bausteine, und ein
 * Stockwerk-Level ist etwas anderes als ein Streifen mit Stacheln.
 */

import type { LevelDaten, LoesungsSchritt, Objekt } from '../types'
import { BILD_BREITE } from '../types'
import { LEVEL_PRO_WELT, weltNummer } from '../welten'
import { spieleLoesung } from '../loesung'
import { wandelZiel, zaehleWandel } from './erzeugt'

/** Abstand zweier Stockwerke (Oberkante zu Oberkante). */
const STOCK = 100
/** Dicke einer Zwischendecke. */
const DECKE = 10
/** Dicke des Erdbodens. */
const GRUND = 30
/** Platz über dem obersten Stockwerk. */
const KOPF = 70
/** Dicke der Seitenwände. */
const WAND = 8
/** Breite einer Öffnung zum nächsten Stockwerk. */
const OEFFNUNG = 56
/** Figur. */
const FIGUR_B = 11
const FIGUR_H = 17

const BREITE = BILD_BREITE
const INNEN_L = WAND
const INNEN_R = BREITE - WAND

/** Ab hier gibt es die Stockwerk-Level (Welt 1, Platz 17). */
export const ETAGEN_AB = 17
/** Bis hierher -- das Endspiel hat keine ruhigen Plätze mehr frei. */
export const ETAGEN_BIS = 300

/**
 * Welche Plätze einer Welt Stockwerk-Level sind.
 *
 * 7 und 17 sind in jeder Welt bis 300 weder gemein noch Albtraum noch ein
 * Lernplatz für eine neue Falle (siehe erzeugt.ts). Damit bleibt alles, was
 * die Tests über gemeine Level und Albträume festhalten, unberührt.
 */
const PLAETZE = [7, 17]

export function istEtagenLevel(nr: number): boolean {
  if (nr < ETAGEN_AB || nr > ETAGEN_BIS) return false
  const inWelt = ((nr - 1) % LEVEL_PRO_WELT) + 1
  return PLAETZE.includes(inWelt)
}

export type EtagenArt = 'aufstieg' | 'abstieg' | 'turm'
type Hoch = 'lift' | 'sprungbrett'
type Runter = 'luke' | 'broeselluke'
type Gefahr = 'zacken' | 'klappzacken' | 'loch' | 'broeselboden' | 'deckenblock'

function mulberry(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** Wie viele Stockwerke -- mit der Welt mehr. */
function stockwerke(nr: number): number {
  const welt = weltNummer(nr)
  if (welt <= 2) return 3
  if (welt <= 6) return 4
  return 5
}

/** Wie viele Gefahren je Stockwerk höchstens. */
function gefahrenJeStock(nr: number): number {
  const welt = weltNummer(nr)
  if (welt <= 2) return 1
  if (welt <= 8) return 2
  return 3
}

/** Nummer unter allen Stockwerk-Leveln (0, 1, 2 ...). */
function etagenIndex(nr: number): number {
  let i = 0
  for (let n = ETAGEN_AB; n < nr; n++) if (istEtagenLevel(n)) i++
  return i
}

const ARTEN: EtagenArt[] = ['aufstieg', 'abstieg', 'turm']

const NAMEN: Record<EtagenArt, string[]> = {
  aufstieg: [
    'Treppenhaus',
    'Nach oben',
    'Stockwerk für Stockwerk',
    'Dachterrasse',
    'Bitte nach oben',
    'Himmelsleiter',
    'Die Etagen',
    'Ganz nach oben',
    'Aufwärts',
    'Hochhaus',
  ],
  abstieg: [
    'Ab in den Keller',
    'Abwärts',
    'Der tiefe Schacht',
    'Durch die Luke',
    'Bodenlos',
    'Nur nach unten',
    'Fallrohr',
    'Kellertreppe',
    'Stock um Stock',
    'Der lange Weg runter',
  ],
  turm: [
    'Der Turm',
    'Oben ist nicht das Ende',
    'Hoch und wieder runter',
    'Der falsche Gipfel',
    'Zurück in den Keller',
    'Turmspitze',
    'Der Schacht',
    'Oben lügt',
    'Alles umsonst?',
    'Der zweite Weg',
  ],
}

interface Lauf {
  /** Das Stockwerk (0 = ganz unten). */
  k: number
  /** Laufrichtung: 1 nach rechts, -1 nach links. */
  d: 1 | -1
}

/** Oberkante von Stockwerk k. */
function oberkante(hoehe: number, k: number): number {
  return hoehe - GRUND - k * STOCK
}

/** Nach rechts bzw. links laufen, bis die Figur an Marke x ist. */
function laufBis(d: 1 | -1, x: number, extra: Partial<LoesungsSchritt> = {}): LoesungsSchritt {
  return d > 0
    ? { rechts: true, bisX: x - FIGUR_B, ...extra }
    : { links: true, bisXunter: x, ...extra }
}

function richtung(d: 1 | -1, extra: Partial<LoesungsSchritt> = {}): LoesungsSchritt {
  return d > 0 ? { rechts: true, ...extra } : { links: true, ...extra }
}

interface Plan {
  art: EtagenArt
  stock: number
  hoch: Hoch[]
  runter: Runter[]
  gefahren: Gefahr[][]
}

/**
 * Baut ein Stockwerk-Level.
 *
 * Jedes Stockwerk ist eine Zwischendecke mit Aussparungen: an einem Ende
 * die Öffnung, durch die man ankommt, am anderen die, durch die es weiter
 * geht. Dazwischen liegen die Gefahren. Weil die Laufrichtung wechselt,
 * liegen die Öffnungen abwechselnd links und rechts -- wie in einem
 * Treppenhaus.
 */
function baue(nr: number, plan: Plan, heimlich: boolean): LevelDaten {
  const { art, stock } = plan
  const hoehe = KOPF + (stock - 1) * STOCK + GRUND
  const objekte: Objekt[] = []
  const loesung: LoesungsSchritt[] = []
  let kennung = 0
  const neueId = (p: string) => `e${nr}${p}${kennung++}`

  // Seitenwände über die ganze Höhe.
  objekte.push({ typ: 'block', x: 0, y: 0, b: WAND, h: hoehe })
  objekte.push({ typ: 'block', x: INNEN_R, y: 0, b: WAND, h: hoehe })

  // Welche Stockwerke in welcher Richtung durchlaufen werden.
  const runter = art === 'abstieg'
  const ersterStock = art === 'turm' ? 1 : runter ? stock - 1 : 0
  const laeufe: Lauf[] = []
  for (let j = 0; j < (art === 'turm' ? stock - 1 : stock); j++) {
    const k = runter ? ersterStock - j : ersterStock + j
    laeufe.push({ k, d: j % 2 === 0 ? 1 : -1 })
  }

  // Aussparungen je Stockwerk, als [von, bis) mit Inhalt.
  type Stueck = { von: number; bis: number; art: 'leer' | 'bruch' | 'tuer'; id?: string }
  const aussparungen = new Map<number, Stueck[]>()
  const spare = (k: number, s: Stueck) => {
    const liste = aussparungen.get(k) ?? []
    liste.push(s)
    aussparungen.set(k, liste)
  }

  /** Das Ende eines Laufs in Richtung d: x-Bereich der Öffnung dort. */
  const endeBereich = (d: 1 | -1, breite = OEFFNUNG) =>
    d > 0 ? { von: INNEN_R - breite, bis: INNEN_R } : { von: INNEN_L, bis: INNEN_L + breite }

  // Der Schacht des Turms: in der Mitte, durch alle Decken.
  const schacht = { von: 212, bis: 252 }
  let klappeId = ''
  if (art === 'turm') {
    klappeId = neueId('k')
    // Über dem Keller eine Klappe, die erst der Knopf oben öffnet.
    spare(1, { ...schacht, art: 'tuer', id: klappeId })
    for (let k = 2; k < stock; k++) spare(k, { ...schacht, art: 'leer' })
  }

  // Wo die Gefahren eines Laufs liegen dürfen: zwischen den Öffnungen.
  const startX = (lauf: Lauf) => (lauf.d > 0 ? INNEN_L + 24 : INNEN_R - 24 - FIGUR_B)

  for (let j = 0; j < laeufe.length; j++) {
    const lauf = laeufe[j]!
    const { k, d } = lauf
    const y = oberkante(hoehe, k)
    const letzter = j === laeufe.length - 1

    // Start.
    if (j === 0) {
      // Die Figur steht auf der Oberkante -- `start.y` ist ihre Oberkante.
      loesung.push({ dauer: 0.15 })
    }

    // Gefahren entlang des Laufs, in Laufrichtung sortiert.
    /*
     * Feste Plätze statt gleichmäßiger Verteilung: Zwischen zwei Gefahren
     * muss ein ganzer Sprung Platz haben, und im Turm bleibt um den Schacht
     * herum Luft -- über den springt man ja auch noch.
     */
    const plaetze = art === 'turm' ? [100, 316] : [104, 204, 304]
    const gefahren = (plan.gefahren[j] ?? []).slice(0, plaetze.length)
    const auswahl =
      gefahren.length === 1
        ? [plaetze[art === 'turm' ? (d > 0 ? 1 : 0) : 1]!]
        : gefahren.length === 2 && plaetze.length === 3
          ? [124, 284]
          : plaetze
    const stellen = gefahren.map((g, i) => ({ x: auswahl[i]!, g }))
    // Im Turm ist der Schacht selbst eine Gefahr -- außer im obersten Stock
    // (da muss man hinein) und über dem Keller (da liegt die Klappe).
    const schachtHier = art === 'turm' && k >= 2 && k < stock - 1
    const hindernisse: { von: number; bis: number; springen: boolean }[] = []

    for (const st of stellen) {
      const x = st.x
      switch (st.g) {
        case 'zacken':
          objekte.push({ typ: 'stachel', x, y: y - 10, b: 28, h: 10 })
          hindernisse.push({ von: x, bis: x + 28, springen: true })
          break
        case 'klappzacken': {
          const id = neueId('z')
          objekte.push({ typ: 'stachel', id, x, y: y - 10, b: 30, h: 10, versteckt: true })
          // Der Auslöser liegt so weit davor, dass man die Zacken kommen sieht.
          const zx = d > 0 ? x - 70 : x + 30 + 60
          objekte.push({
            typ: 'zone',
            x: zx,
            y: y - 30,
            b: 10,
            h: 30,
            einmal: true,
            loest: [{ tu: 'zeigen', ziel: id }],
          })
          hindernisse.push({ von: x, bis: x + 30, springen: true })
          break
        }
        case 'loch':
          spare(k, { von: x, bis: x + 40, art: 'leer' })
          hindernisse.push({ von: x, bis: x + 40, springen: true })
          break
        case 'broeselboden':
          spare(k, { von: x, bis: x + 44, art: 'bruch' })
          hindernisse.push({ von: x, bis: x + 44, springen: false })
          break
        case 'deckenblock': {
          // Er fällt, sobald man darunter durch ist: Wer weiterläuft, hört
          // ihn hinter sich aufschlagen, wer stehen bleibt, nicht mehr.
          const id = neueId('f')
          const unter = y - STOCK + DECKE
          objekte.push({
            typ: 'fall',
            id,
            x,
            y: Math.max(4, unter),
            b: 24,
            h: 16,
            toedlich: true,
            heimlich,
          })
          objekte.push({
            typ: 'zone',
            x: x + 7,
            y: y - 40,
            b: 10,
            h: 40,
            einmal: true,
            loest: [{ tu: 'fallen', ziel: id, nach: 0.15 }],
          })
          hindernisse.push({ von: x, bis: x + 24, springen: false })
          break
        }
      }
    }
    if (schachtHier) hindernisse.push({ ...schacht, springen: true })

    // In Laufrichtung abarbeiten.
    hindernisse.sort((a, b) => (d > 0 ? a.von - b.von : b.bis - a.bis))
    for (const h of hindernisse) {
      if (!h.springen) continue
      // Absprung kurz vor der Kante, Landung sicher dahinter.
      if (d > 0) loesung.push(laufBis(1, h.von - 20))
      else loesung.push(laufBis(-1, h.bis + 20))
      // Die Taste nur bis kurz vor dem Scheitel halten: Wer sie bis zur
      // Landung hält, springt dank Sprungpuffer gleich noch einmal -- und
      // hüpft über die nächste Öffnung hinweg, statt hineinzufahren.
      loesung.push(richtung(d, { sprung: true, dauer: 0.25 }))
      loesung.push(richtung(d, { bisBoden: true, dauer: 1.2 }))
    }

    // Das Ende des Laufs.
    if (letzter) {
      const ende = endeBereich(d)
      if (art === 'turm') {
        // Oben: der Knopf vor dem Schacht, dahinter der falsche Ausgang.
        const knopfX = d > 0 ? schacht.von - 70 : schacht.bis + 44
        objekte.push({
          typ: 'knopf',
          x: knopfX,
          y,
          b: 26,
          h: 8,
          loest: [{ tu: 'oeffnen', ziel: klappeId }],
        })
        spare(k, { ...schacht, art: 'leer' })
        objekte.push({
          typ: 'ziel',
          x: d > 0 ? ende.bis - 30 : ende.von + 8,
          y: y - 32,
          b: 22,
          h: 32,
          falle: true,
        })
        objekte.push({
          typ: 'schild',
          x: d > 0 ? ende.bis - 50 : ende.von + 2,
          y: y - 54,
          b: 40,
          h: 13,
          text: 'AUSGANG',
        })
        // Hinein in den Schacht und ganz nach unten.
        // Gleich hinter der Kante gegensteuern: Mit vollem Schwung trägt es
        // einen in der Luft sonst bis an die andere Kante, und dort bleibt
        // man ein Stockwerk tiefer auf dem Rand stehen.
        loesung.push(laufBis(d, d > 0 ? schacht.von + FIGUR_B + 2 : schacht.bis - FIGUR_B - 2))
        loesung.push({ ...richtung((-d) as 1 | -1), dauer: 0.18 })
        loesung.push({ dauer: 0.4 })
        loesung.push({ bisBoden: true, dauer: 3 })
        // Im Keller: der echte Ausgang, ein Stück zur Seite.
        const keller = oberkante(hoehe, 0)
        const kd = (-d) as 1 | -1
        const zielX = kd > 0 ? schacht.bis + 90 : schacht.von - 90 - 22
        objekte.push({ typ: 'ziel', x: zielX, y: keller - 32, b: 22, h: 32 })
        loesung.push(richtung(kd, { dauer: 2 }))
      } else {
        objekte.push({
          typ: 'ziel',
          x: d > 0 ? ende.bis - 30 : ende.von + 8,
          y: y - 32,
          b: 22,
          h: 32,
        })
        loesung.push(richtung(d, { dauer: 4 }))
      }
      continue
    }

    // Übergang zum nächsten Stockwerk.
    const ende = endeBereich(d)
    if (!runter) {
      const ueber = oberkante(hoehe, k + 1)
      const wie = plan.hoch[j] ?? 'lift'
      if (wie === 'lift') {
        // Der Aufzug fährt genau in die Öffnung darüber und füllt sie aus.
        spare(k + 1, { ...ende, art: 'leer' })
        const id = neueId('l')
        spare(k, { ...ende, art: 'leer' })
        objekte.push({
          typ: 'beweger',
          id,
          x: ende.von + 1,
          y,
          b: OEFFNUNG - 2,
          h: DECKE,
          weg: { dx: 0, dy: -STOCK, dauer: 1.3, wartetAufAusloeser: true, einweg: true },
        })
        objekte.push({
          typ: 'zone',
          x: ende.von + OEFFNUNG / 2 - 5,
          y: y - 20,
          b: 10,
          h: 20,
          einmal: true,
          loest: [{ tu: 'los', ziel: id }],
        })
        const mitte = ende.von + OEFFNUNG / 2
        loesung.push(laufBis(d, d > 0 ? mitte + 4 : mitte - 4))
        loesung.push({ dauer: 1.6 })
      } else {
        /*
         * Die Feder liegt an der Wand, darüber eine schmale Öffnung. Breit
         * darf sie nicht sein: Wer oben ankommt, muss im Flug noch seitlich
         * auf die Decke kommen, und dafür bleibt nur ein kurzer Moment über
         * der Kante. Bei 56 Punkten reichte er nicht.
         */
        const schmal = endeBereich(d, 30)
        spare(k + 1, { ...schmal, art: 'leer' })
        const fx = d > 0 ? INNEN_R - 28 : INNEN_L + 2
        objekte.push({ typ: 'feder', x: fx, y, b: 26, h: DECKE, kraft: 660 })
        loesung.push(richtung(d, { bisYunter: ueber - FIGUR_H - 4, dauer: 4 }))
        loesung.push(richtung((-d) as 1 | -1, { bisBoden: true, dauer: 2 }))
      }
    } else {
      const wie = plan.runter[j] ?? 'luke'
      if (wie === 'luke') {
        spare(k, { ...ende, art: 'leer' })
        loesung.push(laufBis(d, d > 0 ? ende.von + 14 : ende.bis - 14))
        loesung.push(richtung(d, { dauer: 0.3 }))
        loesung.push(richtung(d, { bisBoden: true, dauer: 2 }))
      } else {
        spare(k, { ...ende, art: 'bruch' })
        loesung.push(laufBis(d, d > 0 ? INNEN_R - 2 : INNEN_L + 2))
        loesung.push({ dauer: 1.1 })
        loesung.push({ bisBoden: true, dauer: 2 })
      }
    }
  }

  // Die Decken aus ihren Aussparungen bauen. Sie kommen nach vorn in die
  // Liste: Gezeichnet wird in Listenreihenfolge, und Feder und Knopf liegen
  // bündig in der Decke -- hinten angehängt hätte die Decke sie verdeckt.
  const decken: Objekt[] = []
  for (let k = 0; k < stock; k++) {
    const y = oberkante(hoehe, k)
    const h = k === 0 ? GRUND : DECKE
    const stuecke = (aussparungen.get(k) ?? []).sort((a, b) => a.von - b.von)
    let x = INNEN_L
    for (const s of stuecke) {
      if (s.von > x) decken.push({ typ: 'block', x, y, b: s.von - x, h })
      const b = s.bis - Math.max(s.von, x)
      if (b > 0 && s.art === 'bruch') {
        decken.push({
          typ: 'bruch',
          x: Math.max(s.von, x),
          y,
          b,
          h,
          verzoegerung: 0.55,
          heimlich,
        })
      }
      if (b > 0 && s.art === 'tuer') {
        decken.push({ typ: 'tuer', id: s.id, x: Math.max(s.von, x), y, b, h })
      }
      x = Math.max(x, s.bis)
    }
    if (x < INNEN_R) decken.push({ typ: 'block', x, y, b: INNEN_R - x, h })
  }
  objekte.splice(2, 0, ...decken)

  const erster = laeufe[0]!
  const idee = [
    'etagen',
    art,
    ...new Set((runter ? plan.runter : plan.hoch).slice(0, laeufe.length - 1)),
    ...new Set(plan.gefahren.flat()),
  ]
  const welt = weltNummer(nr)
  const inWelt = ((nr - 1) % LEVEL_PRO_WELT) + 1
  const index = etagenIndex(nr)
  const namen = NAMEN[art]
  return {
    nr,
    welt,
    abschnitt: inWelt <= 10 ? 1 : 2,
    name: namen[index % namen.length]!,
    idee: `Aus Bausteinen: ${idee.join(' + ')}.`,
    breite: BREITE,
    hoehe,
    start: { x: startX(erster), y: oberkante(hoehe, erster.k) - FIGUR_H },
    objekte,
    loesung,
  }
}

/** Gefahren, die ein Stockwerk tragen kann -- mit der Welt mehr. */
function gefahrenVorrat(nr: number, art: EtagenArt, k: number): Gefahr[] {
  const welt = weltNummer(nr)
  const vorrat: Gefahr[] = ['zacken', 'loch']
  if (welt >= 2) vorrat.push('broeselboden')
  if (welt >= 3) vorrat.push('klappzacken')
  if (welt >= 4) vorrat.push('deckenblock')
  // Ab Level 150 muss sich in jedem Level etwas bewegen (erzeugt.ts,
  // `wandelZiel`) -- dann nur noch Gefahren, die etwas tun.
  const bewegt = nr >= 150 ? vorrat.filter((g) => g !== 'zacken' && g !== 'loch') : vorrat
  return bewegt.filter((g) => {
    if (g !== 'loch' && g !== 'broeselboden') return true
    // Kein Loch über dem Keller des Turms: Dort steht der Ausgang, und
    // wer hineinfiele, wäre am Ziel, ohne oben gewesen zu sein.
    if (art === 'turm') return k >= 2
    // Beim Abstieg wäre ein Loch eine Abkürzung und keine Falle. Ganz unten
    // ist es ein Abgrund -- das bleibt.
    if (art === 'abstieg') return k === 0
    return true
  })
}

/** Der Bauplan eines Stockwerk-Levels. */
function planFuer(nr: number, variante: number): Plan {
  const index = etagenIndex(nr)
  const art = ARTEN[(index + variante) % ARTEN.length]!
  const rng = mulberry(nr * 7919 + variante * 104729 + 17)
  const stock = stockwerke(nr) + (art === 'turm' ? 1 : 0)
  const laeufe = art === 'turm' ? stock - 1 : stock
  const hoch: Hoch[] = []
  const runter: Runter[] = []
  const gefahren: Gefahr[][] = []
  const welt = weltNummer(nr)
  const liftAnteil = nr >= 150 ? 0.75 : 0.5
  for (let j = 0; j < laeufe; j++) {
    // Über dem Keller des Turms kein Aufzug: Sein Schacht bliebe offen,
    // und wer vom fahrenden Aufzug springt, fiele direkt zum Ausgang.
    hoch.push(
      art === 'turm' && j === 0 ? 'sprungbrett' : rng() < liftAnteil ? 'lift' : 'sprungbrett',
    )
    runter.push(welt >= 2 && rng() < 0.45 ? 'broeselluke' : 'luke')
    const k = art === 'abstieg' ? stock - 1 - j : (art === 'turm' ? 1 : 0) + j
    const vorrat = gefahrenVorrat(nr, art, k)
    const anzahl = 1 + Math.floor(rng() * gefahrenJeStock(nr))
    const hier: Gefahr[] = []
    // Im obersten Stock des Turms gehört die Bühne dem falschen Ausgang.
    if (art === 'turm' && j === laeufe - 1) {
      gefahren.push(hier)
      continue
    }
    for (let i = 0; i < anzahl; i++) hier.push(vorrat[Math.floor(rng() * vorrat.length)]!)
    gefahren.push(hier)
  }
  return { art, stock, hoch, runter, gefahren }
}

/**
 * Das Stockwerk-Level zu einer Nummer.
 *
 * Mehrere Varianten werden probiert, bis die Lösung aufgeht -- wie in
 * erzeugt.ts. Geht keine auf, bleibt die schlichteste: ein Aufstieg mit
 * Aufzügen und je einer Zackenreihe.
 */
export function erzeugeEtagenLevel(nr: number): LevelDaten {
  const da = merker.get(nr)
  if (da) return da
  const heimlich = nr >= 101
  // Dieselbe Bauart erst nach fünfzig Leveln wieder -- wie bei den anderen
  // erzeugten Leveln (tests/trapbound.test.ts, "Abwechslung").
  const vorher = new Set<string>()
  for (let n = Math.max(ETAGEN_AB, nr - 49); n < nr; n++) {
    if (istEtagenLevel(n)) vorher.add(bauart(erzeugeEtagenLevel(n)))
  }
  for (let variante = 0; variante < 40; variante++) {
    const plan = planFuer(nr, variante)
    const l = baue(nr, plan, heimlich)
    if (vorher.has(bauart(l))) continue
    if (zaehleWandel(l) < wandelZiel(nr)) continue
    if (spieleLoesung(l).geschafft) {
      merker.set(nr, l)
      return l
    }
  }
  const stock = stockwerke(nr)
  return baue(
    nr,
    {
      art: 'aufstieg',
      stock,
      hoch: Array<Hoch>(stock).fill('lift'),
      runter: [],
      gefahren: Array.from({ length: stock }, () => ['zacken'] as Gefahr[]),
    },
    false,
  )
}

const merker = new Map<number, LevelDaten>()

/** Woraus ein Level besteht, unabhängig von der Reihenfolge. */
function bauart(l: LevelDaten): string {
  return l.idee.replace('Aus Bausteinen: ', '').replace(/.$/, '').split(' + ').sort().join('+')
}

/** Eine bestimmte Variante -- für die Tests und zum Nachsehen. */
export function etagenVariante(nr: number, variante: number): LevelDaten {
  return baue(nr, planFuer(nr, variante), nr >= 101)
}
