/**
 * Dame – Brett, Stellung und Zugerzeugung.
 *
 * Das Brett hat 64 Felder, Index = Reihe · 8 + Linie (a1 = 0, h8 = 63).
 * Gespielt wird auf den dunklen Feldern; a1 ist dunkel, wie beim Schach.
 * Weiß steht auf den Reihen 1–3 und zieht nach oben, Schwarz auf 6–8.
 *
 * Inhalt eines Feldes: 0 leer, +1 weißer Stein, +2 weiße Dame, -1 schwarzer
 * Stein, -2 schwarze Dame.
 *
 * Eine Stellung ist unveränderlich: `ziehe` liefert eine neue. Die Hausregeln
 * (`DameRegeln`) kommen bei jedem Aufruf mit -- es gibt hier keine Stelle,
 * die eine Spielart kennt.
 *
 * Ein Zug ist die ganze Schlagfolge auf einmal, so wie sie auch ins Zugbuch
 * kommt. Die Kurzform nennt das Startfeld und jedes Landefeld:
 * `c3-d4` (ziehen), `c3xe5xc7` (zweimal schlagen). Sie ist eindeutig, denn
 * zwischen zwei Landefeldern auf einer Diagonale liegt genau ein
 * geschlagener Stein, und ein stiller Zug braucht eine leere Diagonale.
 */

import type { DameRegeln } from './config'

export type Farbe = 'w' | 'b'

export const STEIN = 1
export const DAME = 2

export interface Stellung {
  /** 64 Felder, siehe oben. Nicht verändern. */
  brett: readonly number[]
  amZug: Farbe
  /** Halbzüge seit dem letzten Schlagen oder Steinzug (für die Remisregel). */
  ohneFortschritt: number
}

export interface Zug {
  von: number
  /** Die Landefelder der Reihe nach; das letzte ist das Ziel. */
  pfad: number[]
  /** Die geschlagenen Steine in der Reihenfolge, in der sie übersprungen werden. */
  geschlagen: number[]
  /** Ein Stein, der auf der letzten Reihe stehen bleibt, wird Dame. */
  wirdDame: boolean
}

export const andere = (f: Farbe): Farbe => (f === 'w' ? 'b' : 'w')
export const vorzeichen = (f: Farbe): number => (f === 'w' ? 1 : -1)
export const farbeVonFigur = (figur: number): Farbe | null =>
  figur > 0 ? 'w' : figur < 0 ? 'b' : null

export const reiheVon = (feld: number) => feld >> 3
export const linieVon = (feld: number) => feld & 7
export const istDunkel = (feld: number) => ((reiheVon(feld) + linieVon(feld)) & 1) === 0

export function feldName(feld: number): string {
  return 'abcdefgh'[linieVon(feld)]! + String(reiheVon(feld) + 1)
}

/** Ein Feld aus seinem Namen -- oder -1. */
export function feldAus(name: string): number {
  const m = /^([a-h])([1-8])$/.exec(name)
  if (!m) return -1
  return (Number(m[2]) - 1) * 8 + 'abcdefgh'.indexOf(m[1]!)
}

/** Die vier Diagonalen: nach oben rechts, oben links, unten rechts, unten links. */
const RICHTUNGEN: readonly [number, number][] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]

/** Je Feld und Richtung die Felder entlang der Diagonale, das nächste zuerst. */
const STRAHLEN: number[][][] = Array.from({ length: 64 }, (_, feld) =>
  RICHTUNGEN.map(([dr, dl]) => {
    const felder: number[] = []
    let r = reiheVon(feld) + dr
    let l = linieVon(feld) + dl
    while (r >= 0 && r < 8 && l >= 0 && l < 8) {
      felder.push(r * 8 + l)
      r += dr
      l += dl
    }
    return felder
  }),
)

/** Geht Richtung `d` für diese Farbe nach vorn? Weiß zieht nach oben. */
const vorwaerts = (d: number, vz: number) => RICHTUNGEN[d]![0] > 0 === vz > 0

/** Auf welcher Reihe ein Stein dieser Farbe Dame wird. */
export const umwandlungsReihe = (f: Farbe) => (f === 'w' ? 7 : 0)

export function grundstellung(): Stellung {
  const brett = Array<number>(64).fill(0)
  for (let feld = 0; feld < 64; feld++) {
    if (!istDunkel(feld)) continue
    if (reiheVon(feld) <= 2) brett[feld] = STEIN
    else if (reiheVon(feld) >= 5) brett[feld] = -STEIN
  }
  return { brett, amZug: 'w', ohneFortschritt: 0 }
}

/* ------------------------------------------------------ Zugerzeugung */

