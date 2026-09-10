/**
 * Die Level 11 bis 100 – aus Bausteinen zusammengesetzt.
 *
 * Warum erzeugt und nicht von Hand: Neunzig Level von Hand zu bauen ist
 * machbar, sie alle von Hand *nachzuweisen* nicht. Hier entsteht mit der
 * Geometrie zusammen die Lösung; der Test spielt sie ab. Damit gilt für
 * jedes einzelne Level dasselbe wie für die zehn handgebauten aus Welt 1:
 * Es ist zu schaffen, und zwar nachgerechnet.
 *
 * Erzeugt heißt nicht zufällig. Der Zufall hängt an der Levelnummer, also
 * sieht Level 47 heute aus wie morgen und auf jedem Gerät gleich. Welche
 * Bausteine überhaupt vorkommen dürfen, entscheidet die Welt -- so lernt man
 * in der Fabrik die Bänder und Pressen kennen, bevor sie im Chaos zusammen
 * mit allem anderen auftreten.
 */

import type { LevelDaten, LoesungsSchritt, Objekt } from '../types'
import { LEVEL_PRO_WELT, TRAP_MAX_LEVEL, weltNummer } from '../welten'
import { BAUSTEINE, BODEN_Y, BODEN_H, STEH_Y, type BauStelle } from './bausteine'

const BREITE = 480
/** Ab hier beginnt der erste Abschnitt. */
const START_BREITE = 44
/**
 * So viel Platz bekommt der Ausgang.
 *
 * Reichlich bemessen wegen des fliehenden Ausgangs: Zwischen der Stelle, an
 * der er wegspringt, und den Stacheln, die er dabei freilegt, muss genug
 * Boden liegen, um im Lauf noch anzuhalten.
 */
const SCHLUSS_BREITE = 120

