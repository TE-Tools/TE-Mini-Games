/**
 * Schach – der Computergegner.
 *
 * Ein Negamax mit Alpha-Beta-Schnitt, Ruhesuche für Schlagabtausche und
 * iterativer Vertiefung bei der schweren Stufe. Bewertet wird Material plus
 * Feldtabellen (wo steht eine Figur gut?), im Endspiel dazu, wie weit der
 * gegnerische König am Rand steht -- sonst schiebt der Rechner mit Dame
 * und König gegen König endlos hin und her, statt mattzusetzen.
 *
 * Zufall nur über den mitgegebenen Startwert: Mit demselben Startwert zieht
 * er dasselbe. Das macht ihn prüfbar.
 *
 * Die Wiederholungsregel prüft er nur an der Wurzel: Ein Zug, der die
 * Stellung zum dritten Mal herbeiführt, ist Remis -- gut, wenn er schlechter
 * steht, schlecht, wenn er gewinnt. Tiefer im Baum sähe er das nur mit
 * deutlich mehr Rechenaufwand.
 */

import { mulberry32 } from '@/games/rng'
import { STUFEN, WERTE, type SchachStufe, type StufenWerte } from './config'
import { BAUER, DAME, KOENIG, Stellung, TURM, uci, type Zug } from './stellung'

const MATT = 30000
const UNENDLICH = 100000

/* Feldtabellen aus Sicht von Weiß, Reihe 8 oben -- wie man ein Brett liest. */
// prettier-ignore
const TAB_BAUER = [
   0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
]
// prettier-ignore
const TAB_SPRINGER = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
]
// prettier-ignore
const TAB_LAEUFER = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
]
// prettier-ignore
const TAB_TURM = [
   0,  0,  0,  0,  0,  0,  0,  0,
   5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
   0,  0,  0,  5,  5,  0,  0,  0,
]
// prettier-ignore
const TAB_DAME = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
   -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20,
]
// prettier-ignore
const TAB_KOENIG_MITTE = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20,
]
// prettier-ignore
const TAB_KOENIG_ENDE = [
  -50,-40,-30,-20,-20,-30,-40,-50,
  -30,-20,-10,  0,  0,-10,-20,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-30,  0,  0,  0,  0,-30,-30,
  -50,-30,-30,-30,-30,-30,-30,-50,
]

const TABELLEN = [[], TAB_BAUER, TAB_SPRINGER, TAB_LAEUFER, TAB_TURM, TAB_DAME]

/** Wo in einer Tabelle ein Feld steht, aus Sicht der Farbe. */
function index(feld: number, weiss: boolean): number {
  const reihe = feld >> 4
  const linie = feld & 7
  return (weiss ? 7 - reihe : reihe) * 8 + linie
}

/**
 * Die Stellung aus Sicht dessen, der am Zug ist. Positiv: gut für ihn.
 */
export function bewerte(s: Stellung): number {
  let mitte = 0
  let ende = 0
  let phase = 0
  const material: [number, number] = [0, 0]
  for (let feld = 0; feld < 128; feld++) {
    if (feld & 0x88) {
      feld += 7
      continue
    }
    const f = s.brett[feld]!
    if (f === 0) continue
    const weiss = f > 0
    const art = weiss ? f : -f
    const vz = weiss ? 1 : -1
    const i = index(feld, weiss)
    if (art === KOENIG) {
      mitte += vz * TAB_KOENIG_MITTE[i]!
      ende += vz * TAB_KOENIG_ENDE[i]!
      continue
    }
    const wert = WERTE[art]! + TABELLEN[art]![i]!
    mitte += vz * wert
    ende += vz * wert
    if (art !== BAUER) {
      phase += art === DAME ? 4 : art === TURM ? 2 : 1
      material[weiss ? 0 : 1] += WERTE[art]!
    }
  }
  // 24 = alle Figuren auf dem Brett (2 Damen, 4 Türme, 8 Leichtfiguren).
  const p = Math.min(phase, 24)
  let wert = (mitte * p + ende * (24 - p)) / 24

  // Mattführung: Wer klar vorn liegt, treibt den König an den Rand und
  // rückt mit dem eigenen nach.
  const vorsprung = material[0]! - material[1]!
  if (p <= 8 && Math.abs(vorsprung) >= 300) {
    const sieger = vorsprung > 0 ? 0 : 1
    const verlierer = s.koenig[1 - sieger]!
    const eigener = s.koenig[sieger]!
    const randAbstand = (feld: number) =>
      Math.max(3 - (feld >> 4), (feld >> 4) - 4) + Math.max(3 - (feld & 7), (feld & 7) - 4)
    const nah =
      14 - (Math.abs((eigener >> 4) - (verlierer >> 4)) + Math.abs((eigener & 7) - (verlierer & 7)))
    const zug = randAbstand(verlierer) * 10 + nah * 4
    wert += sieger === 0 ? zug : -zug
  }
  return Math.round(wert) * s.seite
}

