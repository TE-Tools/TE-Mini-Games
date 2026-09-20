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
import { spieleLoesung } from '../loesung'
import { BAUSTEINE, BODEN_Y, BODEN_H, STEH_Y, type BauStelle } from './bausteine'

/**
 * Wie breit ein Level ist.
 *
 * Thomas am 18.09.2026: "die Level sehen ähnlich aus [...] die dürfen auch
 * länger werden und viel schwerer". Das war die Wurzel des Problems, nicht
 * ein Nebenschauplatz: Ein Level war genau ein Bildschirm breit, 480 Punkte.
 * Davon gehen Start und Ausgang ab, es blieben rund 320 -- Platz für zwei,
 * bestenfalls drei Bausteine. Bei vierundzwanzig Bausteinen gibt es davon
 * ein paar hundert sinnvolle Paarungen, und über zweihundertneunzig Level
 * verteilt heißt das: Man sieht dieselbe Sorte Level immer wieder.
 *
 * Drei Bausteine mehr je Level vervielfachen diese Zahl. Deshalb wächst die
 * Breite ab Welt 3 mit jeder Welt, bis auf zweieinhalb Bildschirme. Die
 * Anzeige wandert mit (siehe TrapboundPage), die Figur bleibt gleich groß,
 * und ein Sprung ist überall gleich weit.
 *
 * Die ersten vierzig Level bleiben bei einem Bildschirm: Da lernt man das
 * Spiel, und ein Level, das man ganz sieht, ist dafür das bessere.
 */
export function levelBreite(nr: number): number {
  const welt = weltNummer(nr)
  if (welt <= 2) return 480
  // Im Endspiel geht es noch ein Stück weiter: Bei 1240 waren sechs
  // Bausteine das Maximum, hier passen sieben hinein.
  const deckel = welt >= 16 ? 1480 : 1240
  return Math.min(deckel, 480 + (welt - 2) * 60)
}

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
const SCHNAPP_BREITE = 144

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
  // Ab hier die zweite Hälfte (Level 101). Jede Welt bringt wieder etwas
  // Neues mit, und das Neue ist diesmal das, was man nicht kommen sieht.
  ['blindbruch', 'blindfall'], // 6  Die Tiefe
  ['pendel', 'einsturz'], // 7  Die Schmiede
  // Ab Welt 8 (Level 141) die Wand, die zurückschiebt.
  ['doppelluecke', 'schieber'], // 8  Das Uhrwerk
  // Ab Welt 9 sind die Level lang genug für die Bausteine, die Platz
  // brauchen -- der Fahrsteg, der Bolzen, der Weg übers Dach und die
  // Trittsteine passen in einen einzigen Bildschirm gar nicht hinein.
  ['fahrsteg'], // 9  Die Leere
  ['stachelregen'], // 10 Der Spiegelsaal
  ['schuss'], // 11 Das Gewitter
  ['dachweg'], // 12 Der Schlund
  ['kippstufen'], // 13 Die Maschine
  [], // 14 Der Albtraum
  [], // 15 Das Ende
  // Ab Welt 16 das Endspiel. Jede der fünf Welten bringt noch einmal etwas
  // mit, das es vorher nicht gab -- und keines davon verzeiht.
  ['doppelsaege'], // 16 Die Schneide
  ['fallgitter'], // 17 Das Kesselhaus
  // Die Schwärze bringt zwei Sachen mit: Boden, dem man nicht ansieht, ob
  // er trägt, und die Decke, auf der man läuft.
  ['blindweg', 'kopfueber'], // 18 Die Schwärze
  // Das Räderwerk bringt die Zange und den Sprung, der an der Decke endet.
  ['zange', 'sprungdreh'], // 19 Das Räderwerk
  // Welt 20 führt nichts Neues mehr ein -- sie hat alles.
  [], // 20 Das letzte Licht
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
  // Fest auf hundert bezogen und nicht auf die Gesamtzahl: Sonst wären die
  // ersten hundert Level beim Erweitern auf dreihundert plötzlich leichter
  // geworden, obwohl sie niemand angefasst hat.
  const gesamt = Math.min(1, (nr - 1) / 99)
  const inWeltAnteil = (inWelt - 1) / (LEVEL_PRO_WELT - 1)
  return Math.min(1, 0.55 * gesamt + 0.45 * inWeltAnteil)
}

/** Ab Level 101 beginnt die zweite Hälfte. */
export const HAERTER_AB = 101

/**
 * Wie weit man in der zweiten Hälfte ist: 0 bei Level 101, 1 bei 300.
 *
 * Der zweite Regler neben `schwierigkeit`. Er entscheidet nicht über die
 * Zeitfenster einzelner Fallen -- die sind schon bei 1 angekommen --,
 * sondern darüber, wie viel gleichzeitig passiert: wie oft eine Falle blind
 * ist und wie oft ein Level ein Albtraum wird.
 */
export function haerte(nr: number): number {
  if (nr < HAERTER_AB) return 0
  // Fest auf 300 bezogen, nicht auf die Gesamtzahl: Sonst wären die Level
  // 101 bis 300 beim Erweitern auf vierhundert plötzlich weicher geworden,
  // obwohl sie niemand angefasst hat -- derselbe Fehler, den `schwierigkeit`
  // eine Ecke weiter oben schon einmal vermieden hat.
  return Math.min(1, (nr - HAERTER_AB) / (300 - HAERTER_AB))
}

/** Ab Level 301 beginnt die dritte Hälfte. */
export const ENDSPIEL_AB = 301

/**
 * Wie weit man im Endspiel ist: 0 bei Level 301, 1 bei 400.
 *
 * Thomas am 18.09.2026: "du sollst 100 neue machen" -- und zwar schwere.
 * Der dritte Regler neben `schwierigkeit` und `haerte`. Er entscheidet
 * nicht darüber, *ob* es hart wird, sondern wie viel gleichzeitig: Im
 * Endspiel ist das Gemeine die Regel und nicht die Ausnahme.
 */
export function endspiel(nr: number): number {
  if (nr < ENDSPIEL_AB) return 0
  return Math.min(1, (nr - ENDSPIEL_AB) / (TRAP_MAX_LEVEL - ENDSPIEL_AB))
}

/** Im Endspiel gehört der halben Welt eine Jagd oder eine Wand. */
export function imEndspiel(nr: number): boolean {
  return nr >= ENDSPIEL_AB
}

/**
 * Welche Plätze in einer Welt gemein sind.
 *
 * Fünf von zwanzig, gleichmäßig verteilt und nie zwei hintereinander: Wenn
 * jedes zweite Level einen jagt, ist es keine Ausnahme mehr, sondern der
 * Normalzustand -- und dann hört der Schreck auf.
 */
const GEMEINE_PLAETZE = [3, 8, 12, 16, 19]

