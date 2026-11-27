/**
 * Mühle – Brett, Stellung und Zugerzeugung.
 *
 * Das Brett hat 24 Punkte auf drei ineinanderliegenden Quadraten, die an
 * den Seitenmitten verbunden sind. Die Punkte heißen wie üblich nach einem
 * Raster von 7 × 7 Feldern, Linien a–g von links, Reihen 1–7 von unten:
 *
 *     a7 ---------- d7 ---------- g7
 *     |             |             |
 *     |    b6 ----- d6 ----- f6   |
 *     |    |        |        |    |
 *     |    |   c5 - d5 - e5  |    |
 *     a4 - b4 - c4       e4 - f4 - g4
 *     |    |   c3 - d3 - e3  |    |
 *     |    |        |        |    |
 *     |    b2 ----- d2 ----- f2   |
 *     |             |             |
 *     a1 ---------- d1 ---------- g1
 *
 * Index = Stelle in `FELDER` (a1 = 0, g7 = 23). Inhalt eines Punktes:
 * 0 leer, +1 Weiß, -1 Schwarz. Eine Stellung ist unveränderlich: `ziehe`
 * liefert eine neue. Die Hausregeln (`MuehleRegeln`) kommen bei jedem
 * Aufruf mit -- es gibt hier keine Stelle, die eine Spielart kennt.
 *
 * Ein Zug ist alles, was eine Seite in einem Halbzug tut -- auch das
 * Schlagen nach einer Mühle. So kommt er ins Zugbuch, und so bleibt die
 * Reihenfolge einfach: Nach jedem Zug ist der andere dran. Die Kurzform:
 * `d2` (setzen), `a1-a4` (ziehen oder springen), `d2xg7` und `a1-a4xd7`
 * (mit Schlag), `a4xd7xg1` (Doppelschlag, wo die Hausregel ihn erlaubt).
 */

import { STEINE, type MuehleRegeln } from './config'

export type Farbe = 'w' | 'b'

/** Die 24 Punkte, von unten nach oben und von links nach rechts. */
export const FELDER = [
  'a1',
  'd1',
  'g1',
  'b2',
  'd2',
  'f2',
  'c3',
  'd3',
  'e3',
  'a4',
  'b4',
  'c4',
  'e4',
  'f4',
  'g4',
  'c5',
  'd5',
  'e5',
  'b6',
  'd6',
  'f6',
  'a7',
  'd7',
  'g7',
] as const

export const ANZAHL_FELDER = FELDER.length

const index = (name: string) => (FELDER as readonly string[]).indexOf(name)

/** Die 16 Linien zu je drei Punkten. Drei eigene Steine auf einer Linie sind eine Mühle. */
export const MUEHLEN: readonly (readonly [number, number, number])[] = (
  [
    // waagerecht
    ['a1', 'd1', 'g1'],
    ['b2', 'd2', 'f2'],
    ['c3', 'd3', 'e3'],
    ['a4', 'b4', 'c4'],
    ['e4', 'f4', 'g4'],
    ['c5', 'd5', 'e5'],
    ['b6', 'd6', 'f6'],
    ['a7', 'd7', 'g7'],
    // senkrecht
    ['a1', 'a4', 'a7'],
    ['b2', 'b4', 'b6'],
    ['c3', 'c4', 'c5'],
    ['d1', 'd2', 'd3'],
    ['d5', 'd6', 'd7'],
    ['e3', 'e4', 'e5'],
    ['f2', 'f4', 'f6'],
    ['g1', 'g4', 'g7'],
  ] as const
).map((l) => l.map(index) as unknown as readonly [number, number, number])

/** Die Linien durch jeden Punkt -- immer genau zwei. */
export const MUEHLEN_AN: readonly (readonly number[])[] = FELDER.map((_, f) =>
  MUEHLEN.flatMap((m, i) => (m.includes(f) ? [i] : [])),
)

/**
 * Die Nachbarn jedes Punktes. Gezogen wird entlang der Linien, und jede
 * Verbindung des Bretts liegt auf einer der 16 Linien: Nachbarn sind
 * die aufeinanderfolgenden Punkte einer Linie.
 */
export const NACHBARN: readonly (readonly number[])[] = FELDER.map((_, f) => {
  const n = new Set<number>()
  for (const [a, b, c] of MUEHLEN) {
    if (f === a || f === c) n.add(b)
    if (f === b) {
      n.add(a)
      n.add(c)
    }
  }
  return [...n].sort((x, y) => x - y)
})

export const linieVon = (feld: number) => FELDER[feld]!.charCodeAt(0) - 97
export const reiheVon = (feld: number) => Number(FELDER[feld]![1]) - 1
export const feldName = (feld: number): string => FELDER[feld] ?? '?'
/** Ein Punkt aus seinem Namen -- oder -1. */
export const feldAus = (name: string): number => index(name)

export const andere = (f: Farbe): Farbe => (f === 'w' ? 'b' : 'w')
export const vorzeichen = (f: Farbe): number => (f === 'w' ? 1 : -1)
export const farbeVonStein = (stein: number): Farbe | null =>
  stein > 0 ? 'w' : stein < 0 ? 'b' : null