/**
 * Alle Schlagfolgen der Figur auf `von`. Eine Folge endet erst, wenn von
 * ihrem Landefeld aus nichts mehr zu schlagen ist (Mehrfachsprung ist
 * Pflicht). Geschlagene Steine bleiben bis zum Ende des Zuges stehen: Sie
 * dürfen nicht ein zweites Mal übersprungen werden und versperren den Weg.
 * Das Startfeld ist während der Folge frei -- die Figur hat es verlassen.
 */
function schlagFolgen(brett: number[], von: number, r: DameRegeln, aus: Zug[]) {
  const figur = brett[von]!
  const vz = Math.sign(figur)
  const istDame = Math.abs(figur) === DAME
  const fliegt = istDame && r.fliegendeDame
  const geschlagen: number[] = []
  const pfad: number[] = []
  brett[von] = 0

  /** Die Sprünge, die von `pos` aus gehen: je Opfer die möglichen Landefelder. */
  function spruenge(pos: number): { opfer: number; landungen: number[] }[] {
    const liste: { opfer: number; landungen: number[] }[] = []
    for (let d = 0; d < 4; d++) {
      if (!istDame && !r.steinSchlaegtRueckwaerts && !vorwaerts(d, vz)) continue
      const strahl = STRAHLEN[pos]![d]!
      let i = 0
      if (fliegt) while (i < strahl.length && brett[strahl[i]!] === 0) i++
      if (i + 1 >= strahl.length) continue
      const opfer = strahl[i]!
      if (brett[opfer]! * vz >= 0 || geschlagen.includes(opfer)) continue
      const landungen: number[] = []
      for (let j = i + 1; j < strahl.length && brett[strahl[j]!] === 0; j++) {
        landungen.push(strahl[j]!)
        if (!fliegt) break
      }
      if (landungen.length > 0) liste.push({ opfer, landungen })
    }
    return liste
  }

  function weiter(pos: number) {
    const moeglich = spruenge(pos)
    if (moeglich.length === 0) {
      if (geschlagen.length === 0) return
      const ziel = pfad[pfad.length - 1]!
      aus.push({
        von,
        pfad: [...pfad],
        geschlagen: [...geschlagen],
        wirdDame: !istDame && reiheVon(ziel) === umwandlungsReihe(vz > 0 ? 'w' : 'b'),
      })
      return
    }
    for (const { opfer, landungen } of moeglich) {
      geschlagen.push(opfer)
      /*
       * Eine fliegende Dame darf hinter dem Opfer landen, wo sie will --
       * aber kann sie von einem der Felder aus weiterschlagen, muss sie
       * eines davon nehmen. Sonst ließe sich der Mehrfachsprung umgehen,
       * indem man ein Feld zu weit oder zu kurz springt.
       */
      const mitFortsetzung = landungen.filter((l) => spruenge(l).length > 0)
      for (const l of mitFortsetzung.length > 0 ? mitFortsetzung : landungen) {
        pfad.push(l)
        weiter(l)
        pfad.pop()
      }
      geschlagen.pop()
    }
  }

  weiter(von)
  brett[von] = figur
}

function stilleZuege(brett: readonly number[], von: number, r: DameRegeln, aus: Zug[]) {
  const figur = brett[von]!
  const vz = Math.sign(figur)
  const istDame = Math.abs(figur) === DAME
  for (let d = 0; d < 4; d++) {
    if (!istDame && !vorwaerts(d, vz)) continue
    for (const nach of STRAHLEN[von]![d]!) {
      if (brett[nach] !== 0) break
      aus.push({
        von,
        pfad: [nach],
        geschlagen: [],
        wirdDame: !istDame && reiheVon(nach) === umwandlungsReihe(vz > 0 ? 'w' : 'b'),
      })
      if (!istDame || !r.fliegendeDame) break
    }
  }
}

/** Nur die Schlagfolgen der Seite am Zug (ohne Mehrheitsfilter). */
function alleSchlaege(s: Stellung, r: DameRegeln): Zug[] {
  const vz = vorzeichen(s.amZug)
  const brett = s.brett.slice()
  const aus: Zug[] = []
  for (let feld = 0; feld < 64; feld++) {
    if (brett[feld]! * vz > 0) schlagFolgen(brett, feld, r, aus)
  }
  return aus
}

/** Alle erlaubten Züge der Seite am Zug. */
export function erlaubteZuege(s: Stellung, r: DameRegeln): Zug[] {
  let schlaege = alleSchlaege(s, r)
  if (r.mehrheitsschlag && schlaege.length > 0) {
    const meiste = Math.max(...schlaege.map((z) => z.geschlagen.length))
    schlaege = schlaege.filter((z) => z.geschlagen.length === meiste)
  }
  if (r.schlagzwang && schlaege.length > 0) return schlaege
  const vz = vorzeichen(s.amZug)
  const still: Zug[] = []
  for (let feld = 0; feld < 64; feld++) {
    if (s.brett[feld]! * vz > 0) stilleZuege(s.brett, feld, r, still)
  }
  return [...schlaege, ...still]
}