/*
 * Und im Endspiel: zehn gemeine und sechs Albträume auf zwanzig Level.
 *
 * Damit bleiben genau vier ruhige Plätze je Welt -- drei, an denen die Welt
 * ihre neue Falle zeigt, und das Tor am Ende. Das ist der Sprung von der
 * zweiten zur dritten Hälfte: Vorher war das Gemeine jedes vierte Level,
 * jetzt sind vier von fünf Leveln gemein oder Albtraum. Ganz ohne Pause
 * geht es trotzdem nicht, sonst hört der Schreck auf.
 */
const ENDSPIEL_GEMEINE_PLAETZE = [1, 4, 6, 7, 10, 11, 13, 16, 17, 19]
const ENDSPIEL_ALPTRAUM_PLAETZE = [2, 5, 9, 12, 15, 18]
const ENDSPIEL_NEU_PLAETZE = [3, 8, 14]

export function istGemein(nr: number): boolean {
  if (nr < GEMEIN_AB) return false
  const inWelt = ((nr - 1) % LEVEL_PRO_WELT) + 1
  if (imEndspiel(nr)) return ENDSPIEL_GEMEINE_PLAETZE.includes(inWelt)
  return GEMEINE_PLAETZE.includes(inWelt)
}

/**
 * Die blinden Bausteine: die, die man vorher nicht sieht.
 *
 * Sie sind der Grund, warum ein Albtraumlevel wirklich zwanzig Versuche
 * kostet und nicht drei. Ein Zeitfenster lernt man in zwei Anläufen; eine
 * Falle, von der man nicht weiß, dass es sie gibt, kostet den ersten
 * Versuch pro Stück -- und danach noch die, in denen man sie zwar kennt,
 * aber die Stelle noch nicht trifft.
 */
const BLIND = ['blindbruch', 'blindfall', 'stachelregen']

/**
 * Bausteine, in denen sich von selbst etwas bewegt oder verändert.
 *
 * Ab Level 150 muss jedes Level mindestens einen davon enthalten. Sonst
 * kämen die vier beweglichen Dinge allein aus dem Ausgang, und der Weg
 * dorthin stünde still.
 */
const BEWEGT = [
  'bruch',
  'stachelfalle',
  'saege',
  'decke',
  'aufzug',
  'knopftuer',
  'band',
  'presse',
  'teleport',
  'blindbruch',
  'blindfall',
  'stachelregen',
  'pendel',
  'schieber',
  'jagd',
  'waende',
  'fahrsteg',
  'schuss',
  'einsturz',
  'kippstufen',
  'doppelsaege',
  'fallgitter',
  'blindweg',
  'zange',
]

/**
 * Bausteine, deren Lösung darin besteht, still zu stehen.
 *
 * Sie vertragen sich nicht mit der Jagd: Wer gejagt wird, kann nicht auf den
 * Takt einer Säge warten. Level 159 war genau das -- Jagd und Säge im selben
 * Level -- und schlicht nicht zu schaffen.
 */
const WARTET = [
  'saege',
  'presse',
  'decke',
  'blindfall',
  'stachelregen',
  'pendel',
  'aufzug',
  'schieber',
  // Auch die vertauschte Steuerung nicht: Der Umweg, den man zum Umlernen
  // braucht, führt einen der Jagd direkt in die Arme. Gemessen an Level 103
  // -- die Figur lief rückwärts in die Sägen, die hinter ihr standen.
  'umkehr',
  // Der Fahrsteg kommt geholt und man wartet auf ihn; beim Bolzen springt
  // man auf der Stelle; und der Weg übers Dach beginnt mit Anhalten, weil
  // ein Sprung mit vollem Schwung über die erste Stufe hinwegträgt.
  'fahrsteg',
  'schuss',
  'dachweg',
  // Bei der Doppelsäge wartet man auf das Pendel; kopfüber hängt man eine
  // Weile an der Decke, wo eine Jagd am Boden nichts ausrichtet und danach
  // alles auf einmal.
  'doppelsaege',
  'kopfueber',
  'sprungdreh',
]

/**
 * Albtraumlevel: gemein und blind zugleich.
 *
 * Drei Plätze je Welt ab Level 101, versetzt zu den gemeinen und nie
 * daneben. Sie bekommen eine Jagd oder Wände, dazu mindestens eine blinde
 * Falle und den zuschnappenden Ausgang.
 */
const ALPTRAUM_PLAETZE = [5, 10, 14]

/**
 * Plätze, an denen die Welt zeigt, was sie Neues mitbringt.
 *
 * Ohne diese Regel ging das Neue im Vorrat unter: Der Schieber kam in
 * hundertfünfzig Leveln fünfmal vor, weil zwanzig andere Bausteine
 * mitkonkurrierten. Man soll eine neue Falle aber mehrfach sehen, bevor sie
 * später zwischen allem anderen auftaucht -- erst lernen, dann anwenden.
 *
 * Die vier Plätze liegen zwischen den gemeinen (3, 8, 12, 16, 19) und den
 * Albträumen (5, 10, 14), stoßen also mit keinem zusammen.
 */
const NEU_PLAETZE = [2, 6, 11, 15]

export function istAlptraum(nr: number): boolean {
  if (nr < HAERTER_AB) return false
  const inWelt = ((nr - 1) % LEVEL_PRO_WELT) + 1
  if (imEndspiel(nr)) return ENDSPIEL_ALPTRAUM_PLAETZE.includes(inWelt)
  return ALPTRAUM_PLAETZE.includes(inWelt)
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
  // Die Bausteine der zweiten Hälfte halten genauso auf -- die Liste war
  // einfach älter als sie. Fehlten sie hier, galt ein Albtraum aus Jagd und
  // blindem Bruchboden als "hält niemanden auf", und die Regel schob ihn in
  // den Notausgang, wo sich die Paarungen dann wiederholten.
  'blindbruch',
  'blindfall',
  'stachelregen',
  'doppelluecke',
  'pendel',
  'schieber',
  'jagd',
  'waende',
  'fahrsteg',
  'schuss',
  'dachweg',
  'einsturz',
  'kippstufen',
  'doppelsaege',
  'fallgitter',
  'blindweg',
  'zange',
  'kopfueber',
  'sprungdreh',
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
): { namen: string[]; breiten: number[]; fueller: number[] } {
  const namen: string[] = []
  let rest = platz
  if (erzwungen && BAUSTEINE[erzwungen]!.min <= rest) {
    namen.push(erzwungen)
    rest -= BAUSTEINE[erzwungen]!.min
  }
  while (namen.length < hoechstens) {
    const passt = pool.filter((n) => {
      if (n === 'weg' || namen.includes(n) || BAUSTEINE[n]!.min > rest) return false
      // Jagd und Warten schließen einander aus, in beide Richtungen.
      if (namen.includes('jagd') && WARTET.includes(n)) return false
      if (n === 'jagd' && namen.some((m) => WARTET.includes(m))) return false
      return true
    })
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
    return {
      namen: ['weg'],
      breiten: [Math.min(platz, 200)],
      fueller: [platz - Math.min(platz, 200)],
    }
  }
  /*
   * Ein Baustein darf höchstens neunzig Punkte breiter werden als nötig.
   *
   * Bis die Level länger wurden, ging die ganze übrige Breite an die
   * Bausteine -- bei drei Stücken auf 320 Punkten war das eine Handbreit und
   * fiel nicht auf. Auf 990 Punkten ist es das nicht mehr, und mehrere
   * Bausteine gehen daran kaputt: Die Knopftür fällt nach anderthalb
   * Sekunden wieder zu, egal wie weit der Weg ist; das Förderband wäre
   * minutenlang; der Federsprung trägt hundertvierzig Punkte und nicht
   * mehr. Gemessen an Level 226, das daran unlösbar wurde.
   *
   * Was übrig bleibt, wird zu ruhigen Strecken zwischen den Fallen. Das ist
   * kein Notbehelf, sondern gut so: Ein Level ganz ohne Luft zwischen den
   * Fallen liest sich nicht mehr.
   */
  const zugabe = Math.min(ZUGABE_MAX, Math.floor(rest / namen.length))
  const breiten = namen.map((n) => BAUSTEINE[n]!.min + zugabe)
  let uebrig = rest - zugabe * namen.length
  const proStueck = Math.floor(uebrig / namen.length)
  const fueller = namen.map(() => proStueck)
  uebrig -= proStueck * namen.length
  fueller[fueller.length - 1]! += uebrig
  return { namen, breiten, fueller }
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
  /** Ruhige Strecke hinter jedem Baustein. */
  fueller: number[]
  gemein: boolean
  alptraum: boolean
  name: string
  schluss: SchlussArt
}