export interface Stellung {
  /** 24 Punkte, siehe oben. Nicht verändern. */
  brett: readonly number[]
  /** Steine, die noch gesetzt werden. */
  hand: Readonly<Record<Farbe, number>>
  amZug: Farbe
  /** Halbzüge in der Zugphase seit der letzten Mühle (für die Remisregeln). */
  ohneMuehle: number
}

export type ZugArt = 'setzen' | 'ziehen' | 'springen'

export interface Zug {
  art: ZugArt
  /** Woher der Stein kommt -- beim Setzen null. */
  von: number | null
  nach: number
  /** Die geschlagenen Steine in der Reihenfolge, in der sie genommen werden. */
  schlag: number[]
  /** Die Linien (Index in `MUEHLEN`), die dieser Zug schließt. */
  muehlen: number[]
}

/** Was eine Seite gerade tut. */
export type Phase = 'setzen' | 'ziehen' | 'springen'

export function grundstellung(): Stellung {
  return {
    brett: Array.from({ length: ANZAHL_FELDER }, () => 0),
    hand: { w: STEINE.jeSeite, b: STEINE.jeSeite },
    amZug: 'w',
    ohneMuehle: 0,
  }
}

/** Wie viele Steine einer Seite auf dem Brett stehen und wie viele sie noch in der Hand hat. */
export function zaehle(s: Stellung, f: Farbe): { brett: number; hand: number } {
  const vz = vorzeichen(f)
  let brett = 0
  for (const x of s.brett) if (x === vz) brett++
  return { brett, hand: s.hand[f] }
}

/** Hand und Brett zusammen. Unter `STEINE.mindestens` ist die Partie verloren. */
export function steineVon(s: Stellung, f: Farbe): number {
  const z = zaehle(s, f)
  return z.brett + z.hand
}

export function phaseVon(s: Stellung, f: Farbe, r: MuehleRegeln): Phase {
  if (s.hand[f] > 0) return 'setzen'
  return r.springen && zaehle(s, f).brett <= STEINE.springenBei ? 'springen' : 'ziehen'
}

/** Steht der Stein auf `feld` in einer geschlossenen Mühle? */
export function inMuehle(brett: readonly number[], feld: number): boolean {
  const x = brett[feld]
  if (!x) return false
  return MUEHLEN_AN[feld]!.some((m) => MUEHLEN[m]!.every((p) => brett[p] === x))
}

/** Die geschlossenen Mühlen der Seite `vz` durch `feld`. */
function muehlenDurch(brett: readonly number[], feld: number, vz: number): number[] {
  return MUEHLEN_AN[feld]!.filter((m) => MUEHLEN[m]!.every((p) => brett[p] === vz))
}

/**
 * Welche Steine der Seite `opfer` geschlagen werden dürfen. Steine in einer
 * Mühle sind geschützt -- außer alle stehen in Mühlen, oder die Hausregel
 * gibt sie frei.
 */
export function schlagbar(brett: readonly number[], opfer: Farbe, r: MuehleRegeln): number[] {
  const vz = vorzeichen(opfer)
  const alle: number[] = []
  for (let f = 0; f < ANZAHL_FELDER; f++) if (brett[f] === vz) alle.push(f)
  if (r.schlagenAusMuehle) return alle
  const frei = alle.filter((f) => !inMuehle(brett, f))
  return frei.length > 0 ? frei : alle
}

/** Alle Wege, einen Stein zu setzen oder zu ziehen -- noch ohne das Schlagen. */
function grundzuege(
  s: Stellung,
  r: MuehleRegeln,
): { art: ZugArt; von: number | null; nach: number }[] {
  const vz = vorzeichen(s.amZug)
  const frei: number[] = []
  for (let f = 0; f < ANZAHL_FELDER; f++) if (s.brett[f] === 0) frei.push(f)
  const phase = phaseVon(s, s.amZug, r)
  if (phase === 'setzen') return frei.map((nach) => ({ art: 'setzen', von: null, nach }))
  const liste: { art: ZugArt; von: number | null; nach: number }[] = []
  for (let von = 0; von < ANZAHL_FELDER; von++) {
    if (s.brett[von] !== vz) continue
    const ziele = phase === 'springen' ? frei : NACHBARN[von]!.filter((n) => s.brett[n] === 0)
    for (const nach of ziele) liste.push({ art: phase, von, nach })
  }
  return liste
}

/** Das Brett nach dem Setzen oder Ziehen, bevor geschlagen wird. */
function nachGrundzug(brett: readonly number[], von: number | null, nach: number, vz: number) {
  const b = brett.slice()
  if (von !== null) b[von] = 0
  b[nach] = vz
  return b
}

/**
 * Alle erlaubten Züge der Seite am Zug, das Schlagen eingeschlossen. Wer
 * eine Mühle schließt, muss schlagen; jeder schlagbare Stein ist ein
 * eigener Zug. Bei zwei Schlägen zählt die Reihenfolge, denn der erste
 * kann den Schutz einer Mühle aufheben -- deshalb ist jede erlaubte
 * Reihenfolge ein eigener Zug.
 */