/** Kann die Seite am Zug schlagen? */
export function kannSchlagen(s: Stellung, r: DameRegeln): boolean {
  return alleSchlaege(s, r).length > 0
}

export function ziehe(s: Stellung, z: Zug): Stellung {
  const brett = s.brett.slice()
  const figur = brett[z.von]!
  brett[z.von] = 0
  for (const g of z.geschlagen) brett[g] = 0
  brett[z.pfad[z.pfad.length - 1]!] = z.wirdDame ? Math.sign(figur) * DAME : figur
  const fortschritt = z.geschlagen.length > 0 || Math.abs(figur) === STEIN
  return {
    brett,
    amZug: andere(s.amZug),
    ohneFortschritt: fortschritt ? 0 : s.ohneFortschritt + 1,
  }
}

/** Die Kurzform: `c3-d4` oder `c3xe5xc7`. */
export function kurz(z: Zug): string {
  if (z.geschlagen.length === 0) return `${feldName(z.von)}-${feldName(z.pfad[0]!)}`
  return feldName(z.von) + z.pfad.map((p) => 'x' + feldName(p)).join('')
}

/** Den Zug zu einer Kurzform finden -- oder null, wenn er hier nicht erlaubt ist. */
export function findeZug(
  s: Stellung,
  r: DameRegeln,
  text: string,
  liste = erlaubteZuege(s, r),
): Zug | null {
  return liste.find((z) => kurz(z) === text) ?? null
}

/* ------------------------------------------------------- Schreibweise */

const ZEICHEN: Record<number, string> = { 0: '.', 1: 'w', 2: 'W', [-1]: 'b', [-2]: 'B' }
const DUNKLE = Array.from({ length: 64 }, (_, f) => f).filter(istDunkel)

/**
 * Die Stellung als Schlüssel für die Wiederholungsregel: wer am Zug ist und
 * die 32 dunklen Felder von a1 an (`w:wwww…`).
 */
export function schluessel(s: Stellung): string {
  return s.amZug + ':' + DUNKLE.map((f) => ZEICHEN[s.brett[f]!]).join('')
}

/** Die ganze Stellung als Text, samt Zähler -- so reist sie zum Rechner. */
export function alsText(s: Stellung): string {
  return `${schluessel(s)}:${s.ohneFortschritt}`
}

/** Eine Stellung aus `alsText` (oder einem Schlüssel). Wirft bei Unsinn. */
export function ausText(text: string): Stellung {
  const [seite, felder, zaehler] = text.split(':')
  if ((seite !== 'w' && seite !== 'b') || !felder || felder.length !== 32) {
    throw new Error(`Keine Damestellung: ${text}`)
  }
  const brett = Array<number>(64).fill(0)
  DUNKLE.forEach((f, i) => {
    const wert = { '.': 0, w: 1, W: 2, b: -1, B: -2 }[felder[i]!]
    if (wert === undefined) throw new Error(`Keine Damestellung: ${text}`)
    brett[f] = wert
  })
  return { brett, amZug: seite, ohneFortschritt: Number(zaehler) || 0 }
}

/**
 * Eine Stellung aus einer Liste von Figuren, für Tests und das Handbuch:
 * `stellungAus({ w: ['c3', 'Dd4'], b: ['e5'] })` -- ein D davor macht die Dame.
 */
export function stellungAus(
  figuren: { w?: readonly string[]; b?: readonly string[] },
  amZug: Farbe = 'w',
): Stellung {
  const brett = Array<number>(64).fill(0)
  for (const farbe of ['w', 'b'] as const) {
    for (const eintrag of figuren[farbe] ?? []) {
      const dame = eintrag.startsWith('D')
      const feld = feldAus(dame ? eintrag.slice(1) : eintrag)
      if (feld < 0 || !istDunkel(feld)) throw new Error(`Kein dunkles Feld: ${eintrag}`)
      brett[feld] = vorzeichen(farbe) * (dame ? DAME : STEIN)
    }
  }
  return { brett, amZug, ohneFortschritt: 0 }
}

/** Wie viele Steine und Damen eine Farbe noch hat. */
export function zaehle(s: Stellung, f: Farbe): { steine: number; damen: number } {
  const vz = vorzeichen(f)
  let steine = 0
  let damen = 0
  for (const figur of s.brett) {
    if (figur === vz * STEIN) steine++
    else if (figur === vz * DAME) damen++
  }
  return { steine, damen }
}

/** Zählt die Zugfolgen bis zur Tiefe -- zum Prüfen der Zugerzeugung. */
export function perft(s: Stellung, r: DameRegeln, tiefe: number): number {
  if (tiefe === 0) return 1
  const liste = erlaubteZuege(s, r)
  if (tiefe === 1) return liste.length
  let n = 0
  for (const z of liste) n += perft(ziehe(s, z), r, tiefe - 1)
  return n
}