/** Wie viel breiter als nötig ein einzelner Baustein höchstens wird. */
const ZUGABE_MAX = 90

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
  // Gemeine Level und Albträume schöpfen aus einem kleinen Vorrat -- ihr
  // erster Baustein ist immer die Jagd oder die Wände. Damit sich das nicht
  // alle paar Level wiederholt, sind die letzten sechs Paarungen dieser Art
  // gesperrt. (183 und 185 waren sonst zweimal dasselbe.)
  const letzteGemeine: string[] = []
  // Albträume brauchen eine eigene, kürzere Liste: Ihr Vorrat ist klein
  // (Jagd oder Wände, dazu etwas Blindes), da wäre eine lange Sperre nicht
  // zu erfüllen.
  const letzteAlptraeume: string[] = []
  // Und dasselbe für die Ausgänge: Der letzte Meter eines Levels soll nicht
  // dreimal hintereinander derselbe sein.
  const letzteSchluesse: SchlussArt[] = []

  for (let nr = 11; nr <= TRAP_MAX_LEVEL; nr++) {
    const welt = weltNummer(nr)
    const inWelt = ((nr - 1) % LEVEL_PRO_WELT) + 1
    const schwer = schwierigkeit(nr)
    const alptraum = istAlptraum(nr)
    const gemein = istGemein(nr) || alptraum
    const pool = bausteinePool(welt).filter((n) => gemein || !GEMEIN.includes(n))
    const ganz = levelBreite(nr)
    const schluss = waehleSchluss(
      nr,
      gemein,
      inWelt === LEVEL_PRO_WELT,
      ganz - START_BREITE,
      rng,
      letzteSchluesse,
    )
    letzteSchluesse.push(schluss)
    if (letzteSchluesse.length > 3) letzteSchluesse.shift()
    const platz = ganz - START_BREITE - schlussBreite(nr, schluss)
    /*
     * Wie viele Bausteine in ein Level passen.
     *
     * Nicht mehr fest zwei oder drei, sondern so viele, wie die Breite
     * hergibt -- und die wächst mit der Welt. In Welt 3 sind das drei, ganz
     * hinten sechs. Das ist der eigentliche Hebel gegen "immer dasselbe":
     * Aus drei Bausteinen aus einem Vorrat von knapp dreißig lassen sich ein
     * paar tausend Level bauen, aus sechs ein paar Millionen.
     */
    const hoechstens =
      schwer < 0.25 ? 2 : Math.max(3, Math.min(imEndspiel(nr) ? 7 : 6, Math.round(platz / 175)))
    const frisch = plan
      .slice(-FRISCH_FENSTER)
      .flatMap((p) => p.namen)
      .filter((n) => !GEMEIN.includes(n))

    // Auf den Lernplätzen zeigt die Welt, was sie Neues mitbringt.
    const eigene = (WELT_BAUSTEINE[welt - 1] ?? []).filter(
      (n) => n !== 'weg' && !GEMEIN.includes(n) && BAUSTEINE[n]!.min <= platz,
    )
    const lernPlatz = (imEndspiel(nr) ? ENDSPIEL_NEU_PLAETZE : NEU_PLAETZE).indexOf(inWelt)
    const zeigeNeu =
      !gemein && lernPlatz >= 0 && eigene.length > 0 ? eigene[lernPlatz % eigene.length] : undefined

    let gewaehlt: { namen: string[]; breiten: number[]; fueller: number[] } | null = null
    // Die Bedingungen weichen in dieser Reihenfolge: erst gilt beides, dann
    // darf ein Baustein aus den letzten Leveln wieder vorkommen, und erst
    // ganz zuletzt eine Paarung. Andersherum wäre es falsch -- ein
    // wiederholter Baustein fällt viel weniger auf als ein Level, das genau
    // so schon einmal dastand.
    for (let versuch = 0; versuch < 200; versuch++) {
      const meideFrisch = versuch < 60
      const meideWiederholung = versuch < 150
      const kandidat = waehleBausteine(
        pool,
        platz,
        hoechstens,
        rng,
        meideFrisch ? frisch : [],
        gemein ? GEMEIN[Math.floor(rng() * GEMEIN.length)]! : zeigeNeu,
      )
      /*
       * Im Endspiel-Albtraum jagen zwei Dinge gleichzeitig.
       *
       * Bis Level 300 war der erste Baustein eines gemeinen Levels eine
       * Jagd *oder* eine Wand. Ab 301 soll beides zusammen vorkommen
       * können: etwas im Nacken, und vorn geht der Weg zu. Weich, nicht
       * hart -- geht es nach hundertsechzig Anläufen nicht auf, reicht auch
       * eins, sonst käme am Ende gar kein Level heraus.
       */
      if (
        alptraum &&
        imEndspiel(nr) &&
        versuch < 160 &&
        kandidat.namen.filter((n) => GEMEIN.includes(n)).length < 2
      ) {
        continue
      }
      // Im Albtraum muss außerdem etwas Blindes dabei sein.
      if (
        alptraum &&
        versuch < 190 &&
        !kandidat.namen.some((n) => BLIND.includes(n)) &&
        pool.some((n) => BLIND.includes(n))
      ) {
        continue
      }
      // Etwas, das wirklich aufhält, muss dabei sein. Sonst konnte ein
      // erzwungener Lern-Baustein (Teleport, Knopftür) diese Regel
      // aushebeln -- die Level 46, 51 und 55 waren danach mit gehaltener
      // Taste zu schaffen.
      if (
        versuch < 150 &&
        !kandidat.namen.some((n) => SPERREND.includes(n)) &&
        pool.some((n) => SPERREND.includes(n))
      ) {
        continue
      }
      // Ab Level 150: Mindestens ein Baustein, in dem sich selbst etwas tut.
      if (
        nr >= VIER_AB &&
        versuch < 150 &&
        !kandidat.namen.some((n) => BEWEGT.includes(n)) &&
        pool.some((n) => BEWEGT.includes(n))
      ) {
        continue
      }
      const schluessel = [...kandidat.namen].sort().join('+')
      const sperre = alptraum ? letzteAlptraeume : letzteGemeine
      if (gemein && versuch < 190 && sperre.includes(schluessel)) continue
      const zuletzt = paare.get(schluessel)
      if (meideWiederholung && zuletzt !== undefined && nr - zuletzt < NICHT_WIEDER) continue
      gewaehlt = kandidat
      paare.set(schluessel, nr)
      if (gemein) {
        sperre.push(schluessel)
        if (letzteGemeine.length > 12) letzteGemeine.shift()
        if (letzteAlptraeume.length > 3) letzteAlptraeume.shift()
      }
      break
    }
    let notfall = gewaehlt
    if (!notfall) {
      // Nichts gefunden, das alle Regeln erfüllt: Dann wenigstens die
      // Paarung nehmen, die am längsten nicht dran war. Ein blindes
      // Nachziehen hatte hier zwei gleiche Level im Abstand von sechs
      // erzeugt.
      let bester: { namen: string[]; breiten: number[]; fueller: number[] } | null = null
      let besterAbstand = -1
      for (let versuch = 0; versuch < 40; versuch++) {
        const kandidat = waehleBausteine(
          pool,
          platz,
          hoechstens,
          rng,
          [],
          gemein ? GEMEIN[Math.floor(rng() * GEMEIN.length)]! : undefined,
        )
        // Auch hier muss etwas dabei sein, das wirklich aufhält. Ohne diese
        // Zeile rutschte Level 31 als Decke-und-Knopftür durch: mit
        // gehaltener Taste zu schaffen.
        if (
          !kandidat.namen.some((n) => SPERREND.includes(n)) &&
          pool.some((n) => SPERREND.includes(n))
        ) {
          continue
        }
        const schluessel = [...kandidat.namen].sort().join('+')
        const zuletzt = paare.get(schluessel)
        const abstand = zuletzt === undefined ? 9999 : nr - zuletzt
        if (abstand > besterAbstand) {
          besterAbstand = abstand
          bester = kandidat
        }
      }
      if (bester) {
        notfall = bester
        paare.set([...bester.namen].sort().join('+'), nr)
      }
    }
    const fertig = notfall ?? waehleBausteine(pool, platz, hoechstens, rng)
    plan.push({
      ...fertig,
      gemein,
      alptraum,
      schluss,
      name: levelName(
        nr,
        fertig.namen,
        inWelt === LEVEL_PRO_WELT,
        gemein,
        alptraum,
        plan.at(-1)?.name,
      ),
    })
  }

  planSpeicher = plan
  return plan
}

