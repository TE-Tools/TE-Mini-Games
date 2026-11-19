/**
 * Schach – eine Partie: Zugfolge, Notation, Ende.
 *
 * Die Stellung (`stellung.ts`) kennt nur Züge. Hier steht, was eine Partie
 * daraus macht: die Liste der gespielten Züge, wie sie notiert werden, und
 * wann Schluss ist -- Matt, Patt, 50 Züge ohne Schlagen oder Bauernzug,
 * dreimal dieselbe Stellung, zu wenig Material zum Mattsetzen.
 *
 * Eine Partie ist unveränderlich: `zieheIn` liefert eine neue. Das passt
 * zu React, und das Zurücknehmen gegen den Rechner ist ein Nachspielen der
 * Liste ohne die letzten Züge.
 *
 * Die 50-Züge-Regel und die Wiederholung greifen hier von selbst, statt
 * dass jemand sie beanspruchen muss. Am Brett ist das anders; in einer App
 * gibt es niemanden, der dafür die Uhr anhält.
 */

import {
  BAUER,
  DAME,
  KOENIG,
  LAEUFER,
  SPRINGER,
  START_FEN,
  TURM,
  ZUG_KURZ,
  ZUG_LANG,
  Stellung,
  feldAus,
  feldName,
  uci,
  type Farbe,
  type Zug,
} from './stellung'

export type EndeArt =
  | 'matt'
  | 'patt'
  | 'fuenfzig-zuege'
  | 'wiederholung'
  | 'material'
  | 'aufgabe'
  | 'remis-vereinbart'
  | 'ungueltiger-zug'

export interface Ende {
  art: EndeArt
  /** Wer gewonnen hat; null bei Remis. */
  sieger: Farbe | null
}

export interface Partie {
  startFen: string
  /** Die Stellung jetzt. Nicht verändern -- `zieheIn` legt eine neue an. */
  stellung: Stellung
  /** Die Züge in der Kurzform (e2e4, e7e8q). */
  zuege: string[]
  /** Dieselben Züge in algebraischer Notation (Nf3, exd5, O-O, e8=Q#). */
  notation: string[]
  /** Die Schlüssel aller Stellungen der Partie, die erste zuerst. */
  verlauf: string[]
  ende: Ende | null
}

export function neuePartie(fen = START_FEN): Partie {
  const stellung = Stellung.ausFen(fen)
  return {
    startFen: fen,
    stellung,
    zuege: [],
    notation: [],
    verlauf: [stellung.schluessel()],
    ende: endeVon(stellung, [stellung.schluessel()]),
  }
}

/**
 * Reicht das Material noch zum Mattsetzen? Nein bei König gegen König,
 * mit nur einer Leichtfigur, oder wenn nur noch Läufer auf Feldern
 * derselben Farbe stehen.
 */
export function zuWenigMaterial(s: Stellung): boolean {
  const leichte: { art: number; feld: number }[] = []
  for (let feld = 0; feld < 128; feld++) {
    if (feld & 0x88) continue
    const art = Math.abs(s.brett[feld]!)
    if (art === 0 || art === KOENIG) continue
    if (art === BAUER || art === TURM || art === DAME) return false
    leichte.push({ art, feld })
  }
  if (leichte.length <= 1) return true
  if (leichte.every((f) => f.art === LAEUFER)) {
    const farbe = (f: number) => ((f >> 4) + (f & 7)) % 2
    return leichte.every((f) => farbe(f.feld) === farbe(leichte[0]!.feld))
  }
  return false
}

function endeVon(s: Stellung, verlauf: string[]): Ende | null {
  if (s.legaleZuege().length === 0) {
    return s.imSchach()
      ? { art: 'matt', sieger: s.seite === 1 ? 'b' : 'w' }
      : { art: 'patt', sieger: null }
  }
  if (zuWenigMaterial(s)) return { art: 'material', sieger: null }
  if (s.halbzuege >= 100) return { art: 'fuenfzig-zuege', sieger: null }
  const jetzt = verlauf[verlauf.length - 1]
  if (verlauf.filter((k) => k === jetzt).length >= 3) return { art: 'wiederholung', sieger: null }
  return null
}

const BUCHSTABE = ['', '', 'N', 'B', 'R', 'Q', 'K']