function mulberry(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** Welche Bausteine eine Welt kennt. Jede Welt erbt von der davor. */
const WELT_BAUSTEINE: string[][] = [
  ['weg', 'luecke', 'bruch', 'stacheln', 'stachelfalle', 'decke', 'unsichtbar', 'saege'],
  ['band', 'presse', 'knopftuer', 'aufzug'],
  ['feder', 'teleport'],
  ['umkehr', 'schwachersprung'],
  [],
]

function bausteinePool(welt: number): string[] {
  const out: string[] = []
  for (let w = 0; w < welt; w++) out.push(...(WELT_BAUSTEINE[w] ?? []))
  return out
}

/**
 * Bausteine, an denen Draufloslaufen scheitert.
 *
 * Decke, Knopftür, unsichtbarer Steg, Band, Feder und Teleport sind Rätsel
 * darüber, was man *weiß* -- wer die Taste nach rechts hält, kommt trotzdem
 * durch. Ein Level nur aus solchen Stücken wäre kein Trapbound-Level.
 * Deshalb ist der erste Baustein immer einer von hier: eine Lücke, eine
 * Falle, eine Säge, eine vertauschte Steuerung. Irgendetwas, das einen
 * anhält.
 */
const SPERREND = [
  'luecke',
  'bruch',
  'stacheln',
  'stachelfalle',
  'saege',
  'presse',
  'aufzug',
  'umkehr',
  'schwachersprung',
]

/**
 * Welche Bausteine in ein Level passen -- und wie breit sie werden dürfen.
 *
 * Der erste Anlauf verteilte die Breite gleichmäßig auf eine vorher
 * festgelegte Zahl von Abschnitten. Bei drei Abschnitten blieben davon je
 * 114 Punkte übrig, und damit fielen dreizehn der sechzehn Bausteine durch
 * ihr Mindestmaß: Level 47 im Turm bestand aus Weg, Stacheln, Weg. Deshalb
 * wird jetzt andersherum gerechnet -- erst nehmen, was noch in den Platz
 * passt, dann den Rest auf die genommenen Stücke verteilen. So sind alle
 * Abschnitte echte Fallen, und die übrige Breite kommt ihnen zugute.
 */
function waehleBausteine(
  pool: string[],
  platz: number,
  hoechstens: number,
  rng: () => number,
): { namen: string[]; breiten: number[] } {
  const namen: string[] = []
  let rest = platz
  while (namen.length < hoechstens) {
    const passt = pool.filter((n) => n !== 'weg' && !namen.includes(n) && BAUSTEINE[n]!.min <= rest)
    // Der erste muss einer sein, der wirklich aufhält.
    const erste = namen.length === 0 ? passt.filter((n) => SPERREND.includes(n)) : []
    const moeglich = erste.length > 0 ? erste : passt
    if (moeglich.length === 0) break
    const name = moeglich[Math.floor(rng() * moeglich.length)]!
    namen.push(name)
    rest -= BAUSTEINE[name]!.min
  }
  // Kann vorkommen, wenn eine Welt nur breite Bausteine kennt: dann lieber
  // ein ruhiges Level als gar keins.
  if (namen.length === 0) {
    return { namen: ['weg'], breiten: [platz] }
  }
  const zugabe = Math.floor(rest / namen.length)
  const breiten = namen.map((n) => BAUSTEINE[n]!.min + zugabe)
  breiten[breiten.length - 1]! += rest - zugabe * namen.length
  return { namen, breiten }
}

/** Der Ausgang eines Levels – drei Bauarten, eine gemeiner als die andere. */
type SchlussArt = 'tuer' | 'flucht' | 'falsch'

function baueSchluss(
  art: SchlussArt,
  x: number,
  nr: number,
  umgedreht: boolean,
): { objekte: Objekt[]; loesung: LoesungsSchritt[] } {
  const vor = (rest: Omit<LoesungsSchritt, 'links' | 'rechts'>): LoesungsSchritt =>
    umgedreht ? { ...rest, links: true } : { ...rest, rechts: true }
  const boden: Objekt = { typ: 'block', x, y: BODEN_Y, b: SCHLUSS_BREITE, h: BODEN_H }

  if (art === 'flucht') {
    const id = `fl${nr}`
    return {
      objekte: [
        boden,
        // Der Absatz liegt 44 Punkte hoch: Ein Sprung trägt knapp sechzig,
        // und die Figur muss mit den Füßen darüber kommen, nicht nur mit dem
        // Kopf. Bei 52 blieb dafür nur ein Fünftel Sekunde -- zu wenig, wenn
        // die Figur ein paar Punkte weiter rechts zum Stehen kommt als
        // gedacht. Bei 44 ist das Fenster halb so eng.
        { typ: 'block', x: x + 80, y: BODEN_Y - 44, b: 40, h: 10 },
        { typ: 'stachel', id, x: x + 60, y: BODEN_Y - 12, b: 24, h: 12, versteckt: true },
        {
          typ: 'ziel',
          x: x + 66,
          y: BODEN_Y - 32,
          b: 22,
          h: 32,
          flieht: { dx: 28, dy: -44 },
          loest: [
            { tu: 'zeigen', ziel: id },
            { tu: 'beben', wert: 0.3 },
          ],
        },
      ],
      loesung: [
        vor({ bisBoden: true, dauer: 1 }),
        // Bis hierher, dann springt der Ausgang weg und die Stacheln kommen
        // zum Vorschein. Wer jetzt weiterläuft, läuft hinein -- also erst
        // anhalten, dann springen. Genau diese halbe Sekunde ist der Witz
        // der Falle, und sie braucht Boden: deshalb der breite Schluss.
        vor({ bisX: x + 26 }),
        { dauer: 0.45 },
        vor({ sprung: true, dauer: 0.34 }),
        vor({ bisBoden: true }),
        vor({ dauer: 0.5 }),
      ],
    }
  }

  if (art === 'falsch') {
    return {
      objekte: [
        boden,
        { typ: 'feder', x: x + 4, y: BODEN_Y, b: 26, h: 14, kraft: 620 },
        { typ: 'ziel', x: x + 40, y: BODEN_Y - 32, b: 22, h: 32, falle: true },
        { typ: 'schild', x: x + 34, y: BODEN_Y - 54, b: 40, h: 13, text: 'AUSGANG' },
        { typ: 'block', x: x + 44, y: BODEN_Y - 90, b: 48, h: 10 },
        { typ: 'ziel', x: x + 58, y: BODEN_Y - 122, b: 22, h: 32 },
      ],
      loesung: [
        vor({ bisBoden: true, dauer: 1 }),
        vor({ bisX: x + 2 }),
        vor({ bisBoden: true, dauer: 2.6 }),
        vor({ bisX: x + 58 }),
      ],
    }
  }

  return {
    objekte: [boden, { typ: 'ziel', x: x + 56, y: BODEN_Y - 32, b: 22, h: 32 }],
    loesung: [vor({ bisX: x + 58 })],
  }
}

/**
 * Ein Level aus Abschnitten bauen.
 *
 * Die Breite wird gleichmäßig auf die Abschnitte verteilt; welche Bausteine
 * passen, entscheidet ihr Mindestmaß. Passt keiner, kommt schlichter Boden --
 * lieber eine ruhige Stelle als ein Level, das nicht aufgeht.
 */
export function erzeugeLevel(nr: number): LevelDaten {
  const welt = weltNummer(nr)
  const inWelt = ((nr - 1) % LEVEL_PRO_WELT) + 1
  // Zwei Anteile: wie weit man insgesamt ist und wie weit in dieser Welt.
  // Dadurch entsteht eine steigende Säge -- jede Welt fängt ruhiger an als
  // sie aufhört, aber Welt 5 fängt trotzdem härter an als Welt 1 aufhört.
  const gesamt = (nr - 1) / (TRAP_MAX_LEVEL - 1)
  const inWeltAnteil = (inWelt - 1) / (LEVEL_PRO_WELT - 1)
  const schwer = Math.min(1, 0.55 * gesamt + 0.45 * inWeltAnteil)
  const istTor = inWelt === LEVEL_PRO_WELT
  const rng = mulberry(nr * 2654435761 + 1013904223)

  const pool = bausteinePool(welt)
  const platz = BREITE - START_BREITE - SCHLUSS_BREITE
  // Am Anfang einer Welt höchstens zwei Fallen -- erst kennenlernen, dann
  // stapeln. Mehr als drei passen bei 480 Punkten Breite ohnehin nicht.
  const hoechstens = schwer < 0.25 ? 2 : 3
  const { namen, breiten } = waehleBausteine(pool, platz, hoechstens, rng)

  const objekte: Objekt[] = [{ typ: 'block', x: 0, y: BODEN_Y, b: START_BREITE, h: BODEN_H }]
  const loesung: LoesungsSchritt[] = []
  let x = START_BREITE
  let umgedreht = false
  const benutzt: string[] = []

  for (let i = 0; i < namen.length; i++) {
    const name = namen[i]!
    benutzt.push(name)
    const stelle: BauStelle = {
      x,
      breite: breiten[i]!,
      schwer,
      rng,
      nr: nr * 10 + i,
      umgedreht,
    }
    const stueck = BAUSTEINE[name]!.bau(stelle)
    objekte.push(...stueck.objekte)
    loesung.push(...stueck.loesung)
    if (stueck.umgedreht !== undefined) umgedreht = stueck.umgedreht
    // Übergabe an den nächsten Abschnitt: erst landen, dann kurz stehen.
    // Ohne das trägt ein Sprung aus dem letzten Abschnitt die Figur weit in
    // den nächsten hinein, dessen Anlauf dann schon erfüllt ist -- und der
    // Sprung über die nächste Falle kommt zu spät.
    loesung.push({
      bisBoden: true,
      dauer: 1.2,
      ...(umgedreht ? { links: true } : { rechts: true }),
    })
    loesung.push({ dauer: 0.18 })
    x += breiten[i]!
  }

  const art: SchlussArt = istTor
    ? 'falsch'
    : schwer > 0.55 && rng() < 0.4
      ? 'flucht'
      : schwer > 0.75 && rng() < 0.3
        ? 'falsch'
        : 'tuer'
  const schluss = baueSchluss(art, x, nr, umgedreht)
  objekte.push(...schluss.objekte)
  loesung.push(...schluss.loesung)

  return {
    nr,
    welt,
    abschnitt: welt,
    name: levelName(nr, benutzt, art, istTor),
    idee: `Aus Bausteinen: ${benutzt.join(' + ')}${art === 'tuer' ? '' : ` + ${art === 'flucht' ? 'fliehender' : 'falscher'} Ausgang`}.`,
    start: { x: 18, y: STEH_Y },
    objekte,
    loesung,
  }
}

/** Namen aus dem, was drinsteckt -- damit die Karte nicht "Level 57" sagt. */
const NAMEN: Record<string, string[]> = {
  weg: ['Ruhige Bahn', 'Kurzer Weg'],
  luecke: ['Über den Spalt', 'Lücke im Fels'],
  bruch: ['Der Boden lügt wieder', 'Dünnes Eis'],
  stacheln: ['Zahnreihe', 'Spitzen'],
  stachelfalle: ['Zu spät gesehen', 'Aus dem Nichts'],
  saege: ['Auf und ab', 'Schnittmuster'],
  decke: ['Von oben', 'Kopf einziehen'],
  aufzug: ['Ruf den Aufzug', 'Fahrstuhl'],
  feder: ['Absprung', 'Über die Mauer'],
  knopftuer: ['Knopf und Tür', 'Kurz offen'],
  teleport: ['Kurzer Dienstweg', 'Durch die Wand'],
  unsichtbar: ['Vertrauensfrage', 'Nicht alles ist Luft'],
  band: ['Gegen den Strom', 'Laufband'],
  presse: ['Pressluft', 'Nicht stehenbleiben'],
  umkehr: ['Alles verkehrt', 'Andersrum'],
  schwachersprung: ['Schwere Beine', 'Kein Schwung'],
}

function levelName(nr: number, teile: string[], art: SchlussArt, istTor: boolean): string {
  if (istTor) return 'Prüfung'
  const r = mulberry(nr * 7919 + 5)
  r()
  const haupt = teile[teile.length - 1] ?? 'weg'
  const liste = NAMEN[haupt] ?? ['Weiter']
  const gewaehlt = liste[Math.floor(r() * liste.length)]!
  return art === 'falsch' ? `${gewaehlt}?` : gewaehlt
}

export function alleErzeugten(): LevelDaten[] {
  const out: LevelDaten[] = []
  for (let nr = 11; nr <= TRAP_MAX_LEVEL; nr++) out.push(erzeugeLevel(nr))
  return out
}