/** Der Ausgang eines Levels – fünf Bauarten, eine gemeiner als die andere. */
export type SchlussArt = 'tuer' | 'flucht' | 'falsch' | 'zuschnapp' | 'hoch'

const SCHLUSS_TEXT: Record<SchlussArt, string> = {
  tuer: '',
  flucht: ' + fliehender Ausgang',
  falsch: ' + falscher Ausgang',
  zuschnapp: ' + zuschnappender Ausgang',
  hoch: ' + Ausgang springt nach oben',
}

/**
 * Die Tür, die nach oben wegspringt, braucht am meisten Platz.
 *
 * Thomas am 18.09.2026: "das man als Beispiel unten Tür sieht und die nach
 * oben springt". Dahinter müssen zwei Stufen und ein Absatz Platz haben,
 * sonst ist die Tür oben und niemand kommt hinterher.
 */
const HOCH_BREITE = 206

const SCHLUSS_MASS: Record<SchlussArt, number> = {
  tuer: SCHLUSS_BREITE,
  flucht: SCHLUSS_BREITE,
  falsch: SCHLUSS_BREITE,
  zuschnapp: SCHNAPP_BREITE,
  hoch: HOCH_BREITE,
}

/** Wie viel Platz der Ausgang eines Levels braucht. */
function schlussBreite(nr: number, art: SchlussArt): number {
  // Ab Level 150 wird mindestens der zuschnappende Schluss eingeplant, auch
  // wenn das Level am Ende doch eine schlichte Tür bekommt: Ob der Ausgang
  // zuschnappt, entscheidet sich erst, wenn feststeht, wie viel sich im Level
  // sonst bewegt -- und die Breite muss vorher feststehen.
  const mindestens =
    istGemein(nr) || istAlptraum(nr) || nr >= VIER_AB ? SCHNAPP_BREITE : SCHLUSS_BREITE
  return Math.max(mindestens, SCHLUSS_MASS[art])
}

/**
 * Welchen Ausgang ein Level bekommt.
 *
 * Bisher war das eine Kette von Würfen, an deren Ende fast immer die
 * schlichte Tür stand: über zweihundert Level hinweg kamen die drei
 * besonderen Ausgänge zusammen seltener vor als die Tür allein. Damit war
 * der letzte Meter eines Levels fast immer derselbe -- und genau der bleibt
 * im Gedächtnis, weil man ihn am häufigsten zu sehen bekommt.
 *
 * Jetzt wird aus einem Vorrat gewählt, der mit der Schwierigkeit wächst, und
 * die letzten drei Ausgänge sind gesperrt.
 */
function waehleSchluss(
  nr: number,
  gemein: boolean,
  istTor: boolean,
  platz: number,
  rng: () => number,
  letzte: SchlussArt[],
): SchlussArt {
  /*
   * Ein gemeines Level endet mit einem Ausgang, der noch einmal zuschlägt.
   *
   * Bis Level 300 war das immer der zuschnappende. Im Endspiel sind aber
   * achtzig von hundert Leveln gemein, und dann steht achtzigmal derselbe
   * letzte Meter da -- genau die Beschwerde, wegen der die Level überhaupt
   * länger geworden sind. Die springende Tür taugt genauso: Sie legt beim
   * Näherkommen Stacheln frei und zwingt zu einem Aufstieg, mit dem niemand
   * gerechnet hat.
   */
  if (gemein) {
    if (!imEndspiel(nr) || platz - HOCH_BREITE < 300) return 'zuschnapp'
    const beide: SchlussArt[] = ['zuschnapp', 'hoch']
    const frei = beide.filter((a) => !letzte.includes(a))
    const woraus = frei.length > 0 ? frei : beide
    return woraus[Math.floor(rng() * woraus.length)]!
  }
  if (istTor) return 'falsch'
  const schwer = schwierigkeit(nr)
  const vorrat: SchlussArt[] = ['tuer']
  if (schwer > 0.3) vorrat.push('flucht')
  if (schwer > 0.45) vorrat.push('falsch')
  // Die springende Tür braucht Platz für ihre Treppe -- erst wenn die Level
  // lang genug sind, passt sie überhaupt hinein. Dreihundert Punkte müssen
  // für die Fallen übrig bleiben: Level 31 bestand sonst aus einer einzigen
  // Knopftür und einem Ausgang, der die halbe Breite fraß.
  if (schwer > 0.4 && platz - HOCH_BREITE >= 300) vorrat.push('hoch')
  if (schwer > 0.6) vorrat.push('zuschnapp')
  const frisch = vorrat.filter((a) => !letzte.includes(a))
  const moeglich = frisch.length > 0 ? frisch : vorrat
  return moeglich[Math.floor(rng() * moeglich.length)]!
}