export function erlaubteZuege(s: Stellung, r: MuehleRegeln): Zug[] {
  if (steineVon(s, s.amZug) < STEINE.mindestens) return []
  const vz = vorzeichen(s.amZug)
  const opfer = andere(s.amZug)
  const liste: Zug[] = []
  for (const g of grundzuege(s, r)) {
    const b = nachGrundzug(s.brett, g.von, g.nach, vz)
    const muehlen = muehlenDurch(b, g.nach, vz)
    if (muehlen.length === 0) {
      liste.push({ ...g, schlag: [], muehlen })
      continue
    }
    const anzahl = r.doppelSchlag ? Math.min(2, muehlen.length) : 1
    const erste = schlagbar(b, opfer, r)
    // Nichts zu schlagen (der Gegner hat noch keinen Stein gesetzt): die Mühle bleibt ohne Schlag.
    if (erste.length === 0) liste.push({ ...g, schlag: [], muehlen })
    for (const c1 of erste) {
      if (anzahl === 1) {
        liste.push({ ...g, schlag: [c1], muehlen })
        continue
      }
      const b2 = b.slice()
      b2[c1] = 0
      const zweite = schlagbar(b2, opfer, r)
      if (zweite.length === 0) liste.push({ ...g, schlag: [c1], muehlen })
      for (const c2 of zweite) liste.push({ ...g, schlag: [c1, c2], muehlen })
    }
  }
  return liste
}

export function ziehe(s: Stellung, z: Zug): Stellung {
  const vz = vorzeichen(s.amZug)
  const brett = nachGrundzug(s.brett, z.von, z.nach, vz)
  for (const c of z.schlag) brett[c] = 0
  const hand = z.art === 'setzen' ? { ...s.hand, [s.amZug]: s.hand[s.amZug] - 1 } : s.hand
  return {
    brett,
    hand,
    amZug: andere(s.amZug),
    ohneMuehle: z.schlag.length > 0 || z.art === 'setzen' ? 0 : s.ohneMuehle + 1,
  }
}

/** Das Brett nach dem Setzen oder Ziehen, aber vor dem Schlagen -- fürs Brett, solange man wählt. */
export function brettVorSchlag(s: Stellung, z: Pick<Zug, 'von' | 'nach'>): number[] {
  return nachGrundzug(s.brett, z.von, z.nach, vorzeichen(s.amZug))
}

/** Der Zug ohne das Schlagen: `d2` oder `a1-a4`. */
export function basisVon(z: Pick<Zug, 'von' | 'nach'>): string {
  return z.von === null ? feldName(z.nach) : `${feldName(z.von)}-${feldName(z.nach)}`
}

/** Die Kurzform eines Zuges, wie sie ins Zugbuch kommt. */
export function kurz(z: Zug): string {
  return basisVon(z) + z.schlag.map((c) => 'x' + feldName(c)).join('')
}

/** Einen Zug aus seiner Kurzform -- nur, wenn er jetzt erlaubt ist. */
export function findeZug(s: Stellung, r: MuehleRegeln, text: string): Zug | null {
  if (typeof text !== 'string') return null
  const t = text.trim()
  return erlaubteZuege(s, r).find((z) => kurz(z) === t) ?? null
}

const zeichen = (x: number) => (x > 0 ? 'W' : x < 0 ? 'B' : '.')

/** Der Schlüssel einer Stellung für die Wiederholungsregel: Brett, Hände, wer zieht. */
export function schluessel(s: Stellung): string {
  return `${s.brett.map(zeichen).join('')}/${s.hand.w}/${s.hand.b}/${s.amZug}`
}

/** Die Stellung als Text -- für den Weg in den Worker und zurück. */
export function alsText(s: Stellung): string {
  return `${schluessel(s)}/${s.ohneMuehle}`
}

export function ausText(text: string): Stellung {
  const [b = '', hw = '0', hb = '0', zug = 'w', ohne = '0'] = text.split('/')
  const brett = Array.from({ length: ANZAHL_FELDER }, (_, i) =>
    b[i] === 'W' ? 1 : b[i] === 'B' ? -1 : 0,
  )
  return {
    brett,
    hand: { w: Number(hw) || 0, b: Number(hb) || 0 },
    amZug: zug === 'b' ? 'b' : 'w',
    ohneMuehle: Number(ohne) || 0,
  }
}

/**
 * Eine Stellung aus Punktnamen -- für Tests und Aufgaben:
 * `stellungAus({ w: ['a1', 'd1'], b: ['g7'] }, 'w', { w: 0, b: 0 })`.
 * Ohne Angabe sind beide Hände leer.
 */
export function stellungAus(
  steine: { w?: readonly string[]; b?: readonly string[] },
  amZug: Farbe = 'w',
  hand: Partial<Record<Farbe, number>> = {},
): Stellung {
  const brett = Array.from({ length: ANZAHL_FELDER }, () => 0)
  for (const n of steine.w ?? []) brett[index(n)] = 1
  for (const n of steine.b ?? []) brett[index(n)] = -1
  return { brett, hand: { w: hand.w ?? 0, b: hand.b ?? 0 }, amZug, ohneMuehle: 0 }
}
