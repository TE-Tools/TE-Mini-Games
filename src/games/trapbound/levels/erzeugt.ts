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

/**
 * Der zuschnappende Ausgang braucht mehr Platz.
 *
 * Zwischen dem Auslöser und dem, was er hochfahren lässt, muss ein Bremsweg
 * liegen -- sonst rennt man ins Messer, ohne eine Chance gehabt zu haben,
 * und das wäre nicht gemein, sondern unfair.
 */
const SCHNAPP_BREITE = 150

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
  // Ab Welt 3 (Level 41) gibt es die beiden gemeinen: die Jagd und die
  // Wände. Eingesetzt werden sie aber erst ab Level 50, siehe `istGemein`.
  ['feder', 'teleport', 'jagd', 'waende'],
  ['umkehr', 'schwachersprung'],
  [],
]

/**
 * Die beiden Bausteine, bei denen man nicht überlegen darf.
 *
 * Thomas am 10.09.2026: "ab Level fünfzig auch immer mal wieder gemeine
 * Level, wo sich Wände verschieben, irgendwas hinter einem herläuft [...]
 * dass man das nicht beim ersten Mal schafft."
 */
const GEMEIN = ['jagd', 'waende']

/** Ab hier gibt es gemeine Level. */
export const GEMEIN_AB = 50

/**
 * Wie schwer ein Level sein soll: 0 bis 1.
 *
 * Zwei Anteile: wie weit man insgesamt ist und wie weit in dieser Welt.
 * Dadurch entsteht eine steigende Säge -- jede Welt fängt ruhiger an als sie
 * aufhört, aber Welt 5 fängt trotzdem härter an als Welt 1 aufhört.
 */
export function schwierigkeit(nr: number): number {
  const inWelt = ((nr - 1) % LEVEL_PRO_WELT) + 1
  const gesamt = (nr - 1) / (TRAP_MAX_LEVEL - 1)
  const inWeltAnteil = (inWelt - 1) / (LEVEL_PRO_WELT - 1)
  return Math.min(1, 0.55 * gesamt + 0.45 * inWeltAnteil)
}

/**
 * Welche Plätze in einer Welt gemein sind.
 *
 * Fünf von zwanzig, gleichmäßig verteilt und nie zwei hintereinander: Wenn
 * jedes zweite Level einen jagt, ist es keine Ausnahme mehr, sondern der
 * Normalzustand -- und dann hört der Schreck auf.
 */
const GEMEINE_PLAETZE = [3, 8, 12, 16, 19]