export function baueSchluss(
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
    b: SCHLUSS_MASS[art],
    h: BODEN_H,
  }

  if (art === 'hoch') {
    const s1 = `ho${nr}a`
    const s2 = `ho${nr}b`
    const sp = `ho${nr}s`
    return {
      objekte: [
        boden,
        /*
         * Die Tür steht unten, in aller Ruhe sichtbar, und sieht aus wie das
         * Ende eines leichten Levels. Kommt man näher, springt sie hoch --
         * und erst in dem Augenblick erscheinen die beiden Stufen, über die
         * man ihr folgen kann, und die Stacheln, die den einfachen Weg
         * darunter zumachen.
         *
         * Die Maße sind gemessen, nicht geraten: Ein Sprung aus dem Stand
         * trägt fünfzig Punkte weit, bis die Füße wieder auf
         * Absatzhöhe sind, und höchstens sechzig hoch. Vierundvierzig
         * und zweiundvierzig Stufenhöhe lassen also Luft, ohne dass es
         * geschenkt wäre.
         */
        {
          typ: 'ziel',
          x: x + 74,
          y: BODEN_Y - 32,
          b: 22,
          h: 32,
          flieht: { dx: 84, dy: -86 },
          loest: [
            { tu: 'zeigen', ziel: s1 },
            { tu: 'zeigen', ziel: s2 },
            { tu: 'zeigen', ziel: sp },
            { tu: 'beben', wert: 0.45 },
          ],
        },
        { typ: 'block', id: s1, x: x + 56, y: BODEN_Y - 44, b: 66, h: 10, versteckt: true },
        { typ: 'block', id: s2, x: x + 136, y: BODEN_Y - 86, b: 56, h: 10, versteckt: true },
        // Unter der Treppe wird es ungemütlich: Wer danebentritt, fängt von
        // vorn an. Sie beginnen erst hinter dem Platz, auf dem man steht,
        // wenn die Tür wegspringt.
        {
          typ: 'stachel',
          id: sp,
          x: x + 78,
          y: BODEN_Y - 12,
          b: 76,
          h: 12,
          versteckt: true,
        },
      ],
      loesung: [
        vor({ bisBoden: true, dauer: 1 }),
        // Bis hierher -- und ab hier ist die Tür oben. Nicht weiter: Die
        // erste Stufe erscheint bei x+56, und wer darunter steht, stößt sich
        // beim Absprung den Kopf an ihrer Unterkante.
        vor({ bisX: x + 30 }),
        { dauer: 0.4 },
        vor({ sprung: true, dauer: 0.36 }),
        vor({ bisBoden: true, dauer: 1.4 }),
        vor({ bisX: x + 104 }),
        vor({ sprung: true, dauer: 0.36 }),
        vor({ bisBoden: true, dauer: 1.4 }),
        vor({ bisX: x + 160, dauer: 1.6 }),
      ],
    }
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
        // Breit genug, um den Bogen zu fangen: Bei 48 Punkten flog die Figur
        // knapp daran vorbei, wenn sie mit Schwung auf die Feder kam, und
        // fiel rechts aus dem Bild.
        { typ: 'block', x: x + 40, y: BODEN_Y - 90, b: 76, h: 10 },
        { typ: 'ziel', x: x + 72, y: BODEN_Y - 122, b: 22, h: 32 },
      ],
      loesung: [
        vor({ bisBoden: true, dauer: 1 }),
        vor({ bisX: x + 2 }),
        // Erst zum Stehen kommen: Wer mit Schwung auf die Feder springt,
        // fliegt an der oberen Plattform vorbei und aus dem Bild heraus.
        { dauer: 0.45 },
        vor({ bisBoden: true, dauer: 2.6 }),
        vor({ bisX: x + 74 }),
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
/**
 * Ein Level bauen -- `variante` dreht nur am Zufall in den Bausteinen.
 *
 * Gebraucht wird das für die Selbstprüfung unten: Wenn eine Variante nicht
 * aufgeht, wird die nächste probiert, statt ein unschaffbares Level
 * auszuliefern.
 */
export function baueLevel(
  nr: number,
  variante: number,
  schlussErzwingen?: SchlussArt,
  /** Höchstens so viele Bausteine nehmen -- der Notausgang, wenn nichts aufgeht. */
  kuerzen = 0,
): LevelDaten {
  const welt = weltNummer(nr)
  const inWelt = ((nr - 1) % LEVEL_PRO_WELT) + 1
  const schwer = schwierigkeit(nr)
  const istTor = inWelt === LEVEL_PRO_WELT
  const planRoh = bauPlan()[nr - 11]!
  // Der Notausgang nimmt nur den ersten Baustein und gibt ihm den ganzen
  // Platz. Jeder Baustein für sich ist nachweislich zu schaffen; erst ihre
  // Übergabe kann klemmen -- Level 151 (Doppellücke und Presse) war so ein
  // Fall.
  const plan: PlanEintrag =
    kuerzen > 0 && kuerzen < planRoh.namen.length
      ? (() => {
          /*
           * Der Notausgang: weniger Bausteine, dafür mehr ruhige Strecke.
           *
           * Zuerst kommen die, in denen sich etwas bewegt -- sonst stünde im
           * gekürzten Level gar nichts mehr (Level 278 kam so auf nur drei
           * bewegliche Dinge statt vier). Die Breite der weggelassenen
           * Stücke wird nicht auf die übrigen verteilt, sondern zu Boden:
           * Ein Baustein, der doppelt so breit ist wie vorgesehen, geht
           * kaputt (siehe ZUGABE_MAX).
           */
          // Zuerst die, die wirklich aufhalten, dann die, in denen sich etwas
          // bewegt. Ohne die erste Hälfte dieser Regel blieb von Level 31
          // eine einzelne Knopftür übrig -- mit gehaltener Taste zu
          // schaffen.
          const rang = (n: string) => (SPERREND.includes(n) ? 0 : 2) + (BEWEGT.includes(n) ? 0 : 1)
          const reihenfolge = planRoh.namen
            .map((n, i) => ({ n, i }))
            .sort((a, x) => rang(a.n) - rang(x.n) || a.i - x.i)
            .slice(0, kuerzen)
            .sort((a, x) => a.i - x.i)
          const weg = planRoh.namen
            .map((_, i) => i)
            .filter((i) => !reihenfolge.some((r) => r.i === i))
            .reduce((summe, i) => summe + planRoh.breiten[i]! + planRoh.fueller[i]!, 0)
          const fueller = reihenfolge.map((r) => planRoh.fueller[r.i]!)
          fueller[fueller.length - 1]! += weg
          return {
            ...planRoh,
            namen: reihenfolge.map((r) => r.n),
            breiten: reihenfolge.map((r) => planRoh.breiten[r.i]!),
            fueller,
          }
        })()
      : planRoh
  // Die Notausgangs-Variante lässt den zuschnappenden Ausgang weg.
  const gemein = (istGemein(nr) || plan.alptraum) && variante >= 0
  const rng = mulberry(nr * 2654435761 + 1013904223 + variante * 7919)

  const { namen, breiten, fueller } = plan

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
    // Die ruhige Strecke dahinter: schlichter Boden zum Durchatmen.
    const ruhe = fueller[i]!
    if (ruhe > 0) {
      objekte.push({ typ: 'block', x, y: BODEN_Y, b: ruhe, h: BODEN_H })
      loesung.push({
        bisX: x + ruhe - 12,
        dauer: ruhe / 100 + 1,
        ...(umgedreht ? { links: true } : { rechts: true }),
      })
      x += ruhe
    }
  }

  // Welcher Ausgang, steht im Plan -- der kennt als einziger die Ausgänge der
  // Nachbarlevel und kann dafür sorgen, dass sich der letzte Meter nicht
  // dreimal hintereinander wiederholt. Auf einem gemeinen Level schnappt er
  // zu: Genau davor kommt noch einmal etwas, womit man nicht gerechnet hat.
  const art: SchlussArt =
    schlussErzwingen ?? (gemein && !imEndspiel(nr) ? 'zuschnapp' : plan.schluss)
  const schluss = baueSchluss(art, x, nr, umgedreht)
  objekte.push(...schluss.objekte)
  loesung.push(...schluss.loesung)

  return {
    nr,
    welt,
    abschnitt: welt,
    name: art === 'falsch' && !istTor ? `${plan.name}?` : plan.name,
    idee: `Aus Bausteinen: ${benutzt.join(' + ')}${SCHLUSS_TEXT[art]}.`,
    breite: levelBreite(nr),
    start: { x: 18, y: STEH_Y },
    objekte,
    loesung,
  }
}