interface Suche {
  werte: StufenWerte
  ende: number
  knoten: number
  abgebrochen: boolean
  killer: Zug[][]
}

function gleich(a: Zug | undefined, b: Zug): boolean {
  return Boolean(a) && a!.von === b.von && a!.nach === b.nach && a!.umwandlung === b.umwandlung
}

/** Gute Züge zuerst: Dann schneidet Alpha-Beta mehr weg. */
function ordne(zuege: Zug[], erster: Zug | null, killer: Zug[] | undefined): Zug[] {
  const wert = (z: Zug) => {
    if (erster && gleich(erster, z)) return 1e6
    let w = 0
    if (z.geschlagen) w += 10000 + 10 * WERTE[Math.abs(z.geschlagen)]! - WERTE[Math.abs(z.figur)]! / 10
    if (z.umwandlung) w += 9000 + WERTE[z.umwandlung]!
    if (killer && (gleich(killer[0], z) || gleich(killer[1], z))) w += 5000
    return w
  }
  return zuege
    .map((z) => ({ z, w: wert(z) }))
    .sort((a, b) => b.w - a.w)
    .map((e) => e.z)
}

function zeitUm(su: Suche): boolean {
  if ((su.knoten & 1023) === 0 && performance.now() > su.ende) su.abgebrochen = true
  return su.abgebrochen
}

function ruhe(s: Stellung, alpha: number, beta: number, su: Suche, ply: number): number {
  su.knoten++
  if (zeitUm(su)) return 0
  const stehen = bewerte(s)
  if (stehen >= beta) return beta
  if (stehen > alpha) alpha = stehen
  if (ply > 40) return alpha
  for (const z of ordne(s.pseudoZuege(true), null, undefined)) {
    s.ziehe(z)
    if (s.imSchach(-s.seite)) {
      s.nimmZurueck()
      continue
    }
    const wert = -ruhe(s, -beta, -alpha, su, ply + 1)
    s.nimmZurueck()
    if (su.abgebrochen) return 0
    if (wert >= beta) return beta
    if (wert > alpha) alpha = wert
  }
  return alpha
}

function suche(
  s: Stellung,
  tiefe: number,
  alpha: number,
  beta: number,
  su: Suche,
  ply: number,
): number {
  if (tiefe <= 0) {
    if (su.werte.ruhesuche) return ruhe(s, alpha, beta, su, ply)
    su.knoten++
    return bewerte(s)
  }
  su.knoten++
  if (zeitUm(su)) return 0
  if (s.halbzuege >= 100) return 0

  const imSchach = s.imSchach()
  let legal = 0
  for (const z of ordne(s.pseudoZuege(), null, su.killer[ply])) {
    s.ziehe(z)
    if (s.imSchach(-s.seite)) {
      s.nimmZurueck()
      continue
    }
    legal++
    // Wer im Schach steht, hat wenig Auswahl -- eine Ebene mehr kostet kaum.
    const wert = -suche(s, tiefe - 1 + (imSchach ? 1 : 0), -beta, -alpha, su, ply + 1)
    s.nimmZurueck()
    if (su.abgebrochen) return 0
    if (wert >= beta) {
      if (!z.geschlagen) {
        const k = (su.killer[ply] ??= [])
        if (!gleich(k[0], z)) {
          k[1] = k[0]!
          k[0] = z
        }
      }
      return beta
    }
    if (wert > alpha) alpha = wert
  }
  if (legal === 0) return imSchach ? -MATT + ply : 0
  return alpha
}