export function istGemein(nr: number): boolean {
  if (nr < GEMEIN_AB) return false
  const inWelt = ((nr - 1) % LEVEL_PRO_WELT) + 1
  return GEMEINE_PLAETZE.includes(inWelt)
}

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
  /** Bausteine, die gerade erst dran waren -- die möglichst nicht. */
  frisch: string[] = [],
  /** Womit das Level anfangen muss (für gemeine Level). */
  erzwungen?: string,
): { namen: string[]; breiten: number[] } {
  const namen: string[] = []
  let rest = platz
  if (erzwungen && BAUSTEINE[erzwungen]!.min <= rest) {
    namen.push(erzwungen)
    rest -= BAUSTEINE[erzwungen]!.min
  }
  while (namen.length < hoechstens) {
    const passt = pool.filter((n) => n !== 'weg' && !namen.includes(n) && BAUSTEINE[n]!.min <= rest)
    // Der erste muss einer sein, der wirklich aufhält.
    const erste = namen.length === 0 ? passt.filter((n) => SPERREND.includes(n)) : passt
    // Und möglichst keiner, den man gerade in den letzten Leveln hatte.
    const neuartig = erste.filter((n) => !frisch.includes(n))
    const moeglich = neuartig.length > 0 ? neuartig : erste
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

/**
 * Der Bauplan für alle erzeugten Level auf einmal.
 *
 * Warum nicht jedes Level für sich: Weil jedes Level für sich nicht wissen
 * kann, was in den Leveln davor stand. Genau daran hat es gekrankt -- am
 * 10.09.2026 meldete Thomas "im Dreißigerbereich viele gleiche Level", und
 * nachgemessen stimmte das: 29, 32 und 34 waren dreimal Stacheln + Knopftür,
 * 22, 24 und 25 dreimal eine Lücke, und von 90 Leveln gab es nur 72
 * verschiedene Bauarten.
 *
 * Deshalb entsteht der Plan in einem Durchgang von Level 11 bis 100. Er
 * merkt sich, welche Paarungen es schon gab und was zuletzt dran war, und
 * würfelt so lange neu, bis beides passt. Weil der Durchgang von einer
 * einzigen festen Zahl ausgeht, kommt trotzdem auf jedem Gerät derselbe Plan
 * heraus -- Level 47 sieht überall gleich aus.
 */
interface PlanEintrag {
  namen: string[]
  breiten: number[]
  gemein: boolean
  name: string
}

/** Wie viele Level zurück eine Paarung nicht wiederkommen darf. */
const NICHT_WIEDER = 90
/** Wie viele Level zurück ein einzelner Baustein gemieden wird. */
const FRISCH_FENSTER = 3

let planSpeicher: PlanEintrag[] | null = null

function bauPlan(): PlanEintrag[] {
  if (planSpeicher) return planSpeicher
  const rng = mulberry(20260910)
  const plan: PlanEintrag[] = []
  const paare = new Map<string, number>()

  for (let nr = 11; nr <= TRAP_MAX_LEVEL; nr++) {
    const welt = weltNummer(nr)
    const inWelt = ((nr - 1) % LEVEL_PRO_WELT) + 1
    const schwer = schwierigkeit(nr)
    const gemein = istGemein(nr)
    const pool = bausteinePool(welt).filter((n) => gemein || !GEMEIN.includes(n))
    const platz = BREITE - START_BREITE - schlussBreite(nr)
    const hoechstens = schwer < 0.25 ? 2 : 3
    const frisch = plan
      .slice(-FRISCH_FENSTER)
      .flatMap((p) => p.namen)
      .filter((n) => !GEMEIN.includes(n))

    let gewaehlt: { namen: string[]; breiten: number[] } | null = null
    // Die Bedingungen weichen in dieser Reihenfolge: erst gilt beides, dann
    // darf ein Baustein aus den letzten Leveln wieder vorkommen, und erst
    // ganz zuletzt eine Paarung. Andersherum wäre es falsch -- ein
    // wiederholter Baustein fällt viel weniger auf als ein Level, das genau
    // so schon einmal dastand.
    for (let versuch = 0; versuch < 90; versuch++) {
      const meideFrisch = versuch < 30
      const meideWiederholung = versuch < 70
      const kandidat = waehleBausteine(
        pool,
        platz,
        hoechstens,
        rng,
        meideFrisch ? frisch : [],
        gemein ? GEMEIN[Math.floor(rng() * GEMEIN.length)]! : undefined,
      )
      const schluessel = [...kandidat.namen].sort().join('+')
      const zuletzt = paare.get(schluessel)
      if (meideWiederholung && zuletzt !== undefined && nr - zuletzt < NICHT_WIEDER) continue
      gewaehlt = kandidat
      paare.set(schluessel, nr)
      break
    }
    const fertig = gewaehlt ?? waehleBausteine(pool, platz, hoechstens, rng)
    plan.push({
      ...fertig,
      gemein,
      name: levelName(nr, fertig.namen, inWelt === LEVEL_PRO_WELT, gemein, plan.at(-1)?.name),
    })
  }

  planSpeicher = plan
  return plan
}

/** Der Ausgang eines Levels – vier Bauarten, eine gemeiner als die andere. */
type SchlussArt = 'tuer' | 'flucht' | 'falsch' | 'zuschnapp'

const SCHLUSS_TEXT: Record<SchlussArt, string> = {
  tuer: '',
  flucht: ' + fliehender Ausgang',
  falsch: ' + falscher Ausgang',
  zuschnapp: ' + zuschnappender Ausgang',
}

/** Wie viel Platz der Ausgang eines Levels braucht. */
function schlussBreite(nr: number): number {
  return istGemein(nr) ? SCHNAPP_BREITE : SCHLUSS_BREITE
}

function baueSchluss(
  art: SchlussArt,
  x: number,
  nr: number,
  umgedreht: boolean,
): { objekte: Objekt[]; loesung: LoesungsSchritt[] } {
  const vor = (rest: Omit<LoesungsSchritt, 'links' | 'rechts'>): LoesungsSchritt =>
    umgedreht ? { ...rest, links: true } : { ...rest, rechts: true }
  const boden: Objekt = {
    typ: 'block',
    x,
    y: BODEN_Y,
    b: art === 'zuschnapp' ? SCHNAPP_BREITE : SCHLUSS_BREITE,
    h: BODEN_H,
  }

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

  if (art === 'zuschnapp') {
    const stachel = `zs${nr}`
    const wand = `zw${nr}`
    return {
      objekte: [
        boden,
        // Die Tür ist zu sehen, der Weg sieht frei aus.
        { typ: 'ziel', x: x + 120, y: BODEN_Y - 32, b: 22, h: 32 },
        // Zwei Schritte vor der Tür: Stacheln aus dem Boden ...
        { typ: 'stachel', id: stachel, x: x + 62, y: BODEN_Y - 12, b: 30, h: 12, versteckt: true },
        // ... und eine Wand, die von der Decke bis auf den Boden kommt.
        //
        // Bis auf den Boden ist wörtlich gemeint: Beim ersten Anlauf blieb
        // sie 34 Punkte darüber stehen, und die Figur spazierte einfach
        // darunter durch. Gemessen daran, wie lange man vor der Tür
        // stehenbleiben durfte, war der Ausgang gar keine Falle.
        {
          typ: 'beweger',
          id: wand,
          x: x + 104,
          y: BODEN_Y - 210,
          b: 14,
          h: 78,
          weg: { dx: 0, dy: 132, dauer: 0.95, einweg: true, wartetAufAusloeser: true },
        },
        // Unten dran Stacheln: Wer zu spät kommt, wird nicht ausgesperrt,
        // sondern erwischt -- und ist gleich wieder im Spiel.
        {
          typ: 'stachel',
          id: `${wand}s`,
          x: x + 104,
          y: BODEN_Y - 132,
          b: 14,
          h: 10,
          weg: { dx: 0, dy: 132, dauer: 0.95, einweg: true, wartetAufAusloeser: true },
        },
        {
          typ: 'zone',
          x: x + 24,
          y: BODEN_Y - 50,
          b: 8,
          h: 50,
          einmal: true,
          loest: [
            { tu: 'zeigen', ziel: stachel },
            // Erst anhalten und springen, dann kommt die Wand: Die
            // Verzögerung ist so bemessen, dass es reicht, wenn man sofort
            // handelt -- und nicht mehr, wenn man einen Moment überlegt.
            { tu: 'los', ziel: wand, nach: 0.75 },
            { tu: 'los', ziel: `${wand}s`, nach: 0.75 },
            { tu: 'beben', wert: 0.4 },
          ],
        },
      ],
      loesung: [
        vor({ bisBoden: true, dauer: 1 }),
        // Bis in den Auslöser -- ab hier läuft die Uhr.
        vor({ bisX: x + 26 }),
        // Anhalten, sonst läuft man in die Stacheln, die gerade erschienen
        // sind. Das ist der Moment, den beim ersten Mal niemand hat.
        { dauer: 0.34 },
        vor({ sprung: true, dauer: 0.34 }),
        vor({ bisBoden: true }),
        // Und jetzt zügig, bevor die Wand unten ist.
        vor({ bisX: x + 122, dauer: 2 }),
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
  const schwer = schwierigkeit(nr)
  const istTor = inWelt === LEVEL_PRO_WELT
  const gemein = istGemein(nr)
  const rng = mulberry(nr * 2654435761 + 1013904223)

  const plan = bauPlan()[nr - 11]!
  const { namen, breiten } = plan

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

  // Auf einem gemeinen Level schnappt der Ausgang zu: Genau davor kommt
  // noch einmal etwas, womit man nicht gerechnet hat.
  const art: SchlussArt = gemein
    ? 'zuschnapp'
    : istTor
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
    name: art === 'falsch' && !istTor ? `${plan.name}?` : plan.name,
    idee: `Aus Bausteinen: ${benutzt.join(' + ')}${SCHLUSS_TEXT[art]}.`,
    start: { x: 18, y: STEH_Y },
    objekte,
    loesung,
  }
}

/** Namen aus dem, was drinsteckt -- damit die Karte nicht "Level 57" sagt. */
const NAMEN: Record<string, string[]> = {
  weg: ['Ruhige Bahn', 'Kurzer Weg', 'Durchatmen', 'Fast geschenkt'],
  luecke: ['Über den Spalt', 'Lücke im Fels', 'Nicht hinunterschauen', 'Ein Schritt zu viel'],
  bruch: ['Der Boden lügt wieder', 'Dünnes Eis', 'Bloß nicht stehenbleiben', 'Knirsch'],
  stacheln: ['Zahnreihe', 'Spitzen', 'Zackig', 'Barfuß wäre schlecht'],
  stachelfalle: ['Zu spät gesehen', 'Aus dem Nichts', 'Überraschung von unten', 'Klick'],
  saege: ['Auf und ab', 'Schnittmuster', 'Im Takt', 'Sägewerk'],
  decke: ['Von oben', 'Kopf einziehen', 'Es donnert', 'Die Decke meint es ernst'],
  aufzug: ['Ruf den Aufzug', 'Fahrstuhl', 'Mitfahrgelegenheit', 'Bitte einsteigen'],
  feder: ['Absprung', 'Über die Mauer', 'Katapult', 'Hoch hinaus'],
  knopftuer: ['Knopf und Tür', 'Kurz offen', 'Erst drücken', 'Türsteher'],
  teleport: ['Kurzer Dienstweg', 'Durch die Wand', 'Ortswechsel', 'Nicht erschrecken'],
  unsichtbar: ['Vertrauensfrage', 'Nicht alles ist Luft', 'Blindgang', 'Glaub es einfach'],
  band: ['Gegen den Strom', 'Laufband', 'Rückwärts vorwärts', 'Zäher Boden'],
  presse: ['Pressluft', 'Nicht stehenbleiben', 'Zwischendurch', 'Flach gemacht'],
  umkehr: ['Alles verkehrt', 'Andersrum', 'Links ist das neue Rechts', 'Verdreht'],
  schwachersprung: ['Schwere Beine', 'Kein Schwung', 'Bleierne Füße', 'Halbe Kraft'],
  jagd: ['Es kommt näher', 'Nicht umdrehen', 'Im Nacken', 'Lauf!'],
  waende: ['Die Wände kommen', 'Enger und enger', 'Zwischen den Wänden', 'Zuschieben'],
}

/** Die Namen für die gemeinen Level -- die sollen schon vorher warnen. */
const GEMEINE_NAMEN = [
  'Kein Halten mehr',
  'Ohne Vorwarnung',
  'Das wird knapp',
  'Beim ersten Mal nie',
  'Gemein',
]

/**
 * Ein Name, der zum Level passt -- und nicht schon beim Nachbarn stand.
 *
 * Der Name kam bisher allein vom letzten Baustein, und weil es nur zwei
 * Namen je Baustein gab, hieß es dreimal hintereinander "Von oben". Jetzt
 * entscheidet die ganze Bausteinfolge mit, es gibt vier Namen je Baustein,
 * und wer denselben Namen wie das Level davor zöge, bekommt den nächsten.
 */
function levelName(
  nr: number,
  teile: string[],
  istTor: boolean,
  gemein: boolean,
  davor: string | undefined,
): string {
  if (istTor) return 'Prüfung'
  if (gemein) {
    const g = mulberry(nr * 104729 + 17)
    g()
    return GEMEINE_NAMEN[Math.floor(g() * GEMEINE_NAMEN.length)]!
  }
  const r = mulberry(nr * 7919 + teile.length * 131 + 5)
  r()
  const haupt = teile[teile.length - 1] ?? 'weg'
  const liste = NAMEN[haupt] ?? ['Weiter']
  let gewaehlt = liste[Math.floor(r() * liste.length)]!
  if (davor !== undefined && gewaehlt === davor) {
    gewaehlt = liste[(liste.indexOf(gewaehlt) + 1) % liste.length]!
  }
  return gewaehlt
}

export function alleErzeugten(): LevelDaten[] {
  const out: LevelDaten[] = []
  for (let nr = 11; nr <= TRAP_MAX_LEVEL; nr++) out.push(erzeugeLevel(nr))
  return out
}