/** Ab hier soll in jedem Level ständig etwas in Bewegung sein. */
export const VIER_AB = 150

/** So viele bewegliche Dinge mindestens, ab Level 150. */
export const WANDEL_ZIEL = 4

/** Und ab Level 301 sechs. */
export const WANDEL_ZIEL_ENDSPIEL = 6

/** Wie viel sich in einem Level mindestens bewegen muss. */
export function wandelZiel(nr: number): number {
  if (nr < VIER_AB) return 0
  return imEndspiel(nr) ? WANDEL_ZIEL_ENDSPIEL : WANDEL_ZIEL
}

/**
 * Wie viel sich in einem Level bewegt oder verändert.
 *
 * Thomas am 11.09.2026: "ab 150 [...] das heißt es sind 4 Sachen die sich
 * verändern verschieben." Gezählt wird alles, was nicht einfach dasteht:
 * was fährt, fällt, bricht, aufgeht, auftaucht oder wegspringt.
 */
export function zaehleWandel(l: LevelDaten): number {
  return l.objekte.filter(
    (o) =>
      o.weg !== undefined ||
      o.typ === 'bruch' ||
      o.typ === 'fall' ||
      o.typ === 'tuer' ||
      o.typ === 'knopf' ||
      o.versteckt === true ||
      o.heimlich === true ||
      o.flieht !== undefined ||
      o.falle === true ||
      // Ein Förderband steht zwar still, verschiebt aber einen -- und genau
      // darum geht es hier.
      o.schub !== undefined,
  ).length
}

/**
 * Blinde Fallen dorthin streuen, wo die Lösung ohnehin in der Luft ist.
 *
 * Der Trick: Wer den Sprung kennt, fliegt darüber hinweg und merkt nichts.
 * Wer ihn nicht kennt, läuft hinein. Damit kostet jede dieser Fallen genau
 * einen Anlauf -- und mehrere davon sind der Grund, warum ein Albtraumlevel
 * nicht in drei Versuchen fällt.
 *
 * Jede Falle wird einzeln geprüft: Sie kommt nur ins Level, wenn die
 * hinterlegte Lösung sie danach immer noch übersteht.
 */