export interface Bewerteter {
  zug: string
  wert: number
}

/**
 * Jeden Zug an der Wurzel genau bewerten -- für die Stufen, die sich
 * verschätzen dürfen. Ohne den ganzen Bereich wüsste man nur, welcher Zug
 * der beste ist, nicht, wie knapp die anderen dahinter liegen.
 */
function alleBewerten(s: Stellung, verlauf: readonly string[], su: Suche): Bewerteter[] {
  const ergebnis: Bewerteter[] = []
  for (const z of ordne(s.legaleZuege(), null, undefined)) {
    s.ziehe(z)
    const remis = s.halbzuege >= 100 || verlauf.filter((k) => k === s.schluessel()).length >= 2
    const wert = remis ? 0 : -suche(s, su.werte.tiefe - 1, -UNENDLICH, UNENDLICH, su, 1)
    s.nimmZurueck()
    ergebnis.push({ zug: uci(z), wert })
  }
  return ergebnis
}

/** Iterative Vertiefung: Tiefe um Tiefe, bis die Zeit um ist. */
function vertiefen(s: Stellung, verlauf: readonly string[], su: Suche): string | null {
  const zuege = s.legaleZuege()
  if (zuege.length === 0) return null
  let bester: Zug = zuege[0]!
  for (let tiefe = 1; tiefe <= su.werte.tiefe; tiefe++) {
    let alpha = -UNENDLICH
    let besterHier: Zug | null = null
    for (const z of ordne(zuege, bester, undefined)) {
      s.ziehe(z)
      const remis = s.halbzuege >= 100 || verlauf.filter((k) => k === s.schluessel()).length >= 2
      const wert = remis ? 0 : -suche(s, tiefe - 1, -UNENDLICH, -alpha, su, 1)
      s.nimmZurueck()
      if (su.abgebrochen) break
      if (wert > alpha) {
        alpha = wert
        besterHier = z
      }
    }
    // Eine abgebrochene Tiefe zählt nur, wenn sie schon einen besseren Zug fand.
    if (besterHier) bester = besterHier
    if (su.abgebrochen) break
    // Ein gefundenes Matt wird durch tieferes Suchen nicht besser.
    if (alpha > MATT - 100) break
  }
  return uci(bester)
}

export interface KiAuftrag {
  fen: string
  /** Die Schlüssel der bisherigen Stellungen -- für die Wiederholungsregel. */
  verlauf: readonly string[]
  stufe: SchachStufe
  seed: number
  /** Nur für Tests: andere Werte als die der Stufe. */
  werte?: Partial<StufenWerte>
}

/** Den Zug des Computers bestimmen. Liefert null, wenn es keinen gibt. */
export function waehleZug(auftrag: KiAuftrag): string | null {
  const werte = { ...STUFEN[auftrag.stufe], ...auftrag.werte }
  const s = Stellung.ausFen(auftrag.fen)
  const su: Suche = {
    werte,
    ende: performance.now() + werte.zeitMs,
    knoten: 0,
    abgebrochen: false,
    killer: [],
  }
  const zufall = mulberry32(auftrag.seed)

  if (werte.rauschen === 0 && werte.zufall === 0) return vertiefen(s, auftrag.verlauf, su)

  const bewertet = alleBewerten(s, auftrag.verlauf, su)
  if (bewertet.length === 0) return null
  if (zufall() < werte.zufall) return bewertet[Math.floor(zufall() * bewertet.length)]!.zug
  let bester = bewertet[0]!
  let besterWert = -Infinity
  for (const b of bewertet) {
    // Ein Matt bleibt ein Matt: Daran verschätzt sich auch der leichte nicht.
    const rausch = Math.abs(b.wert) > MATT - 100 ? 0 : (zufall() * 2 - 1) * werte.rauschen
    if (b.wert + rausch > besterWert) {
      besterWert = b.wert + rausch
      bester = b
    }
  }
  return bester.zug
}