/** Ein Zug in algebraischer Notation, aus der Stellung VOR dem Zug. */
export function notationVon(s: Stellung, z: Zug, legale = s.legaleZuege()): string {
  let text: string
  if (z.art === ZUG_KURZ) text = 'O-O'
  else if (z.art === ZUG_LANG) text = 'O-O-O'
  else {
    const art = Math.abs(z.figur)
    const schlaegt = z.geschlagen !== 0
    if (art === BAUER) {
      text = (schlaegt ? feldName(z.von)[0] + 'x' : '') + feldName(z.nach)
      if (z.umwandlung) text += '=' + BUCHSTABE[z.umwandlung]
    } else {
      const andere = legale.filter(
        (o) => o.nach === z.nach && o.figur === z.figur && o.von !== z.von,
      )
      let zusatz = ''
      if (andere.length > 0) {
        const linie = feldName(z.von)[0]!
        const reihe = feldName(z.von)[1]!
        if (andere.every((o) => feldName(o.von)[0] !== linie)) zusatz = linie
        else if (andere.every((o) => feldName(o.von)[1] !== reihe)) zusatz = reihe
        else zusatz = linie + reihe
      }
      text = BUCHSTABE[art] + zusatz + (schlaegt ? 'x' : '') + feldName(z.nach)
    }
  }
  s.ziehe(z)
  if (s.imSchach()) text += s.legaleZuege().length === 0 ? '#' : '+'
  s.nimmZurueck()
  return text
}

/** Den Zug zu einer Kurzform finden -- oder null, wenn er hier nicht erlaubt ist. */
export function findeZug(s: Stellung, kurz: string, legale = s.legaleZuege()): Zug | null {
  const von = feldAus(kurz.slice(0, 2))
  const nach = feldAus(kurz.slice(2, 4))
  const um = kurz[4] ? ' pnbrqk'.indexOf(kurz[4].toLowerCase()) : 0
  return (
    legale.find(
      (z) => z.von === von && z.nach === nach && (z.umwandlung || 0) === (um > 0 ? um : 0),
    ) ?? null
  )
}

/**
 * Einen Zug spielen. Liefert die neue Partie -- oder null, wenn der Zug
 * nicht erlaubt ist oder die Partie schon zu Ende war.
 */
export function zieheIn(p: Partie, kurz: string): Partie | null {
  if (p.ende) return null
  const legale = p.stellung.legaleZuege()
  const z = findeZug(p.stellung, kurz, legale)
  if (!z) return null
  const notation = notationVon(p.stellung, z, legale)
  const s = p.stellung.kopie()
  s.ziehe(z)
  const verlauf = [...p.verlauf, s.schluessel()]
  return {
    startFen: p.startFen,
    stellung: s,
    zuege: [...p.zuege, uci(z)],
    notation: [...p.notation, notation],
    verlauf,
    ende: endeVon(s, verlauf),
  }
}

/** Eine Partie aus einer Zugliste. Hält beim ersten Zug an, der nicht geht. */
export function partieAus(zuege: readonly string[], fen = START_FEN): Partie {
  let p = neuePartie(fen)
  for (const z of zuege) {
    const weiter = zieheIn(p, z)
    if (!weiter) break
    p = weiter
  }
  return p
}

/** Die Partie beenden, ohne dass auf dem Brett etwas geschieht. */
export function beende(p: Partie, ende: Ende): Partie {
  return p.ende ? p : { ...p, ende }
}

/** Die legalen Ziele einer Figur -- für die Punkte auf dem Brett. */
export function zieleVon(p: Partie, feld: number): Zug[] {
  if (p.ende) return []
  return p.stellung.legaleZuege().filter((z) => z.von === feld)
}

export function amZug(p: Partie): Farbe {
  return p.stellung.farbe()
}

/** Die geschlagenen Figuren, nach Farbe des Geschlagenen, wertvollste zuerst. */
export function geschlagen(p: Partie): { w: number[]; b: number[] } {
  const zaehle = (s: Stellung) => {
    const n = new Map<number, number>()
    for (let f = 0; f < 128; f++)
      if (!(f & 0x88) && s.brett[f]) n.set(s.brett[f]!, (n.get(s.brett[f]!) ?? 0) + 1)
    return n
  }
  const anfang = zaehle(Stellung.ausFen(p.startFen))
  const jetzt = zaehle(p.stellung)
  const fehlt = (figur: number) => Math.max(0, (anfang.get(figur) ?? 0) - (jetzt.get(figur) ?? 0))
  const liste = (vorzeichen: number) =>
    [DAME, TURM, LAEUFER, SPRINGER, BAUER].flatMap((art) =>
      Array<number>(fehlt(vorzeichen * art)).fill(vorzeichen * art),
    )
  return { w: liste(1), b: liste(-1) }
}