function streueBlindfallen(level: LevelDaten, hoechstens: number, saat: number): LevelDaten {
  const erst = spieleLoesung(level)
  if (!erst.geschafft) return level

  // Stellen suchen, an denen die Figur klar über dem Boden fliegt.
  const boegen: { von: number; bis: number }[] = []
  let start: number | null = null
  for (const punkt of erst.spur) {
    const hoch = !punkt.amBoden && punkt.y < BODEN_Y - 30
    if (hoch && start === null) start = punkt.x
    if (!hoch && start !== null) {
      if (punkt.x - start > 18) boegen.push({ von: start, bis: punkt.x })
      start = null
    }
  }

  const rng = mulberry(saat)
  let gebaut = level
  let gesetzt = 0
  /*
   * Erst alle auf einmal, dann einzeln.
   *
   * Jede Falle einzeln nachzuspielen ist sauber, aber teuer: Ein Level aus
   * sieben Bausteinen ist zwanzig Sekunden lang, und fünfzehn Probeläufe
   * summierten sich auf ein Drittel einer Sekunde, bevor das Level überhaupt
   * erschien. Fast immer gehen ohnehin alle -- also einmal alle zusammen
   * probieren und nur im Fehlerfall zurück auf den einzelnen Weg. Was dabei
   * herauskommt, ist in beiden Fällen dasselbe.
   */
  const alleAufEinmal: Objekt[] = []
  const gesammelt: { mitte: number; breite: number; id: string; zoneX: number }[] = []
  for (const bogen of boegen) {
    if (gesammelt.length >= hoechstens) break
    const mitte = Math.round((bogen.von + bogen.bis) / 2)
    const breite = Math.min(26, Math.max(16, Math.round(bogen.bis - bogen.von - 14)))
    const id = `bz${level.nr}_${gesammelt.length}`
    const aufBoden = level.objekte.some(
      (o) =>
        o.typ === 'block' &&
        o.y === BODEN_Y &&
        o.x <= mitte - 4 &&
        o.x + o.b >= mitte + breite + 4 &&
        !o.weg,
    )
    if (!aufBoden) continue
    if (
      level.objekte.some((o) => o.typ === 'stachel' && Math.abs(o.x - (mitte - breite / 2)) < 24)
    ) {
      continue
    }
    if (gesammelt.some((g) => Math.abs(g.mitte - mitte) < 34)) continue
    const zoneX = Math.max(4, mitte - 74 - Math.round(rng() * 10))
    gesammelt.push({ mitte, breite, id, zoneX })
    alleAufEinmal.push(
      {
        typ: 'stachel',
        id,
        x: mitte - Math.round(breite / 2),
        y: BODEN_Y - 12,
        b: breite,
        h: 12,
        versteckt: true,
      },
      {
        typ: 'zone',
        x: zoneX,
        y: BODEN_Y - 50,
        b: 8,
        h: 50,
        einmal: true,
        loest: [{ tu: 'zeigen', ziel: id }],
      },
    )
  }
  if (alleAufEinmal.length > 0) {
    const zusammen: LevelDaten = { ...level, objekte: [...level.objekte, ...alleAufEinmal] }
    if (spieleLoesung(zusammen).geschafft) return zusammen
  }

  // Der einzelne Weg, wenn alle zusammen nicht aufgehen.
  const rngEinzeln = mulberry(saat)
  for (const bogen of boegen) {
    if (gesetzt >= hoechstens) break
    const mitte = Math.round((bogen.von + bogen.bis) / 2)
    const breite = Math.min(26, Math.max(16, Math.round(bogen.bis - bogen.von - 14)))
    const id = `bz${level.nr}_${gesetzt}`
    // Nur wo auch wirklich Boden ist -- über einer Lücke wäre der Stachel
    // Deko.
    const aufBoden = gebaut.objekte.some(
      (o) =>
        o.typ === 'block' &&
        o.y === BODEN_Y &&
        o.x <= mitte - 4 &&
        o.x + o.b >= mitte + breite + 4 &&
        !o.weg,
    )
    if (!aufBoden) continue
    // Nicht zweimal an dieselbe Stelle: Beim Nachlegen für die
    // Vier-Dinge-Regel würden sich sonst zwei Stachelreihen überlagern.
    if (
      gebaut.objekte.some((o) => o.typ === 'stachel' && Math.abs(o.x - (mitte - breite / 2)) < 24)
    ) {
      continue
    }
    const zoneX = Math.max(4, mitte - 74 - Math.round(rngEinzeln() * 10))
    const versuch: LevelDaten = {
      ...gebaut,
      objekte: [
        ...gebaut.objekte,
        {
          typ: 'stachel',
          id,
          x: mitte - Math.round(breite / 2),
          y: BODEN_Y - 12,
          b: breite,
          h: 12,
          versteckt: true,
        },
        {
          typ: 'zone',
          x: zoneX,
          y: BODEN_Y - 50,
          b: 8,
          h: 50,
          einmal: true,
          loest: [{ tu: 'zeigen', ziel: id }],
        },
      ],
    }
    if (!spieleLoesung(versuch).geschafft) continue
    gebaut = versuch
    gesetzt++
  }
  return gebaut
}

/**
 * Boden, der ohne Vorwarnung nachgibt – dort, wo die Lösung schnell ist.
 *
 * Die zweite Sorte blinder Falle. Sie wird in den Boden geschnitten, nicht
 * daraufgelegt: Der ursprüngliche Block wird geteilt, damit unter der Platte
 * wirklich nichts mehr ist. Wer im Lauf darüber geht, ist drüben, bevor sie
 * nachgibt. Wer zögert oder erst schaut, fällt.
 */
function streueBruchboden(level: LevelDaten, hoechstens: number, saat: number): LevelDaten {
  const erst = spieleLoesung(level)
  if (!erst.geschafft) return level

  // Schnelle Bodenstrecken aus der Spur lesen.
  const stellen: { von: number; bis: number }[] = []
  let start: number | null = null
  for (let i = 1; i < erst.spur.length; i++) {
    const a = erst.spur[i - 1]!
    const b = erst.spur[i]!
    const schnell = b.amBoden && (b.x - a.x) / Math.max(1e-6, b.t - a.t) > 100
    if (schnell && start === null) start = b.x
    if (!schnell && start !== null) {
      if (b.x - start > 40) stellen.push({ von: start, bis: b.x })
      start = null
    }
  }

  const rng = mulberry(saat)
  let gebaut = level
  let gesetzt = 0
  for (const stelle of stellen) {
    if (gesetzt >= hoechstens) break
    const breite = 24
    const von = Math.round(
      stelle.von + 12 + rng() * Math.max(0, stelle.bis - stelle.von - breite - 24),
    )
    const bis = von + breite
    const idx = gebaut.objekte.findIndex(
      (o) =>
        o.typ === 'block' && o.y === BODEN_Y && !o.weg && o.x + 6 <= von && o.x + o.b >= bis + 6,
    )
    if (idx < 0) continue
    if (gebaut.objekte.some((o) => o.typ === 'bruch' && Math.abs(o.x - von) < 40)) continue
    const alt = gebaut.objekte[idx]!
    const objekte = [...gebaut.objekte]
    objekte.splice(
      idx,
      1,
      { ...alt, b: von - alt.x },
      {
        typ: 'bruch',
        x: von,
        y: BODEN_Y,
        b: breite,
        h: BODEN_H,
        // Gerade so lange, dass ein Lauf darüber hinwegkommt und ein
        // Schritt nicht.
        verzoegerung: 0.2,
        heimlich: true,
      },
      { ...alt, x: bis, b: alt.x + alt.b - bis },
    )
    const versuch: LevelDaten = { ...gebaut, objekte }
    if (!spieleLoesung(versuch).geschafft) continue
    gebaut = versuch
    gesetzt++
  }
  return gebaut
}

/**
 * Ein Level bauen und selbst nachspielen.
 *
 * Bisher hat nur der Test geprüft, ob die erzeugten Level aufgehen -- und
 * damit stand die Zusage "jedes Level ist zu schaffen" nur, solange jemand
 * den Test laufen ließ. Mit dreihundert Leveln, blinden Fallen und
 * Albträumen wird das zu wackelig: Jetzt spielt der Generator jede Variante
 * selbst durch und liefert nur aus, was er geschafft hat. Bleibt alles
 * liegen, kommt der schlichte Aufbau ohne zuschnappenden Ausgang.
 *
 * Das kostet einen Durchlauf je Level (wenige Millisekunden) und passiert
 * einmal, weil `levelDaten` das Ergebnis behält.
 */
export function erzeugeLevel(nr: number): LevelDaten {
  for (const versuch of [
    { variante: 0, kuerzen: 0 },
    { variante: 1, kuerzen: 0 },
    { variante: 2, kuerzen: 0 },
    // Mit sieben Bausteinen im Endspiel geht es häufiger schief als mit
    // drei; deshalb erst mehr Würfe, bevor überhaupt gekürzt wird. Vorher
    // rutschten elf Level auf ein einziges Stück herunter, und zwei davon
    // standen direkt nebeneinander (385 und 386 waren beide "nur Jagd").
    { variante: 3, kuerzen: 0 },
    { variante: 4, kuerzen: 0 },
    { variante: 5, kuerzen: 0 },
    // Geht keine Variante auf, klemmt fast immer eine Übergabe zwischen zwei
    // Bausteinen. Dann wird nicht gleich auf ein Stück heruntergegangen,
    // sondern Schritt für Schritt gekürzt -- ein Level aus fünf Fallen ist
    // immer noch besser als eines aus einer.
    { variante: 0, kuerzen: 6 },
    { variante: 1, kuerzen: 6 },
    { variante: 0, kuerzen: 5 },
    { variante: 1, kuerzen: 5 },
    { variante: 0, kuerzen: 4 },
    { variante: 1, kuerzen: 4 },
    { variante: 0, kuerzen: 3 },
    { variante: 1, kuerzen: 3 },
    { variante: 0, kuerzen: 2 },
    { variante: 1, kuerzen: 2 },
    { variante: 0, kuerzen: 1 },
    { variante: 1, kuerzen: 1 },
  ]) {
    const l = baueLevel(nr, versuch.variante, undefined, versuch.kuerzen)
    if (!spieleLoesung(l).geschafft) continue
    const variante = versuch.variante
    // Ab Level 101 kommen blinde Stacheln dazu, im Albtraum am meisten.
    if (nr < HAERTER_AB) return l
    const alp = istAlptraum(nr)
    // Im Endspiel wird reichlich gestreut: Jede blinde Falle kostet einen
    // Anlauf, und genau daraus besteht dort die Schwierigkeit.
    const ende = imEndspiel(nr)
    const stacheln = alp ? (ende ? 9 : 6) : ende ? 5 : 3
    const platten = alp ? (ende ? 6 : 4) : ende ? 3 : 2
    const streuen = (roh: LevelDaten): LevelDaten =>
      streueBruchboden(streueBlindfallen(roh, stacheln, nr * 31 + 7), platten, nr * 131 + 11)

    const fertig = streuen(l)
    if (nr < VIER_AB || zaehleWandel(fertig) >= wandelZiel(nr)) return fertig

    // Zu wenig in Bewegung: Dann schnappt eben der Ausgang zu. Das bringt
    // Stacheln, eine herabfahrende Wand und ihren Auslöser auf einmal --
    // und passt zu dem, was ab hier ohnehin gelten soll: Kurz vor der Tür
    // kommt noch etwas.
    const mitSchnapp = baueLevel(nr, variante, 'zuschnapp', versuch.kuerzen)
    if (!spieleLoesung(mitSchnapp).geschafft) return fertig
    const gestreut = streuen(mitSchnapp)
    return zaehleWandel(gestreut) > zaehleWandel(fertig) ? gestreut : fertig
  }
  return baueLevel(nr, -1)
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
  blindbruch: ['Sah fest aus', 'Nichts deutete darauf hin', 'Plopp', 'Der Boden log'],
  blindfall: ['Aus dem Nichts von oben', 'Wo kam der her', 'Deckenschlag', 'Kopf hoch'],
  pendel: ['Hin und her', 'Warten und springen', 'Das Pendel', 'Im Vorbeigehen'],
  stachelregen: ['Es regnet', 'Von oben kommt mehr', 'Schauer', 'Nicht stehenbleiben, echt'],
  doppelluecke: ['Zweimal springen', 'Der schmale Absatz', 'Zwei Löcher', 'Absatz dazwischen'],
  schieber: ['Zurück mit dir', 'Erst mal warten', 'Die Wand will da lang', 'Rückwärts'],
  fahrsteg: ['Bitte einsteigen', 'Übersetzen', 'Die Fähre', 'Mitfahren, nicht mitlaufen'],
  schuss: ['Duck dich – nein, spring', 'Es kommt was', 'Flach und schnell', 'Der Bolzen'],
  dachweg: ['Über die Mauer', 'Der obere Weg', 'Unten ist zu', 'Übers Dach'],
  einsturz: ['Nicht anhalten', 'Alles bricht', 'Die ganze Strecke', 'Renn einfach'],
  kippstufen: ['Trittsteine', 'Nur kurz stehen', 'Drei Sprünge', 'Nichts hält'],
  doppelsaege: ['Zwei auf einmal', 'Eins nach dem anderen', 'Beide', 'Kein Fenster'],
  fallgitter: ['Das Gitter fällt', 'Eingesperrt', 'Nicht stehenbleiben', 'Der Käfig'],
  blindweg: ['Welcher Boden hält', 'Auswendig', 'Sieht überall gleich aus', 'Rate mal'],
  zange: ['Die Zange', 'Von beiden Seiten', 'Dazwischen', 'Zu spät ist zu spät'],
  kopfueber: ['Kopfüber', 'Oben ist unten', 'An der Decke', 'Falsch herum'],
  sprungdreh: [
    'Spring nicht – doch, spring',
    'Oben angekommen',
    'Der Sprung hört nicht auf',
    'Hochkant',
  ],
}

/** Die Namen für die Albträume. Wer den auf der Karte liest, weiß Bescheid. */
const ALPTRAUM_NAMEN = [
  'Viel Glück',
  'Nicht dein Ernst',
  'Zwanzig Versuche',
  'Wer hat sich das ausgedacht',
  'Das kann nicht sein',
  'Wieder von vorn',
  // Sechs reichten für dreißig Albträume. Im Endspiel sind es sechzig, und
  // dann standen zweimal hintereinander dieselben zwei Wörter auf der Karte.
  'Noch mal von ganz vorn',
  'Das ist Absicht',
  'Dreimal tief durchatmen',
  'Jetzt wird es albern',
  'Lieber nicht',
  'Sag nicht, ich hätte nicht gewarnt',
]

/** Die Namen für die gemeinen Level -- die sollen schon vorher warnen. */
const GEMEINE_NAMEN = [
  'Kein Halten mehr',
  'Ohne Vorwarnung',
  'Das wird knapp',
  'Beim ersten Mal nie',
  'Gemein',
  'Denk nicht nach',
  'Hinter dir',
  'Es wird eng',
  'Nicht anhalten',
  'Jetzt oder nie',
  'Zu spät',
  'Das ging schnell',
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
  alptraum: boolean,
  davor: string | undefined,
): string {
  if (istTor) return 'Prüfung'
  /** Wer denselben Namen wie das Level davor zöge, bekommt den nächsten. */
  const nichtWieder = (liste: string[], gewaehlt: string): string =>
    davor !== undefined && gewaehlt === davor
      ? liste[(liste.indexOf(gewaehlt) + 1) % liste.length]!
      : gewaehlt
  if (alptraum) {
    const a = mulberry(nr * 15486071 + 29)
    a()
    return nichtWieder(ALPTRAUM_NAMEN, ALPTRAUM_NAMEN[Math.floor(a() * ALPTRAUM_NAMEN.length)]!)
  }
  if (gemein) {
    const g = mulberry(nr * 104729 + 17)
    g()
    return nichtWieder(GEMEINE_NAMEN, GEMEINE_NAMEN[Math.floor(g() * GEMEINE_NAMEN.length)]!)
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
